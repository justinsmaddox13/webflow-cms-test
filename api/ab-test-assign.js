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

async function getExistingAssignment({
  supabaseUrl,
  serviceRoleKey,
  experimentId,
  visitorId
}) {
  const data = await supabaseRest({
    supabaseUrl,
    serviceRoleKey,
    method: "GET",
    path:
      "experiment_assignments?select=*" +
      `&experiment_id=eq.${encodeURIComponent(experimentId)}` +
      `&visitor_id=eq.${encodeURIComponent(visitorId)}` +
      "&limit=1"
  });

  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function createAssignment({
  supabaseUrl,
  serviceRoleKey,
  experimentId,
  visitorId,
  assignedVariant
}) {
  const data = await supabaseRest({
    supabaseUrl,
    serviceRoleKey,
    method: "POST",
    path: "experiment_assignments",
    body: {
      experiment_id: experimentId,
      visitor_id: visitorId,
      assigned_variant: assignedVariant
    },
    prefer: "return=representation"
  });

  return Array.isArray(data) ? data[0] : data;
}

async function incrementVisitCounter({
  supabaseUrl,
  serviceRoleKey,
  experiment,
  assignedVariant
}) {
  const patch = {};

  if (assignedVariant === "page1") {
    patch.page1_visits = Number(experiment.page1_visits || 0) + 1;
  } else {
    patch.control_visits = Number(experiment.control_visits || 0) + 1;
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
      message: "ab-test-assign endpoint exists. Use POST to assign traffic."
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

    if (experiment.status !== "active") {
      return sendJson(res, 403, {
        error: "Experiment is not active"
      });
    }

    const existingAssignment = await getExistingAssignment({
      supabaseUrl,
      serviceRoleKey,
      experimentId: experiment.id,
      visitorId
    });

    let assignedVariant;
    let isNewAssignment = false;

    if (existingAssignment) {
      assignedVariant = existingAssignment.assigned_variant;
    } else {
      assignedVariant =
        Math.random() * 100 < Number(experiment.split_percent || 50)
          ? "page1"
          : "control";

      await createAssignment({
        supabaseUrl,
        serviceRoleKey,
        experimentId: experiment.id,
        visitorId,
        assignedVariant
      });

      isNewAssignment = true;

      await incrementVisitCounter({
        supabaseUrl,
        serviceRoleKey,
        experiment,
        assignedVariant
      });
    }

    const redirectUrl =
      assignedVariant === "page1"
        ? experiment.page1_url
        : experiment.control_url;

    return sendJson(res, 200, {
      success: true,
      experimentSlug,
      assignedVariant,
      isNewAssignment,
      redirectUrl
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "Could not assign A/B test visitor",
      details: error.message
    });
  }
}
