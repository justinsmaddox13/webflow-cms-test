const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type"
};

const FIELD_SLUGS = {
  logoUrl: "logo-url",
  extLink1Name: "extlink1-name",
  extLink2Name: "extlink2-name",
  extLink3Name: "extlink3-name",
  extLink4Name: "extlink4-name",
  extLink1Url: "extlink1-url-2",
  extLink2Url: "extlink2-url-2",
  extLink3Url: "extlink3-url-2",
  extLink4Url: "extlink4-url",
  freeClassUrl: "freeclass-url"
};

const allowedLogoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedLogoExts = new Set(["jpg", "jpeg", "png", "webp"]);
const maxLogoSizeBytes = 2.5 * 1024 * 1024;

function sendJson(res, status, data) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(status).json(data);
}

function getBody(req) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  return req.body || {};
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

function cleanFileName(fileName, contentType) {
  const ext = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];

  const base =
    String(fileName || "logo")
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "logo";

  return `${base}-${Date.now()}.${ext}`;
}

async function getCollectionSchema({ token, collectionId }) {
  const response = await fetch(`https://api.webflow.com/v2/collections/${collectionId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Could not fetch Webflow collection schema: ${JSON.stringify(data)}`);
  }

  const fields = Array.isArray(data.fields) ? data.fields : [];
  const slugs = fields.map((field) => field.slug).filter(Boolean);

  return {
    collectionName: data.displayName || data.name || null,
    collectionSlug: data.slug || null,
    fieldSlugs: slugs,
    raw: data
  };
}

async function uploadLogoToSupabase({
  supabaseUrl,
  serviceRoleKey,
  bucket,
  businessSlug,
  fileName,
  contentType,
  buffer
}) {
  const safeFileName = cleanFileName(fileName, contentType);
  const objectPath = `logos/${businessSlug}/${safeFileName}`;

  const cleanSupabaseUrl = supabaseUrl.replace(/\/$/, "");

  const uploadUrl =
    `${cleanSupabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
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
    `${cleanSupabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;

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
    const supabaseLogoBucket = process.env.SUPABASE_LOGO_BUCKET || "Image_Bucket";

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

    const businessName = String(body.businessName || "").trim();

    const extLink1Name = String(body.extLink1Name || "").trim();
    const extLink2Name = String(body.extLink2Name || "").trim();
    const extLink3Name = String(body.extLink3Name || "").trim();
    const extLink4Name = String(body.extLink4Name || "").trim();

    if (!businessName || !extLink1Name || !extLink2Name || !extLink3Name || !extLink4Name) {
      return sendJson(res, 400, {
        error: "Missing required text fields",
        step,
        details: {
          hasBusinessName: Boolean(businessName),
          hasExtLink1Name: Boolean(extLink1Name),
          hasExtLink2Name: Boolean(extLink2Name),
          hasExtLink3Name: Boolean(extLink3Name),
          hasExtLink4Name: Boolean(extLink4Name)
        }
      });
    }

    const slug = slugify(businessName);

    if (!slug) {
      return sendJson(res, 400, {
        error: "Business/Page Name could not be converted into a valid slug",
        step,
        details: {
          businessName
        }
      });
    }

    const extLink1Url = normalizeUrl(body.extLink1Url, "ExtLink1 URL");
    const extLink2Url = normalizeUrl(body.extLink2Url, "ExtLink2 URL");
    const extLink3Url = normalizeUrl(body.extLink3Url, "ExtLink3 URL");
    const extLink4Url = normalizeUrl(body.extLink4Url, "ExtLink4 URL");
    const freeClassUrl = normalizeUrl(body.freeClassUrl, "FreeClass URL");

    step = "validating logo file";

    const logo = body.logo || {};
    const fileName = String(logo.fileName || "");
    const contentType = String(logo.contentType || "").toLowerCase();
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (!fileName || !contentType || !logo.dataUrl) {
      return sendJson(res, 400, {
        error: "Logo upload is required",
        step
      });
    }

    if (!allowedLogoTypes.has(contentType) || !allowedLogoExts.has(ext)) {
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

    if (buffer.byteLength > maxLogoSizeBytes) {
      return sendJson(res, 400, {
        error: "Logo file is too large",
        step,
        details: {
          maxSizeMB: 2.5,
          actualSizeBytes: buffer.byteLength
        }
      });
    }

    step = "checking Webflow collection schema";

    const schema = await getCollectionSchema({
      token,
      collectionId
    });

    const requiredCustomSlugs = Object.values(FIELD_SLUGS);
    const missingSlugs = requiredCustomSlugs.filter((slug) => !schema.fieldSlugs.includes(slug));

    if (missingSlugs.length > 0) {
      return sendJson(res, 400, {
        error: "Vercel/Webflow is not seeing the expected CMS fields",
        step,
        details: {
          collectionId,
          collectionName: schema.collectionName,
          collectionSlug: schema.collectionSlug,
          expectedSlugs: requiredCustomSlugs,
          missingSlugs,
          slugsWebflowReturned: schema.fieldSlugs
        }
      });
    }

    step = "uploading logo to Supabase Storage";

    const uploadedLogo = await uploadLogoToSupabase({
      supabaseUrl,
      serviceRoleKey: supabaseServiceRoleKey,
      bucket: supabaseLogoBucket,
      businessSlug: slug,
      fileName,
      contentType,
      buffer
    });

    step = "creating live Webflow CMS item";

    const fieldData = {
      name: businessName,
      slug: slug,

      [FIELD_SLUGS.logoUrl]: uploadedLogo.publicUrl,

      [FIELD_SLUGS.extLink1Name]: extLink1Name,
      [FIELD_SLUGS.extLink2Name]: extLink2Name,
      [FIELD_SLUGS.extLink3Name]: extLink3Name,
      [FIELD_SLUGS.extLink4Name]: extLink4Name,

      [FIELD_SLUGS.extLink1Url]: extLink1Url,
      [FIELD_SLUGS.extLink2Url]: extLink2Url,
      [FIELD_SLUGS.extLink3Url]: extLink3Url,
      [FIELD_SLUGS.extLink4Url]: extLink4Url,
      [FIELD_SLUGS.freeClassUrl]: freeClassUrl
    };

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
          fieldData
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: "Webflow live CMS item creation failed",
        step,
        details: data,
        collectionId,
        collectionName: schema.collectionName,
        collectionSlug: schema.collectionSlug,
        slugsWebflowReturned: schema.fieldSlugs,
        fieldDataAttempted: fieldData
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
        contentType,
        sizeBytes: buffer.byteLength,
        publicUrl: uploadedLogo.publicUrl,
        objectPath: uploadedLogo.objectPath
      },
      note: "Live CMS item created.",
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
