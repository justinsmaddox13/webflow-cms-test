const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type"
};

const IMAGE_FIELDS = [
  { key: "logoUrl", label: "Logo", slug: "logo-url" },
  { key: "heroImageUrl", label: "Hero Image", slug: "hero-image-url" },
  { key: "feature1ImageUrl", label: "Feature 1 Image", slug: "feature-1-image-url" },
  { key: "feature2ImageUrl", label: "Feature 2 Image", slug: "feature-2-image-url" },
  { key: "clientImageUrl1", label: "Client Image 1", slug: "client-image-url-1" },
  { key: "clientImageUrl2", label: "Client Image 2", slug: "client-image-url-2" },
  { key: "clientImageUrl3", label: "Client Image 3", slug: "client-image-url-3" },
  { key: "bottomHeroImageUrl", label: "Bottom Hero Image", slug: "bottom-hero-image-url" }
];

const TEXT_FIELDS = [
  { key: "homePageUrl", label: "HomePage URL", slug: "homepage-url", kind: "url" },

  { key: "extLink1Name", label: "ExtLink1 Name", slug: "extlink1-name", kind: "text" },
  { key: "extLink2Name", label: "ExtLink2 Name", slug: "extlink2-name", kind: "text" },
  { key: "extLink3Name", label: "ExtLink3 Name", slug: "extlink3-name", kind: "text" },
  { key: "extLink4Name", label: "ExtLink4 Name", slug: "extlink4-name", kind: "text" },

  { key: "heroOfferText", label: "Hero Offer Text", slug: "hero-offer-text", kind: "text" },

  { key: "extLink1Url", label: "ExtLink1 URL", slug: "extlink1-url-2", kind: "url" },
  { key: "extLink2Url", label: "ExtLink2 URL", slug: "extlink2-url-2", kind: "url" },
  { key: "extLink3Url", label: "ExtLink3 URL", slug: "extlink3-url-2", kind: "url" },
  { key: "extLink4Url", label: "ExtLink4 URL", slug: "extlink4-url", kind: "url" },
  { key: "freeClassUrl", label: "FreeClass URL", slug: "freeclass-url", kind: "url" },

  { key: "city", label: "City", slug: "city", kind: "text" },
  { key: "streetAddress", label: "Street Address", slug: "street-address", kind: "text" },
  { key: "phone", label: "Phone", slug: "phone", kind: "text" },

  { key: "membershipUrl", label: "Membership URL", slug: "membership-url", kind: "url" },
  { key: "freeClassCta", label: "Free Class CTA", slug: "free-class-cta", kind: "text" },

  { key: "mainHeroHeadline", label: "Main Hero Headline", slug: "main-hero-headline", kind: "text" },
  { key: "heroSavingsCta", label: "Hero Savings CTA", slug: "hero-savings-cta", kind: "text" },
  { key: "heroSavingsSubtext", label: "Hero Savings Subtext", slug: "hero-savings-subtext", kind: "text" },

  { key: "feature1Title", label: "Feature 1 Title", slug: "feature-1-title", kind: "text" },
  { key: "feature1Blurb", label: "Feature 1 Blurb", slug: "feature-1-blurb", kind: "text" },

  { key: "feature2Title", label: "Feature 2 Title", slug: "feature-2-title", kind: "text" },
  { key: "feature2Blurb", label: "Feature 2 Blurb", slug: "feature-2-blurb", kind: "text" },
  { key: "feature2CtaText", label: "Feature 2 CTA Text", slug: "feature-2-cta-text", kind: "text" },
  { key: "feature2CtaUrl", label: "Feature 2 CTA URL", slug: "feature-2-cta-url", kind: "urlText" },

  { key: "testimonialHeader", label: "Testimonial Header", slug: "testimonial-header", kind: "text" },
  { key: "testimonial1Text", label: "Testimonial 1 Text", slug: "testimonial-1-text", kind: "text" },
  { key: "testimonial2Text", label: "Testimonial 2 Text", slug: "testimonial-2-text", kind: "text" },
  { key: "testimonial3Text", label: "Testimonial 3 Text", slug: "testimonial-3-text", kind: "text" },

  { key: "clientName1", label: "Client Name 1", slug: "client-name-1", kind: "text" },
  { key: "clientName2", label: "Client Name 2", slug: "client-name-2", kind: "text" },
  { key: "clientName3", label: "Client Name 3", slug: "client-name-3", kind: "text" },

  { key: "bottomHeroCta", label: "Bottom Hero CTA", slug: "bottom-hero-cta", kind: "text" }
];

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedImageExts = new Set(["jpg", "jpeg", "png", "webp"]);

const maxSingleImageSizeBytes = 1.25 * 1024 * 1024;
const maxTotalImageSizeBytes = 3.5 * 1024 * 1024;

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

function cleanPlainText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value, fieldName) {
  let trimmed = cleanPlainText(value);

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
    String(fileName || "image")
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image";

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

function parseImageUpload(image, label) {
  const fileName = String(image?.fileName || "");
  const contentType = String(image?.contentType || "").toLowerCase();
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (!fileName || !contentType || !image?.dataUrl) {
    throw new Error(`${label} upload is required`);
  }

  if (!allowedImageTypes.has(contentType) || !allowedImageExts.has(ext)) {
    throw new Error(`${label} must be a JPG, PNG, or WebP file`);
  }

  const match = String(image.dataUrl || "").match(
    /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i
  );

  if (!match) {
    throw new Error(`${label} upload is invalid`);
  }

  const buffer = Buffer.from(match[2], "base64");

  if (buffer.byteLength > maxSingleImageSizeBytes) {
    throw new Error(`${label} is too large. Max size is 1.25 MB.`);
  }

  return {
    fileName,
    contentType,
    buffer,
    sizeBytes: buffer.byteLength
  };
}

async function uploadImageToSupabase({
  supabaseUrl,
  serviceRoleKey,
  bucket,
  businessSlug,
  fieldKey,
  fileName,
  contentType,
  buffer
}) {
  const safeFileName = cleanFileName(fileName, contentType);
  const objectPath = `page-images/${businessSlug}/${fieldKey}-${safeFileName}`;
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
    throw new Error(`Supabase upload failed for ${fieldKey}: ${JSON.stringify(data)}`);
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
    const supabaseImageBucket = process.env.SUPABASE_LOGO_BUCKET || "Image_Bucket";

    if (
      !token ||
      !collectionId ||
      !publicSiteBaseUrl ||
      !collectionPathPrefix ||
      !supabaseUrl ||
      !supabaseServiceRoleKey ||
      !supabaseImageBucket
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
          hasSupabaseImageBucket: Boolean(supabaseImageBucket)
        }
      });
    }

    step = "reading request body";

    const body = getBody(req);

    const businessName = cleanPlainText(body.businessName);

    if (!businessName) {
      return sendJson(res, 400, {
        error: "Business / Page Name is required",
        step
      });
    }

    const slug = slugify(businessName);

    if (!slug) {
      return sendJson(res, 400, {
        error: "Business / Page Name could not be converted into a valid slug",
        step,
        details: {
          businessName
        }
      });
    }

    const fields = body.fields || {};
    const images = body.images || {};

    const fieldData = {
      name: businessName,
      slug: slug
    };

    const missingTextFields = [];

    for (const field of TEXT_FIELDS) {
      const rawValue = cleanPlainText(fields[field.key]);

      if (!rawValue) {
        missingTextFields.push(field.label);
        continue;
      }

      if (field.kind === "url" || field.kind === "urlText") {
        fieldData[field.slug] = normalizeUrl(rawValue, field.label);
      } else {
        fieldData[field.slug] = rawValue;
      }
    }

    if (missingTextFields.length > 0) {
      return sendJson(res, 400, {
        error: "Missing required text/link fields",
        step,
        details: {
          missingTextFields
        }
      });
    }

    step = "checking Webflow collection schema";

    const schema = await getCollectionSchema({
      token,
      collectionId
    });

    const requiredCustomSlugs = [
      ...TEXT_FIELDS.map((field) => field.slug),
      ...IMAGE_FIELDS.map((field) => field.slug)
    ];

    const missingSlugs = requiredCustomSlugs.filter(
      (slug) => !schema.fieldSlugs.includes(slug)
    );

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

    step = "validating image uploads";

    const parsedImages = {};
    let totalImageBytes = 0;

    for (const imageField of IMAGE_FIELDS) {
      const parsed = parseImageUpload(
        images[imageField.key],
        imageField.label
      );

      parsedImages[imageField.key] = parsed;
      totalImageBytes += parsed.sizeBytes;
    }

    if (totalImageBytes > maxTotalImageSizeBytes) {
      return sendJson(res, 400, {
        error: "Total image upload size is too large",
        step,
        details: {
          maxTotalMB: 3.5,
          totalImageBytes
        }
      });
    }

    step = "uploading images to Supabase Storage";

    const uploadedImages = {};

    for (const imageField of IMAGE_FIELDS) {
      const parsed = parsedImages[imageField.key];

      const uploaded = await uploadImageToSupabase({
        supabaseUrl,
        serviceRoleKey: supabaseServiceRoleKey,
        bucket: supabaseImageBucket,
        businessSlug: slug,
        fieldKey: imageField.key,
        fileName: parsed.fileName,
        contentType: parsed.contentType,
        buffer: parsed.buffer
      });

      uploadedImages[imageField.key] = uploaded;
      fieldData[imageField.slug] = uploaded.publicUrl;
    }

    step = "creating live Webflow CMS item";

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
      uploadedImages: Object.fromEntries(
        Object.entries(uploadedImages).map(([key, value]) => [
          key,
          {
            publicUrl: value.publicUrl,
            objectPath: value.objectPath
          }
        ])
      ),
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
