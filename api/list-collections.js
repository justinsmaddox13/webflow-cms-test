const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function sendJson(res, status, data) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(status).json(data);
}

async function webflowFetch(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(JSON.stringify({
      status: response.status,
      data
    }));
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, {});
  }

  try {
    const token = process.env.WEBFLOW_API_TOKEN;

    if (!token) {
      return sendJson(res, 500, {
        error: "Missing WEBFLOW_API_TOKEN"
      });
    }

    const sitesData = await webflowFetch("https://api.webflow.com/v2/sites", token);
    const sites = sitesData.sites || [];

    const output = [];

    for (const site of sites) {
      const siteId = site.id;

      const collectionsData = await webflowFetch(
        `https://api.webflow.com/v2/sites/${siteId}/collections`,
        token
      );

      output.push({
        siteName: site.displayName,
        siteId,
        collections: collectionsData.collections || []
      });
    }

    return sendJson(res, 200, output);
  } catch (error) {
    return sendJson(res, 500, {
      error: "Failed to list collections",
      details: error.message
    });
  }
}
