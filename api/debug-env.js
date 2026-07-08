export default async function handler(req, res) {
  res.status(200).json({
    hasWebflowToken: Boolean(process.env.WEBFLOW_API_TOKEN),
    webflowSiteId: process.env.WEBFLOW_SITE_ID || null,
    webflowCollectionId: process.env.WEBFLOW_COLLECTION_ID || null,
    publicSiteBaseUrl: process.env.PUBLIC_SITE_BASE_URL || null,
    collectionPathPrefix: process.env.COLLECTION_PATH_PREFIX || null
  });
}
