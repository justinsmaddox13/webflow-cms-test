const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const IMAGE_FIELDS = [
  { key: "logoUrl", label: "Logo", slug: "logo-url", fieldType: "image" },
  { key: "heroImageUrl", label: "Hero Image", slug: "hero-image-url", fieldType: "image" },
  { key: "feature1ImageUrl", label: "Feature 1 Image", slug: "feature-1-image-url", fieldType: "image" },
  { key: "feature2ImageUrl", label: "Feature 2 Image", slug: "feature-2-image-url", fieldType: "image" },
  { key: "clientImageUrl1", label: "Client Image 1", slug: "client-image-url-1", fieldType: "image" },
  { key: "clientImageUrl2", label: "Client Image 2", slug: "client-image-url-2", fieldType: "image" },
  { key: "clientImageUrl3", label: "Client Image 3", slug: "client-image-url-3", fieldType: "image" },
  { key: "bottomHeroImageUrl", label: "Bottom Hero Image", slug: "bottom-hero-image-url", fieldType: "image" }
];

const COLOR_FIELDS = [
  { key: "subColor1", label: "SubColor 1", slug: "subcolor-1", fieldType: "color" },
  { key: "subColor2", label: "SubColor 2", slug: "subcolor-2", fieldType: "color" },
  { key: "mainColor", label: "Main Color", slug: "main-color", fieldType: "color" },
  { key: "bgColor", label: "BG Color", slug: "bg-color", fieldType: "color" }
];

const TEXT_FIELDS = [
  { key: "homePageUrl", label: "HomePage URL", slug: "homepage-url", fieldType: "url" },

  { key: "extLink1Name", label: "ExtLink1 Name", slug: "extlink1-name", fieldType: "text" },
  { key: "extLink2Name", label: "ExtLink2 Name", slug: "extlink2-name", fieldType: "text" },
  { key: "extLink3Name", label: "ExtLink3 Name", slug: "extlink3-name", fieldType: "text" },
  { key: "extLink4Name", label: "ExtLink4 Name", slug: "extlink4-name", fieldType: "text" },

  { key: "heroOfferText", label: "Hero Offer Text", slug: "hero-offer-text", fieldType: "text" },

  { key: "extLink1Url", label: "ExtLink1 URL", slug: "extlink1-url-2", fieldType: "url" },
  { key: "extLink2Url", label: "ExtLink2 URL", slug: "extlink2-url-2", fieldType: "url" },
  { key: "extLink3Url", label: "ExtLink3 URL", slug: "extlink3-url-2", fieldType: "url" },
  { key: "extLink4Url", label: "ExtLink4 URL", slug: "extlink4-url", fieldType: "url" },
  { key: "freeClassUrl", label: "FreeClass URL", slug: "freeclass-url", fieldType: "url" },

  { key: "city", label: "City", slug: "city", fieldType: "text" },
  { key: "streetAddress", label: "Street Address", slug: "street-address", fieldType: "text" },
  { key: "phone", label: "Phone", slug: "phone", fieldType: "text" },

  { key: "membershipUrl", label: "Membership URL", slug: "membership-url", fieldType: "url" },
  { key: "freeClassCta", label: "Free Class CTA", slug: "free-class-cta", fieldType: "text" },

  { key: "mainHeroHeadline", label: "Main Hero Headline", slug: "main-hero-headline", fieldType: "text" },
  { key: "heroSavingsCta", label: "Hero Savings CTA", slug: "hero-savings-cta", fieldType: "text" },
  { key: "heroSavingsSubtext", label: "Hero Savings Subtext", slug: "hero-savings-subtext", fieldType: "text" },

  { key: "feature1Title", label: "Feature 1 Title", slug: "feature-1-title", fieldType: "text" },
  { key: "feature1Blurb", label: "Feature 1 Blurb", slug: "feature-1-blurb", fieldType: "text" },

  { key: "feature2Title", label: "Feature 2 Title", slug: "feature-2-title", fieldType: "text" },
  { key: "feature2Blurb", label: "Feature 2 Blurb", slug: "feature-2-blurb", fieldType: "text" },
  { key: "feature2CtaText", label: "Feature 2 CTA Text", slug: "feature-2-cta-text", fieldType: "text" },
  { key: "feature2CtaUrl", label: "Feature 2 CTA URL", slug: "feature-2-cta-url-2", fieldType: "urlText" },

  { key: "testimonialHeader", label: "Testimonial Header", slug: "testimonial-header", fieldType: "text" },
  { key: "testimonial1Text", label: "Testimonial 1 Text", slug: "testimonial-1-text", fieldType: "text" },
  { key: "testimonial2Text", label: "Testimonial 2 Text", slug: "testimonial-2-text", fieldType: "text" },
  { key: "testimonial3Text", label: "Testimonial 3 Text", slug: "testimonial-3-text", fieldType: "text" },

  { key: "clientName1", label: "Client Name 1", slug: "client-name-1", fieldType: "text" },
  { key: "clientName2", label: "Client Name 2", slug: "client-name-2", fieldType: "text" },
  { key: "clientName3", label: "Client Name 3", slug: "client-name-3", fieldType: "text" },

  { key: "bottomHeroCta", label: "Bottom Hero CTA", slug: "bottom-hero-cta", fieldType: "text" }
];

const ALL_FIELDS = [...IMAGE_FIELDS, ...COLOR_FIELDS, ...TEXT_FIELDS];

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedImageExts = new Set(["jpg", "jpeg", "png", "webp"]);
const maxSingleImageSizeBytes = 1.25 * 1024 * 1024;

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

function validateHexColor(value, fieldName) {
  const color = String(value || "").trim();

  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error(`${fieldName} must be a valid hex color like #ffffff`);
  }

  return color.toLowerCase();
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
  pageSlug,
  fieldKey,
  fileName,
  contentType,
  buffer
}) {
  const safeFileName = cleanFileName(fileName, contentType);
  const objectPath = `page-images/${pageSlug}/${fieldKey}-${safeFileName}`;
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

async function findLiveItemBySlug({ token, collectionId, slug, label }) {
  const url =
    `https://api.webflow.com/v2/collections/${collectionId}/items/live` +
    `?limit=1&slug=${encodeURIComponent(slug)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Could not list ${label} live items: ${JSON.stringify(data)}`);
  }

  const item = Array.isArray(data.items) ? data.items[0] : null;

  if (!item) {
    throw new Error(`No ${label} item found with slug: ${slug}`);
  }

  return item;
}

async function updateLiveItemField({ token, collectionId, item, fieldSlug, value, label }) {
  const mergedFieldData = {
    ...(item.fieldData || {}),
    [fieldSlug]: value
  };

  const updatePayload = {
    id: item.id,
    fieldData: mergedFieldData
  };

  if (item.cmsLocaleId) {
    updatePayload.cmsLocaleId = item.cmsLocaleId;
  }

  const response = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}/items/live?skipInvalidFiles=true`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [updatePayload]
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Could not update ${label} item: ${JSON.stringify(data)}`);
  }

  return data;
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
    const publicCollectionId = process.env.WEBFLOW_COLLECTION_ID;
    const editCollectionId = process.env.WEBFLOW_EDIT_COLLECTION_ID;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseImageBucket = process.env.SUPABASE_LOGO_BUCKET || "Image_Bucket";

    if (
      !token ||
      !publicCollectionId ||
      !editCollectionId ||
      !supabaseUrl ||
      !supabaseServiceRoleKey ||
      !supabaseImageBucket
    ) {
      return sendJson(res, 500, {
        error: "Missing environment variables",
        step,
        details: {
          hasWebflowToken: Boolean(token),
          hasPublicCollectionId: Boolean(publicCollectionId),
          hasEditCollectionId: Boolean(editCollectionId),
          hasSupabaseUrl: Boolean(supabaseUrl),
          hasSupabaseServiceRoleKey: Boolean(supabaseServiceRoleKey),
          hasSupabaseImageBucket: Boolean(supabaseImageBucket)
        }
      });
    }

    step = "reading request body";

    const body = getBody(req);

    const pageSlug = cleanPlainText(body.slug);
    const fieldKey = cleanPlainText(body.fieldKey);

    if (!pageSlug || !fieldKey) {
      return sendJson(res, 400, {
        error: "Missing slug or fieldKey",
        step
      });
    }

    const field = ALL_FIELDS.find((item) => item.key === fieldKey);

    if (!field) {
      return sendJson(res, 400, {
        error: "Unknown fieldKey",
        step,
        details: {
          fieldKey,
          allowedFieldKeys: ALL_FIELDS.map((item) => item.key)
        }
      });
    }

    step = "preparing updated field value";

    let newValue;
    let uploadedImage = null;

    if (field.fieldType === "image") {
      const parsed = parseImageUpload(body.image, field.label);

      uploadedImage = await uploadImageToSupabase({
        supabaseUrl,
        serviceRoleKey: supabaseServiceRoleKey,
        bucket: supabaseImageBucket,
        pageSlug,
        fieldKey,
        fileName: parsed.fileName,
        contentType: parsed.contentType,
        buffer: parsed.buffer
      });

      newValue = uploadedImage.publicUrl;
    } else if (field.fieldType === "color") {
      newValue = validateHexColor(body.value, field.label);
    } else if (field.fieldType === "url" || field.fieldType === "urlText") {
      newValue = normalizeUrl(body.value, field.label);
    } else {
      newValue = cleanPlainText(body.value);

      if (!newValue) {
        throw new Error(`${field.label} is required`);
      }
    }

    step = "finding matching Webflow CMS items";

    const publicItem = await findLiveItemBySlug({
      token,
      collectionId: publicCollectionId,
      slug: pageSlug,
      label: "public"
    });

    const editItem = await findLiveItemBySlug({
      token,
      collectionId: editCollectionId,
      slug: pageSlug,
      label: "edit"
    });

    step = "updating public Webflow CMS item";

    const publicUpdate = await updateLiveItemField({
      token,
      collectionId: publicCollectionId,
      item: publicItem,
      fieldSlug: field.slug,
      value: newValue,
      label: "public"
    });

    step = "updating edit Webflow CMS item";

    const editUpdate = await updateLiveItemField({
      token,
      collectionId: editCollectionId,
      item: editItem,
      fieldSlug: field.slug,
      value: newValue,
      label: "edit"
    });

    return sendJson(res, 200, {
      success: true,
      slug: pageSlug,
      fieldKey,
      fieldSlug: field.slug,
      value: newValue,
      uploadedImage,
      publicUpdate,
      editUpdate
    });
  } catch (error) {
    console.error("Server error at step:", step, error);

    return sendJson(res, 500, {
      error: "Could not update page field",
      step,
      details: error.message
    });
  }
}
