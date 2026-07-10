export default async function handler(req, res) {
  try {
    const token = process.env.WEBFLOW_API_TOKEN;
    const collectionId = process.env.WEBFLOW_COLLECTION_ID;

    if (!token || !collectionId) {
      return res.status(500).json({
        error: "Missing WEBFLOW_API_TOKEN or WEBFLOW_COLLECTION_ID",
        hasToken: Boolean(token),
        hasCollectionId: Boolean(collectionId)
      });
    }

    const response = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json().catch(() => ({}));

    return res.status(response.status).json({
      ok: response.ok,
      status: response.status,
      collectionId,
      name: data.displayName || data.name || null,
      slug: data.slug || null,
      fields: data.fields || data.fieldData || data
    });
  } catch (error) {
    return res.status(500).json({
      error: "Debug endpoint failed",
      details: error.message
    });
  }
}
