function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function parseCookies(cookieHeader) {
  const cookies = {};

  String(cookieHeader || "")
    .split(";")
    .forEach(function (part) {
      const pieces = part.split("=");
      const key = pieces.shift();

      if (!key) return;

      cookies[key.trim()] = decodeURIComponent(pieces.join("=").trim());
    });

  return cookies;
}

function makeVisitorId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return "visitor-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function appendParamsToUrl(urlValue, params) {
  const url = new URL(urlValue);

  Object.entries(params || {}).forEach(function ([key, value]) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.href;
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

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).send("Missing Supabase environment variables.");
    }

    const experimentSlug = cleanText(req.query.experiment, 160);

    if (!experimentSlug) {
      return res.status(400).send("Missing experiment.");
    }

    const experiment = await getExperiment({
      supabaseUrl,
      serviceRoleKey,
      experimentSlug
    });

    if (!experiment || experiment.status !== "active") {
      return res.status(404).send("Experiment not found or inactive.");
    }

    const cookies = parseCookies(req.headers.cookie);
    const existingVisitorId = cookies.page1_visitor_id;
    const visitorId = existingVisitorId || makeVisitorId();

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

    const baseRedirectUrl =
      assignedVariant === "page1"
        ? experiment.page1_url
        : experiment.control_url;

    const redirectUrl = appendParamsToUrl(baseRedirectUrl, {
      p1_experiment: experiment.experiment_slug,
      p1_variant: assignedVariant
    });

    res.setHeader(
      "Set-Cookie",
      `page1_visitor_id=${encodeURIComponent(visitorId)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`
    );

    res.writeHead(302, {
      Location: redirectUrl
    });

    return res.end();
  } catch (error) {
    console.error(error);

    return res.status(500).send("Could not route A/B test.");
  }
}
