import { requireAdmin } from "./_admin.js";
import { serviceClient, serviceHeaders } from "./_auth.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const admin = await requireAdmin(req);
  if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });

  const result = await uploadLeadPhotos(req.body || {}, admin.user);
  return res.status(result.ok ? 200 : result.status || 400).json(result);
}

async function uploadLeadPhotos(body, user) {
  const client = serviceClient();
  if (!client.ok) return client;

  const leadId = String(body.leadId || "").trim();
  const files = Array.isArray(body.files) ? body.files.slice(0, 12) : [];
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };
  if (!files.length) return { ok: false, status: 400, error: "At least one photo is required" };

  const leadResult = await fetchJson(
    `${client.url}/rest/v1/valuation_leads?select=*&id=eq.${encodeURIComponent(leadId)}&limit=1`,
    client.key
  );
  if (!leadResult.ok) return leadResult;
  const lead = leadResult.data?.[0];
  if (!lead) return { ok: false, status: 404, error: "Lead not found" };

  const webhook = await submitPhotosToWebhook(lead, files, user);
  if (!webhook.submitted) {
    return { ok: false, status: 502, error: webhook.error || webhook.reason || "Google Drive upload webhook is not configured" };
  }

  const parsed = webhook.data || parseJson(webhook.response) || {};
  const savedFiles = Array.isArray(parsed.savedFiles) ? parsed.savedFiles : [];
  if (!savedFiles.length) return { ok: false, status: 502, error: "Google Drive did not return saved file URLs" };

  const lines = [];
  if (parsed.leadFolderUrl) lines.push(`Vehicle Drive folder: ${parsed.leadFolderUrl}`);
  lines.push(...savedFiles.map((file, index) => {
    const label = files[index]?.role || files[index]?.angle || file.name || `Photo ${index + 1}`;
    const url = file.url || file.webViewLink || "";
    return `${label}: ${url}`;
  }));

  await insertJson(`${client.url}/rest/v1/lead_notes`, client.key, {
    lead_id: leadId,
    author_email: String(user?.email || "").trim().toLowerCase(),
    note_type: "inspection",
    note: `Vehicle photo upload:\n${lines.join("\n")}`
  });

  await touchLead(client, leadId);
  return { ok: true, photos: savedFiles, webhook };
}

async function submitPhotosToWebhook(lead, files, user) {
  const webhookUrl = String(process.env.LEAD_WEBHOOK_URL || "").trim();
  if (!webhookUrl) return { submitted: false, skipped: true, reason: "LEAD_WEBHOOK_URL is not configured" };

  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const payload = {
    email: String(input.email || lead.auth_email || user?.email || "lead-photo@autoswitch.local").trim(),
    phone: input.phone || "",
    vin: input.vin || valuation.vin || "",
    uvc: input.uvc || "",
    year: input.year || "",
    make: input.make || "",
    model: input.model || "",
    series: input.series || "",
    style: input.style || "",
    kilometers: input.kilometers || "",
    color: input.color || "",
    region: input.region || valuation.region || "",
    country: input.country || "C",
    wholesaleAvg: marketAverage(valuation, "wholesale") || "",
    retailAvg: marketAverage(valuation, "retail") || "",
    tradeInAvg: marketAverage(valuation, "tradeIn") || "",
    id: lead.id || "",
    status: "lead-photo-upload",
    authEmail: String(user?.email || "").trim(),
    files,
    photoCount: files.length,
    source: "admin-inventory-photo-upload",
    raw: {
      input,
      valuation
    }
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await response.text().catch(() => "");
    const data = parseJson(text);
    return {
      submitted: response.ok,
      status: response.status,
      data,
      response: text.slice(0, 1000),
      error: response.ok ? "" : `Webhook rejected the photo upload (${response.status})`
    };
  } catch (error) {
    return { submitted: false, error: error.message || "Photo webhook submission failed" };
  }
}

async function touchLead(client, leadId) {
  await fetch(`${client.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...serviceHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ last_activity_at: new Date().toISOString() })
  }).catch(() => null);
}

async function fetchJson(url, key) {
  const response = await fetch(url, { headers: serviceHeaders(key) });
  const data = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, data };
}

async function insertJson(url, key, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...serviceHeaders(key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, data };
}

function marketAverage(valuation, market) {
  const marketData = valuation?.values?.[market] || {};
  return positiveNumber(marketData.adjusted?.avg) ?? positiveNumber(marketData.base?.avg) ?? "";
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
