function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, status, data) {
  setCorsHeaders(res);
  return res.status(status).json(data);
}

function getBody(req) {
  if (!req.body) return {};

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return {};
    }
  }

  return req.body;
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

async function supabaseRest({
  supabaseUrl,
  serviceRoleKey,
  method,
  path,
  body,
  prefer
}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`Supabase REST error: ${JSON.stringify(data)}`);
  }

  return data;
}

async function getExperiment({ supabaseUrl, serviceRoleKey, experimentSlug }) {
  const data = await supabaseRest({
    supabaseUrl,
    serviceRoleKey,
    method: "GET",
    path:
      "experiments?select=*" +
      `&experiment_slug=eq.${encodeURIComponent(experimentSlug)}` +
      "&limit=1"
  });

  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function recordConversion({
  supabaseUrl,
  serviceRoleKey,
  experiment,
  visitorId,
  variant
}) {
  try {
    const data = await supabaseRest({
      supabaseUrl,
      serviceRoleKey,
      method: "POST",
      path: "experiment_conversions",
      body: {
        experiment_id: experiment.id,
        visitor_id: visitorId,
        variant,
        conversion_type: "thank_you"
      },
      prefer: "return=representation"
    });

    return {
      inserted: true,
      conversion: Array.isArray(data) ? data[0] : data
    };
  } catch (error) {
    if (String(error.message || "").includes("duplicate key")) {
      return {
        inserted: false,
        duplicate: true
      };
    }

    throw error;
  }
}

async function incrementConversionCounter({
  supabaseUrl,
  serviceRoleKey,
  experiment,
  variant
}) {
  const patch = {};

  if (variant === "page1") {
    patch.page1_conversions = Number(experiment.page1_conversions || 0) + 1;
  } else {
    patch.control_conversions = Number(experiment.control_conversions || 0) + 1;
  }

  await supabaseRest({
    supabaseUrl,
    serviceRoleKey,
    method: "PATCH",
    path: `experiments?id=eq.${encodeURIComponent(experiment.id)}`,
    body: patch
  });
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return sendJson(res, 200, {
      success: true,
      message: "track-thank-you endpoint exists. Use POST to track thank-you conversions."
    });
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
        error: "Missing Supabase environment variables"
      });
    }

    const body = getBody(req);

    const experimentSlug = cleanText(body.experimentSlug, 160);
    const visitorId = cleanText(body.visitorId, 160);
    const variant = cleanText(body.variant, 40);

    if (!experimentSlug) {
      return sendJson(res, 400, {
        error: "Missing experimentSlug"
      });
    }

    if (!visitorId) {
      return sendJson(res, 400, {
        error: "Missing visitorId"
      });
    }

    if (!["control", "page1"].includes(variant)) {
      return sendJson(res, 400, {
        error: "Invalid variant"
      });
    }

    const experiment = await getExperiment({
      supabaseUrl,
      serviceRoleKey,
      experimentSlug
    });

    if (!experiment) {
      return sendJson(res, 404, {
        error: "Experiment not found"
      });
    }

    const result = await recordConversion({
      supabaseUrl,
      serviceRoleKey,
      experiment,
      visitorId,
      variant
    });

    if (result.inserted) {
      await incrementConversionCounter({
        supabaseUrl,
        serviceRoleKey,
        experiment,
        variant
      });
    }

    return sendJson(res, 200, {
      success: true,
      tracked: true,
      inserted: result.inserted,
      duplicate: Boolean(result.duplicate),
      experimentSlug,
      variant
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "Could not track thank-you conversion",
      details: error.message
    });
  }
}
