const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const IMAGE_FIELDS = [
  { key: "logoUrl", label: "Logo", slug: "logo-url", type: "image" },
  { key: "heroImageUrl", label: "Hero Image", slug: "hero-image-url", type: "image" },
  { key: "feature1ImageUrl", label: "Feature 1 Image", slug: "feature-1-image-url", type: "image" },
  { key: "feature2ImageUrl", label: "Feature 2 Image", slug: "feature-2-image-url", type: "image" },
  { key: "clientImageUrl1", label: "Client Image 1", slug: "client-image-url-1", type: "image" },
  { key: "clientImageUrl2", label: "Client Image 2", slug: "client-image-url-2", type: "image" },
  { key: "clientImageUrl3", label: "Client Image 3", slug: "client-image-url-3", type: "image" },
  { key: "bottomHeroImageUrl", label: "Bottom Hero Image", slug: "bottom-hero-image-url", type: "image" }
];

const COLOR_FIELDS = [
  { key: "subColor1", label: "SubColor 1", slug: "subcolor-1", type: "color" },
  { key: "subColor2", label: "SubColor 2", slug: "subcolor-2", type: "color" },
  { key: "mainColor", label: "Main Color", slug: "main-color", type: "color" },
  { key: "bgColor", label: "BG Color", slug: "bg-color", type: "color" }
];

const TEXT_FIELDS = [
  { key: "homePageUrl", label: "HomePage URL", slug: "homepage-url", type: "text" },

  { key: "extLink1Name", label: "ExtLink1 Name", slug: "extlink1-name", type: "text" },
  { key: "extLink2Name", label: "ExtLink2 Name", slug: "extlink2-name", type: "text" },
  { key: "extLink3Name", label: "ExtLink3 Name", slug: "extlink3-name", type: "text" },
  { key: "extLink4Name", label: "ExtLink4 Name", slug: "extlink4-name", type: "text" },

  { key: "heroOfferText", label: "Hero Offer Text", slug: "hero-offer-text", type: "text" },

  { key: "extLink1Url", label: "ExtLink1 URL", slug: "extlink1-url-2", type: "text" },
  { key: "extLink2Url", label: "ExtLink2 URL", slug: "extlink2-url-2", type: "text" },
  { key: "extLink3Url", label: "ExtLink3 URL", slug: "extlink3-url-2", type: "text" },
  { key: "extLink4Url", label: "ExtLink4 URL", slug: "extlink4-url", type: "text" },
  { key: "freeClassUrl", label: "FreeClass URL", slug: "freeclass-url", type: "text" },

  { key: "city", label: "City", slug: "city", type: "text" },
  { key: "streetAddress", label: "Street Address", slug: "street-address", type: "text" },
  { key: "phone", label: "Phone", slug: "phone", type: "text" },

  { key: "membershipUrl", label: "Membership URL", slug: "membership-url", type: "text" },
  { key: "freeClassCta", label: "Free Class CTA", slug: "free-class-cta", type: "text" },

  { key: "mainHeroHeadline", label: "Main Hero Headline", slug: "main-hero-headline", type: "textarea" },
  { key: "heroSavingsCta", label: "Hero Savings CTA", slug: "hero-savings-cta", type: "text" },
  { key: "heroSavingsSubtext", label: "Hero Savings Subtext", slug: "hero-savings-subtext", type: "textarea" },

  { key: "feature1Title", label: "Feature 1 Title", slug: "feature-1-title", type: "text" },
  { key: "feature1Blurb", label: "Feature 1 Blurb", slug: "feature-1-blurb", type: "textarea" },

  { key: "feature2Title", label: "Feature 2 Title", slug: "feature-2-title", type: "text" },
  { key: "feature2Blurb", label: "Feature 2 Blurb", slug: "feature-2-blurb", type: "textarea" },
  { key: "feature2CtaText", label: "Feature 2 CTA Text", slug: "feature-2-cta-text", type: "text" },
  { key: "feature2CtaUrl", label: "Feature 2 CTA URL", slug: "feature-2-cta-url-2", type: "text" },

  { key: "testimonialHeader", label: "Testimonial Header", slug: "testimonial-header", type: "text" },
  { key: "testimonial1Text", label: "Testimonial 1 Text", slug: "testimonial-1-text", type: "textarea" },
  { key: "testimonial2Text", label: "Testimonial 2 Text", slug: "testimonial-2-text", type: "textarea" },
  { key: "testimonial3Text", label: "Testimonial 3 Text", slug: "testimonial-3-text", type: "textarea" },

  { key: "clientName1", label: "Client Name 1", slug: "client-name-1", type: "text" },
  { key: "clientName2", label: "Client Name 2", slug: "client-name-2", type: "text" },
  { key: "clientName3", label: "Client Name 3", slug: "client-name-3", type: "text" },

  { key: "bottomHeroCta", label: "Bottom Hero CTA", slug: "bottom-hero-cta", type: "text" }
];

function sendJson(res, status, data) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(status).json(data);
}

function getAllFields() {
  return [...IMAGE_FIELDS, ...COLOR_FIELDS, ...TEXT_FIELDS];
}

async function findLiveItemBySlug({ token, collectionId, slug }) {
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
    throw new Error(`Could not list live items: ${JSON.stringify(data)}`);
  }

  const item = Array.isArray(data.items) ? data.items[0] : null;

  if (!item) {
    throw new Error(`No public page found with slug: ${slug}`);
  }

  return item;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, {});
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, {
      error: "Method not allowed"
    });
  }

  try {
    const token = process.env.WEBFLOW_API_TOKEN;
    const publicCollectionId = process.env.WEBFLOW_COLLECTION_ID;
    const publicSiteBaseUrl = process.env.PUBLIC_SITE_BASE_URL;
    const publicCollectionPathPrefix = process.env.COLLECTION_PATH_PREFIX;

    if (!token || !publicCollectionId || !publicSiteBaseUrl || !publicCollectionPathPrefix) {
      return sendJson(res, 500, {
        error: "Missing environment variables",
        details: {
          hasWebflowToken: Boolean(token),
          hasPublicCollectionId: Boolean(publicCollectionId),
          hasPublicSiteBaseUrl: Boolean(publicSiteBaseUrl),
          hasPublicCollectionPathPrefix: Boolean(publicCollectionPathPrefix)
        }
      });
    }

    const slug = String(req.query.slug || "").trim();

    if (!slug) {
      return sendJson(res, 400, {
        error: "Missing slug"
      });
    }

    const item = await findLiveItemBySlug({
      token,
      collectionId: publicCollectionId,
      slug
    });

    const fieldData = item.fieldData || {};

    const baseUrl = publicSiteBaseUrl.replace(/\/$/, "");
    const publicPrefix = publicCollectionPathPrefix.replace(/^\/?/, "/").replace(/\/?$/, "/");

    return sendJson(res, 200, {
      success: true,
      slug,
      itemId: item.id,
      publicPageUrl: `${baseUrl}${publicPrefix}${slug}`,
      fieldData,
      fields: getAllFields().map((field) => ({
        ...field,
        value: fieldData[field.slug] || ""
      }))
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "Could not get page data",
      details: error.message
    });
  }
}
