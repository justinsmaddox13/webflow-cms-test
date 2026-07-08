const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

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

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, {});
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      error: "Method not allowed"
    });
  }

  try {
    const token = process.env.WEBFLOW_API_TOKEN;
    const collectionId = process.env.WEBFLOW_COLLECTION_ID;
    const publicSiteBaseUrl = process.env.PUBLIC_SITE_BASE_URL;
    const collectionPathPrefix = process.env.COLLECTION_PATH_PREFIX;

    if (!token || !collectionId || !publicSiteBaseUrl || !collectionPathPrefix) {
      return sendJson(res, 500, {
        error: "Missing one or more environment variables"
      });
    }

    const submittedText = String(req.body?.submittedText || "").trim();

    if (!submittedText) {
      return sendJson(res, 400, {
        error: "submittedText is required"
      });
    }

    const cleanName = submittedText.slice(0, 120);
    const randomSuffix = Math.random().toString(36).slice(2, 7);
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
fielddata: {  name: cleanName,  slug,  logo: {    fileId: uploadedLogo.id,    url: uploadedLogo.hostedUrl,    alt: `${cleanName} logo`  },  "option-1": option1,  "option-2": option2,  "option-3": option3,  "option-1-link": option1Link,  "option-2-link": option2Link,  "option-3-link": option3Link}
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
      name: cleanName,
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
