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
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return {};
    }
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
    const clickName = cleanText(body.clickName, 160);
    const clickUrl = cleanText(body.clickUrl, 1000);
    const visitorId = cleanText(body.visitorId, 120);
    const pagePath = cleanText(body.path, 500);
    const referrer = cleanText(body.referrer, 1000);
    const userAgent = cleanText(req.headers["user-agent"], 1000);

    if (!slug) {
      return sendJson(res, 400, {
        error: "Missing slug"
      });
    }

    if (!clickName) {
      return sendJson(res, 400, {
        error: "Missing clickName"
      });
    }

    const result = await callSupabaseRpc({
      supabaseUrl,
      serviceRoleKey,
      functionName: "record_page_click",
      body: {
        p_slug: slug,
        p_click_name: clickName,
        p_click_url: clickUrl || null,
        p_visitor_id: visitorId || null,
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
      clickName,
      totalClickThroughs: firstResult
        ? Number(firstResult.total_click_throughs || 0)
        : 0,
      result
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "Could not record page click",
      details: error.message
    });
  }
}
