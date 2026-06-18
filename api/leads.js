import { requireAdmin } from "./_admin.js";
import { attachLeadSignals, isBuyerLead, notifyDuplicateSellerLead, reviewDuplicateSellerLead } from "./_lead-signals.js";

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
    const result = req.body?.action === "owner_read"
      ? await markOwnerRead(req.body || {}, admin.user)
      : req.body?.action === "duplicate_review"
        ? await markDuplicateReview(req.body || {}, admin.user)
        : await updateLead(req.body || {});
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
    if (saved.ok && savedLead.id) {
      await createOwnerReviewNote({
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        leadId: savedLead.id,
        authorEmail: "system",
        reason: `${leadSourceLabel(savedLead.input?.leadSource)} received.`
      });
      await createLeadTimelineNote({
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        leadId: savedLead.id,
        authorEmail: "system",
        note: `Lead created from ${leadSourceLabel(savedLead.input?.leadSource)}.${savedLead.input?.dealerEmail ? ` Dealer: ${savedLead.input.dealerEmail}.` : ""}`
      });
      if (!isBuyerLead(savedLead)) {
        await notifyDuplicateSellerLead({
          url: process.env.SUPABASE_URL,
          key: process.env.SUPABASE_SERVICE_ROLE_KEY
        }, savedLead);
      }
    }
    const webhook = await submitLeadToWebhook(savedLead, uploadFiles);
    if (saved.ok && savedLead.id) {
      await recordWebhookPhotosAsLeadNote({
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        leadId: savedLead.id,
        uploadFiles,
        webhook
      });
    }
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
    leadSource: leadSourceLabel(input.leadSource),
    ownerName: input.ownerName || "",
    email: input.email || "",
    dealerEmail: input.dealerEmail || lead.auth_email || lead.auth_user?.email || "",
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
  const withReview = await attachOwnerReviewState(leads, { url, key });
  return { ok: true, storage: "supabase", leads: await attachLeadSignals(withReview, { url, key }) };
}

async function attachOwnerReviewState(leads, client) {
  if (!Array.isArray(leads) || !leads.length) return [];
  const ids = leads.map((lead) => String(lead.id || "").trim()).filter(Boolean);
  if (!ids.length) return leads;

  const encodedIds = ids.map(encodeURIComponent).join(",");
  const [reviewResult, readResult] = await Promise.all([
    fetch(`${client.url}/rest/v1/lead_notes?select=id,lead_id,created_at,author_email,note&lead_id=in.(${encodedIds})&note_type=eq.owner_review&order=created_at.desc&limit=500`, {
      headers: authHeaders(client.key)
    }).then((res) => res.json().then((data) => ({ ok: res.ok, data })).catch(() => ({ ok: res.ok, data: [] }))).catch(() => ({ ok: false, data: [] })),
    fetch(`${client.url}/rest/v1/lead_notes?select=id,lead_id,created_at,author_email,note&lead_id=in.(${encodedIds})&note_type=eq.owner_read&order=created_at.desc&limit=500`, {
      headers: authHeaders(client.key)
    }).then((res) => res.json().then((data) => ({ ok: res.ok, data })).catch(() => ({ ok: res.ok, data: [] }))).catch(() => ({ ok: false, data: [] }))
  ]);

  if (!reviewResult.ok || !readResult.ok) return leads;
  const latestReview = latestNoteByLead(reviewResult.data || []);
  const latestRead = latestNoteByLead(readResult.data || []);

  return leads.map((lead) => {
    const id = String(lead.id || "");
    const review = latestReview.get(id) || null;
    const read = latestRead.get(id) || null;
    const reviewTime = review ? new Date(review.created_at || 0).getTime() : 0;
    const readTime = read ? new Date(read.created_at || 0).getTime() : 0;
    return {
      ...lead,
      owner_review: {
        unread: Boolean(review && reviewTime > readTime),
        reason: review?.note || "",
        at: review?.created_at || "",
        by: review?.author_email || "",
        read_at: read?.created_at || "",
        read_by: read?.author_email || ""
      }
    };
  });
}

function latestNoteByLead(notes) {
  const map = new Map();
  for (const note of Array.isArray(notes) ? notes : []) {
    const leadId = String(note.lead_id || "");
    if (!leadId) continue;
    const current = map.get(leadId);
    if (!current || new Date(note.created_at || 0).getTime() > new Date(current.created_at || 0).getTime()) {
      map.set(leadId, note);
    }
  }
  return map;
}

async function markOwnerRead(body, user) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const leadId = String(body.id || body.leadId || "").trim();
  if (!leadId) return { ok: false, error: "Lead id is required" };
  if (!url || !key) return { ok: false, error: "Supabase is not configured" };

  const result = await insertJson(`${url}/rest/v1/lead_notes`, key, {
    lead_id: leadId,
    author_email: String(user?.email || "").trim().toLowerCase(),
    note_type: "owner_read",
    note: String(body.note || "Owner reviewed this important update.").trim()
  });
  if (!result.ok) return result;
  return { ok: true, read: result.data?.[0] || null };
}

async function markDuplicateReview(body, user) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const leadId = String(body.id || body.leadId || "").trim();
  if (!leadId) return { ok: false, error: "Lead id is required" };
  if (!url || !key) return { ok: false, error: "Supabase is not configured" };
  return reviewDuplicateSellerLead({
    url,
    key
  }, leadId, body.decision, user?.email, {
    targetLeadId: body.targetLeadId,
    listingId: body.listingId
  });
}

async function fetchLeadById(client, id) {
  const response = await fetch(`${client.url}/rest/v1/valuation_leads?select=*&id=eq.${encodeURIComponent(id)}&limit=1`, {
    headers: authHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return null;
  return rows?.[0] || null;
}

async function createOwnerReviewNote({ url, key, leadId, authorEmail, reason }) {
  if (!url || !key || !leadId) return;
  await insertJson(`${url}/rest/v1/lead_notes`, key, {
    lead_id: leadId,
    author_email: String(authorEmail || "").trim().toLowerCase(),
    note_type: "owner_review",
    note: reason
  }).catch(() => null);
}

async function createLeadTimelineNote({ url, key, leadId, authorEmail, note }) {
  if (!url || !key || !leadId || !String(note || "").trim()) return;
  await insertJson(`${url}/rest/v1/lead_notes`, key, {
    lead_id: leadId,
    author_email: String(authorEmail || "system").trim().toLowerCase(),
    note_type: "internal",
    note: String(note || "").trim()
  }).catch(() => null);
}

async function recordWebhookPhotosAsLeadNote({ url, key, leadId, uploadFiles = [], webhook = {} }) {
  if (!url || !key || !leadId || !webhook?.submitted) return;
  const parsed = webhook.data || parseJson(webhook.response) || {};
  const savedFiles = Array.isArray(parsed.savedFiles) ? parsed.savedFiles : [];
  if (!savedFiles.length) return;
  const lines = savedFiles.map((file, index) => {
    const label = uploadFiles[index]?.role || uploadFiles[index]?.angle || uploadFiles[index]?.name || file.name || `Photo ${index + 1}`;
    const photoUrl = file.url || file.webViewLink || "";
    return photoUrl ? `${label}: ${photoUrl}` : "";
  }).filter(Boolean);
  if (!lines.length) return;
  await insertJson(`${url}/rest/v1/lead_notes`, key, {
    lead_id: leadId,
    author_email: "system",
    note_type: "inspection",
    note: `Vehicle photo upload:\n${lines.join("\n")}`
  }).catch(() => null);
}

async function deleteLeadRecords(query) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const id = String(query.id || "").trim();
  const confirm = normalizeDeleteConfirm(query.confirm);

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

  return deleteAllLeads({ url, key });
}

async function deleteAllLeads({ url, key }) {
  const listResponse = await fetch(`${url}/rest/v1/valuation_leads?select=id&limit=1000`, {
    headers: authHeaders(key)
  });
  const rows = await listResponse.json().catch(() => []);
  if (!listResponse.ok) return { ok: false, status: listResponse.status, error: rows };

  const ids = (Array.isArray(rows) ? rows : []).map((row) => row.id).filter(Boolean);
  if (!ids.length) return { ok: true, deleted: 0 };

  let deleted = 0;
  for (const id of ids) {
    const response = await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        ...authHeaders(key),
        Prefer: "return=representation"
      }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, status: response.status, error: data, deleted };
    deleted += Array.isArray(data) ? data.length : 0;
  }

  return { ok: true, deleted };
}

function normalizeDeleteConfirm(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

async function updateLead(body) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const id = String(body.id || "").trim();
  if (!id) return { ok: false, error: "Lead id is required" };
  if (!url || !key) return { ok: false, error: "Supabase is not configured" };
  const previous = await fetchLeadById({ url, key }, id);

  const now = new Date().toISOString();
  const patch = {
    status: String(body.status || "reviewing").trim(),
    assigned_to: String(body.assignedTo || body.assigned_to || "").trim().toLowerCase(),
    priority: normalizePriority(body.priority),
    next_follow_up_at: dateOrNull(body.nextFollowUpAt || body.next_follow_up_at),
    last_activity_at: now,
    notes: String(body.notes || "").trim(),
    owner_adjustment: {
      wholesale: numberOrNull(body.ownerWholesale),
      retail: numberOrNull(body.ownerRetail),
      reason: String(body.reason || "").trim(),
      updated_at: now
    }
  };
  const vehiclePatch = buildVehiclePatch(body, previous || {});
  if (vehiclePatch.input) patch.input = vehiclePatch.input;
  if (vehiclePatch.valuation) patch.valuation = vehiclePatch.valuation;

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
  if (previous) {
    const timeline = buildLeadUpdateTimeline(previous, patch);
    if (timeline) {
      await createLeadTimelineNote({
        url,
        key,
        leadId: id,
        authorEmail: String(body.authorEmail || body.updatedBy || "").trim().toLowerCase() || "admin",
        note: timeline
      });
    }
  }
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

function normalizeLeadSource(value) {
  const source = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["dealer_appraisal", "dealer_valuation", "dealer_created"].includes(source)) return "dealer_appraisal";
  if (["buyer_inquiry", "buy_page", "public_buy"].includes(source)) return "buyer_inquiry";
  return "owner_self_valuation";
}

function leadSourceLabel(value) {
  const source = normalizeLeadSource(value);
  if (source === "dealer_appraisal") return "Dealer appraisal";
  if (source === "buyer_inquiry") return "Buyer inquiry";
  return "Owner self appraisal";
}

function buildLeadUpdateTimeline(previous = {}, patch = {}) {
  const changes = [];
  const previousStatus = String(previous.status || "").trim();
  if (previousStatus !== patch.status) changes.push(`status ${previousStatus || "blank"} -> ${patch.status || "blank"}`);

  const previousRep = String(previous.assigned_to || "").trim().toLowerCase();
  if (previousRep !== patch.assigned_to) changes.push(`assigned rep ${previousRep || "unassigned"} -> ${patch.assigned_to || "unassigned"}`);

  const previousPriority = String(previous.priority || "normal").trim().toLowerCase();
  if (previousPriority !== patch.priority) changes.push(`priority ${previousPriority} -> ${patch.priority}`);

  const previousFollowUp = normalizeIsoForCompare(previous.next_follow_up_at);
  const nextFollowUp = normalizeIsoForCompare(patch.next_follow_up_at);
  if (previousFollowUp !== nextFollowUp) changes.push(`next follow-up ${previousFollowUp || "not set"} -> ${nextFollowUp || "not set"}`);

  const previousAdjustment = previous.owner_adjustment || {};
  if (numberOrNull(previousAdjustment.wholesale) !== numberOrNull(patch.owner_adjustment?.wholesale)) {
    changes.push(`approved wholesale ${previousAdjustment.wholesale ?? "not set"} -> ${patch.owner_adjustment?.wholesale ?? "not set"}`);
  }
  if (numberOrNull(previousAdjustment.retail) !== numberOrNull(patch.owner_adjustment?.retail)) {
    changes.push(`approved retail ${previousAdjustment.retail ?? "not set"} -> ${patch.owner_adjustment?.retail ?? "not set"}`);
  }

  const vehicleChanges = buildVehicleChangeSummary(previous, patch);
  if (vehicleChanges) changes.push(vehicleChanges);

  if (!changes.length) return "";
  return `Lead updated: ${changes.join("; ")}.`;
}

function buildVehiclePatch(body = {}, previous = {}) {
  const hasVehicleField = [
    "vehicleTitle",
    "vehicleVin",
    "vehicleYear",
    "vehicleMake",
    "vehicleModel",
    "vehicleSeries",
    "vehicleStyle",
    "vehicleKilometers",
    "vehicleColor",
    "vehicleRegion"
  ].some((key) => Object.prototype.hasOwnProperty.call(body, key));
  if (!hasVehicleField) return {};

  const input = { ...(previous.input || {}) };
  const valuation = { ...(previous.valuation || {}) };
  const title = String(body.vehicleTitle || "").trim();
  const vin = cleanVin(body.vehicleVin || input.vin || valuation.vin);
  const year = String(body.vehicleYear || "").trim();
  const make = String(body.vehicleMake || "").trim();
  const model = String(body.vehicleModel || "").trim();
  const series = String(body.vehicleSeries || "").trim();
  const style = String(body.vehicleStyle || "").trim();
  const kilometers = numberOrNull(body.vehicleKilometers);
  const color = String(body.vehicleColor || "").trim();
  const region = String(body.vehicleRegion || "").trim();

  if (title) valuation.title = title;
  input.vin = vin;
  valuation.vin = vin;
  input.year = year;
  input.make = make;
  input.model = model;
  input.series = series;
  input.style = style;
  if (kilometers !== null) input.kilometers = kilometers;
  input.color = color;
  input.region = region;
  valuation.region = region;

  return { input, valuation };
}

function buildVehicleChangeSummary(previous = {}, patch = {}) {
  if (!patch.input && !patch.valuation) return "";
  const beforeInput = previous.input || {};
  const afterInput = patch.input || beforeInput;
  const beforeValuation = previous.valuation || {};
  const afterValuation = patch.valuation || beforeValuation;
  const changes = [];
  if (String(beforeValuation.title || "") !== String(afterValuation.title || "")) changes.push("title");
  if (String(beforeInput.vin || beforeValuation.vin || "") !== String(afterInput.vin || afterValuation.vin || "")) changes.push("VIN");
  if (String(beforeInput.year || "") !== String(afterInput.year || "")) changes.push("year");
  if (String(beforeInput.make || "") !== String(afterInput.make || "")) changes.push("make");
  if (String(beforeInput.model || "") !== String(afterInput.model || "")) changes.push("model");
  if (String(beforeInput.series || "") !== String(afterInput.series || "")) changes.push("series");
  if (String(beforeInput.style || "") !== String(afterInput.style || "")) changes.push("style");
  if (numberOrNull(beforeInput.kilometers) !== numberOrNull(afterInput.kilometers)) changes.push("kilometers");
  if (String(beforeInput.color || "") !== String(afterInput.color || "")) changes.push("color");
  if (String(beforeInput.region || beforeValuation.region || "") !== String(afterInput.region || afterValuation.region || "")) changes.push("region");
  return changes.length ? `vehicle details updated (${changes.join(", ")})` : "";
}

function normalizeIsoForCompare(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function sanitizeLeadInput(input) {
  const leadSource = normalizeLeadSource(input.leadSource || input.sourceContext || (input.leadType === "buyer_inquiry" ? "buyer_inquiry" : input.createdByDealer ? "dealer_appraisal" : "owner_self_valuation"));
  return {
    leadSource,
    sourceLabel: leadSourceLabel(leadSource),
    ownerName: String(input.ownerName || input.customerName || "").trim(),
    dealerEmail: String(input.dealerEmail || "").trim().toLowerCase(),
    createdByDealer: Boolean(input.createdByDealer || leadSource === "dealer_appraisal"),
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
