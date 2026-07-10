const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type"
};

const FIELD_SLUGS = {
  extLink1Name: "extlink1",
  extLink2Name: "extlink2-name",
  extLink3Name: "extlink3-name",
  extLink4Name: "extlink4-name",
  extLink1Url: "extlink1-url-2",
  extLink2Url: "extlink2-url-2",
  extLink3Url: "extlink3-url-2",
  extLink4Url: "extlink4-url",
  freeClassUrl: "freeclass-url"
};

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

    if (!token || !collectionId || !publicSiteBaseUrl || !collectionPathPrefix) {
      return sendJson(res, 500, {
        error: "Missing one or more environment variables",
        step,
        details: {
          hasWebflowToken: Boolean(token),
          hasCollectionId: Boolean(collectionId),
          hasPublicSiteBaseUrl: Boolean(publicSiteBaseUrl),
          hasCollectionPathPrefix: Boolean(collectionPathPrefix)
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

    step = "creating Webflow CMS item";

    const fieldData = {
      name: businessName,
      slug: slug,

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
      `https://api.webflow.com/v2/collections/${collectionId}/items`,
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
        error: "Webflow CMS item creation failed",
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
      note: "CMS item created. If the page does not appear immediately, publish the Webflow site once.",
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
