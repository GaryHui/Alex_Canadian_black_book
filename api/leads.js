import { requireAdmin } from "./_admin.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"
    }
  }
};

export default async function handler(req, res) {
  if (req.method === "PATCH") {
    const admin = await requireAdmin(req);
    if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });
    const result = await updateLead(req.body || {});
    return res.status(result.ok ? 200 : 400).json(result);
  }

  if (req.method === "POST") {
    const rawInput = req.body?.input || {};
    const uploadFiles = sanitizePhotoFiles(rawInput.photoFiles || []);
    const lead = {
      created_at: new Date().toISOString(),
      input: sanitizeLeadInput(rawInput),
      auth_user: sanitizeAuthUser(req.body?.user || {}),
      valuation: sanitizeValuation(req.body?.valuation || {}),
      auth_user_id: String(req.body?.user?.id || "").trim(),
      auth_email: String(req.body?.user?.email || rawInput.email || "").trim(),
      valuation_year: new Date().getFullYear(),
      status: "new",
      assigned_to: "",
      priority: "normal",
      next_follow_up_at: null,
      last_activity_at: null,
      notes: "",
      owner_adjustment: {}
    };

    const saved = await saveToSupabase(lead);
    const savedLead = { ...lead, id: saved.lead?.id || "" };
    const webhook = await submitLeadToWebhook(savedLead, uploadFiles);
    const crm = await submitLeadToCrm(savedLead, webhook);
    if (saved.ok) return res.status(200).json({ ...saved, webhook, crm });

    if (webhook.submitted || crm.submitted) {
      return res.status(200).json({
        ok: true,
        captured: true,
        storage: webhook.submitted ? "webhook" : "crm",
        webhook,
        crm,
        message: "Lead sent to external lead receiver. Set Supabase env vars to also keep user history."
      });
    }

    return res.status(200).json({
      ok: true,
      captured: false,
      storage: "not_configured",
      webhook,
      crm,
      message: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel to persist leads."
    });
  }

  if (req.method === "DELETE") {
    const admin = await requireAdmin(req);
    if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });
    const result = await deleteLeadRecords(req.query || {});
    return res.status(result.ok ? 200 : result.status || 400).json(result);
  }

  if (req.method === "GET") {
    const admin = await requireAdmin(req);
    if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });
    return res.status(200).json(await listFromSupabase());
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

async function submitLeadToWebhook(lead, uploadFiles = []) {
  const webhookUrl = String(process.env.LEAD_WEBHOOK_URL || "").trim();
  if (!webhookUrl) return { submitted: false, skipped: true, reason: "LEAD_WEBHOOK_URL is not configured" };

  const payload = leadExportValues(lead);
  payload.files = uploadFiles;
  payload.photoCount = lead.input?.photoCount || uploadFiles.length || "";
  payload.photoNames = Array.isArray(lead.input?.photoNames) ? lead.input.photoNames.join(", ") : "";
  payload.id = lead.id || "";
  payload.createdAt = lead.created_at || "";
  payload.status = lead.status || "new";
  payload.authUserId = lead.auth_user_id || lead.auth_user?.id || "";
  payload.authEmail = lead.auth_email || lead.auth_user?.email || "";
  payload.raw = {
    input: lead.input || {},
    valuation: lead.valuation || {},
    auth_user: lead.auth_user || {}
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
      error: response.ok ? "" : `Webhook rejected the submission (${response.status})`
    };
  } catch (error) {
    return { submitted: false, error: error.message || "Lead webhook submission failed" };
  }
}

async function submitLeadToCrm(lead, webhook = {}) {
  const crmUrl = String(process.env.CRM_WEBHOOK_URL || "").trim();
  if (!crmUrl) return { submitted: false, skipped: true, reason: "CRM_WEBHOOK_URL is not configured" };

  const drivePayload = webhook.data || parseJson(webhook.response);
  const payload = {
    source: "blackbook-demo",
    lead: leadExportValues(lead),
    drive: {
      folderUrl: drivePayload.leadFolderUrl || "",
      pdfUrl: drivePayload.pdfUrl || "",
      savedFiles: drivePayload.savedFiles || []
    },
    raw: {
      input: lead.input || {},
      valuation: lead.valuation || {},
      auth_user: lead.auth_user || {}
    }
  };

  const headers = { "Content-Type": "application/json" };
  const token = String(process.env.CRM_WEBHOOK_TOKEN || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(crmUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    const text = await response.text().catch(() => "");
    return {
      submitted: response.ok,
      status: response.status,
      response: text.slice(0, 500),
      error: response.ok ? "" : `CRM webhook rejected the submission (${response.status})`
    };
  } catch (error) {
    return { submitted: false, error: error.message || "CRM webhook submission failed" };
  }
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function leadExportValues(lead) {
  const input = lead.input || {};
  const valuation = lead.valuation || {};

  return {
    email: input.email || lead.auth_email || lead.auth_user?.email || "",
    phone: input.phone || "",
    vin: valuation.vin || input.vin || "",
    uvc: input.uvc || "",
    year: input.year || "",
    make: input.make || "",
    model: input.model || "",
    series: input.series || "",
    style: input.style || "",
    kilometers: input.kilometers || "",
    ownershipType: input.ownershipType || "",
    color: input.color || "",
    conditionNotes: input.conditionNotes || "",
    photoCount: input.photoCount || "",
    photoNames: Array.isArray(input.photoNames) ? input.photoNames.join(", ") : "",
    region: valuation.region || input.region || "",
    country: valuation.country || input.country || "",
    dealerPurchaseLow: marketRange(valuation, "wholesale").min,
    dealerPurchaseHigh: marketRange(valuation, "wholesale").max,
    dealerPurchaseRange: marketRange(valuation, "wholesale").label,
    privateSaleLow: marketRange(valuation, "retail").min,
    privateSaleHigh: marketRange(valuation, "retail").max,
    privateSaleRange: marketRange(valuation, "retail").label,
    wholesaleAvg: marketAverage(valuation, "wholesale"),
    retailAvg: marketAverage(valuation, "retail"),
    tradeInAvg: marketAverage(valuation, "tradeIn"),
    cbbJson: JSON.stringify({ input, valuation }, null, 2)
  };
}

function marketAverage(valuation, market) {
  const marketData = valuation?.values?.[market] || {};
  return positiveNumber(marketData.adjusted?.avg) ?? positiveNumber(marketData.base?.avg) ?? "";
}

function marketRange(valuation, market) {
  const marketData = valuation?.values?.[market] || {};
  const row = marketData.adjusted || marketData.base || {};
  const numbers = ["rough", "avg", "clean", "xclean"]
    .map((key) => row[key])
    .map(positiveNumber)
    .filter((value) => value !== null);
  if (!numbers.length) return { min: "", max: "", label: "" };
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return {
    min,
    max,
    label: min === max ? String(min) : `${min} - ${max}`
  };
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

async function saveToSupabase(lead) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false };

  const result = await insertLead({ url, key, lead });
  if (result.ok) return result;

  const legacyLead = { ...lead };
  delete legacyLead.auth_user_id;
  delete legacyLead.auth_email;
  delete legacyLead.valuation_year;
  delete legacyLead.assigned_to;
  delete legacyLead.priority;
  delete legacyLead.next_follow_up_at;
  delete legacyLead.last_activity_at;
  const legacyResult = await insertLead({ url, key, lead: legacyLead });
  if (legacyResult.ok) return { ...legacyResult, legacyColumns: true };

  return result;
}

async function insertLead({ url, key, lead }) {
  const response = await fetch(`${url}/rest/v1/valuation_leads`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(lead)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, captured: true, storage: "supabase", lead: data?.[0] || null };
}

async function listFromSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, storage: "not_configured", leads: [] };

  const response = await fetch(`${url}/rest/v1/valuation_leads?select=*&order=created_at.desc&limit=100`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });

  const leads = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: leads, leads: [] };
  return { ok: true, storage: "supabase", leads };
}

async function deleteLeadRecords(query) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const id = String(query.id || "").trim();
  const confirm = String(query.confirm || "").trim();

  if (id) {
    const response = await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        ...authHeaders(key),
        Prefer: "return=representation"
      }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, status: response.status, error: data };
    return { ok: true, deleted: Array.isArray(data) ? data.length : 0 };
  }

  if (confirm !== "DELETE ALL LEADS") {
    return { ok: false, status: 400, error: "Type DELETE ALL LEADS to confirm clearing all lead records." };
  }

  const response = await fetch(`${url}/rest/v1/valuation_leads?id=not.is.null`, {
    method: "DELETE",
    headers: {
      ...authHeaders(key),
      Prefer: "return=representation"
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, deleted: Array.isArray(data) ? data.length : 0 };
}

async function updateLead(body) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, error: "Lead id is required" };
  if (!url || !key) return { ok: false, error: "Supabase is not configured" };

  const patch = {
    status: String(body.status || "reviewing").trim(),
    assigned_to: String(body.assignedTo || body.assigned_to || "").trim().toLowerCase(),
    priority: normalizePriority(body.priority),
    next_follow_up_at: dateOrNull(body.nextFollowUpAt || body.next_follow_up_at),
    last_activity_at: new Date().toISOString(),
    notes: String(body.notes || "").trim(),
    owner_adjustment: {
      wholesale: numberOrNull(body.ownerWholesale),
      retail: numberOrNull(body.ownerRetail),
      reason: String(body.reason || "").trim(),
      updated_at: new Date().toISOString()
    }
  };

  const response = await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(patch)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, lead: data?.[0] || null };
}

function normalizePriority(value) {
  const priority = String(value || "normal").trim().toLowerCase();
  return ["low", "normal", "high", "urgent"].includes(priority) ? priority : "normal";
}

function dateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sanitizeLeadInput(input) {
  return {
    email: String(input.email || "").trim(),
    phone: String(input.phone || "").trim(),
    vin: cleanVin(input.vin),
    uvc: String(input.uvc || "").trim(),
    year: String(input.year || "").trim(),
    make: String(input.make || "").trim(),
    model: String(input.model || "").trim(),
    series: String(input.series || "").trim(),
    style: String(input.style || "").trim(),
    kilometers: Number(input.kilometers || input.mileage || 0),
    ownershipType: String(input.ownershipType || "").trim(),
    ownsVehicle: Boolean(input.ownsVehicle),
    color: String(input.color || "").trim(),
    conditionNotes: String(input.conditionNotes || "").trim(),
    photoCount: Number(input.photoCount || 0),
    photoNames: Array.isArray(input.photoNames) ? input.photoNames.map((name) => String(name || "").trim()).filter(Boolean) : [],
    photoMetadata: Array.isArray(input.photoMetadata) ? input.photoMetadata.map((photo) => ({
      name: String(photo?.name || "").trim(),
      size: numberOrNull(photo?.size),
      type: String(photo?.type || photo?.mimeType || "").trim(),
      width: numberOrNull(photo?.width),
      height: numberOrNull(photo?.height)
    })) : [],
    region: String(input.region || "").trim(),
    country: String(input.country || "").trim()
  };
}

function sanitizePhotoFiles(files) {
  if (!Array.isArray(files)) return [];

  return files
    .slice(0, 9)
    .map((file, index) => {
      const mimeType = String(file?.mimeType || file?.type || "image/jpeg").trim();
      const base64 = String(file?.base64 || "")
        .replace(/^data:[^,]+,/, "")
        .replace(/\s/g, "");

      if (!base64 || !/^image\/(jpeg|jpg|png|webp)$/i.test(mimeType)) return null;

      return {
        name: sanitizeFileName(file?.name || `vehicle-photo-${index + 1}.jpg`),
        originalName: String(file?.originalName || "").trim(),
        role: String(file?.role || "").trim(),
        angle: String(file?.angle || "").trim(),
        mimeType: mimeType.replace(/image\/jpg/i, "image/jpeg"),
        size: numberOrNull(file?.size),
        width: numberOrNull(file?.width),
        height: numberOrNull(file?.height),
        base64
      };
    })
    .filter(Boolean);
}

function sanitizeFileName(value) {
  const cleaned = String(value || "vehicle-photo.jpg")
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return cleaned || "vehicle-photo.jpg";
}

function sanitizeAuthUser(user) {
  return {
    id: String(user.id || "").trim(),
    email: String(user.email || "").trim(),
    name: String(user.name || "").trim()
  };
}

function sanitizeValuation(valuation) {
  return {
    source: valuation.source,
    title: valuation.title,
    vin: valuation.vin,
    region: valuation.region,
    country: valuation.country,
    values: valuation.values,
    loanValue: valuation.loanValue,
    thresholds: valuation.thresholds,
    choices: valuation.choices || []
  };
}

function cleanVin(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
