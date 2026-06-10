import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(__dirname, ".env.local"));

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BLACKBOOK_BASE_URL || "https://service.canadianblackbook.com";
const API_PATH = process.env.BLACKBOOK_API_PATH || "/UsedCarWS/CanUsedAPI";
const VALUATION_TEMPLATE = process.env.BLACKBOOK_TEMPLATE || "12";
const LOG_FILE = path.join(__dirname, "server.log");

process.on("uncaughtException", (error) => {
  log(`uncaughtException: ${error.stack || error.message}`);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  log(`unhandledRejection: ${error?.stack || error}`);
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      return sendFile(res, path.join(__dirname, "public", "index.html"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/styles.css") {
      return sendFile(res, path.join(__dirname, "public", "styles.css"), "text/css; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/app.js") {
      return sendFile(res, path.join(__dirname, "public", "app.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/admin.js") {
      return sendFile(res, path.join(__dirname, "public", "admin.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/admin.html") {
      return sendFile(res, path.join(__dirname, "public", "admin.html"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/api/config") {
      return sendJson(res, 200, {
        supabaseUrl: process.env.SUPABASE_URL || "",
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
        siteUrl: process.env.PUBLIC_SITE_URL || "http://localhost:3000"
      });
    }

    if (req.method === "GET" && url.pathname === "/api/usage") {
      const result = await getUsage({
        userId: url.searchParams.get("userId") || "",
        email: url.searchParams.get("email") || "",
        year: Number(url.searchParams.get("year") || new Date().getFullYear())
      });
      return sendJson(res, result.ok ? 200 : 500, result);
    }

    if (url.pathname === "/api/user-limits") {
      const admin = await requireAdmin(req);
      if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
      if (req.method === "GET") {
        const result = await listUserLimits(Number(url.searchParams.get("year") || new Date().getFullYear()));
        return sendJson(res, result.ok ? 200 : 500, result);
      }
      if (req.method === "PATCH") {
        const result = await updateUserLimit(await readJson(req));
        return sendJson(res, result.ok ? 200 : 400, result);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/valuation") {
      const body = await readJson(req);
      const result = await fetchValuation(body);
      return sendJson(res, 200, result);
    }

    if (req.method === "GET" && url.pathname === "/api/autocomplete") {
      const result = await fetchAutocomplete(url.searchParams.get("searchText") || "");
      return sendJson(res, 200, result);
    }

    if (req.method === "GET" && url.pathname === "/api/drilldown") {
      const result = await fetchDrilldown({
        year: url.searchParams.get("year") || "",
        make: url.searchParams.get("make") || "",
        model: url.searchParams.get("model") || "",
        series: url.searchParams.get("series") || "",
        style: url.searchParams.get("style") || "",
        country: url.searchParams.get("country") || "C"
      });
      return sendJson(res, result.ok ? 200 : 500, result);
    }

    if (url.pathname === "/api/leads") {
      if (req.method === "PATCH") {
        const admin = await requireAdmin(req);
        if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
        const body = await readJson(req);
        const result = await updateLead(body);
        return sendJson(res, result.ok ? 200 : 400, result);
      }
      if (req.method === "POST") {
        const body = await readJson(req);
        const result = await saveLead(body);
        return sendJson(res, 200, result);
      }
      if (req.method === "GET") {
        const admin = await requireAdmin(req);
        if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
        return sendJson(res, 200, await listLeads());
      }
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  log(`Black Book demo running at http://localhost:${PORT}`);
});

server.on("error", (error) => {
  log(`server error: ${error.stack || error.message}`);
});

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(message);
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function sendFile(res, filePath, contentType) {
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

async function requireAdmin(req) {
  const adminEmails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.length) {
    return { ok: false, status: 403, error: "Admin access is not configured. Set ADMIN_EMAILS on Vercel." };
  }

  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: "Admin sign-in required" };

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, status: 500, error: "Supabase auth is not configured" };

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`
    }
  });

  const user = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: 401, error: "Invalid or expired admin session" };

  const email = String(user?.email || "").toLowerCase();
  if (!adminEmails.includes(email)) {
    return { ok: false, status: 403, error: `This Google account is not an admin: ${email || "unknown"}` };
  }

  return { ok: true, user: { id: user.id, email } };
}

function bearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

async function fetchValuation(input) {
  const vin = cleanVin(input.vin);
  const uvc = String(input.uvc || "").trim();
  const year = String(input.year || "").trim();
  const make = String(input.make || "").trim();
  const model = cleanUnknown(input.model);
  const series = cleanUnknown(input.series);
  const style = cleanUnknown(input.style);
  const kilometers = Number(input.kilometers || input.mileage || 0);
  const region = String(input.region || "ON").trim();
  const country = String(input.country || "C").trim();
  const language = String(input.language || "en").trim();

  if (!vin && !uvc && !(year && make)) throw new Error("VIN, UVC, or vehicle description is required");
  if (!Number.isFinite(kilometers) || kilometers < 0) throw new Error("Kilometers must be a positive number");

  const username = process.env.BLACKBOOK_USERNAME;
  const password = process.env.BLACKBOOK_PASSWORD;

  if (!username || !password || password === "your_api_password_or_key") {
    return buildDemoResponse(input, mockBlackBookResponse(vin, kilometers, region, country));
  }

  const endpoint = valuationEndpoint({ vin, uvc, year, make });
  endpoint.searchParams.set("country", country);
  endpoint.searchParams.set("language", language);
  endpoint.searchParams.set("customerid", input.customerid || "test");
  if (VALUATION_TEMPLATE) endpoint.searchParams.set("template", VALUATION_TEMPLATE);
  if (region) endpoint.searchParams.set("state", region);
  if (kilometers > 0) endpoint.searchParams.set("mileage", String(kilometers));
  if (model) endpoint.searchParams.set("model", model);
  if (series) endpoint.searchParams.set("series", series);
  if (style) endpoint.searchParams.set("style", style);

  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`
    }
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    return {
      ok: false,
      source: "blackbook",
      status: response.status,
      error: `Black Book API returned ${response.status}`,
      raw: json
    };
  }

  return buildDemoResponse(input, json);
}

async function fetchAutocomplete(searchText) {
  const query = String(searchText || "").trim();
  if (query.length < 2) return { ok: true, items: [] };

  const username = process.env.BLACKBOOK_USERNAME;
  const password = process.env.BLACKBOOK_PASSWORD;
  if (!username || !password || password === "your_api_password_or_key") {
    return { ok: true, source: "mock", items: mockAutocomplete(query) };
  }

  const endpoint = new URL(`${BASE_URL}${API_PATH}/Autocomplete`);
  endpoint.searchParams.set("searchText", query);
  endpoint.searchParams.set("country", "C");
  endpoint.searchParams.set("customerid", "test");

  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`
    }
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    return { ok: false, status: response.status, error: `Black Book API returned ${response.status}`, raw: json };
  }

  return { ok: true, source: "blackbook", items: normalizeAutocomplete(json), raw: json };
}

async function fetchDrilldown(input) {
  const year = String(input.year || "").trim();
  if (!year) return { ok: false, error: "Year is required" };

  const username = process.env.BLACKBOOK_USERNAME;
  const password = process.env.BLACKBOOK_PASSWORD;
  if (!username || !password || password === "your_api_password_or_key") {
    return { ok: true, source: "mock", ...mockDrilldown(input) };
  }

  const segments = ["Drilldown", "ALL", year, input.make]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map(encodeURIComponent);
  const endpoint = new URL(`${BASE_URL}${API_PATH}/${segments.join("/")}`);
  endpoint.searchParams.set("drilldeep", "false");
  endpoint.searchParams.set("getclass", "false");
  endpoint.searchParams.set("country", input.country || "C");
  endpoint.searchParams.set("customerid", "test");

  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`
    }
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    return { ok: false, status: response.status, error: `Black Book API returned ${response.status}`, raw: json };
  }

  return { ok: true, source: "blackbook", ...normalizeDrilldown(json, input), raw: json };
}

function valuationEndpoint({ vin, uvc, year, make }) {
  if (uvc) return new URL(`${BASE_URL}${API_PATH}/UsedVehicle/UVC/${encodeURIComponent(uvc)}`);
  if (year && make) return new URL(`${BASE_URL}${API_PATH}/UsedVehicle/${encodeURIComponent(year)}/${encodeURIComponent(make)}`);
  return new URL(`${BASE_URL}${API_PATH}/UsedVehicle/VIN/${encodeURIComponent(vin)}`);
}

function buildDemoResponse(input, raw) {
  const vehicles = allVehicles(raw);
  const vehicle = chooseVehicle(vehicles, input) || firstVehicle(raw);
  if (!hasVehicleData(vehicle)) {
    return {
      ok: false,
      source: raw?.mock ? "mock" : "blackbook",
      error: "No vehicle matches found. Please search and choose a specific vehicle first.",
      choices: [],
      raw
    };
  }

  const values = extractValues(vehicle);
  const title = vehicleTitle(vehicle, input.vin);
  const vin = cleanVin(input.vin) || vehicle?.vin;
  const kilometers = Number(input.kilometers || input.mileage || 0);
  const regionCode = String(input.region || "ON").trim();

  return {
    ok: true,
    source: raw?.mock ? "mock" : "blackbook",
    title,
    vin,
    kilometers,
    region: regionName(regionCode),
    country: String(input.country || "C").trim(),
    optionsSelected: 0,
    activeMarket: "wholesale",
    columns: ["xclean", "clean", "avg", "rough"],
    values,
    loanValue: findNumber(vehicle, ["loan_value", "finadv", "adjusted_finadv", "finance_advance_value"]),
    thresholds: vehicle?.kilometer_adjustments || null,
    choices: vehicles.length > 1 ? vehicles.map(vehicleChoice) : [],
    input: sanitizeLeadInput(input),
    raw
  };
}

async function saveLead(body) {
  const lead = {
    created_at: new Date().toISOString(),
    input: sanitizeLeadInput(body.input || {}),
    auth_user: sanitizeAuthUser(body.user || {}),
    valuation: sanitizeValuation(body.valuation || {}),
    auth_user_id: String(body.user?.id || "").trim(),
    auth_email: String(body.user?.email || body.input?.email || "").trim(),
    valuation_year: new Date().getFullYear(),
    status: "new",
    notes: "",
    owner_adjustment: {}
  };

  const saved = await saveLeadToSupabase(lead);
  if (saved.ok) return saved;

  return {
    ok: true,
    captured: false,
    storage: "not_configured",
    message: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel to persist leads."
  };
}

async function listLeads() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, storage: "not_configured", leads: [] };

  const response = await fetch(`${url}/rest/v1/valuation_leads?select=*&order=created_at.desc&limit=100`, {
    headers: supabaseServiceHeaders(key)
  });

  const leads = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: leads, leads: [] };
  return { ok: true, storage: "supabase", leads };
}

async function updateLead(body) {
  const id = String(body.id || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!id) return { ok: false, error: "Lead id is required" };
  if (!url || !key) return { ok: false, error: "Supabase is not configured" };

  const patch = {
    status: String(body.status || "reviewing").trim(),
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
      ...supabaseServiceHeaders(key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(patch)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, lead: data?.[0] || null };
}

async function saveLeadToSupabase(lead) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false };

  const result = await insertLead({ url, key, lead });
  if (result.ok) return result;

  const legacyLead = { ...lead };
  delete legacyLead.auth_user_id;
  delete legacyLead.auth_email;
  delete legacyLead.valuation_year;
  const legacyResult = await insertLead({ url, key, lead: legacyLead });
  if (legacyResult.ok) return { ...legacyResult, legacyColumns: true };

  return result;
}

async function insertLead({ url, key, lead }) {
  const response = await fetch(`${url}/rest/v1/valuation_leads`, {
    method: "POST",
    headers: {
      ...supabaseServiceHeaders(key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(lead)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, captured: true, storage: "supabase", lead: data?.[0] || null };
}

const DEFAULT_ANNUAL_LIMIT = Number(process.env.ANNUAL_VALUATION_LIMIT || 3);

async function getUsage({ userId, email, year }) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedEmail = String(email || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!normalizedUserId && !normalizedEmail) {
    return { ok: false, error: "userId or email is required" };
  }

  if (!url || !key) {
    return {
      ok: true,
      storage: "not_configured",
      year,
      used: 0,
      annualLimit: DEFAULT_ANNUAL_LIMIT,
      remaining: DEFAULT_ANNUAL_LIMIT,
      contact: process.env.OWNER_CONTACT || "Please contact the website owner for more valuations."
    };
  }

  const annualLimit = await getAnnualLimit({ url, key, userId: normalizedUserId, year });
  const used = await getUsedCount({ url, key, userId: normalizedUserId, email: normalizedEmail, year });

  if (annualLimit.error || used.error) return { ok: false, error: annualLimit.error || used.error };

  return {
    ok: true,
    storage: "supabase",
    year,
    used: used.count,
    annualLimit: annualLimit.limit,
    remaining: Math.max(0, annualLimit.limit - used.count),
    contact: process.env.OWNER_CONTACT || "Please contact the website owner for more valuations."
  };
}

async function getAnnualLimit({ url, key, userId, year }) {
  if (!userId) return { limit: DEFAULT_ANNUAL_LIMIT };

  const response = await fetch(`${url}/rest/v1/valuation_user_limits?select=annual_limit&user_id=eq.${encodeURIComponent(userId)}&valuation_year=eq.${year}&limit=1`, {
    headers: supabaseServiceHeaders(key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return { error: `Unable to load valuation limit (${response.status})` };

  return { limit: Number(rows?.[0]?.annual_limit || DEFAULT_ANNUAL_LIMIT) };
}

async function getUsedCount({ url, key, userId, email, year }) {
  const filter = userId
    ? `auth_user_id=eq.${encodeURIComponent(userId)}`
    : `auth_email=eq.${encodeURIComponent(email)}`;
  const response = await fetch(`${url}/rest/v1/valuation_leads?select=id&${filter}&valuation_year=eq.${year}`, {
    headers: supabaseServiceHeaders(key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return { error: `Unable to load valuation usage (${response.status})` };

  return { count: Array.isArray(rows) ? rows.length : 0 };
}

async function listUserLimits(year) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, storage: "not_configured", users: [] };

  const [leadsResult, limitsResult] = await Promise.all([
    fetchSupabaseJson(`${url}/rest/v1/valuation_leads?select=auth_user_id,auth_email&valuation_year=eq.${year}`, key),
    fetchSupabaseJson(`${url}/rest/v1/valuation_user_limits?select=*&valuation_year=eq.${year}`, key)
  ]);

  if (!leadsResult.ok) return leadsResult;
  if (!limitsResult.ok) return limitsResult;

  const limitsByUser = new Map((limitsResult.data || []).map((limit) => [limit.user_id, limit]));
  const usersById = new Map();

  for (const lead of leadsResult.data || []) {
    const userId = lead.auth_user_id || lead.auth_email;
    if (!userId) continue;
    const current = usersById.get(userId) || { userId, email: lead.auth_email || "", used: 0 };
    current.used += 1;
    if (!current.email && lead.auth_email) current.email = lead.auth_email;
    usersById.set(userId, current);
  }

  for (const limit of limitsResult.data || []) {
    const userId = limit.user_id;
    if (!userId) continue;
    const current = usersById.get(userId) || { userId, email: limit.email || "", used: 0 };
    current.email = current.email || limit.email || "";
    usersById.set(userId, current);
  }

  const users = [...usersById.values()]
    .map((user) => {
      const limit = limitsByUser.get(user.userId);
      const annualLimit = Number(limit?.annual_limit || DEFAULT_ANNUAL_LIMIT);
      return {
        ...user,
        year,
        annualLimit,
        remaining: Math.max(0, annualLimit - user.used)
      };
    })
    .sort((a, b) => (a.email || a.userId).localeCompare(b.email || b.userId));

  return { ok: true, storage: "supabase", year, users };
}

async function updateUserLimit(body) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "Supabase is not configured" };

  const userId = String(body.userId || "").trim();
  const email = String(body.email || "").trim();
  const year = Number(body.year || new Date().getFullYear());
  const annualLimit = Number(body.annualLimit);

  if (!userId) return { ok: false, error: "User id is required" };
  if (!Number.isInteger(annualLimit) || annualLimit < 0) {
    return { ok: false, error: "Annual limit must be 0 or more" };
  }

  const response = await fetch(`${url}/rest/v1/valuation_user_limits?on_conflict=user_id,valuation_year`, {
    method: "POST",
    headers: {
      ...supabaseServiceHeaders(key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      user_id: userId,
      email,
      valuation_year: year,
      annual_limit: annualLimit,
      updated_at: new Date().toISOString()
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, limit: data?.[0] || null };
}

async function fetchSupabaseJson(url, key) {
  const response = await fetch(url, { headers: supabaseServiceHeaders(key) });
  const data = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, data };
}

function supabaseServiceHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
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
    color: String(input.color || "").trim(),
    region: String(input.region || "").trim(),
    country: String(input.country || "").trim()
  };
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

function allVehicles(raw) {
  const candidates = [
    raw?.used_vehicles?.used_vehicle_list,
    raw?.used_vehicle?.used_vehicles,
    raw?.used_vehicle?.usedvehicles,
    raw?.usedvehicles?.usedvehicles,
    raw?.usedvehicles,
    raw?.used_vehicles,
    raw?.vehicle_list,
    raw?.vehicles
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") return [candidate];
  }

  return raw?.vehicle ? [raw.vehicle] : [];
}

function chooseVehicle(vehicles, input) {
  if (!vehicles.length) return null;
  const uvc = String(input.uvc || "").trim();
  if (uvc) return vehicles.find((vehicle) => String(vehicle.uvc || "") === uvc) || vehicles[0];
  return vehicles[0];
}

function vehicleChoice(vehicle) {
  return {
    uvc: vehicle.uvc || "",
    title: vehicleTitle(vehicle),
    year: vehicle.model_year || vehicle.year || "",
    make: vehicle.make || "",
    model: vehicle.model || "",
    series: vehicle.series || "",
    style: vehicle.style || "",
    adjustedWholesaleAvg: findMarketNumber(vehicle, ["adjusted"], ["whole"], "avg"),
    adjustedRetailAvg: findMarketNumber(vehicle, ["adjusted"], ["retail"], "avg")
  };
}

function firstVehicle(raw) {
  const candidates = [
    raw?.used_vehicles?.used_vehicle_list,
    raw?.used_vehicle?.used_vehicles,
    raw?.used_vehicle?.usedvehicles,
    raw?.usedvehicles?.usedvehicles,
    raw?.usedvehicles,
    raw?.used_vehicles,
    raw?.vehicle_list,
    raw?.vehicles
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate[0];
    if (candidate && typeof candidate === "object") return candidate;
  }

  return raw?.vehicle || raw;
}

function normalizeAutocomplete(raw) {
  const arrays = [];
  collectArrays(raw, arrays);
  const best = arrays.sort((a, b) => b.length - a.length)[0] || [];
  return best
    .filter((item) => item && typeof item === "object")
    .slice(0, 20)
    .map((item) => ({
      uvc: item.uvc || item.UVC || item.value || "",
      year: item.model_year || item.year || "",
      make: item.make || "",
      model: item.model || "",
      series: item.series || item.trim || "",
      style: item.style || "",
      title: item.description || item.vehicle_description || item.text || vehicleTitle(item)
    }))
    .filter((item) => item.title && item.title !== "Vehicle ");
}

function normalizeDrilldown(raw, input = {}) {
  const selectedMake = String(input.make || "").trim();
  const selectedModel = cleanUnknown(input.model);
  const selectedSeries = cleanUnknown(input.series);
  const makeNodes = collectListItems(raw, "make_list");
  const activeMakeNodes = selectedMake
    ? makeNodes.filter((node) => sameName(node?.name, selectedMake))
    : makeNodes;
  const modelNodes = activeMakeNodes.flatMap((make) => arrayOf(make?.model_list));
  const activeModelNodes = selectedModel
    ? modelNodes.filter((node) => sameName(node?.name, selectedModel))
    : [];
  const seriesNodes = activeModelNodes.flatMap((model) => arrayOf(model?.series_list));
  const activeSeriesNodes = selectedSeries
    ? seriesNodes.filter((node) => sameName(node?.name, selectedSeries))
    : seriesNodes;
  const styleNodes = activeSeriesNodes.flatMap((seriesItem) => arrayOf(seriesItem?.style_list));

  const makes = selectedMake
    ? uniqueSorted(activeMakeNodes.map((item) => item?.name))
    : uniqueSorted(makeNodes.map((item) => item?.name));
  const models = uniqueSorted(modelNodes.map((item) => item?.name));
  const series = selectedModel ? uniqueSorted(seriesNodes.map((item) => item?.name)) : [];
  const styles = selectedModel ? uniqueSorted(styleNodes.map((item) => item?.name)) : [];
  const vehicles = selectedModel
    ? styleNodes.map((style) => ({
      uvc: style.uvc || "",
      title: [input.year, selectedMake, selectedModel, selectedSeries || "", style.name || ""].filter(Boolean).join(" "),
      year: String(input.year || ""),
      make: selectedMake,
      model: selectedModel,
      series: selectedSeries || "",
      style: style.name || ""
    }))
    : allVehicles(raw).map(vehicleChoice).filter((item) => item.title && item.title !== "Vehicle ");

  return {
    year: String(input.year || ""),
    makes,
    models,
    series,
    styles,
    vehicles
  };
}

function collectListItems(value, listKey, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectListItems(item, listKey, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;

  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === listKey) {
      output.push(...arrayOf(child));
    }
    collectListItems(child, listKey, output);
  }

  return output;
}

function arrayOf(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function sameName(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function collectNamedValues(raw, valueKeys, containerKeys) {
  const values = new Set();
  visitMatchingContainers(raw, containerKeys, (item) => {
    if (typeof item === "string" || typeof item === "number") {
      values.add(String(item).trim());
      return;
    }
    if (!item || typeof item !== "object") return;
    for (const key of valueKeys) {
      const direct = item[key] ?? item[key.toUpperCase()];
      if (direct !== undefined && direct !== null && String(direct).trim()) {
        values.add(String(direct).trim());
        return;
      }
    }
  });
  return [...values].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function visitMatchingContainers(value, containerKeys, callback) {
  if (Array.isArray(value)) {
    value.forEach((item) => visitMatchingContainers(item, containerKeys, callback));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (containerKeys.some((container) => normalizedKey === container || normalizedKey.endsWith(`_${container}`))) {
      const items = Array.isArray(child) ? child : [child];
      items.forEach(callback);
    }
    visitMatchingContainers(child, containerKeys, callback);
  }
}

function collectArrays(value, arrays) {
  if (Array.isArray(value)) {
    arrays.push(value);
    value.forEach((item) => collectArrays(item, arrays));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectArrays(item, arrays));
  }
}

function extractValues(vehicle = {}) {
  return {
    wholesale: extractMarket(vehicle, "whole"),
    retail: extractMarket(vehicle, "retail"),
    tradeIn: extractMarket(vehicle, "trade")
  };
}

function extractMarket(vehicle, market) {
  const aliases = market === "trade" ? ["trade", "tradein", "trade_in"] : [market];
  const rowNames = {
    base: ["base"],
    options: ["add_deduct", "options", "option"],
    mileage: ["mileage", "kilometer", "km"],
    region: ["regional", "region"],
    adjusted: ["adjusted"]
  };
  const conditions = ["xclean", "clean", "avg", "rough"];
  const output = {};

  for (const [row, prefixes] of Object.entries(rowNames)) {
    output[row] = {};
    for (const condition of conditions) {
      output[row][condition] = findMarketNumber(vehicle, prefixes, aliases, condition);
    }
  }

  return output;
}

function findMarketNumber(vehicle, rowPrefixes, marketAliases, condition) {
  const conditionAliases = condition === "xclean" ? ["xclean", "extra_clean", "xcln"] : [condition];
  const keys = Object.keys(vehicle || {});

  for (const row of rowPrefixes) {
    for (const market of marketAliases) {
      for (const cond of conditionAliases) {
        const exact = `${row}_${market}_${cond}`;
        if (isNumberLike(vehicle[exact])) return Number(vehicle[exact]);
      }
    }
  }

  for (const key of keys) {
    const normalized = key.toLowerCase();
    if (
      rowPrefixes.some((row) => normalized.includes(row)) &&
      marketAliases.some((market) => normalized.includes(market)) &&
      conditionAliases.some((cond) => normalized.includes(cond)) &&
      isNumberLike(vehicle[key])
    ) {
      return Number(vehicle[key]);
    }
  }

  return null;
}

function findNumber(object, keys) {
  for (const key of keys) {
    if (isNumberLike(object?.[key])) return Number(object[key]);
  }
  return null;
}

function isNumberLike(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function vehicleTitle(vehicle = {}, fallbackVin = "") {
  const year = vehicle.model_year || vehicle.year;
  const make = vehicle.make;
  const model = vehicle.model;
  const series = vehicle.series || vehicle.trim;
  const style = vehicle.style || vehicle.body_style;
  const parts = [year, make, model, series, style].filter(Boolean);
  return parts.length ? parts.join(" ") : `Vehicle ${cleanVin(fallbackVin)}`;
}

function cleanVin(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanUnknown(value) {
  const text = String(value || "").trim();
  return text.toLowerCase() === "not sure" ? "" : text;
}

function hasVehicleData(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return false;
  if (vehicle.uvc || vehicle.vin || vehicle.model_year || vehicle.year || vehicle.make || vehicle.model) return true;
  const values = extractValues(vehicle);
  return ["wholesale", "retail", "tradeIn"].some((market) =>
    Object.values(values[market] || {}).some((row) =>
      Object.values(row || {}).some((value) => value !== null && value !== undefined)
    )
  );
}

function regionName(code) {
  const regions = {
    AB: "Alberta",
    BC: "British Columbia",
    MB: "Manitoba",
    NB: "New Brunswick",
    NL: "Newfoundland and Labrador",
    NS: "Nova Scotia",
    NT: "Northwest Territories",
    NU: "Nunavut",
    ON: "Ontario",
    PE: "Prince Edward Island",
    QC: "Quebec",
    SK: "Saskatchewan",
    YT: "Yukon"
  };
  return regions[String(code || "").toUpperCase()] || code || "Ontario";
}

function mockBlackBookResponse(vin, kilometers, region, country) {
  return {
    mock: true,
    used_vehicle: {
      used_vehicles: [
        {
          vin,
          model_year: "2024",
          make: "Lexus",
          model: "NX-Series",
          series: "NX350 Premium",
          style: "4D Utility AWD",
          base_whole_xclean: 44200,
          base_whole_clean: 42600,
          base_whole_avg: 40350,
          base_whole_rough: 38200,
          mileage_whole_xclean: 1025,
          mileage_whole_clean: 1550,
          mileage_whole_avg: 2075,
          mileage_whole_rough: 2575,
          regional_whole_xclean: 2652,
          regional_whole_clean: 2556,
          regional_whole_avg: 2421,
          regional_whole_rough: 2292,
          add_deduct_whole_xclean: 0,
          add_deduct_whole_clean: 0,
          add_deduct_whole_avg: 0,
          add_deduct_whole_rough: 0,
          adjusted_whole_xclean: 47877,
          adjusted_whole_clean: 46706,
          adjusted_whole_avg: 44846,
          adjusted_whole_rough: 43067,
          base_retail_xclean: 50100,
          base_retail_clean: 48600,
          base_retail_avg: 46300,
          base_retail_rough: 44100,
          mileage_retail_xclean: 1200,
          mileage_retail_clean: 1700,
          mileage_retail_avg: 2200,
          mileage_retail_rough: 2700,
          regional_retail_xclean: 3006,
          regional_retail_clean: 2916,
          regional_retail_avg: 2778,
          regional_retail_rough: 2646,
          add_deduct_retail_xclean: 0,
          add_deduct_retail_clean: 0,
          add_deduct_retail_avg: 0,
          add_deduct_retail_rough: 0,
          adjusted_retail_xclean: 54306,
          adjusted_retail_clean: 53216,
          adjusted_retail_avg: 51278,
          adjusted_retail_rough: 49446,
          kilometer_adjustments: {
            xclean_km_threshold: 136000,
            clean_km_threshold: 213000,
            avg_km_threshold: 253000,
            rough_km_threshold: 273000,
            cents_per_kilometer: 0.1
          },
          loan_value: 41924,
          region,
          country,
          input_kilometers: kilometers
        }
      ]
    }
  };
}

function mockAutocomplete(query) {
  const items = [
    {
      uvc: "2017080342",
      year: "2017",
      make: "Honda",
      model: "Odyssey",
      series: "LX",
      style: "4D Wagon",
      title: "2017 Honda Odyssey LX 4D Wagon"
    },
    {
      uvc: "2024500170",
      year: "2024",
      make: "Lexus",
      model: "NX-Series",
      series: "NX350 Premium",
      style: "4D Utility AWD",
      title: "2024 Lexus NX-Series NX350 Premium 4D Utility AWD"
    },
    {
      uvc: "2024500163",
      year: "2024",
      make: "Lexus",
      model: "NX-Series",
      series: "NX350 Ultra Premium",
      style: "4D Utility AWD",
      title: "2024 Lexus NX-Series NX350 Ultra Premium 4D Utility AWD"
    }
  ];
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => words.every((word) => item.title.toLowerCase().includes(word)));
}

function mockDrilldown(input = {}) {
  const year = String(input.year || "");
  const make = String(input.make || "");
  const model = String(input.model || "");

  const data = {
    makes: commonMockMakes(),
    models: {
      Honda: ["Accord", "Civic", "CR-V", "Odyssey", "Pilot"],
      Lexus: ["ES-Series", "IS-Series", "NX-Series", "RX-Series"],
      Toyota: ["Camry", "Corolla", "RAV4", "Sienna"]
    },
    series: {
      "Honda|Odyssey": ["LX", "EX", "EX-L", "Touring"],
      "Lexus|NX-Series": ["NX250", "NX350 Premium", "NX350 Ultra Premium", "NX350h"]
    },
    styles: {
      "Honda|Odyssey": ["4D Wagon"],
      "Lexus|NX-Series": ["4D Utility AWD"]
    }
  };

  return {
    year,
    makes: data.makes,
    models: make ? data.models[make] || [] : [],
    series: make && model ? data.series[`${make}|${model}`] || [] : [],
    styles: make && model ? data.styles[`${make}|${model}`] || [] : [],
    vehicles: []
  };
}

function commonMockMakes() {
  return ["Acura", "Audi", "BMW", "Ford", "Honda", "Lexus", "Mazda", "Mercedes-Benz", "Toyota", "Volkswagen"];
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
