import { requireDealer } from "./_auth.js";
import { isBuyerLead, notifySameVehicleBuyerLeads } from "./_lead-signals.js";

export default async function handler(req, res) {
  const dealer = await requireDealer(req);
  if (!dealer.ok) return res.status(dealer.status).json({ ok: false, error: dealer.error });

  if (req.method === "GET") {
    const leadId = String(req.query?.leadId || "").trim();
    const access = await canAccessLead(leadId, dealer);
    if (!access.ok) return res.status(access.status || 403).json(access);
    const result = await listActivity(leadId);
    return res.status(result.ok ? 200 : result.status || 400).json(result);
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const access = await canAccessLead(body.leadId, dealer);
    if (!access.ok) return res.status(access.status || 403).json(access);
    const result = await createActivity(body, dealer.user, dealer.role);
    return res.status(result.ok ? 200 : result.status || 400).json(result);
  }

  if (req.method === "PATCH") {
    const body = req.body || {};
    const access = await canAccessLead(body.leadId, dealer);
    if (!access.ok) return res.status(access.status || 403).json(access);
    const result = body.action === "status"
      ? await updateLeadStatus(body, dealer.user, dealer.role)
      : body.action === "follow_up"
        ? await updateLeadFollowUp(body, dealer.user)
        : await updateTask(body, dealer.user);
    return res.status(result.ok ? 200 : result.status || 400).json(result);
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

async function listActivity(leadId) {
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };
  const client = supabaseClient();
  if (!client.ok) return client;

  const [notes, tasks, emails] = await Promise.all([
    fetchJson(`${client.url}/rest/v1/lead_notes?select=*&lead_id=eq.${encodeURIComponent(leadId)}&order=created_at.desc&limit=100`, client.key),
    fetchJson(`${client.url}/rest/v1/lead_tasks?select=*&lead_id=eq.${encodeURIComponent(leadId)}&order=due_at.asc.nullslast,created_at.desc&limit=100`, client.key),
    fetchJson(`${client.url}/rest/v1/lead_emails?select=*&lead_id=eq.${encodeURIComponent(leadId)}&order=created_at.desc&limit=100`, client.key)
  ]);

  const failed = [notes, tasks, emails].find((result) => !result.ok);
  if (failed) return failed;

  return {
    ok: true,
    notes: notes.data || [],
    tasks: tasks.data || [],
    emails: emails.data || []
  };
}

async function canAccessLead(leadId, dealer) {
  const id = String(leadId || "").trim();
  if (!id) return { ok: false, status: 400, error: "Lead id is required" };
  const client = supabaseClient();
  if (!client.ok) return client;

  const response = await fetch(`${client.url}/rest/v1/valuation_leads?select=id,assigned_to&id=eq.${encodeURIComponent(id)}&limit=1`, {
    headers: authHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: rows };

  const lead = rows?.[0];
  if (!lead) return { ok: false, status: 404, error: "Lead not found" };
  if (dealer.role === "admin") return { ok: true, lead };

  const assignedTo = String(lead.assigned_to || "").trim().toLowerCase();
  const email = String(dealer.user?.email || "").trim().toLowerCase();
  if (assignedTo && assignedTo === email) return { ok: true, lead };
  const taskAccess = await fetch(`${client.url}/rest/v1/lead_tasks?select=id&lead_id=eq.${encodeURIComponent(id)}&assigned_to=eq.${encodeURIComponent(email)}&limit=1`, {
    headers: authHeaders(client.key)
  });
  const taskRows = await taskAccess.json().catch(() => []);
  if (!taskAccess.ok) return { ok: false, status: taskAccess.status, error: taskRows };
  if (Array.isArray(taskRows) && taskRows.length > 0) return { ok: true, lead };
  return { ok: false, status: 403, error: "This lead is not assigned to your dealer account." };
}

async function createActivity(body, user, role) {
  const leadId = String(body.leadId || "").trim();
  const type = String(body.type || "note").trim().toLowerCase();
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };

  if (type === "task") return createTask(body, user);
  if (type === "email") return recordEmail(body, user);
  return createNote(body, user, role);
}

async function createNote(body, user, role) {
  const client = supabaseClient();
  if (!client.ok) return client;

  const leadId = String(body.leadId || "").trim();
  const note = String(body.note || "").trim();
  if (!note) return { ok: false, status: 400, error: "Note is required" };
  const lead = await fetchLeadRow(client, leadId);
  if (!lead) return { ok: false, status: 404, error: "Lead not found" };

  const payload = {
    lead_id: leadId,
    author_email: String(user?.email || "").trim().toLowerCase(),
    note_type: normalizeNoteType(body.noteType),
    note
  };

  const result = await insertJson(`${client.url}/rest/v1/lead_notes`, client.key, payload);
  if (!result.ok) return result;
  if (role !== "admin" && ["offer", "correction"].includes(payload.note_type)) {
    await createOwnerReview(
      client,
      leadId,
      user,
      payload.note_type === "correction" ? "Vehicle detail correction requested by staff." : "Quote or offer added by staff."
    );
  }
  await touchLead(client, leadId);
  if (payload.note_type === "offer" && isBuyerLead(lead)) {
    await notifySameVehicleBuyerLeads(client, lead, {
      excludeLeadId: leadId,
      code: "shared_offer",
      message: `Another buyer lead just received an offer on ${leadTitle(lead)}. Review this inquiry before quoting again.`
    });
  }
  return { ok: true, note: result.data?.[0] || null };
}

async function createTask(body, user) {
  const client = supabaseClient();
  if (!client.ok) return client;

  const leadId = String(body.leadId || "").trim();
  const title = String(body.title || "").trim();
  if (!title) return { ok: false, status: 400, error: "Task title is required" };

  const payload = {
    lead_id: leadId,
    assigned_to: String(body.assignedTo || user?.email || "").trim().toLowerCase(),
    title,
    due_at: dateOrNull(body.dueAt)
  };

  const result = await insertJson(`${client.url}/rest/v1/lead_tasks`, client.key, payload);
  if (!result.ok) return result;
  await touchLead(client, leadId);
  return { ok: true, task: result.data?.[0] || null };
}

async function recordEmail(body, user) {
  const client = supabaseClient();
  if (!client.ok) return client;

  const leadId = String(body.leadId || "").trim();
  const sentTo = String(body.sentTo || "").trim().toLowerCase();
  const subject = String(body.subject || "").trim();
  if (!sentTo || !subject) return { ok: false, status: 400, error: "Recipient and subject are required" };

  const payload = {
    lead_id: leadId,
    sent_by: String(user?.email || "").trim().toLowerCase(),
    sent_to: sentTo,
    subject,
    body: String(body.body || "").trim(),
    provider_message_id: String(body.providerMessageId || "").trim(),
    status: String(body.status || "sent").trim()
  };

  const result = await insertJson(`${client.url}/rest/v1/lead_emails`, client.key, payload);
  if (!result.ok) return result;
  await touchLead(client, leadId);
  return { ok: true, email: result.data?.[0] || null };
}

async function updateTask(body, user) {
  const client = supabaseClient();
  if (!client.ok) return client;

  const taskId = String(body.taskId || "").trim();
  const leadId = String(body.leadId || "").trim();
  if (!taskId) return { ok: false, status: 400, error: "Task id is required" };

  const patch = {};
  if ("completed" in body) patch.completed_at = body.completed ? new Date().toISOString() : null;
  if ("title" in body) patch.title = String(body.title || "").trim();
  if ("assignedTo" in body) patch.assigned_to = String(body.assignedTo || "").trim().toLowerCase();
  if ("dueAt" in body) patch.due_at = dateOrNull(body.dueAt);

  const response = await fetch(`${client.url}/rest/v1/lead_tasks?id=eq.${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(client.key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(patch)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  if (leadId) await touchLead(client, leadId, user);
  return { ok: true, task: data?.[0] || null };
}

async function updateLeadStatus(body, user, role) {
  const client = supabaseClient();
  if (!client.ok) return client;

  const leadId = String(body.leadId || "").trim();
  const status = normalizeLeadStatus(body.status);
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };
  if (!status) return { ok: false, status: 400, error: "Unsupported lead status" };
  const lead = await fetchLeadRow(client, leadId);
  if (!lead) return { ok: false, status: 404, error: "Lead not found" };

  const now = new Date().toISOString();
  const response = await fetch(`${client.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(client.key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      status,
      last_activity_at: now
    })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };

  const note = String(body.note || `Status changed to ${status.replaceAll("_", " ")}.`).trim();
  await insertJson(`${client.url}/rest/v1/lead_notes`, client.key, {
    lead_id: leadId,
    author_email: String(user?.email || "").trim().toLowerCase(),
    note_type: "internal",
    note
  }).catch(() => null);
  if (role !== "admin") {
    const reason = ownerReviewReason(status);
    if (reason) await createOwnerReview(client, leadId, user, reason);
  }
  if (isBuyerLead(lead) && status === "won") {
    await notifySameVehicleBuyerLeads(client, lead, {
      excludeLeadId: leadId,
      code: "vehicle_sold",
      message: `This vehicle was committed to another buyer lead: ${leadTitle(lead)}. Review or close the other related inquiries.`
    });
  }

  return { ok: true, lead: data?.[0] || null };
}

async function updateLeadFollowUp(body, user) {
  const client = supabaseClient();
  if (!client.ok) return client;

  const leadId = String(body.leadId || "").trim();
  const dueAt = dateOrNull(body.dueAt);
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };
  if (!dueAt) return { ok: false, status: 400, error: "Valid follow-up date is required" };

  const response = await fetch(`${client.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(client.key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      next_follow_up_at: dueAt,
      last_activity_at: new Date().toISOString()
    })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };

  const note = String(body.note || `Next follow-up set for ${dueAt}.`).trim();
  await insertJson(`${client.url}/rest/v1/lead_notes`, client.key, {
    lead_id: leadId,
    author_email: String(user?.email || "").trim().toLowerCase(),
    note_type: "internal",
    note
  }).catch(() => null);

  return { ok: true, lead: data?.[0] || null };
}

async function touchLead(client, leadId) {
  await fetch(`${client.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ last_activity_at: new Date().toISOString() })
  }).catch(() => null);
}

async function createOwnerReview(client, leadId, user, reason) {
  await insertJson(`${client.url}/rest/v1/lead_notes`, client.key, {
    lead_id: leadId,
    author_email: String(user?.email || "").trim().toLowerCase(),
    note_type: "owner_review",
    note: reason
  }).catch(() => null);
}

async function fetchLeadRow(client, leadId) {
  const response = await fetch(`${client.url}/rest/v1/valuation_leads?select=*&id=eq.${encodeURIComponent(leadId)}&limit=1`, {
    headers: authHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return null;
  return rows?.[0] || null;
}

function leadTitle(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  const raw = String(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" ") || "Vehicle").trim();
  return isBuyerLead(lead) ? raw.replace(/^Buyer inquiry\s*-\s*/i, "") : raw;
}

function ownerReviewReason(status) {
  const value = String(status || "").trim().toLowerCase();
  const labels = {
    inspection_booked: "Inspection appointment booked by staff.",
    appointment_booked: "Buyer appointment booked by staff.",
    finance_sent: "Finance quote sent by staff.",
    offer_sent: "Purchase offer sent by staff.",
    in_inventory: "Seller lead moved into inventory by staff.",
    won: "Lead marked won by staff.",
    lost: "Lead marked lost by staff."
  };
  return labels[value] || "";
}

function supabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };
  return { ok: true, url, key };
}

async function fetchJson(url, key) {
  const response = await fetch(url, { headers: authHeaders(key) });
  const data = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, data };
}

async function insertJson(url, key, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, data };
}

function normalizeNoteType(value) {
  const type = String(value || "internal").trim().toLowerCase();
  return ["call", "email", "sms", "inspection", "correction", "offer", "internal"].includes(type) ? type : "internal";
}

function normalizeLeadStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return [
    "new",
    "assigned",
    "contacted",
    "waiting_for_customer",
    "inspection_booked",
    "appointment_booked",
    "finance_sent",
    "offer_sent",
    "in_inventory",
    "won",
    "lost",
    "closed"
  ].includes(status) ? status : "";
}

function dateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function authHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}
