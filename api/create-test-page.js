const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type"
};

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExts = new Set(["jpg", "jpeg", "png", "webp"]);

const minWidth = 648;
const maxWidth = 972;
const minHeight = 120;
const maxHeight = 180;

function sendJson(res, status, data) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(status).json(data);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function getBody(req) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  return req.body || {};
}

function cleanFileName(fileName, contentType) {
  const ext = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];

  const base =
    String(fileName || "logo")
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "logo";

  return `${base}-${Date.now()}.${ext}`;
}

function normalizeUrl(value, fieldName) {
  let trimmed = String(value || "").trim();

  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = "https://" + trimmed;
  }

  let url;

  try {
    url = new URL(trimmed);
  } catch (error) {
    throw new Error(`${fieldName} must be a valid URL`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${fieldName} must be an http or https URL`);
  }

  return url.href;
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function getImageDimensions(buffer, contentType) {
  if (contentType === "image/png") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }

  if (contentType === "image/jpeg") {
    let offset = 2;

    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        break;
      }

      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);

      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7)
        };
      }

      offset += 2 + length;
    }
  }

  if (contentType === "image/webp") {
    const format = buffer.toString("ascii", 12, 16);

    if (format === "VP8X") {
      return {
        width: 1 + readUInt24LE(buffer, 24),
        height: 1 + readUInt24LE(buffer, 27)
      };
    }

    if (format === "VP8 ") {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff
      };
    }

    if (format === "VP8L") {
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];

      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
      };
    }
  }

  throw new Error("Could not read logo dimensions");
}

async function uploadLogoToSupabase({
  supabaseUrl,
  serviceRoleKey,
  bucket,
  fileName,
  contentType,
  buffer
}) {
  const objectPath = `logos/${cleanFileName(fileName, contentType)}`;

  const uploadUrl =
    `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${objectPath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": contentType,
      "x-upsert": "false"
    },
    body: buffer
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Supabase logo upload failed: ${JSON.stringify(data)}`);
  }

  const publicUrl =
    `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${objectPath}`;

  return {
    objectPath,
    publicUrl,
    storageResponse: data
  };
}

export default async function handler(req, res) {
  let step = "starting";

  if (req.method === "OPTIONS") {
    return sendJson(res, 200, {});
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      error: "Method not allowed"
    });
  }

  try {
    step = "checking environment variables";

    const token = process.env.WEBFLOW_API_TOKEN;
    const collectionId = process.env.WEBFLOW_COLLECTION_ID;
    const publicSiteBaseUrl = process.env.PUBLIC_SITE_BASE_URL;
    const collectionPathPrefix = process.env.COLLECTION_PATH_PREFIX;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseLogoBucket = process.env.SUPABASE_LOGO_BUCKET || "logos";

    if (
      !token ||
      !collectionId ||
      !publicSiteBaseUrl ||
      !collectionPathPrefix ||
      !supabaseUrl ||
      !supabaseServiceRoleKey ||
      !supabaseLogoBucket
    ) {
      return sendJson(res, 500, {
        error: "Missing one or more environment variables",
        step,
        details: {
          hasWebflowToken: Boolean(token),
          hasCollectionId: Boolean(collectionId),
          hasPublicSiteBaseUrl: Boolean(publicSiteBaseUrl),
          hasCollectionPathPrefix: Boolean(collectionPathPrefix),
          hasSupabaseUrl: Boolean(supabaseUrl),
          hasSupabaseServiceRoleKey: Boolean(supabaseServiceRoleKey),
          hasSupabaseLogoBucket: Boolean(supabaseLogoBucket)
        }
      });
    }

    step = "reading request body";

    const body = getBody(req);

    const option1 = String(body.option1 || "").trim();
    const option2 = String(body.option2 || "").trim();
    const option3 = String(body.option3 || "").trim();

    if (!option1 || !option2 || !option3) {
      return sendJson(res, 400, {
        error: "Option 1, Option 2, and Option 3 are required",
        step
      });
    }

    const option1Link = normalizeUrl(body.option1Link, "Option 1 Link");
    const option2Link = normalizeUrl(body.option2Link, "Option 2 Link");
    const option3Link = normalizeUrl(body.option3Link, "Option 3 Link");

    step = "validating logo file";

    const logo = body.logo || {};
    const fileName = String(logo.fileName || "");
    const contentType = String(logo.contentType || "").toLowerCase();
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (!allowedTypes.has(contentType) || !allowedExts.has(ext)) {
      return sendJson(res, 400, {
        error: "Logo must be a JPG, PNG, or WebP file",
        step,
        details: {
          fileName,
          contentType,
          ext
        }
      });
    }

    const match = String(logo.dataUrl || "").match(
      /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i
    );

    if (!match) {
      return sendJson(res, 400, {
        error: "Invalid logo upload",
        step
      });
    }

    const buffer = Buffer.from(match[2], "base64");

    if (buffer.byteLength > 4 * 1024 * 1024) {
      return sendJson(res, 400, {
        error: "Logo must be 4 MB or smaller",
        step,
        details: {
          sizeBytes: buffer.byteLength
        }
      });
    }

    step = "checking logo dimensions";

    const dimensions = getImageDimensions(buffer, contentType);

    if (
      dimensions.width < minWidth ||
      dimensions.width > maxWidth ||
      dimensions.height < minHeight ||
      dimensions.height > maxHeight
    ) {
      return sendJson(res, 400, {
        error: `Logo must be between ${minWidth}-${maxWidth}px wide and ${minHeight}-${maxHeight}px tall`,
        step,
        actual: {
          width: dimensions.width,
          height: dimensions.height
        }
      });
    }

    step = "uploading logo to Supabase Storage";

    const uploadedLogo = await uploadLogoToSupabase({
      supabaseUrl,
      serviceRoleKey: supabaseServiceRoleKey,
      bucket: supabaseLogoBucket,
      fileName,
      contentType,
      buffer
    });

    step = "creating Webflow CMS item";

    const randomSuffix = Math.random().toString(36).slice(2, 7);
    const cleanName = `${option1} ${option2} ${option3}`.slice(0, 120);
    const slug = `${slugify(cleanName) || "test-page"}-${randomSuffix}`;

    const response = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items/live`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          isArchived: false,
          isDraft: false,
          fieldData: {
            name: cleanName,
            slug: slug,
            "logo-url": uploadedLogo.publicUrl,
            "option-1": option1,
            "option-2": option2,
            "option-3": option3,
            "option-1-link": option1Link,
            "option-2-link": option2Link,
            "option-3-link": option3Link
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: "Webflow CMS item creation failed",
        step,
        details: data
      });
    }

    const baseUrl = publicSiteBaseUrl.replace(/\/$/, "");
    const prefix = collectionPathPrefix.replace(/^\/?/, "/").replace(/\/?$/, "/");
    const pageUrl = `${baseUrl}${prefix}${slug}`;

    return sendJson(res, 200, {
      success: true,
      slug,
      pageUrl,
      logo: {
        fileName,
        width: dimensions.width,
        height: dimensions.height,
        publicUrl: uploadedLogo.publicUrl,
        objectPath: uploadedLogo.objectPath
      },
      webflowResponse: data
    });
  } catch (error) {
    console.error("Server error at step:", step, error);

    return sendJson(res, 500, {
      error: "Server error",
      step,
      details: error.message
    });
  }
}
