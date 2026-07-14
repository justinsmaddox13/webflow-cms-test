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

function getBody(req) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  return req.body || {};
}

function cleanText(value, maxLength) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

async function callSupabaseRpc({
  supabaseUrl,
  serviceRoleKey,
  functionName,
  body
}) {
  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`Supabase RPC error: ${JSON.stringify(data)}`);
  }

  return data;
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
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return sendJson(res, 500, {
        error: "Missing Supabase environment variables",
        details: {
          hasSupabaseUrl: Boolean(supabaseUrl),
          hasServiceRoleKey: Boolean(serviceRoleKey)
        }
      });
    }

    const body = getBody(req);

    const slug = cleanText(body.slug, 120);
    const visitorId = cleanText(body.visitorId, 120);
    const pagePath = cleanText(body.path, 500);
    const referrer = cleanText(body.referrer, 1000);
    const userAgent = cleanText(req.headers["user-agent"], 1000);

    if (!slug) {
      return sendJson(res, 400, {
        error: "Missing slug"
      });
    }

    if (!visitorId) {
      return sendJson(res, 400, {
        error: "Missing visitorId"
      });
    }

    const result = await callSupabaseRpc({
      supabaseUrl,
      serviceRoleKey,
      functionName: "record_page_view",
      body: {
        p_slug: slug,
        p_visitor_id: visitorId,
        p_page_path: pagePath || null,
        p_referrer: referrer || null,
        p_user_agent: userAgent || null
      }
    });

    const firstResult = Array.isArray(result) ? result[0] : null;

    return sendJson(res, 200, {
      success: true,
      tracked: Boolean(firstResult && firstResult.tracked_page_id),
      slug,
      totalViews: firstResult ? Number(firstResult.total_views || 0) : 0,
      uniqueViews: firstResult ? Number(firstResult.unique_views || 0) : 0,
      wasUnique: firstResult ? Boolean(firstResult.was_unique) : false,
      result
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "Could not record page view",
      details: error.message
    });
  }
}
