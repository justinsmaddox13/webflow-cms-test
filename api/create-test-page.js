import { createHash } from "crypto";
import { imageSize } from "image-size";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  const base = String(fileName || "logo")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "logo";

  return `${base}-${Date.now()}.${ext}`;
}

function normalizeUrl(value, fieldName) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  const url = new URL(trimmed);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${fieldName} must be an http or https URL`);
  }

  return url.href;
}

async function uploadAssetToWebflow({ token, siteId, fileName, contentType, buffer }) {
  const fileHash = createHash("md5").update(buffer).digest("hex");

  const createAssetResponse = await fetch(`https://api.webflow.com/v2/sites/${siteId}/assets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileName,
      fileHash
    })
  });

  const asset = await createAssetResponse.json().catch(() => ({}));

  if (!createAssetResponse.ok) {
    throw new Error(`Webflow asset creation failed: ${JSON.stringify(asset)}`);
  }

  const formData = new FormData();

  Object.entries(asset.uploadDetails || {}).forEach(([key, value]) => {
    formData.append(key, value);
  });

  formData.append("file", new Blob([buffer], { type: contentType }), fileName);

  const uploadResponse = await fetch(asset.uploadUrl, {
    method: "POST",
    body: formData
  });

  if (!uploadResponse.ok) {
    const uploadText = await uploadResponse.text().catch(() => "");
    throw new Error(`Asset file upload failed: ${uploadResponse.status} ${uploadText}`);
  }

  return asset;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, {});
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const token = process.env.WEBFLOW_API_TOKEN;
    const collectionId = process.env.WEBFLOW_COLLECTION_ID;
    const siteId = process.env.WEBFLOW_SITE_ID;
    const publicSiteBaseUrl = process.env.PUBLIC_SITE_BASE_URL;
    const collectionPathPrefix = process.env.COLLECTION_PATH_PREFIX;

    if (!token || !collectionId || !siteId || !publicSiteBaseUrl || !collectionPathPrefix) {
      return sendJson(res, 500, {
        error: "Missing one or more environment variables"
      });
    }

    const body = getBody(req);

    const option1 = String(body.option1 || "").trim();
    const option2 = String(body.option2 || "").trim();
    const option3 = String(body.option3 || "").trim();

    if (!option1 || !option2 || !option3) {
      return sendJson(res, 400, {
        error: "Option 1, Option 2, and Option 3 are required"
      });
    }

    const option1Link = normalizeUrl(body.option1Link, "Option 1 Link");
    const option2Link = normalizeUrl(body.option2Link, "Option 2 Link");
    const option3Link = normalizeUrl(body.option3Link, "Option 3 Link");

    const logo = body.logo || {};
    const fileName = String(logo.fileName || "");
    const contentType = String(logo.contentType || "").toLowerCase();
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (!allowedTypes.has(contentType) || !allowedExts.has(ext)) {
      return sendJson(res, 400, {
        error: "Logo must be a JPG, PNG, or WebP file"
      });
    }

    const match = String(logo.dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);

    if (!match) {
      return sendJson(res, 400, {
        error: "Invalid logo upload"
      });
    }

    const buffer = Buffer.from(match[2], "base64");

    if (buffer.byteLength > 4 * 1024 * 1024) {
      return sendJson(res, 400, {
        error: "Logo must be 4 MB or smaller"
      });
    }

    const dimensions = imageSize(buffer);

    if (
      dimensions.width < minWidth ||
      dimensions.width > maxWidth ||
      dimensions.height < minHeight ||
      dimensions.height > maxHeight
    ) {
      return sendJson(res, 400, {
        error: `Logo must be between ${minWidth}-${maxWidth}px wide and ${minHeight}-${maxHeight}px tall`,
        actual: {
          width: dimensions.width,
          height: dimensions.height
        }
      });
    }

    const uploadedLogo = await uploadAssetToWebflow({
      token,
      siteId,
      fileName: cleanFileName(fileName, contentType),
      contentType,
      buffer
    });

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
            slug,
            logo: {
              fileId: uploadedLogo.id,
              url: uploadedLogo.hostedUrl,
              alt: `${cleanName} logo`
            },
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
      webflowResponse: data
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "Server error",
      details: error.message
    });
  }
}
}
