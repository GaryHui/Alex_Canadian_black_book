export const DEFAULT_OPERATIONS_SETTINGS = {
  timezone: "America/Toronto",
  businessHours: [
    { day: 1, enabled: true, start: "09:00", end: "18:00" },
    { day: 2, enabled: true, start: "09:00", end: "18:00" },
    { day: 3, enabled: true, start: "09:00", end: "18:00" },
    { day: 4, enabled: true, start: "09:00", end: "18:00" },
    { day: 5, enabled: true, start: "09:00", end: "18:00" },
    { day: 6, enabled: true, start: "10:00", end: "17:00" },
    { day: 0, enabled: false, start: "10:00", end: "17:00" }
  ],
  autoReply: {
    enabled: false,
    fromEmail: "",
    subject: "We received your vehicle request",
    body: "Hi {{name}},\n\nThanks for contacting AutoSwitch Canada. We received your {{leadType}} request outside business hours. Our team will review it and follow up during the next business window.\n\nVehicle: {{vehicle}}\n\nThank you,\nAutoSwitch Canada"
  }
};

const SETTINGS_KEY = "operations";

export function normalizeOperationsSettings(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const byDay = new Map((Array.isArray(source.businessHours) ? source.businessHours : [])
    .map((item) => [Number(item?.day), item]));
  return {
    timezone: validTimezone(source.timezone) || DEFAULT_OPERATIONS_SETTINGS.timezone,
    businessHours: DEFAULT_OPERATIONS_SETTINGS.businessHours.map((fallback) => {
      const item = byDay.get(fallback.day) || {};
      return {
        day: fallback.day,
        enabled: typeof item.enabled === "boolean" ? item.enabled : fallback.enabled,
        start: validTime(item.start) || fallback.start,
        end: validTime(item.end) || fallback.end
      };
    }),
    autoReply: {
      enabled: Boolean(source.autoReply?.enabled),
      fromEmail: normalizeEmail(source.autoReply?.fromEmail),
      subject: String(source.autoReply?.subject || DEFAULT_OPERATIONS_SETTINGS.autoReply.subject).trim(),
      body: String(source.autoReply?.body || DEFAULT_OPERATIONS_SETTINGS.autoReply.body).trim()
    }
  };
}

export async function getOperationsSettings(client) {
  if (!client?.url || !client?.key) return { ok: true, storage: "not_configured", settings: DEFAULT_OPERATIONS_SETTINGS };
  const response = await fetch(`${client.url}/rest/v1/dealer_settings?select=value&key=eq.${SETTINGS_KEY}&limit=1`, {
    headers: serviceHeaders(client.key)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: true,
      storage: "missing_table",
      warning: "Create the dealer_settings table in Supabase to save operations settings.",
      settings: DEFAULT_OPERATIONS_SETTINGS
    };
  }
  return {
    ok: true,
    storage: "supabase",
    settings: normalizeOperationsSettings(Array.isArray(data) ? data[0]?.value : null)
  };
}

export async function saveOperationsSettings(client, settings, user) {
  if (!client?.url || !client?.key) return { ok: false, status: 500, error: "Supabase is not configured" };
  const value = normalizeOperationsSettings(settings);
  const response = await fetch(`${client.url}/rest/v1/dealer_settings?on_conflict=key`, {
    method: "POST",
    headers: {
      ...serviceHeaders(client.key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      key: SETTINGS_KEY,
      value,
      updated_by: String(user?.email || "").trim().toLowerCase(),
      updated_at: new Date().toISOString()
    })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, storage: "supabase", settings: normalizeOperationsSettings(data?.[0]?.value || value) };
}

export async function maybeSendAfterHoursAutoReply(client, lead, options = {}) {
  if (!client?.url || !client?.key || !lead?.id) return { ok: false, skipped: "missing_client_or_lead" };
  const settingsResult = await getOperationsSettings(client);
  const settings = settingsResult.settings || DEFAULT_OPERATIONS_SETTINGS;
  if (!settings.autoReply?.enabled) return { ok: true, skipped: "disabled" };
  if (isWithinBusinessHours(settings, new Date())) return { ok: true, skipped: "business_hours" };

  const recipient = leadCustomerEmail(lead);
  if (!recipient) return { ok: true, skipped: "missing_customer_email" };

  const message = buildAutoReplyMessage(settings, lead, options);
  const provider = await sendAutoReplyEmail(message);
  const status = provider.sent ? "auto_replied" : provider.pending ? "auto_reply_pending" : "auto_reply_failed";
  await insertLeadEmail(client, lead.id, {
    sent_by: message.from,
    sent_to: message.to,
    subject: message.subject,
    body: message.body,
    provider_message_id: provider.id || "",
    status
  });
  await insertLeadNote(client, lead.id, {
    author_email: "system",
    note_type: "email",
    note: provider.sent
      ? `After-hours auto reply sent to ${message.to}.`
      : `After-hours auto reply queued for ${message.to}. Configure RESEND_API_KEY to send automatically.`
  });
  return { ok: true, status, provider };
}

export function isWithinBusinessHours(settings, date = new Date()) {
  const local = zonedParts(date, settings.timezone);
  const day = Number(local.weekday);
  const today = settings.businessHours.find((item) => Number(item.day) === day);
  if (!today?.enabled) return false;
  const start = minutesOfDay(today.start);
  const end = minutesOfDay(today.end);
  const now = local.hour * 60 + local.minute;
  if (end <= start) return now >= start || now < end;
  return now >= start && now < end;
}

function buildAutoReplyMessage(settings, lead, options = {}) {
  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const vehicle = String(valuation.title || [input.year, input.make, input.model, input.series].filter(Boolean).join(" ") || "your vehicle").trim();
  const leadType = String(options.leadType || input.leadType || valuation.source || "vehicle").replaceAll("_", " ");
  const name = String(input.ownerName || input.name || "there").trim();
  const values = { name, vehicle, leadType };
  return {
    from: settings.autoReply.fromEmail || process.env.AUTO_REPLY_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "",
    to: leadCustomerEmail(lead),
    subject: template(settings.autoReply.subject, values),
    body: template(settings.autoReply.body, values)
  };
}

async function sendAutoReplyEmail(message) {
  const apiKey = process.env.RESEND_API_KEY || "";
  if (!apiKey || !message.from || !message.to) return { sent: false, pending: true };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.body
    })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { sent: false, pending: false, error: data };
  return { sent: true, id: data?.id || "" };
}

async function insertLeadEmail(client, leadId, payload) {
  await fetch(`${client.url}/rest/v1/lead_emails`, {
    method: "POST",
    headers: { ...serviceHeaders(client.key), "Content-Type": "application/json" },
    body: JSON.stringify({ lead_id: leadId, ...payload })
  }).catch(() => null);
}

async function insertLeadNote(client, leadId, payload) {
  await fetch(`${client.url}/rest/v1/lead_notes`, {
    method: "POST",
    headers: { ...serviceHeaders(client.key), "Content-Type": "application/json" },
    body: JSON.stringify({ lead_id: leadId, ...payload })
  }).catch(() => null);
}

function serviceHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}

function leadCustomerEmail(lead) {
  return normalizeEmail(lead?.input?.email || lead?.auth_email || lead?.auth_user?.email || "");
}

function template(value, map) {
  return String(value || "").replace(/\{\{\s*(name|vehicle|leadType)\s*\}\}/g, (_match, key) => map[key] || "");
}

function zonedParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: validTimezone(timezone) || DEFAULT_OPERATIONS_SETTINGS.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value || "";
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: dayMap[value("weekday")] ?? date.getDay(),
    hour: Number(value("hour") || 0),
    minute: Number(value("minute") || 0)
  };
}

function validTimezone(value) {
  const timezone = String(value || "").trim();
  if (!timezone) return "";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "";
  }
}

function validTime(value) {
  const time = String(value || "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "";
}

function minutesOfDay(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}
