import http from "node:http";
import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  attachLeadSignals,
  buildVehicleClusters,
  isBuyerLead,
  notifyDuplicateSellerLead,
  reviewDuplicateSellerLead
} from "./api/_lead-signals.js";
import {
  getOperationsSettings,
  maybeSendAfterHoursAutoReply,
  saveOperationsSettings
} from "./api/_operations-settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(__dirname, ".env.local"));

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BLACKBOOK_BASE_URL || "https://service.canadianblackbook.com";
const API_PATH = process.env.BLACKBOOK_API_PATH || "/UsedCarWS/CanUsedAPI";
const VALUATION_TEMPLATE = process.env.BLACKBOOK_TEMPLATE || "12";
const LOG_FILE = path.join(__dirname, "server.log");
const MAX_LEAD_PHOTOS = 20;
const PUBLIC_LEAD_RATE_WINDOW_MS = 60 * 60 * 1000;
const PUBLIC_LEAD_RATE_LIMIT = 8;
const publicLeadRateBuckets = new Map();
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com"
]);

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
      return sendFile(res, path.join(__dirname, "public", "home.html"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && (url.pathname === "/sell" || url.pathname === "/sell.html")) {
      return sendFile(res, path.join(__dirname, "public", "customer.html"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && (url.pathname === "/buy" || url.pathname === "/buy.html")) {
      return sendFile(res, path.join(__dirname, "public", "buy.html"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && (url.pathname === "/dealer" || url.pathname === "/dealer.html")) {
      return sendFile(res, path.join(__dirname, "public", "index.html"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && (url.pathname === "/customer" || url.pathname === "/customer.html")) {
      return sendFile(res, path.join(__dirname, "public", "customer.html"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/login.html") {
      return sendFile(res, path.join(__dirname, "public", "login.html"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/styles.css") {
      return sendFile(res, path.join(__dirname, "public", "styles.css"), "text/css; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/customer.css") {
      return sendFile(res, path.join(__dirname, "public", "customer.css"), "text/css; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/app.js") {
      return sendFile(res, path.join(__dirname, "public", "app.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/customer.js") {
      return sendFile(res, path.join(__dirname, "public", "customer.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/home.js") {
      return sendFile(res, path.join(__dirname, "public", "home.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/buy.js") {
      return sendFile(res, path.join(__dirname, "public", "buy.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/login.js") {
      return sendFile(res, path.join(__dirname, "public", "login.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/turnstile.js") {
      return sendFile(res, path.join(__dirname, "public", "turnstile.js"), "application/javascript; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/contact.js") {
      return sendFile(res, path.join(__dirname, "public", "contact.js"), "application/javascript; charset=utf-8");
    }

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/assets/home-hero-car.png") {
      return sendFile(res, path.join(__dirname, "public", "assets", "home-hero-car.png"), "image/png");
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
        siteUrl: process.env.PUBLIC_SITE_URL || requestOrigin(req),
        turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || "",
        publicDealer: {
          name: process.env.PUBLIC_DEALER_NAME || "AutoSwitch Canada",
          phone: process.env.PUBLIC_DEALER_PHONE || "",
          address: process.env.PUBLIC_DEALER_ADDRESS || ""
        }
      });
    }

    if (req.method === "POST" && url.pathname === "/api/turnstile-verify") {
      const body = await readJson(req);
      const result = await verifyTurnstile(body, req);
      return sendJson(res, result.status || (result.ok ? 200 : 403), result);
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

    if (req.method === "GET" && url.pathname === "/api/admin-check") {
      const admin = await requireAdmin(req);
      if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
      return sendJson(res, 200, { ok: true, user: admin.user });
    }

    if (req.method === "GET" && url.pathname === "/api/dealer-check") {
      const dealer = await requireDealer(req);
      if (!dealer.ok) return sendJson(res, dealer.status, { ok: false, error: dealer.error });
      return sendJson(res, 200, { ok: true, user: dealer.user, role: dealer.role });
    }

    if (req.method === "GET" && url.pathname === "/api/dealer-leads") {
      const dealer = await requireDealer(req);
      if (!dealer.ok) return sendJson(res, dealer.status, { ok: false, error: dealer.error });
      const result = await listDealerLeads(dealer);
      return sendJson(res, result.ok ? 200 : result.status || 500, result);
    }

    if (req.method === "GET" && url.pathname === "/api/dealer-inventory") {
      const dealer = await requireDealer(req);
      if (!dealer.ok) return sendJson(res, dealer.status, { ok: false, error: dealer.error });
      const result = await listDealerInventory(dealer);
      return sendJson(res, result.ok ? 200 : result.status || 500, result);
    }

    if (url.pathname === "/api/dealer-staff") {
      const admin = await requireAdmin(req);
      if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });

      if (req.method === "GET") {
        const result = await listDealerStaff();
        return sendJson(res, result.ok ? 200 : 500, result);
      }
      if (req.method === "POST") {
        const result = await addDealerStaff(await readJson(req), admin.user);
        return sendJson(res, result.ok ? 200 : 400, result);
      }
      if (req.method === "DELETE") {
        const result = await deleteDealerStaff(url.searchParams.get("email") || "");
        return sendJson(res, result.ok ? 200 : 400, result);
      }
    }

    if (url.pathname === "/api/operations-settings") {
      const admin = await requireAdmin(req);
      if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
      const client = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
      if (req.method === "GET") {
        const result = await getOperationsSettings(client);
        return sendJson(res, result.ok ? 200 : result.status || 500, result);
      }
      if (req.method === "PATCH") {
        const body = await readJson(req);
        const result = await saveOperationsSettings(client, body.settings || body || {}, admin.user);
        return sendJson(res, result.ok ? 200 : result.status || 400, result);
      }
    }

    if (req.method === "GET" && url.pathname === "/api/dealer-directory") {
      const dealer = await requireDealer(req);
      if (!dealer.ok) return sendJson(res, dealer.status, { ok: false, error: dealer.error });
      const result = await listDealerDirectory();
      return sendJson(res, result.ok ? 200 : result.status || 500, result);
    }

    if (req.method === "GET" && url.pathname === "/api/inventory") {
      const result = await listPublishedInventory();
      return sendJson(res, result.ok ? 200 : result.status || 500, result);
    }

    if (url.pathname === "/api/buyer-inquiries") {
      if (req.method === "POST") {
        const body = await readJson(req);
        const protection = await protectPublicLeadSubmission(body, req, "buyer_inquiry");
        if (!protection.ok) return sendJson(res, protection.status || 400, protection);
        const result = await createBuyerInquiry(body);
        return sendJson(res, result.ok ? 200 : result.status || 400, result);
      }
      if (req.method === "GET") {
        const admin = await requireAdmin(req);
        if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
        const result = await listBuyerInquiries();
        return sendJson(res, result.ok ? 200 : result.status || 500, result);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/inventory/from-lead") {
      const admin = await requireAdmin(req);
      if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
      const result = await publishLeadToInventory(await readJson(req), admin.user);
      return sendJson(res, result.ok ? 200 : result.status || 400, result);
    }

    if (url.pathname === "/api/admin-inventory") {
      const admin = await requireAdmin(req);
      if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
      if (req.method === "GET") {
        const result = await listAdminInventory();
        return sendJson(res, result.ok ? 200 : result.status || 500, result);
      }
      if (req.method === "PATCH") {
        const result = await updateInventoryListing(await readJson(req), admin.user);
        return sendJson(res, result.ok ? 200 : result.status || 400, result);
      }
      if (req.method === "DELETE") {
        const result = await deleteInventoryListing(url.searchParams.get("id") || "", admin.user);
        return sendJson(res, result.ok ? 200 : result.status || 400, result);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/inventory-photos") {
      const admin = await requireAdmin(req);
      if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
      const result = await uploadInventoryPhotos(await readJson(req), admin.user);
      return sendJson(res, result.ok ? 200 : result.status || 400, result);
    }

    if (req.method === "POST" && url.pathname === "/api/inventory-photo") {
      const admin = await requireAdmin(req);
      if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
      const result = await deleteInventoryPhoto(await readJson(req), admin.user);
      return sendJson(res, result.ok ? 200 : result.status || 400, result);
    }

    if (req.method === "POST" && url.pathname === "/api/inventory-photo-sync") {
      const admin = await requireAdmin(req);
      if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
      const result = await syncInventoryDrivePhotos(await readJson(req), admin.user);
      return sendJson(res, result.ok ? 200 : result.status || 400, result);
    }

    if (req.method === "POST" && url.pathname === "/api/lead-photos") {
      const dealer = await requireDealer(req);
      if (!dealer.ok) return sendJson(res, dealer.status, { ok: false, error: dealer.error });
      const body = await readJson(req);
      const access = await canAccessLead(body.leadId, dealer);
      if (!access.ok) return sendJson(res, access.status || 403, { ok: false, error: access.error });
      const result = await uploadLeadPhotos(body, dealer.user, dealer.role);
      return sendJson(res, result.ok ? 200 : result.status || 400, result);
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

    if (req.method === "GET" && url.pathname === "/api/my-leads") {
      const auth = await requireUser(req);
      if (!auth.ok) return sendJson(res, auth.status, { ok: false, error: auth.error });
      const result = await listMyLeads(auth.user);
      return sendJson(res, result.ok ? 200 : 500, result);
    }

    if (req.method === "DELETE" && url.pathname === "/api/my-leads") {
      const auth = await requireUser(req);
      if (!auth.ok) return sendJson(res, auth.status, { ok: false, error: auth.error });
      const result = await deleteMyLead(auth.user, url.searchParams.get("id") || "");
      return sendJson(res, result.ok ? 200 : result.status || 400, result);
    }

    if (url.pathname === "/api/vehicle-clusters") {
      const admin = await requireAdmin(req);
      if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
      if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Method not allowed" });
      const supabaseUrl = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !key) {
        return sendJson(res, 200, { ok: true, storage: "not_configured", clusters: [] });
      }
      const clusters = await buildVehicleClusters({ url: supabaseUrl, key });
      return sendJson(res, 200, {
        ok: true,
        storage: "supabase",
        clusters,
        summary: {
          clusters: clusters.length,
          needsReview: clusters.filter((item) => Number(item.needs_review_count || 0) > 0).length
        }
      });
    }

    if (url.pathname === "/api/leads") {
      if (req.method === "PATCH") {
        const admin = await requireAdmin(req);
        if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
        const body = await readJson(req);
        const result = body.action === "owner_read"
          ? await markOwnerRead(body, admin.user)
          : body.action === "duplicate_review"
            ? await markDuplicateReview(body, admin.user)
          : await updateLead(body);
        return sendJson(res, result.ok ? 200 : 400, result);
      }
      if (req.method === "POST") {
        const body = await readJson(req);
        if (!body.input?.createdByDealer) {
          const protection = await protectPublicLeadSubmission(body, req, "seller_lead");
          if (!protection.ok) return sendJson(res, protection.status || 400, protection);
        }
        const result = await saveLead(body);
        return sendJson(res, 200, result);
      }
      if (req.method === "GET") {
        const admin = await requireAdmin(req);
        if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
        return sendJson(res, 200, await listLeads());
      }
      if (req.method === "DELETE") {
        const admin = await requireAdmin(req);
        if (!admin.ok) return sendJson(res, admin.status, { ok: false, error: admin.error });
        const result = await deleteLeadRecords({
          id: url.searchParams.get("id") || "",
          confirm: url.searchParams.get("confirm") || ""
        });
        return sendJson(res, result.ok ? 200 : result.status || 400, result);
      }
    }

    if (url.pathname === "/api/lead-activity") {
      const dealer = await requireDealer(req);
      if (!dealer.ok) return sendJson(res, dealer.status, { ok: false, error: dealer.error });
      if (req.method === "GET") {
        const leadId = url.searchParams.get("leadId") || "";
        const access = await canAccessLead(leadId, dealer);
        if (!access.ok) return sendJson(res, access.status || 403, access);
        const result = await listLeadActivity(leadId);
        return sendJson(res, result.ok ? 200 : result.status || 400, result);
      }
      if (req.method === "POST") {
        const body = await readJson(req);
        const access = await canAccessLead(body.leadId, dealer);
        if (!access.ok) return sendJson(res, access.status || 403, access);
        const result = await createLeadActivity(body, dealer.user, dealer.role);
        return sendJson(res, result.ok ? 200 : result.status || 400, result);
      }
      if (req.method === "PATCH") {
        const body = await readJson(req);
        const access = await canAccessLead(body.leadId, dealer);
        if (!access.ok) return sendJson(res, access.status || 403, access);
        const result = body.action === "status"
          ? await updateLeadStatusFromActivity(body, dealer.user, dealer.role)
          : body.action === "follow_up"
            ? await updateLeadFollowUpFromActivity(body, dealer.user)
            : body.action === "owner_info"
              ? await updateLeadOwnerInfoFromActivity(body, dealer.user, dealer.role)
            : await updateLeadTask(body, dealer.user, dealer.role);
        return sendJson(res, result.ok ? 200 : result.status || 400, result);
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

function requestOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`).split(",")[0].trim();
  return `${proto}://${host}`;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 10_000_000) {
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

async function protectPublicLeadSubmission(body, req, leadType) {
  const protection = body?.protection || {};
  if (String(protection.honeypot || body.companyWebsite || body.website || "").trim()) {
    return { ok: false, status: 400, error: "Submission could not be accepted." };
  }

  const contact = publicLeadContact(body, leadType);
  if (contact.email) {
    const emailCheck = await validateLeadEmail(contact.email);
    if (!emailCheck.ok) return emailCheck;
  }
  if (looksLikeSpamText([body.message, body.input?.conditionNotes, body.input?.notes].join(" "))) {
    return { ok: false, status: 400, error: "Submission could not be accepted." };
  }

  const rate = checkPublicLeadRateLimit(req, leadType, contact);
  if (!rate.ok) return rate;

  const turnstile = await verifyTurnstile({
    token: protection.turnstileToken || body.turnstileToken || "",
    action: leadType
  }, req);
  if (!turnstile.ok) {
    return {
      ok: false,
      status: turnstile.status || 403,
      error: turnstile.error || "Complete the human verification first."
    };
  }
  return { ok: true };
}

function publicLeadContact(body, leadType) {
  if (leadType === "buyer_inquiry") {
    return {
      email: normalizePublicEmail(body.email),
      phone: normalizePublicPhone(body.phone),
      vehicleKey: String(body.listingId || body.vehicle?.id || "").trim()
    };
  }
  const input = body.input || {};
  return {
    email: normalizePublicEmail(input.email || input.ownerEmail || body.user?.email || ""),
    phone: normalizePublicPhone(input.phone || input.ownerPhone || ""),
    vehicleKey: cleanVin(input.vin) || [input.year, input.make, input.model].filter(Boolean).join("-").toLowerCase()
  };
}

function checkPublicLeadRateLimit(req, leadType, contact) {
  const now = Date.now();
  for (const [key, bucket] of publicLeadRateBuckets) {
    if (now - bucket.startedAt > PUBLIC_LEAD_RATE_WINDOW_MS) publicLeadRateBuckets.delete(key);
  }
  const keys = [
    `${leadType}:ip:${requestIp(req)}`,
    contact.email ? `${leadType}:email:${contact.email}` : "",
    contact.phone ? `${leadType}:phone:${contact.phone}` : "",
    contact.vehicleKey ? `${leadType}:vehicle:${contact.vehicleKey}` : ""
  ].filter(Boolean);
  for (const key of keys) {
    const bucket = publicLeadRateBuckets.get(key) || { count: 0, startedAt: now };
    if (now - bucket.startedAt > PUBLIC_LEAD_RATE_WINDOW_MS) {
      bucket.count = 0;
      bucket.startedAt = now;
    }
    bucket.count += 1;
    publicLeadRateBuckets.set(key, bucket);
    if (bucket.count > PUBLIC_LEAD_RATE_LIMIT) {
      return { ok: false, status: 429, error: "Too many submissions. Please try again later." };
    }
  }
  return { ok: true };
}

function requestIp(req) {
  return String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

function normalizePublicEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePublicPhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

async function validateLeadEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
    return { ok: false, status: 400, error: "Please enter a valid email address." };
  }
  const domain = email.split("@").pop();
  if (!domain || DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { ok: false, status: 400, error: "Please use a real contact email." };
  }
  if (process.env.SKIP_EMAIL_DOMAIN_CHECK === "1") return { ok: true };
  try {
    const mx = await dns.resolveMx(domain);
    if (Array.isArray(mx) && mx.length) return { ok: true };
  } catch {}
  try {
    await dns.resolve4(domain);
    return { ok: true };
  } catch {}
  try {
    await dns.resolve6(domain);
    return { ok: true };
  } catch {}
  return { ok: false, status: 400, error: "This email domain does not appear to receive email." };
}

function looksLikeSpamText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const links = text.match(/https?:\/\//gi) || [];
  if (links.length > 2) return true;
  if (text.length > 2500) return true;
  return /\b(casino|crypto giveaway|loan guaranteed|seo backlinks)\b/i.test(text);
}

async function verifyTurnstile(body, req) {
  const siteKey = process.env.TURNSTILE_SITE_KEY || "";
  const secret = process.env.TURNSTILE_SECRET_KEY || "";
  if (!secret) {
    if (!siteKey) return { ok: true, skipped: true };
    return { ok: false, status: 500, error: "Human verification is not configured correctly." };
  }

  const token = String(body?.token || "").trim();
  const expectedAction = String(body?.action || "login").trim();
  if (!token) return { ok: false, status: 400, error: "Human verification token is missing." };

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  const ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"];
  if (ip) form.set("remoteip", String(ip).split(",")[0].trim());

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form
    });
    const data = await response.json().catch(() => ({}));
    if (!data.success) {
      return { ok: false, error: "Human verification failed.", codes: data["error-codes"] || [] };
    }
    if (expectedAction && data.action && data.action !== expectedAction) {
      return { ok: false, error: "Human verification action did not match." };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || "Human verification failed." };
  }
}

async function requireAdmin(req) {
  const adminEmails = configuredEmails(process.env.ADMIN_EMAILS);

  if (!adminEmails.length) {
    return { ok: false, status: 403, error: "Admin access is not configured. Set ADMIN_EMAILS on Vercel." };
  }

  const auth = await getSupabaseUserFromRequest(req, "Admin sign-in required");
  if (!auth.ok) return auth;

  const email = auth.user.email;
  if (!adminEmails.includes(email)) {
    return { ok: false, status: 403, error: `This Google account is not an admin: ${email || "unknown"}` };
  }

  return { ok: true, user: auth.user };
}

async function requireDealer(req) {
  const auth = await getSupabaseUserFromRequest(req, "Dealer sign-in required");
  if (!auth.ok) return auth;

  const email = auth.user.email;
  if (configuredEmails(process.env.ADMIN_EMAILS).includes(email)) {
    return { ok: true, user: auth.user, role: "admin" };
  }

  if (configuredEmails(process.env.DEALER_EMAILS).includes(email)) {
    return { ok: true, user: auth.user, role: "dealer_env" };
  }

  const staff = await isDealerStaffEmail(email);
  if (staff.ok && staff.allowed) {
    return { ok: true, user: auth.user, role: "dealer_staff" };
  }
  if (!staff.ok && staff.error) {
    return { ok: false, status: 500, error: staff.error };
  }

  return { ok: false, status: 403, error: `This Google account is not approved for dealer portal: ${email || "unknown"}` };
}

async function requireUser(req) {
  return getSupabaseUserFromRequest(req, "Sign-in required");
}

async function getSupabaseUserFromRequest(req, missingMessage) {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: missingMessage };

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
  if (!response.ok) return { ok: false, status: 401, error: "Invalid or expired session" };

  return {
    ok: true,
    user: {
      id: String(user?.id || "").trim(),
      email: String(user?.email || "").trim().toLowerCase()
    }
  };
}

function configuredEmails(value) {
  return String(value || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
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
  if (!Number.isFinite(kilometers) || kilometers <= 500) throw new Error("Please enter an odometer value greater than 500 km");

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
  const rawInput = body.input || {};
  const uploadFiles = sanitizePhotoFiles(rawInput.photoFiles || []);
  const lead = {
    created_at: new Date().toISOString(),
    input: sanitizeLeadInput(rawInput),
    auth_user: sanitizeAuthUser(body.user || {}),
    valuation: sanitizeValuation(body.valuation || {}),
    auth_user_id: String(body.user?.id || "").trim(),
    auth_email: String(body.user?.email || rawInput.email || "").trim(),
    valuation_year: new Date().getFullYear(),
    status: "new",
    assigned_to: "",
    priority: "normal",
    next_follow_up_at: null,
    last_activity_at: null,
    notes: "",
    owner_adjustment: {}
  };

  const saved = await saveLeadToSupabase(lead);
  const savedLead = {
    ...lead,
    id: saved.lead?.id || ""
  };
  if (saved.ok && savedLead.id) {
    await createOwnerReviewNote({
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY,
      leadId: savedLead.id,
      authorEmail: "system",
      reason: "New lead received."
    });
    if (!isBuyerLead(savedLead)) {
      await notifyDuplicateSellerLead({
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY
      }, savedLead);
    }
    await maybeSendAfterHoursAutoReply({
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY
    }, savedLead, { leadType: leadSourceLabel(savedLead.input?.leadSource) }).catch(() => null);
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
  const googleForm = await submitLeadToGoogleForm(savedLead);
  const crm = await submitLeadToCrm(savedLead, webhook);

  if (saved.ok) return { ...saved, webhook, googleForm, crm };

  if (webhook.submitted || googleForm.submitted || crm.submitted) {
    return {
      ok: true,
      captured: true,
      storage: webhook.submitted ? "webhook" : googleForm.submitted ? "google_form" : "crm",
      webhook,
      googleForm,
      crm,
      message: "Lead sent to external lead receiver. Set Supabase env vars to also keep user history."
    };
  }

  return {
    ok: true,
    captured: false,
    storage: "not_configured",
    webhook,
    googleForm,
    crm,
    message: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel to persist leads."
  };
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
      headers: {
        "Content-Type": "application/json"
      },
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

function parseDriveFileId(value) {
  const text = String(value || "");
  const fileMatch = text.match(/\/d\/([^/]+)/);
  const idMatch = text.match(/[?&]id=([^&]+)/);
  return fileMatch?.[1] || idMatch?.[1] || "";
}

async function submitLeadToGoogleForm(lead) {
  const actionUrl = googleFormActionUrl();
  const fieldMap = parseGoogleFormFieldMap();
  const jsonEntry = process.env.GOOGLE_FORM_JSON_ENTRY || "";

  if (!actionUrl) return { submitted: false, skipped: true, reason: "GOOGLE_FORM_ACTION_URL is not configured" };
  if (!Object.keys(fieldMap).length && !jsonEntry) {
    return { submitted: false, skipped: true, reason: "GOOGLE_FORM_FIELD_MAP or GOOGLE_FORM_JSON_ENTRY is not configured" };
  }

  const values = leadExportValues(lead);
  const params = new URLSearchParams();

  for (const [key, entryName] of Object.entries(fieldMap)) {
    if (!entryName || values[key] === undefined || values[key] === null) continue;
    params.append(entryName, String(values[key]));
  }

  if (jsonEntry) {
    params.append(jsonEntry, JSON.stringify({
      id: lead.id || "",
      created_at: lead.created_at,
      input: lead.input,
      valuation: lead.valuation,
      auth_user: lead.auth_user
    }, null, 2));
  }

  if (![...params.keys()].length) {
    return { submitted: false, skipped: true, reason: "No Google Form fields matched this lead" };
  }

  try {
    const response = await fetch(actionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: params.toString()
    });

    return {
      submitted: response.ok,
      status: response.status,
      error: response.ok ? "" : `Google Form rejected the submission (${response.status})`
    };
  } catch (error) {
    return { submitted: false, error: error.message || "Google Form submission failed" };
  }
}

function googleFormActionUrl() {
  const explicit = String(process.env.GOOGLE_FORM_ACTION_URL || "").trim();
  if (explicit) return explicit;

  const formId = String(process.env.GOOGLE_FORM_ID || "").trim();
  return formId ? `https://docs.google.com/forms/d/${formId}/formResponse` : "";
}

function parseGoogleFormFieldMap() {
  const raw = String(process.env.GOOGLE_FORM_FIELD_MAP || "").trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, String(value || "").trim()])
        .filter(([, value]) => /^entry\.\d+$/.test(value))
    );
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
    email: input.email || lead.auth_email || lead.auth_user?.email || "",
    dealerEmail: input.dealerEmail || input.authEmail || lead.auth_email || lead.auth_user?.email || "",
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
    cbbJson: JSON.stringify({
      input,
      valuation
    }, null, 2)
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

async function listLeads() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, storage: "not_configured", leads: [] };

  const response = await fetch(`${url}/rest/v1/valuation_leads?select=*&order=created_at.desc&limit=100`, {
    headers: supabaseServiceHeaders(key)
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
    fetchSupabaseJson(`${client.url}/rest/v1/lead_notes?select=id,lead_id,created_at,author_email,note&lead_id=in.(${encodedIds})&note_type=eq.owner_review&order=created_at.desc&limit=500`, client.key),
    fetchSupabaseJson(`${client.url}/rest/v1/lead_notes?select=id,lead_id,created_at,author_email,note&lead_id=in.(${encodedIds})&note_type=eq.owner_read&order=created_at.desc&limit=500`, client.key)
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
        ...supabaseServiceHeaders(key),
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
    headers: supabaseServiceHeaders(key)
  });
  const rows = await listResponse.json().catch(() => []);
  if (!listResponse.ok) return { ok: false, status: listResponse.status, error: rows };

  const ids = (Array.isArray(rows) ? rows : []).map((row) => row.id).filter(Boolean);
  if (!ids.length) return { ok: true, deleted: 0 };

  let deleted = 0;
  for (const leadId of ids) {
    const response = await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
      method: "DELETE",
      headers: {
        ...supabaseServiceHeaders(key),
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

async function listDealerLeads(dealer) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const email = String(dealer.user?.email || "").trim().toLowerCase();
  const isAdmin = dealer.role === "admin";
  const filters = ["select=*", "order=next_follow_up_at.asc.nullslast,created_at.desc", "limit=100"];

  let rows = [];
  if (isAdmin) {
    const response = await fetch(`${url}/rest/v1/valuation_leads?${filters.join("&")}`, {
      headers: supabaseServiceHeaders(key)
    });
    rows = await response.json().catch(() => []);
    if (!response.ok) return { ok: false, status: response.status, error: rows };
  } else {
    const direct = await fetchSupabaseJson(
      `${url}/rest/v1/valuation_leads?select=*&assigned_to=eq.${encodeURIComponent(email)}&order=next_follow_up_at.asc.nullslast,created_at.desc&limit=100`,
      key
    );
    if (!direct.ok) return direct;

    const taskRows = await fetchSupabaseJson(
      `${url}/rest/v1/lead_tasks?select=lead_id&assigned_to=eq.${encodeURIComponent(email)}&limit=200`,
      key
    );
    if (!taskRows.ok) return taskRows;

    const taskLeadIds = [...new Set((taskRows.data || []).map((task) => String(task.lead_id || "").trim()).filter(Boolean))];
    let taskLeads = [];
    if (taskLeadIds.length) {
      const taskLeadResult = await fetchSupabaseJson(
        `${url}/rest/v1/valuation_leads?select=*&id=in.(${taskLeadIds.map(encodeURIComponent).join(",")})&order=next_follow_up_at.asc.nullslast,created_at.desc&limit=100`,
        key
      );
      if (!taskLeadResult.ok) return taskLeadResult;
      taskLeads = taskLeadResult.data || [];
    }

    rows = [...new Map([...(direct.data || []), ...taskLeads].map((lead) => [lead.id, lead])).values()]
      .sort(compareDealerLeads);
  }

  const leads = (Array.isArray(rows) ? rows : [])
    .filter((lead) => String(lead.status || "").toLowerCase() !== "deleted");

  return { ok: true, storage: "supabase", role: dealer.role, email, leads: await attachLeadSignals(leads, { url, key }) };
}

function compareDealerLeads(a, b) {
  const followUpA = a.next_follow_up_at ? new Date(a.next_follow_up_at).getTime() : Number.MAX_SAFE_INTEGER;
  const followUpB = b.next_follow_up_at ? new Date(b.next_follow_up_at).getTime() : Number.MAX_SAFE_INTEGER;
  if (followUpA !== followUpB) return followUpA - followUpB;
  return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
}

async function listDealerInventory(dealer) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const email = String(dealer.user?.email || "").trim().toLowerCase();
  const isAdmin = dealer.role === "admin";
  const allowedLeadIds = isAdmin ? null : await assignedLeadIdsForDealerInventory({ url, key }, email);
  if (allowedLeadIds && !allowedLeadIds.length) {
    return { ok: true, storage: "supabase", role: dealer.role, email, inventory: [] };
  }

  const query = [
    "select=*",
    "order=updated_at.desc.nullslast,created_at.desc",
    "limit=120"
  ];
  if (allowedLeadIds) query.splice(1, 0, `source_lead_id=in.(${allowedLeadIds.map(encodeURIComponent).join(",")})`);

  const listings = await fetchSupabaseJson(`${url}/rest/v1/vehicle_listings?${query.join("&")}`, key);
  if (!listings.ok) return listings;

  const rows = Array.isArray(listings.data) ? listings.data : [];
  const sourceLeadIds = [...new Set(rows.map((row) => String(row.source_lead_id || "").trim()).filter(Boolean))];
  const leadMap = await fetchDealerInventoryLeadMap({ url, key }, sourceLeadIds);
  const photoMap = await fetchDealerInventoryPhotoMap({ url, key }, rows.map((row) => row.id).filter(Boolean));

  return {
    ok: true,
    storage: "supabase",
    role: dealer.role,
    email,
    inventory: rows.map((row) => dealerInventoryRow(row, leadMap.get(String(row.source_lead_id || "")), photoMap.get(row.id) || []))
  };
}

async function assignedLeadIdsForDealerInventory(client, email) {
  const direct = await fetchSupabaseJson(
    `${client.url}/rest/v1/valuation_leads?select=id&assigned_to=eq.${encodeURIComponent(email)}&limit=200`,
    client.key
  );
  if (!direct.ok) return [];

  const taskRows = await fetchSupabaseJson(
    `${client.url}/rest/v1/lead_tasks?select=lead_id&assigned_to=eq.${encodeURIComponent(email)}&limit=200`,
    client.key
  );
  if (!taskRows.ok) {
    return [...new Set((direct.data || []).map((lead) => String(lead.id || "").trim()).filter(Boolean))];
  }

  return [...new Set([
    ...(direct.data || []).map((lead) => String(lead.id || "").trim()),
    ...(taskRows.data || []).map((task) => String(task.lead_id || "").trim())
  ].filter(Boolean))];
}

async function fetchDealerInventoryLeadMap(client, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const result = await fetchSupabaseJson(
    `${client.url}/rest/v1/valuation_leads?select=id,auth_email,assigned_to,status,next_follow_up_at,last_activity_at,input,valuation&id=in.(${ids.map(encodeURIComponent).join(",")})`,
    client.key
  );
  if (!result.ok) return map;
  for (const lead of result.data || []) map.set(String(lead.id || ""), lead);
  return map;
}

async function fetchDealerInventoryPhotoMap(client, listingIds) {
  const map = new Map();
  if (!listingIds.length) return map;
  const result = await fetchSupabaseJson(
    `${client.url}/rest/v1/listing_photos?select=*&listing_id=in.(${listingIds.map(encodeURIComponent).join(",")})&order=sort_order.asc,created_at.asc`,
    client.key
  );
  if (!result.ok) return map;
  for (const photo of result.data || []) {
    const list = map.get(photo.listing_id) || [];
    list.push({
      id: photo.id || "",
      url: photo.url || "",
      label: photo.label || "",
      sortOrder: photo.sort_order || 0
    });
    map.set(photo.listing_id, list);
  }
  return map;
}

function dealerInventoryRow(row, lead, photos) {
  const input = lead?.input || {};
  return {
    id: row.id || "",
    sourceLeadId: row.source_lead_id || "",
    status: row.status || "draft",
    title: row.title || [row.vehicle_year, row.make, row.model, row.series, row.style].filter(Boolean).join(" "),
    vin: row.vin || "",
    year: row.vehicle_year || "",
    make: row.make || "",
    model: row.model || "",
    series: row.series || "",
    style: row.style || "",
    kilometers: row.kilometers || 0,
    color: row.color || "",
    region: row.region || "",
    price: Number(row.asking_price || 0),
    monthlyPaymentEstimate: Number(row.monthly_payment_estimate || 0),
    publicOptions: row.public_options || {},
    updatedAt: row.updated_at || row.created_at || "",
    publishedAt: row.published_at || "",
    assignedTo: lead?.assigned_to || "",
    leadStatus: lead?.status || "",
    nextFollowUpAt: lead?.next_follow_up_at || "",
    lastActivityAt: lead?.last_activity_at || "",
    ownerName: input.ownerName || input.name || "",
    ownerEmail: input.ownerEmail || input.email || lead?.auth_email || "",
    ownerPhone: input.ownerPhone || input.phone || "",
    photos
  };
}

async function listMyLeads(user) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, storage: "not_configured", leads: [] };

  const requests = [];
  if (user.id) {
    requests.push(fetchSupabaseJson(`${url}/rest/v1/valuation_leads?select=*&auth_user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=50`, key));
  }
  if (user.email) {
    requests.push(fetchSupabaseJson(`${url}/rest/v1/valuation_leads?select=*&auth_email=eq.${encodeURIComponent(user.email)}&order=created_at.desc&limit=50`, key));
  }

  const results = await Promise.all(requests);
  const failed = results.find((result) => !result.ok);
  if (failed) return failed;

  const rowsById = new Map();
  for (const result of results) {
    for (const row of result.data || []) {
      rowsById.set(row.id || `${row.created_at}-${row.auth_email}`, row);
    }
  }

  const leads = [...rowsById.values()]
    .filter((lead) => String(lead.status || "").toLowerCase() !== "deleted")
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 50);

  return { ok: true, storage: "supabase", leads };
}

async function deleteMyLead(user, id) {
  const leadId = String(id || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const lookup = await fetch(`${url}/rest/v1/valuation_leads?select=id,auth_user_id,auth_email,status&id=eq.${encodeURIComponent(leadId)}&limit=1`, {
    headers: supabaseServiceHeaders(key)
  });
  const rows = await lookup.json().catch(() => []);
  if (!lookup.ok) return { ok: false, status: lookup.status, error: rows };

  const lead = rows?.[0];
  if (!lead) return { ok: false, status: 404, error: "Quote not found" };

  const leadUserId = String(lead.auth_user_id || "").trim();
  const leadEmail = String(lead.auth_email || "").trim().toLowerCase();
  const userId = String(user.id || "").trim();
  const email = String(user.email || "").trim().toLowerCase();
  const ownsLead = (leadUserId && leadUserId === userId) || (leadEmail && leadEmail === email);
  if (!ownsLead) return { ok: false, status: 403, error: "You can only delete your own quote history" };

  const response = await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...supabaseServiceHeaders(key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      status: "deleted",
      notes: "Deleted by customer from quote history. This does not restore valuation allowance."
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, lead: data?.[0] || null };
}

async function updateLead(body) {
  const id = String(body.id || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!id) return { ok: false, error: "Lead id is required" };
  if (!url || !key) return { ok: false, error: "Supabase is not configured" };

  const previousResult = await fetchSupabaseJson(`${url}/rest/v1/valuation_leads?select=*&id=eq.${encodeURIComponent(id)}&limit=1`, key);
  const previous = previousResult.ok ? previousResult.data?.[0] || {} : {};
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
  if (["ownerName", "ownerEmail", "ownerPhone"].some((field) => Object.prototype.hasOwnProperty.call(body || {}, field))) {
    patch.input = {
      ...(previous.input || {}),
      ownerName: String(body.ownerName || "").trim(),
      ownerEmail: String(body.ownerEmail || "").trim().toLowerCase(),
      ownerPhone: String(body.ownerPhone || "").trim()
    };
  }

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

async function markOwnerRead(body, user) {
  const leadId = String(body.id || body.leadId || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!leadId) return { ok: false, error: "Lead id is required" };
  if (!url || !key) return { ok: false, error: "Supabase is not configured" };
  const result = await insertSupabaseJson(`${url}/rest/v1/lead_notes`, key, {
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

async function listPublishedInventory() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, storage: "not_configured", inventory: [] };

  const response = await fetch(
    `${url}/rest/v1/vehicle_listings?select=*&status=eq.published&order=published_at.desc.nullslast,created_at.desc&limit=100`,
    { headers: supabaseServiceHeaders(key) }
  );
  const rows = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: rows, inventory: [] };
  const inventory = Array.isArray(rows) ? rows.map(publicInventoryRow) : [];
  return { ok: true, storage: "supabase", inventory: await attachListingPhotos(inventory, true) };
}

async function listAdminInventory() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, storage: "not_configured", inventory: [] };

  const response = await fetch(
    `${url}/rest/v1/vehicle_listings?select=*&order=created_at.desc&limit=200`,
    { headers: supabaseServiceHeaders(key) }
  );
  const rows = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: rows, inventory: [] };
  const inventory = Array.isArray(rows) ? rows.map(publicInventoryRow) : [];
  const withListingPhotos = await attachListingPhotos(inventory, false);
  const withLeadSummary = await attachInventoryLeadSummary(withListingPhotos);
  return { ok: true, storage: "supabase", inventory: await attachAvailableLeadPhotos(withLeadSummary) };
}

async function updateInventoryListing(body, user) {
  const id = String(body.id || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!id) return { ok: false, status: 400, error: "Listing id is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const previousResult = await fetchSupabaseJson(
    `${url}/rest/v1/vehicle_listings?select=id,source_lead_id,status,title&id=eq.${encodeURIComponent(id)}&limit=1`,
    key
  );
  if (!previousResult.ok) return previousResult;
  const previousListing = previousResult.data?.[0] || null;
  const hasAssignedTo = Object.prototype.hasOwnProperty.call(body || {}, "assignedTo");
  const status = normalizeListingStatus(body.status);
  const patch = {
    status,
    title: String(body.title || "").trim(),
    asking_price: numberOrNull(body.askingPrice),
    monthly_payment_estimate: numberOrNull(body.monthlyPaymentEstimate),
    description: String(body.description || "").trim(),
    public_options: mergeListingPublicOptions(body),
    updated_at: new Date().toISOString()
  };
  if (status === "published" && !body.publishedAt) {
    patch.published_at = new Date().toISOString();
  }
  if (status !== "published") {
    patch.published_at = null;
  }
  if (user?.email) patch.created_by = String(user.email || "").trim();
  if (status === "published" && patch.public_options.showPhotos !== true) {
    const selectedCount = await countListingPhotos({ url, key }, id);
    if (selectedCount > 0) patch.public_options.showPhotos = true;
  }

  const saveResult = await saveVehicleListingWithRetry({
    url: `${url}/rest/v1/vehicle_listings?id=eq.${encodeURIComponent(id)}`,
    key,
    method: "PATCH",
    payload: patch
  });
  if (!saveResult.ok) return saveResult;
  if (Array.isArray(body.selectedPhotoUrls)) {
    await syncSelectedListingPhotos({ url, key }, id, String(body.sourceLeadId || "").trim(), body.selectedPhotoUrls);
  }
  if (hasAssignedTo && previousListing?.source_lead_id) {
    const assignResult = await updateInventoryLeadAssignee({ url, key }, previousListing.source_lead_id, body.assignedTo, user);
    if (!assignResult.ok) return assignResult;
  }
  const savedListing = saveResult.data?.[0] || { ...saveResult.payload, id };
  await recordInventoryLifecycleUpdate({
    url,
    key,
    listing: savedListing,
    previousStatus: previousListing?.status || "",
    user,
    isNew: false
  });
  return { ok: true, listing: publicInventoryRow(savedListing) };
}

async function updateInventoryLeadAssignee(client, leadId, assignedToValue, user) {
  const id = String(leadId || "").trim();
  const assignedTo = String(assignedToValue || "").trim().toLowerCase();
  if (!id) return { ok: true, changed: false };

  const previousResult = await fetchSupabaseJson(
    `${client.url}/rest/v1/valuation_leads?select=id,assigned_to,status&id=eq.${encodeURIComponent(id)}&limit=1`,
    client.key
  );
  if (!previousResult.ok) return previousResult;

  const previous = previousResult.data?.[0] || null;
  if (!previous) return { ok: false, status: 404, error: "Source lead not found for inventory assignment" };

  const previousRep = String(previous.assigned_to || "").trim().toLowerCase();
  if (previousRep === assignedTo) return { ok: true, changed: false };

  const patch = {
    assigned_to: assignedTo || null,
    last_activity_at: new Date().toISOString()
  };
  if (assignedTo && String(previous.status || "").trim().toLowerCase() === "new") {
    patch.status = "assigned";
  }

  const response = await fetch(`${client.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      ...supabaseServiceHeaders(client.key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(patch)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data || "Unable to update inventory rep" };

  await createLeadActivity({
    leadId: id,
    type: "note",
    noteType: "internal",
    note: `Inventory follow-up rep updated by ${user?.email || "admin"}: ${previousRep || "unassigned"} -> ${assignedTo || "unassigned"}.`
  }, user, "admin");

  return { ok: true, changed: true, lead: data?.[0] || null };
}

async function deleteInventoryListing(id, user) {
  const listingId = String(id || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!listingId) return { ok: false, status: 400, error: "Listing id is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const listingResult = await fetchSupabaseJson(
    `${url}/rest/v1/vehicle_listings?select=*&id=eq.${encodeURIComponent(listingId)}&limit=1`,
    key
  );
  if (!listingResult.ok) return listingResult;
  const listing = listingResult.data?.[0];
  if (!listing) return { ok: false, status: 404, error: "Inventory listing not found" };

  const response = await fetch(`${url}/rest/v1/vehicle_listings?id=eq.${encodeURIComponent(listingId)}`, {
    method: "DELETE",
    headers: {
      ...supabaseServiceHeaders(key),
      Prefer: "return=representation"
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };

  if (listing.source_lead_id) {
    const restoredStatus = await restoreLeadFromInventory({ url, key }, listing.source_lead_id);
    await createLeadActivity({
      leadId: listing.source_lead_id,
      type: "note",
      noteType: "internal",
      note: `Inventory listing removed by ${user?.email || "admin"}. Lead restored to ${restoredStatus}. Staff can update the lead details, then an admin can publish it again.`
    }, user);
  }

  return { ok: true, deleted: Array.isArray(data) ? data.length : 1, listing: publicInventoryRow(listing) };
}

function normalizeListingStatus(value) {
  const status = String(value || "draft").trim().toLowerCase();
  return ["draft", "review", "published", "sold", "archived"].includes(status) ? status : "draft";
}

async function publishLeadToInventory(body, user) {
  const leadId = String(body.leadId || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const leadResult = await fetchSupabaseJson(
    `${url}/rest/v1/valuation_leads?select=*&id=eq.${encodeURIComponent(leadId)}&limit=1`,
    key
  );
  if (!leadResult.ok) return leadResult;
  const lead = leadResult.data?.[0];
  if (!lead) return { ok: false, status: 404, error: "Lead not found" };

  const listing = buildListingFromLead(lead, body, user);
  const existing = await fetchSupabaseJson(
    `${url}/rest/v1/vehicle_listings?select=id,status,updated_at,created_at&source_lead_id=eq.${encodeURIComponent(leadId)}&order=updated_at.desc.nullslast,created_at.desc&limit=1`,
    key
  );
  if (!existing.ok) return existing;

  const existingId = existing.data?.[0]?.id;
  const endpoint = existingId
    ? `${url}/rest/v1/vehicle_listings?id=eq.${encodeURIComponent(existingId)}`
    : `${url}/rest/v1/vehicle_listings`;
  const saveResult = await saveVehicleListingWithRetry({
    url: endpoint,
    key,
    method: existingId ? "PATCH" : "POST",
    payload: listing
  });
  if (!saveResult.ok) return saveResult;
  const savedListing = saveResult.data?.[0] || { ...saveResult.payload, id: existingId };
  if (isPublicOptionEnabled(savedListing.public_options || listing.public_options, "showPhotos")) {
    await attachLeadPhotosToListing(leadId, savedListing.id || existingId, { url, key });
  }
  await recordInventoryLifecycleUpdate({
    url,
    key,
    listing: savedListing,
    previousStatus: existing.data?.[0]?.status || "",
    user,
    isNew: !existingId
  });
  return { ok: true, listing: publicInventoryRow(savedListing), updated: Boolean(existingId) };
}

async function recordInventoryLifecycleUpdate({ url, key, listing, previousStatus, user, isNew }) {
  const leadId = String(listing?.source_lead_id || "").trim();
  if (!url || !key || !leadId) return;
  const status = normalizeListingStatus(listing.status);
  const prior = normalizeListingStatus(previousStatus || "");
  if (!isNew && prior === status) return;

  const author = String(user?.email || listing.created_by || "inventory@autoswitch.local").trim().toLowerCase();
  const title = String(listing.title || "Vehicle").trim();
  const messages = {
    draft: `Recon started for ${title}. Complete photos, keys, recon estimate, repairs, pricing, and publish review.`,
    review: `Inventory review started for ${title}. Manager should approve price, photos, and listing readiness.`,
    published: `${title} is now listed for sale. Sales team should monitor buyer activity and follow-up tasks.`,
    sold: `${title} marked sold. Confirm delivery, gross, final documents, and close the CRM record.`,
    archived: `${title} archived from active inventory. Confirm whether the CRM record needs follow-up.`
  };
  const note = messages[status] || `Inventory status changed to ${status} for ${title}.`;
  await insertSupabaseJson(`${url}/rest/v1/lead_notes`, key, {
    lead_id: leadId,
    author_email: author,
    note_type: "internal",
    note: `[Inventory lifecycle:${status}] ${note}`
  }).catch(() => null);

  if (["draft", "review", "published", "sold"].includes(status)) {
    await createOwnerReviewNote({
      url,
      key,
      leadId,
      authorEmail: author,
      reason: status === "sold"
        ? "Vehicle marked sold. Confirm final delivery, gross, and documents."
        : status === "published"
          ? "Vehicle published. Confirm listing, price, photos, and sales handoff."
          : "Vehicle moved into recon/inventory review. Confirm intake, recon, pricing, and publish readiness."
    });
  }

  if (["draft", "review", "published"].includes(status)) {
    await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      headers: {
        ...supabaseServiceHeaders(key),
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        status: "in_inventory",
        last_activity_at: new Date().toISOString()
      })
    }).catch(() => null);
  } else {
    await touchLeadActivity({ url, key, leadId });
  }
}

async function saveVehicleListingWithRetry({ url, key, method, payload }) {
  let currentPayload = { ...payload };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: {
        ...supabaseServiceHeaders(key),
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(currentPayload)
    });
    const data = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data, payload: currentPayload };

    const missingColumn = missingSchemaColumn(data);
    if (!missingColumn || !(missingColumn in currentPayload)) {
      return { ok: false, status: response.status, error: data };
    }
    delete currentPayload[missingColumn];
  }
  return { ok: false, status: 400, error: "Unable to save inventory listing after removing unsupported legacy columns." };
}

function missingSchemaColumn(error) {
  const text = [error?.message, error?.details, error?.hint, JSON.stringify(error || {})].filter(Boolean).join(" ");
  const match = text.match(/'([^']+)'\s+column/i);
  return match?.[1] || "";
}

async function createBuyerInquiry(body) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const listingId = String(body.listingId || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const name = String(body.name || "").trim();
  const message = String(body.message || "").trim();
  const listing = await findInventoryListingForInquiry(listingId, { url, key });
  const vehicle = buyerInquiryVehicleContext(body.vehicle || {}, listing);
  const finance = buyerInquiryFinanceContext(body.finance || {});
  const purchase = buyerInquiryPurchaseContext(body.purchase || body, finance, vehicle);
  if (!listingId) return { ok: false, status: 400, error: "Vehicle listing is required" };
  if (!email && !phone) return { ok: false, status: 400, error: "Please provide an email or phone number" };

  const result = await insertSupabaseJson(`${url}/rest/v1/buyer_inquiries`, key, {
    listing_id: isUuid(listingId) ? listingId : null,
    customer_email: email,
    customer_phone: phone,
    customer_name: name,
    message: buyerInquiryMessageWithContext({ message, vehicle, finance, purchase }),
    source: "buy_page",
    status: "new"
  });
  if (!result.ok) return result;

  const lead = buildBuyerInquiryLead({
    inquiry: result.data?.[0] || null,
    name,
    email,
    phone,
    message,
    listingId,
    vehicle,
    finance,
    purchase
  });
  const savedLead = await saveLeadToSupabase(lead);
  if (savedLead.ok && savedLead.lead?.id) {
    await createOwnerReviewNote({
      url,
      key,
      leadId: savedLead.lead.id,
      authorEmail: "buy-page@autoswitch.local",
      reason: "New buyer inquiry received."
    });
    await createLeadActivity({
      leadId: savedLead.lead.id,
      type: "note",
      noteType: "call",
      note: buyerInquiryActivityNote({ name, email, phone, message, vehicle, finance, purchase })
    }, { email: "buy-page@autoswitch.local" }).catch(() => null);
    await createBuyerInquiryFollowUpTask({ url, key }, {
      leadId: savedLead.lead.id,
      sourceLeadId: vehicle.sourceLeadId,
      vehicleTitle: vehicle.title,
      buyerName: name,
      buyerPhone: phone,
      buyerEmail: email
    }).catch(() => null);
    await maybeSendAfterHoursAutoReply({ url, key }, {
      ...lead,
      id: savedLead.lead.id
    }, { leadType: "Buyer inquiry" }).catch(() => null);
  }

  return {
    ok: true,
    inquiry: publicBuyerInquiryRow(result.data?.[0] || {}),
    lead: savedLead.lead || null,
    leadCreated: Boolean(savedLead.ok && savedLead.lead?.id),
    leadStorage: savedLead.storage || ""
  };
}

async function createBuyerInquiryFollowUpTask(supabase, context = {}) {
  const leadId = String(context.leadId || "").trim();
  if (!supabase?.url || !supabase?.key || !leadId) return;
  let assignedTo = "";
  const sourceLeadId = String(context.sourceLeadId || "").trim();
  if (sourceLeadId) {
    const sourceLead = await fetchSupabaseJson(
      `${supabase.url}/rest/v1/valuation_leads?select=assigned_to&id=eq.${encodeURIComponent(sourceLeadId)}&limit=1`,
      supabase.key
    );
    assignedTo = String(sourceLead.data?.[0]?.assigned_to || "").trim().toLowerCase();
  }
  const dueAt = new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString();
  const contact = context.buyerPhone || context.buyerEmail || "buyer";
  const title = `Call buyer inquiry${context.vehicleTitle ? ` for ${context.vehicleTitle}` : ""} - ${contact}`;
  const result = await insertSupabaseJson(`${supabase.url}/rest/v1/lead_tasks`, supabase.key, {
    lead_id: leadId,
    assigned_to: assignedTo || null,
    title,
    due_at: dueAt
  });
  if (result.ok && assignedTo) await assignLeadForTask({ url: supabase.url, key: supabase.key, leadId, assignedTo });
  if (result.ok) await touchLeadActivity({ url: supabase.url, key: supabase.key, leadId });
}

async function findInventoryListingForInquiry(listingId, supabase) {
  if (!isUuid(listingId)) return null;
  const result = await fetchSupabaseJson(
    `${supabase.url}/rest/v1/vehicle_listings?select=*&id=eq.${encodeURIComponent(listingId)}&limit=1`,
    supabase.key
  );
  if (!result.ok) return null;
  return result.data?.[0] || null;
}

function buyerInquiryVehicleContext(clientVehicle, listing) {
  const row = listing || {};
  const client = clientVehicle || {};
  return {
    id: String(row.id || client.id || "").trim(),
    sourceLeadId: String(row.source_lead_id || client.sourceLeadId || "").trim(),
    title: String(row.title || client.title || "").trim(),
    price: numberOrNull(row.asking_price) ?? numberOrNull(client.price) ?? 0,
    monthlyPaymentEstimate: numberOrNull(row.monthly_payment_estimate) ?? numberOrNull(client.monthlyPaymentEstimate) ?? 0,
    kilometers: numberOrNull(row.kilometers) ?? numberOrNull(client.kilometers) ?? 0,
    region: String(row.region || client.region || "").trim(),
    color: String(row.color || client.color || "").trim(),
    vin: cleanVin(row.vin || client.vin || ""),
    uvc: String(row.uvc || client.uvc || "").trim(),
    year: String(row.vehicle_year || client.year || "").trim(),
    make: String(row.make || client.make || "").trim(),
    model: String(row.model || client.model || "").trim(),
    series: String(row.series || client.series || "").trim(),
    style: String(row.style || client.style || "").trim()
  };
}

function buyerInquiryFinanceContext(finance) {
  return {
    price: numberOrNull(finance.price) ?? 0,
    downPayment: numberOrNull(finance.downPayment) ?? 0,
    annualRate: numberOrNull(finance.annualRate) ?? 0,
    taxRate: numberOrNull(finance.taxRate) ?? 0,
    termMonths: numberOrNull(finance.termMonths) ?? 0,
    monthlyPayment: numberOrNull(finance.monthlyPayment) ?? 0
  };
}

function buyerInquiryPurchaseContext(purchase, finance, vehicle) {
  const intent = String(purchase.purchaseIntent || purchase.intent || "finance").trim().toLowerCase();
  return {
    intent: ["cash", "finance", "lease", "undecided"].includes(intent) ? intent : "finance",
    buyingTimeline: String(purchase.buyingTimeline || "").trim(),
    preferredContact: String(purchase.preferredContact || "").trim(),
    vehiclePrice: numberOrNull(purchase.vehiclePrice) ?? finance.price ?? vehicle.price ?? 0,
    downPayment: numberOrNull(purchase.downPayment) ?? finance.downPayment ?? 0,
    annualRate: numberOrNull(purchase.annualRate) ?? finance.annualRate ?? 0,
    taxRate: numberOrNull(purchase.taxRate) ?? finance.taxRate ?? 0,
    termMonths: numberOrNull(purchase.termMonths) ?? finance.termMonths ?? 0,
    monthlyPayment: numberOrNull(purchase.monthlyPayment) ?? finance.monthlyPayment ?? 0
  };
}

function buildBuyerInquiryLead({ inquiry, name, email, phone, message, listingId, vehicle, finance, purchase }) {
  const title = vehicle.title || "Buyer inquiry";
  const now = new Date().toISOString();
  return {
    created_at: now,
    input: {
      leadType: "buyer_inquiry",
      inquiryId: inquiry?.id || "",
      listingId,
      sourceLeadId: vehicle.sourceLeadId || "",
      email,
      phone,
      buyerName: name,
      message,
      vin: vehicle.vin,
      uvc: vehicle.uvc,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      series: vehicle.series,
      style: vehicle.style,
      kilometers: vehicle.kilometers,
      ownershipType: "buyer",
      ownsVehicle: false,
      color: vehicle.color,
      conditionNotes: message,
      region: vehicle.region,
      country: "C",
      askingPrice: vehicle.price,
      monthlyPaymentEstimate: vehicle.monthlyPaymentEstimate,
      financeEstimate: finance,
      purchaseIntent: purchase.intent,
      buyingTimeline: purchase.buyingTimeline,
      preferredContact: purchase.preferredContact,
      buyerPlan: purchase
    },
    auth_user: {},
    valuation: {
      source: "buyer_inquiry",
      title: `Buyer inquiry - ${title}`,
      vin: vehicle.vin,
      kilometers: vehicle.kilometers,
      region: vehicle.region,
      country: "C",
      values: {
        retail: {
          adjusted: {
            avg: vehicle.price || finance.price || 0
          }
        }
      },
      listing: vehicle,
      financeEstimate: finance,
      buyerPlan: purchase
    },
    auth_user_id: "",
    auth_email: email,
    valuation_year: new Date().getFullYear(),
    status: "new",
    assigned_to: "",
    priority: "high",
    next_follow_up_at: null,
    last_activity_at: now,
    notes: buyerInquiryLeadSummary({ name, email, phone, message, vehicle, finance, purchase }),
    owner_adjustment: {}
  };
}

function buyerInquiryLeadSummary({ name, email, phone, message, vehicle, finance, purchase }) {
  const contact = [name, email, phone].filter(Boolean).join(" / ");
  const plan = [
    purchase?.intent ? `Intent: ${purchase.intent}` : "",
    purchase?.buyingTimeline ? `Timeline: ${purchase.buyingTimeline}` : "",
    purchase?.preferredContact ? `Preferred contact: ${purchase.preferredContact}` : "",
    purchase?.monthlyPayment ? `Target: ${purchase.monthlyPayment}/mo` : finance.monthlyPayment ? `Calculator: ${finance.monthlyPayment}/mo` : ""
  ].filter(Boolean).join(" | ");
  const customerMessage = message ? `Message: ${message}` : "No custom buyer message.";
  return [
    `Buyer inquiry for ${vehicle.title || "selected inventory vehicle"}.`,
    contact ? `Contact: ${contact}` : "",
    plan,
    customerMessage
  ].filter(Boolean).join("\n");
}

function buyerInquiryMessageWithContext({ message, vehicle, finance, purchase }) {
  const context = buyerInquiryActivityNote({ name: "", email: "", phone: "", message: "", vehicle, finance, purchase });
  return [message || "Buyer did not include a message.", context].filter(Boolean).join("\n\n---\n");
}

function buyerInquiryActivityNote({ name, email, phone, message, vehicle, finance, purchase }) {
  const lines = [
    "Buyer inquiry from public Buy page",
    name ? `Buyer: ${name}` : "",
    email ? `Email: ${email}` : "",
    phone ? `Phone: ${phone}` : "",
    purchase?.intent ? `Purchase intent: ${purchase.intent}` : "",
    purchase?.buyingTimeline ? `Buying timeline: ${purchase.buyingTimeline}` : "",
    purchase?.preferredContact ? `Preferred contact: ${purchase.preferredContact}` : "",
    vehicle.title ? `Vehicle: ${vehicle.title}` : "",
    vehicle.price ? `Asking price: ${vehicle.price}` : "",
    vehicle.vin ? `VIN: ${vehicle.vin}` : "",
    vehicle.uvc ? `UVC: ${vehicle.uvc}` : "",
    vehicle.id ? `Listing ID: ${vehicle.id}` : "",
    vehicle.sourceLeadId ? `Source lead: ${vehicle.sourceLeadId}` : "",
    purchase?.intent === "finance" && purchase.monthlyPayment ? `Finance plan: ${purchase.monthlyPayment}/mo, ${purchase.downPayment} down, ${purchase.termMonths} months, ${purchase.annualRate}% APR` : "",
    purchase?.intent === "lease" && purchase.monthlyPayment ? `Lease interest: target around ${purchase.monthlyPayment}/mo, ${purchase.downPayment} down, ${purchase.termMonths} months` : "",
    purchase?.intent === "cash" ? `Cash plan: buyer selected cash purchase` : "",
    purchase?.intent === "undecided" ? `Buyer plan: undecided between cash, finance, and lease` : "",
    finance.monthlyPayment ? `Calculator estimate: ${finance.monthlyPayment}/mo, ${finance.termMonths} months, ${finance.annualRate}% APR` : "",
    message ? `Message: ${message}` : ""
  ].filter(Boolean);
  return lines.join("\n");
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

async function listBuyerInquiries() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, storage: "not_configured", inquiries: [] };
  const result = await fetchSupabaseJson(
    `${url}/rest/v1/buyer_inquiries?select=*&order=created_at.desc&limit=100`,
    key
  );
  if (!result.ok) return { ...result, inquiries: [] };
  const inquiries = Array.isArray(result.data) ? result.data.map(publicBuyerInquiryRow) : [];
  return { ok: true, storage: "supabase", inquiries };
}

function publicBuyerInquiryRow(row) {
  return {
    id: row.id || "",
    listingId: row.listing_id || "",
    name: row.customer_name || "",
    email: row.customer_email || "",
    phone: row.customer_phone || "",
    message: row.message || "",
    status: row.status || "new",
    assignedTo: row.assigned_to || "",
    source: row.source || "",
    createdAt: row.created_at || ""
  };
}

async function uploadLeadPhotos(body, user, role) {
  const leadId = String(body.leadId || "").trim();
  const requestedFiles = Array.isArray(body.files) ? body.files : [];
  if (requestedFiles.length > MAX_LEAD_PHOTOS) {
    return { ok: false, status: 400, error: `Upload ${MAX_LEAD_PHOTOS} photos or fewer at a time.` };
  }
  const files = sanitizePhotoFiles(body.files || []);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };
  if (!files.length) return { ok: false, status: 400, error: "At least one photo is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const leadResult = await fetchSupabaseJson(
    `${url}/rest/v1/valuation_leads?select=*&id=eq.${encodeURIComponent(leadId)}&limit=1`,
    key
  );
  if (!leadResult.ok) return leadResult;
  const lead = leadResult.data?.[0];
  if (!lead) return { ok: false, status: 404, error: "Lead not found" };
  const existingPhotos = await findLeadPhotoLinks(leadId, { url, key });
  if (existingPhotos.length + files.length > MAX_LEAD_PHOTOS) {
    return {
      ok: false,
      status: 400,
      error: `This lead can have up to ${MAX_LEAD_PHOTOS} photos. It already has ${existingPhotos.length}.`
    };
  }

  const webhook = await submitLeadPhotosToWebhook(lead, files, user);
  if (!webhook.submitted) {
    return { ok: false, status: 502, error: webhook.error || webhook.reason || "Google Drive upload webhook is not configured" };
  }

  const parsed = webhook.data || parseJson(webhook.response) || {};
  const savedFiles = normalizeDriveUploadFiles(extractDriveFileRows(parsed));
  if (!savedFiles.length) {
    return {
      ok: false,
      status: 502,
      error: `Google Drive did not return saved file URLs. ${driveWebhookSummary(parsed, webhook)}`
    };
  }

  const lines = [];
  if (parsed.leadFolderUrl) lines.push(`Vehicle Drive folder: ${parsed.leadFolderUrl}`);
  lines.push(...savedFiles.map((file, index) => {
    const label = files[index]?.role || files[index]?.angle || file.name || `Photo ${index + 1}`;
    const url = file.url || "";
    return `${label}: ${url}`;
  }));
  await createLeadActivity({
    leadId,
    type: "note",
    noteType: "inspection",
    note: `Vehicle photo upload:\n${lines.join("\n")}`
  }, user);
  if (role !== "admin") {
    await createOwnerReviewNote({
      url,
      key,
      leadId,
      authorEmail: user?.email || "",
      reason: "Vehicle photos uploaded by staff. Review photo package, recon, and publish readiness."
    });
  }

  return { ok: true, photos: savedFiles, webhook };
}

function extractDriveFileRows(parsed = {}) {
  return [
    ...(Array.isArray(parsed.savedFiles) ? parsed.savedFiles : []),
    ...(Array.isArray(parsed.files) ? parsed.files : []),
    ...(Array.isArray(parsed.photos) ? parsed.photos : []),
    ...(Array.isArray(parsed.data?.savedFiles) ? parsed.data.savedFiles : []),
    ...(Array.isArray(parsed.data?.files) ? parsed.data.files : []),
    ...(Array.isArray(parsed.data?.photos) ? parsed.data.photos : [])
  ];
}

function normalizeDriveUploadFiles(files) {
  const seen = new Set();
  return (files || [])
    .map((file, index) => {
      const id = String(file.id || file.fileId || "").trim();
      const url = driveUploadFileUrl(file, id);
      return {
        id,
        name: String(file.name || file.title || `Vehicle photo ${index + 1}`).trim(),
        url,
        webViewLink: url,
        thumbnailLink: String(file.thumbnailLink || "").trim(),
        mimeType: String(file.mimeType || "").trim()
      };
    })
    .filter((file) => file.url && !isDriveFolderUrl(file.url))
    .filter((file) => !file.mimeType || file.mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic)$/i.test(file.name))
    .filter((file) => {
      const key = file.url || file.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function driveUploadFileUrl(file, id = "") {
  const direct = String(file.url || file.webViewLink || file.webUrl || "").trim();
  if (direct) return direct;
  const thumbnailId = parseDriveFileId(file.thumbnailLink);
  const fileId = id || thumbnailId;
  return fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view` : "";
}

function driveWebhookSummary(parsed = {}, webhook = {}) {
  const keys = Object.keys(parsed || {}).slice(0, 12).join(", ") || "none";
  const response = readableWebhookResponse(webhook.response);
  return `Webhook keys: ${keys}.${response ? ` Response: ${response}` : ""}`;
}

function readableWebhookResponse(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const body = text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return [title, body].filter(Boolean).join(" | ").slice(0, 900);
}

async function submitLeadPhotosToWebhook(lead, files, user) {
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
    photoCount: files.length,
    photoNames: files.map((file) => file.name).join(", "),
    files,
    raw: {
      lead,
      uploadedBy: user || {}
    }
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    return {
      submitted: response.ok,
      status: response.status,
      response: text,
      data: parseJson(text),
      error: response.ok ? "" : `Lead webhook rejected the photo upload (${response.status})`
    };
  } catch (error) {
    return { submitted: false, error: error.message || "Lead photo webhook failed" };
  }
}

async function attachLeadPhotosToListing(leadId, listingId, supabase) {
  if (!leadId || !listingId) return;
  const links = await findLeadPhotoLinks(leadId, supabase);
  if (!links.length) return;

  const existing = await fetchSupabaseJson(
    `${supabase.url}/rest/v1/listing_photos?select=url&listing_id=eq.${encodeURIComponent(listingId)}&limit=200`,
    supabase.key
  );
  if (!existing.ok) return;
  const existingUrls = new Set((existing.data || []).map((row) => String(row.url || "").trim()).filter(Boolean));
  const rows = links
    .filter((photo) => photo.url && !existingUrls.has(photo.url))
    .map((photo, index) => ({
      listing_id: listingId,
      url: photo.url,
      label: photo.label || `Vehicle photo ${index + 1}`,
      sort_order: existingUrls.size + index
    }));
  if (!rows.length) return;

  await fetch(`${supabase.url}/rest/v1/listing_photos`, {
    method: "POST",
    headers: {
      ...supabaseServiceHeaders(supabase.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(rows)
  }).catch(() => null);
}

async function attachAvailableLeadPhotos(inventory) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return inventory;
  const supabase = { url, key };
  const leadIds = [...new Set(inventory.map((item) => item.sourceLeadId).filter(Boolean))];
  if (!leadIds.length) return inventory;
  const photosByLead = new Map();
  await Promise.all(leadIds.map(async (leadId) => {
    photosByLead.set(leadId, await findLeadPhotoLinks(leadId, supabase));
  }));
  return inventory.map((item) => ({
    ...item,
    availableLeadPhotos: photosByLead.get(item.sourceLeadId) || []
  }));
}

async function attachInventoryLeadSummary(inventory) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return inventory;
  const leadIds = [...new Set(inventory.map((item) => String(item.sourceLeadId || "").trim()).filter(Boolean))];
  if (!leadIds.length) return inventory;

  const result = await fetchSupabaseJson(
    `${url}/rest/v1/valuation_leads?select=id,assigned_to,status,next_follow_up_at,last_activity_at&id=in.(${leadIds.map(encodeURIComponent).join(",")})`,
    key
  );
  if (!result.ok || !Array.isArray(result.data)) return inventory;

  const leads = new Map(result.data.map((lead) => [String(lead.id || ""), lead]));
  return inventory.map((item) => {
    const lead = leads.get(String(item.sourceLeadId || ""));
    if (!lead) return item;
    return {
      ...item,
      assignedTo: lead.assigned_to || "",
      leadStatus: lead.status || "",
      nextFollowUpAt: lead.next_follow_up_at || "",
      lastActivityAt: lead.last_activity_at || ""
    };
  });
}

async function syncSelectedListingPhotos(supabase, listingId, leadId, selectedUrls = []) {
  if (!listingId) return;
  const urls = [...new Set((selectedUrls || []).map((photoUrl) => String(photoUrl || "").trim()).filter(Boolean))];
  await fetch(`${supabase.url}/rest/v1/listing_photos?listing_id=eq.${encodeURIComponent(listingId)}`, {
    method: "DELETE",
    headers: supabaseServiceHeaders(supabase.key)
  }).catch(() => null);
  if (!urls.length || !leadId) return;
  const available = await findLeadPhotoLinks(leadId, supabase);
  const byUrl = new Map(available.map((photo) => [photo.url, photo]));
  const rows = urls.map((photoUrl, index) => ({
    listing_id: listingId,
    url: photoUrl,
    label: byUrl.get(photoUrl)?.label || `Vehicle photo ${index + 1}`,
    sort_order: index
  }));
  await fetch(`${supabase.url}/rest/v1/listing_photos`, {
    method: "POST",
    headers: {
      ...supabaseServiceHeaders(supabase.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(rows)
  }).catch(() => null);
}

async function restoreLeadFromInventory(supabase, leadId) {
  const previousStatus = await previousLeadStatusBeforeInventory(supabase, leadId);
  const status = normalizeRestoredLeadStatus(previousStatus) || "assigned";
  await fetch(`${supabase.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...supabaseServiceHeaders(supabase.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status,
      last_activity_at: new Date().toISOString()
    })
  }).catch(() => null);
  return status;
}

async function previousLeadStatusBeforeInventory(supabase, leadId) {
  const result = await fetchSupabaseJson(
    `${supabase.url}/rest/v1/lead_notes?select=note&lead_id=eq.${encodeURIComponent(leadId)}&order=created_at.desc&limit=100`,
    supabase.key
  );
  if (!result.ok) return "";
  for (const row of result.data || []) {
    const match = String(row.note || "").match(/Previous CRM status:\s*([a-z_]+)/i);
    if (match) return match[1].toLowerCase();
  }
  return "";
}

function normalizeRestoredLeadStatus(value) {
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
    "won",
    "lost",
    "closed"
  ].includes(status) ? status : "";
}

async function findLeadPhotoLinks(leadId, supabase) {
  const result = await fetchSupabaseJson(
    `${supabase.url}/rest/v1/lead_notes?select=note&lead_id=eq.${encodeURIComponent(leadId)}&note_type=eq.inspection&order=created_at.desc&limit=50`,
    supabase.key
  );
  if (!result.ok) return [];
  const photos = [];
  const seenUrls = new Set();
  const deletedUrls = new Set();
  for (const row of result.data || []) {
    const note = String(row.note || "");
    if (note.includes("Vehicle photo deleted:")) {
      for (const line of note.split(/\r?\n/)) {
        const deletedUrl = String(line || "").trim();
        if (deletedUrl.startsWith("http")) deletedUrls.add(deletedUrl);
      }
      continue;
    }
    if (!note.includes("Vehicle photo upload:")) continue;
    for (const line of note.split(/\r?\n/)) {
      const match = line.match(/^([^:]+):\s*(https?:\/\/\S+)/);
      if (match) {
        const label = match[1].trim();
        const url = match[2].trim();
        if (!url || isDriveFolderUrl(url) || seenUrls.has(url)) continue;
        photos.push({ label, url });
        seenUrls.add(url);
      }
    }
  }
  return photos.filter((photo) => !deletedUrls.has(photo.url));
}

async function countListingPhotos(supabase, listingId) {
  if (!listingId) return 0;
  const response = await fetch(
    `${supabase.url}/rest/v1/listing_photos?select=id&listing_id=eq.${encodeURIComponent(listingId)}&limit=1`,
    { headers: supabaseServiceHeaders(supabase.key) }
  ).catch(() => null);
  if (!response?.ok) return 0;
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}

function isDriveFolderUrl(url) {
  return /drive\.google\.com\/(?:drive\/)?folders\//i.test(String(url || ""));
}

async function uploadInventoryPhotos(body, user) {
  const listingId = String(body.listingId || "").trim();
  const requestedFiles = Array.isArray(body.files) ? body.files : [];
  if (requestedFiles.length > MAX_LEAD_PHOTOS) {
    return { ok: false, status: 400, error: `Upload ${MAX_LEAD_PHOTOS} photos or fewer at a time.` };
  }
  const files = sanitizePhotoFiles(body.files || []);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!listingId) return { ok: false, status: 400, error: "Listing id is required" };
  if (!files.length) return { ok: false, status: 400, error: "At least one photo is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const listingResult = await fetchSupabaseJson(
    `${url}/rest/v1/vehicle_listings?select=*&id=eq.${encodeURIComponent(listingId)}&limit=1`,
    key
  );
  if (!listingResult.ok) return listingResult;
  const listing = listingResult.data?.[0];
  if (!listing) return { ok: false, status: 404, error: "Inventory listing not found" };

  const webhook = await submitInventoryPhotosToWebhook(listing, files, user);
  if (!webhook.submitted) {
    return { ok: false, status: 502, error: webhook.error || webhook.reason || "Google Drive upload webhook is not configured" };
  }

  const parsed = webhook.data || parseJson(webhook.response) || {};
  const savedFiles = normalizeDriveUploadFiles(extractDriveFileRows(parsed));
  if (!savedFiles.length) {
    return {
      ok: false,
      status: 502,
      error: `Google Drive did not return saved file URLs. ${driveWebhookSummary(parsed, webhook)}`
    };
  }

  const rows = savedFiles.map((file, index) => ({
    listing_id: listingId,
    url: String(file.url || file.webViewLink || "").trim(),
    label: String(files[index]?.role || files[index]?.angle || file.name || `Photo ${index + 1}`).trim(),
    sort_order: index
  })).filter((row) => row.url);

  const insert = await fetch(`${url}/rest/v1/listing_photos`, {
    method: "POST",
    headers: {
      ...supabaseServiceHeaders(key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(rows)
  });
  const data = await insert.json().catch(() => []);
  if (!insert.ok) return { ok: false, status: insert.status, error: data };
  return { ok: true, photos: Array.isArray(data) ? data : [], webhook };
}

async function deleteInventoryPhoto(body, user) {
  const listingId = String(body.listingId || "").trim();
  const leadId = String(body.leadId || "").trim();
  const photoUrl = String(body.url || "").trim();
  const fileId = String(body.fileId || parseDriveFileId(photoUrl)).trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!listingId || !leadId || !photoUrl || !fileId) {
    return { ok: false, status: 400, error: "Listing id, lead id, photo URL, and Drive file id are required" };
  }
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const driveDelete = await submitDriveDeleteToWebhook({ listingId, leadId, photoUrl, fileId }, user);
  if (!driveDelete.ok) return driveDelete;

  await fetch(`${url}/rest/v1/listing_photos?listing_id=eq.${encodeURIComponent(listingId)}&url=eq.${encodeURIComponent(photoUrl)}`, {
    method: "DELETE",
    headers: supabaseServiceHeaders(key)
  }).catch(() => null);

  await createLeadActivity({
    leadId,
    type: "note",
    noteType: "inspection",
    note: `Vehicle photo deleted:\n${photoUrl}`
  }, user);

  return { ok: true, deleted: true, fileId, url: photoUrl };
}

async function syncInventoryDrivePhotos(body, user) {
  const listingId = String(body.listingId || "").trim();
  const leadId = String(body.leadId || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!listingId || !leadId) return { ok: false, status: 400, error: "Listing id and lead id are required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const folderUrl = String(body.folderUrl || await findLeadDriveFolderUrl({ url, key }, leadId) || "").trim();
  if (!folderUrl) {
    return {
      ok: false,
      status: 404,
      error: "No Google Drive vehicle folder is recorded for this lead yet. Upload one photo through this vehicle first, then sync the folder."
    };
  }

  const webhook = await submitDriveFolderListToWebhook({ listingId, leadId, folderUrl }, user);
  if (!webhook.submitted) {
    return { ok: false, status: 502, error: webhook.error || webhook.reason || "Google Drive folder sync webhook is not configured" };
  }

  const parsed = webhook.data || parseJson(webhook.response) || {};
  if (parsed.pdfUrl && !Array.isArray(parsed.files) && !Array.isArray(parsed.photos)) {
    return {
      ok: false,
      status: 502,
      error: "Apps Script treated the sync request as a normal upload. Update GOOGLE_DRIVE_UPLOADS.md script with list-drive-folder-files and redeploy it."
    };
  }
  const files = normalizeDriveFolderFiles(parsed);
  await createLeadActivity({
    leadId,
    type: "note",
    noteType: "inspection",
    note: `Vehicle photo upload:\n${[`Vehicle Drive folder: ${folderUrl}`, ...files.map((file, index) => `${file.name || `Vehicle photo ${index + 1}`}: ${file.url}`)].join("\n")}`
  }, user);
  return { ok: true, folderUrl, photos: files, count: files.length };
}

async function findLeadDriveFolderUrl(client, leadId) {
  const result = await fetchSupabaseJson(
    `${client.url}/rest/v1/lead_notes?select=note&lead_id=eq.${encodeURIComponent(leadId)}&order=created_at.desc&limit=100`,
    client.key
  );
  if (!result.ok) return "";
  for (const row of result.data || []) {
    const note = String(row.note || "");
    const labelled = note.match(/Vehicle Drive folder:\s*(https?:\/\/\S+)/i);
    if (labelled) return labelled[1].trim();
    const generic = note.match(/leadFolderUrl["'\s:]+(https?:\/\/[^"'\s]+)/i);
    if (generic) return generic[1].trim();
  }
  return "";
}

async function submitDriveFolderListToWebhook(payload, user) {
  const webhookUrl = String(process.env.LEAD_WEBHOOK_URL || "").trim();
  if (!webhookUrl) return { submitted: false, skipped: true, reason: "LEAD_WEBHOOK_URL is not configured" };
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "list-drive-folder-files",
        status: "list-drive-folder-files",
        listingId: payload.listingId,
        id: payload.leadId,
        leadId: payload.leadId,
        folderUrl: payload.folderUrl,
        folderId: driveFolderIdFromUrl(payload.folderUrl),
        authEmail: String(user?.email || "").trim()
      })
    });
    const text = await response.text().catch(() => "");
    const data = parseJson(text) || {};
    return {
      submitted: response.ok,
      status: response.status,
      data,
      response: text.slice(0, 1000),
      error: response.ok ? "" : data.error || `Drive folder sync webhook rejected the request (${response.status})`
    };
  } catch (error) {
    return { submitted: false, error: error.message || "Drive folder sync failed" };
  }
}

function normalizeDriveFolderFiles(parsed) {
  const rows = [
    ...(Array.isArray(parsed.savedFiles) ? parsed.savedFiles : []),
    ...(Array.isArray(parsed.files) ? parsed.files : []),
    ...(Array.isArray(parsed.photos) ? parsed.photos : [])
  ];
  const seen = new Set();
  return rows
    .map((file, index) => ({
      id: String(file.id || file.fileId || "").trim(),
      name: String(file.name || file.title || `Vehicle photo ${index + 1}`).trim(),
      url: String(file.url || file.webViewLink || file.webUrl || "").trim(),
      mimeType: String(file.mimeType || "").trim()
    }))
    .filter((file) => file.url && !isDriveFolderUrl(file.url))
    .filter((file) => !file.mimeType || file.mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic)$/i.test(file.name))
    .filter((file) => {
      const key = file.url || file.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function driveFolderIdFromUrl(url) {
  const value = String(url || "");
  const folderMatch = value.match(/\/folders\/([^/?#]+)/);
  const idMatch = value.match(/[?&]id=([^&]+)/);
  return folderMatch?.[1] || idMatch?.[1] || "";
}

async function submitDriveDeleteToWebhook(payload, user) {
  const webhookUrl = String(process.env.LEAD_WEBHOOK_URL || "").trim();
  if (!webhookUrl) return { ok: false, status: 502, error: "LEAD_WEBHOOK_URL is not configured, so Drive files cannot be deleted" };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete-drive-file",
        status: "delete-drive-file",
        fileId: payload.fileId,
        photoUrl: payload.photoUrl,
        listingId: payload.listingId,
        id: payload.leadId,
        authEmail: String(user?.email || "").trim()
      })
    });
    const text = await response.text().catch(() => "");
    const data = parseJson(text) || {};
    if (!response.ok) {
      return { ok: false, status: response.status, error: data.error || `Drive delete webhook rejected the request (${response.status})` };
    }
    if (data.deleted !== true && data.trashed !== true) {
      return { ok: false, status: 502, error: "Apps Script did not confirm the Drive file was deleted. Update GOOGLE_DRIVE_UPLOADS.md script and redeploy it." };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, status: 502, error: error.message || "Drive delete webhook failed" };
  }
}

async function submitInventoryPhotosToWebhook(listing, files, user) {
  const webhookUrl = String(process.env.LEAD_WEBHOOK_URL || "").trim();
  if (!webhookUrl) return { submitted: false, skipped: true, reason: "LEAD_WEBHOOK_URL is not configured" };
  const payload = {
    email: String(user?.email || listing.created_by || "inventory@autoswitch.local").trim(),
    phone: "",
    vin: listing.vin || "",
    uvc: listing.uvc || "",
    year: listing.vehicle_year || "",
    make: listing.make || "",
    model: listing.model || "",
    series: listing.series || "",
    style: listing.style || "",
    kilometers: listing.kilometers || "",
    color: listing.color || "",
    region: listing.region || "",
    country: "C",
    wholesaleAvg: "",
    retailAvg: listing.asking_price || "",
    tradeInAvg: "",
    id: listing.source_lead_id || listing.id || "",
    status: "inventory-photo-upload",
    authEmail: String(user?.email || "").trim(),
    photoCount: files.length,
    photoNames: files.map((file) => file.name).join(", "),
    files,
    raw: {
      listing,
      uploadedBy: user || {}
    }
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    return {
      submitted: response.ok,
      status: response.status,
      response: text,
      data: parseJson(text),
      error: response.ok ? "" : `Lead webhook rejected the photo upload (${response.status})`
    };
  } catch (error) {
    return { submitted: false, error: error.message || "Inventory photo webhook failed" };
  }
}

async function attachListingPhotos(inventory, publicOnly) {
  if (!inventory.length) return inventory;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return inventory;
  const ids = inventory.map((item) => item.id).filter(Boolean);
  if (!ids.length) return inventory;
  const response = await fetch(
    `${url}/rest/v1/listing_photos?select=*&listing_id=in.(${ids.map(encodeURIComponent).join(",")})&order=sort_order.asc,created_at.asc`,
    { headers: supabaseServiceHeaders(key) }
  );
  const rows = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(rows)) return inventory;
  const photosByListing = new Map();
  for (const row of rows) {
    const list = photosByListing.get(row.listing_id) || [];
    list.push({
      id: row.id || "",
      url: row.url || "",
      label: row.label || "",
      sortOrder: row.sort_order || 0
    });
    photosByListing.set(row.listing_id, list);
  }
  return inventory.map((item) => {
    const showPhotos = !publicOnly || isPublicOptionEnabled(item.publicOptions, "showPhotos");
    return {
      ...item,
      photos: showPhotos ? (photosByListing.get(item.id) || []) : []
    };
  });
}

function mergeListingPublicOptions(body) {
  const hasSelectedPublicPhotos = Array.isArray(body.selectedPhotoUrls)
    && body.selectedPhotoUrls.map((url) => String(url || "").trim()).filter(Boolean).length > 0;
  return {
    showVin: body.showVin === "on" || body.showVin === true,
    showUvc: body.showUvc === "on" || body.showUvc === true,
    showKilometers: body.showKilometers === "on" || body.showKilometers === true,
    showRegion: body.showRegion === "on" || body.showRegion === true,
    showColor: body.showColor === "on" || body.showColor === true,
    showMaintenance: body.showMaintenance === "on" || body.showMaintenance === true,
    showPhotos: body.showPhotos === "on" || body.showPhotos === true || hasSelectedPublicPhotos
  };
}

function isPublicOptionEnabled(options, key) {
  if (!options || !Object.keys(options).length) return true;
  return options[key] === true;
}

function buildListingFromLead(lead, body, user) {
  const input = lead.input || {};
  const valuation = lead.valuation || {};
  const adjustment = lead.owner_adjustment || {};
  const askingPrice = firstNumber(
    body.askingPrice,
    adjustment.retail,
    marketAverage(valuation, "retail"),
    marketAverage(valuation, "wholesale")
  ) || 0;
  const title = String(body.title || valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" ")).trim();

  return {
    source_lead_id: lead.id,
    status: String(body.status || "published").trim() || "published",
    title,
    vin: String(input.vin || valuation.vin || "").trim(),
    uvc: String(input.uvc || "").trim(),
    vehicle_year: numberOrNull(input.year),
    make: String(input.make || "").trim(),
    model: String(input.model || "").trim(),
    series: String(input.series || "").trim(),
    style: String(input.style || "").trim(),
    kilometers: numberOrNull(input.kilometers),
    color: String(input.color || "").trim(),
    region: String(input.region || valuation.region || "").trim(),
    asking_price: askingPrice,
    monthly_payment_estimate: numberOrNull(body.monthlyPaymentEstimate),
    description: String(body.description || lead.notes || "").trim(),
    public_options: buildListingPublicOptions(body),
    published_at: String(body.status || "published").trim() === "published" ? new Date().toISOString() : null,
    created_by: String(user?.email || "").trim(),
    updated_at: new Date().toISOString()
  };
}

function buildListingPublicOptions(body) {
  const hasSelectedPublicPhotos = Array.isArray(body.selectedPhotoUrls)
    && body.selectedPhotoUrls.map((url) => String(url || "").trim()).filter(Boolean).length > 0;
  return {
    showVin: body.showVin === "on" || body.showVin === true,
    showUvc: body.showUvc === "on" || body.showUvc === true,
    showKilometers: body.showKilometers === "on" || body.showKilometers === true,
    showRegion: body.showRegion === "on" || body.showRegion === true,
    showColor: body.showColor === "on" || body.showColor === true,
    showMaintenance: body.showMaintenance === "on" || body.showMaintenance === true,
    showPhotos: body.showPhotos === "on" || body.showPhotos === true || hasSelectedPublicPhotos
  };
}

function firstNumber(...values) {
  for (const value of values) {
    const number = numberOrNull(value);
    if (number !== null) return number;
  }
  return null;
}

function publicInventoryRow(row) {
  return {
    id: row.id || "",
    sourceLeadId: row.source_lead_id || "",
    status: row.status || "",
    title: row.title || "",
    vin: row.vin || "",
    uvc: row.uvc || "",
    year: row.vehicle_year || "",
    make: row.make || "",
    model: row.model || "",
    series: row.series || "",
    style: row.style || "",
    kilometers: row.kilometers || 0,
    color: row.color || "",
    region: row.region || "",
    price: Number(row.asking_price || 0),
    monthlyPaymentEstimate: Number(row.monthly_payment_estimate || 0),
    description: row.description || "",
    publicOptions: row.public_options || {},
    publishedAt: row.published_at || row.created_at || ""
  };
}

async function listLeadActivity(leadId) {
  const id = String(leadId || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!id) return { ok: false, status: 400, error: "Lead id is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const [notes, tasks, emails] = await Promise.all([
    fetchSupabaseJson(`${url}/rest/v1/lead_notes?select=*&lead_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=100`, key),
    fetchSupabaseJson(`${url}/rest/v1/lead_tasks?select=*&lead_id=eq.${encodeURIComponent(id)}&order=due_at.asc.nullslast,created_at.desc&limit=100`, key),
    fetchSupabaseJson(`${url}/rest/v1/lead_emails?select=*&lead_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=100`, key)
  ]);
  const failed = [notes, tasks, emails].find((result) => !result.ok);
  if (failed) return failed;

  return { ok: true, notes: notes.data || [], tasks: tasks.data || [], emails: emails.data || [] };
}

async function canAccessLead(leadId, dealer) {
  const id = String(leadId || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!id) return { ok: false, status: 400, error: "Lead id is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const response = await fetch(`${url}/rest/v1/valuation_leads?select=id,assigned_to&id=eq.${encodeURIComponent(id)}&limit=1`, {
    headers: supabaseServiceHeaders(key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: rows };

  const lead = rows?.[0];
  if (!lead) return { ok: false, status: 404, error: "Lead not found" };
  if (dealer.role === "admin") return { ok: true, lead };

  const assignedTo = String(lead.assigned_to || "").trim().toLowerCase();
  const email = String(dealer.user?.email || "").trim().toLowerCase();
  if (assignedTo && assignedTo === email) return { ok: true, lead };
  const taskAccess = await fetch(`${url}/rest/v1/lead_tasks?select=id&lead_id=eq.${encodeURIComponent(id)}&assigned_to=eq.${encodeURIComponent(email)}&limit=1`, {
    headers: supabaseServiceHeaders(key)
  });
  const taskRows = await taskAccess.json().catch(() => []);
  if (!taskAccess.ok) return { ok: false, status: taskAccess.status, error: taskRows };
  if (Array.isArray(taskRows) && taskRows.length > 0) return { ok: true, lead };
  return { ok: false, status: 403, error: "This lead is not assigned to your dealer account." };
}

async function createLeadActivity(body, user, role) {
  const leadId = String(body.leadId || "").trim();
  const type = String(body.type || "note").trim().toLowerCase();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  if (type === "task") {
    const title = String(body.title || "").trim();
    if (!title) return { ok: false, status: 400, error: "Task title is required" };
    const result = await insertSupabaseJson(`${url}/rest/v1/lead_tasks`, key, {
      lead_id: leadId,
      assigned_to: String(body.assignedTo || user?.email || "").trim().toLowerCase(),
      title,
      due_at: dateOrNull(body.dueAt)
    });
    const task = result.data?.[0] || null;
    const assignedTo = String(task?.assigned_to || body.assignedTo || user?.email || "").trim().toLowerCase();
    if (result.ok && assignedTo) await assignLeadForTask({ url, key, leadId, assignedTo });
    if (result.ok) await touchLeadActivity({ url, key, leadId });
    return result.ok ? { ok: true, task } : result;
  }

  if (type === "email") {
    const sentTo = String(body.sentTo || "").trim().toLowerCase();
    const subject = String(body.subject || "").trim();
    if (!sentTo || !subject) return { ok: false, status: 400, error: "Recipient and subject are required" };
    const result = await insertSupabaseJson(`${url}/rest/v1/lead_emails`, key, {
      lead_id: leadId,
      sent_by: String(user?.email || "").trim().toLowerCase(),
      sent_to: sentTo,
      subject,
      body: String(body.body || "").trim(),
      provider_message_id: String(body.providerMessageId || "").trim(),
      status: String(body.status || "sent").trim()
    });
    if (result.ok) await touchLeadActivity({ url, key, leadId });
    return result.ok ? { ok: true, email: result.data?.[0] || null } : result;
  }

  const note = String(body.note || "").trim();
  if (!note) return { ok: false, status: 400, error: "Note is required" };
  const noteType = normalizeNoteType(body.noteType);
  const result = await insertSupabaseJson(`${url}/rest/v1/lead_notes`, key, {
    lead_id: leadId,
    author_email: String(user?.email || "").trim().toLowerCase(),
    note_type: noteType,
    note
  });
  if (result.ok && role !== "admin" && ["offer", "correction", "inspection"].includes(noteType)) {
    await createOwnerReviewNote({
      url,
      key,
      leadId,
      authorEmail: user?.email || "",
      reason: noteType === "correction"
        ? "Vehicle detail correction requested by staff."
        : noteType === "inspection"
          ? "Inspection or recon update added by staff."
          : "Quote or offer added by staff."
    });
  }
  if (result.ok) await touchLeadActivity({ url, key, leadId });
  return result.ok ? { ok: true, note: result.data?.[0] || null } : result;
}

async function assignLeadForTask({ url, key, leadId, assignedTo }) {
  if (!url || !key || !leadId || !assignedTo) return;
  const previous = await fetchSupabaseJson(`${url}/rest/v1/valuation_leads?select=status&id=eq.${encodeURIComponent(leadId)}&limit=1`, key);
  const currentStatus = String(previous?.data?.[0]?.status || "new").trim().toLowerCase();
  const patch = {
    assigned_to: assignedTo,
    last_activity_at: new Date().toISOString()
  };
  if (!currentStatus || currentStatus === "new") patch.status = "assigned";
  await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...supabaseServiceHeaders(key),
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(patch)
  }).catch(() => null);
}

async function updateLeadTask(body, user, role) {
  const taskId = String(body.taskId || "").trim();
  const leadId = String(body.leadId || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!taskId) return { ok: false, status: 400, error: "Task id is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const patch = {};
  if ("completed" in body) patch.completed_at = body.completed ? new Date().toISOString() : null;
  if ("title" in body) patch.title = String(body.title || "").trim();
  if ("assignedTo" in body) patch.assigned_to = String(body.assignedTo || "").trim().toLowerCase();
  if ("dueAt" in body) patch.due_at = dateOrNull(body.dueAt);

  const response = await fetch(`${url}/rest/v1/lead_tasks?id=eq.${encodeURIComponent(taskId)}`, {
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
  if (leadId) await touchLeadActivity({ url, key, leadId });
  if (leadId && body.completed && role !== "admin") {
    await createOwnerReviewNote({
      url,
      key,
      leadId,
      authorEmail: user?.email || "",
      reason: "Task completed by staff. Review the next CRM step."
    });
  }
  return { ok: true, task: data?.[0] || null };
}

async function updateLeadOwnerInfoFromActivity(body, user, role) {
  const leadId = String(body.leadId || "").trim();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const previousResult = await fetchSupabaseJson(`${url}/rest/v1/valuation_leads?select=*&id=eq.${encodeURIComponent(leadId)}&limit=1`, key);
  if (!previousResult.ok) return previousResult;
  const previous = previousResult.data?.[0];
  if (!previous) return { ok: false, status: 404, error: "Lead not found" };
  if (isBuyerLead(previous)) return { ok: false, status: 400, error: "Owner info is only used for seller vehicle leads" };

  const previousInput = previous.input || {};
  const nextInput = {
    ...previousInput,
    ownerName: String(body.ownerName || "").trim(),
    ownerEmail: String(body.ownerEmail || "").trim().toLowerCase(),
    ownerPhone: String(body.ownerPhone || "").trim()
  };
  const response = await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...supabaseServiceHeaders(key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      input: nextInput,
      last_activity_at: new Date().toISOString()
    })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };

  const changes = [];
  if (String(previousInput.ownerName || "") !== nextInput.ownerName) changes.push("owner name");
  if (String(previousInput.ownerEmail || "") !== nextInput.ownerEmail) changes.push("owner email");
  if (String(previousInput.ownerPhone || "") !== nextInput.ownerPhone) changes.push("owner phone");
  if (changes.length) {
    await insertSupabaseJson(`${url}/rest/v1/lead_notes`, key, {
      lead_id: leadId,
      author_email: String(user?.email || "").trim().toLowerCase(),
      note_type: "internal",
      note: `Owner info updated: ${changes.join(", ")}.`
    }).catch(() => null);
  }
  if (role !== "admin") {
    await createOwnerReviewNote({
      url,
      key,
      leadId,
      authorEmail: user?.email || "",
      reason: "Owner info updated by staff. Review before pricing or warehouse work."
    });
  }

  return { ok: true, lead: data?.[0] || null };
}

async function updateLeadStatusFromActivity(body, user, role) {
  const leadId = String(body.leadId || "").trim();
  const status = normalizeLeadStatus(body.status);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };
  if (!status) return { ok: false, status: 400, error: "Unsupported lead status" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const now = new Date().toISOString();
  const response = await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...supabaseServiceHeaders(key),
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
  await insertSupabaseJson(`${url}/rest/v1/lead_notes`, key, {
    lead_id: leadId,
    author_email: String(user?.email || "").trim().toLowerCase(),
    note_type: "internal",
    note
  }).catch(() => null);
  if (role !== "admin") {
    const reason = ownerReviewReason(status);
    if (reason) await createOwnerReviewNote({ url, key, leadId, authorEmail: user?.email || "", reason });
  }

  return { ok: true, lead: data?.[0] || null };
}

async function updateLeadFollowUpFromActivity(body, user) {
  const leadId = String(body.leadId || "").trim();
  const dueAt = dateOrNull(body.dueAt);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!leadId) return { ok: false, status: 400, error: "Lead id is required" };
  if (!dueAt) return { ok: false, status: 400, error: "Valid follow-up date is required" };
  if (!url || !key) return { ok: false, status: 500, error: "Supabase is not configured" };

  const response = await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...supabaseServiceHeaders(key),
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
  await insertSupabaseJson(`${url}/rest/v1/lead_notes`, key, {
    lead_id: leadId,
    author_email: String(user?.email || "").trim().toLowerCase(),
    note_type: "internal",
    note
  }).catch(() => null);

  return { ok: true, lead: data?.[0] || null };
}

async function insertSupabaseJson(url, key, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseServiceHeaders(key),
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, data };
}

async function createOwnerReviewNote({ url, key, leadId, authorEmail, reason }) {
  if (!url || !key || !leadId) return;
  await insertSupabaseJson(`${url}/rest/v1/lead_notes`, key, {
    lead_id: leadId,
    author_email: String(authorEmail || "").trim().toLowerCase(),
    note_type: "owner_review",
    note: reason
  }).catch(() => null);
}

async function recordWebhookPhotosAsLeadNote({ url, key, leadId, uploadFiles = [], webhook = {} }) {
  if (!url || !key || !leadId || !webhook?.submitted) return;
  const parsed = webhook.data || parseJson(webhook.response) || {};
  const savedFiles = Array.isArray(parsed.savedFiles) ? parsed.savedFiles : [];
  if (!savedFiles.length) return;
  const lines = [];
  if (parsed.leadFolderUrl) lines.push(`Vehicle Drive folder: ${parsed.leadFolderUrl}`);
  lines.push(...savedFiles.map((file, index) => {
    const label = uploadFiles[index]?.role || uploadFiles[index]?.angle || uploadFiles[index]?.name || file.name || `Photo ${index + 1}`;
    const photoUrl = file.url || file.webViewLink || "";
    return photoUrl ? `${label}: ${photoUrl}` : "";
  }).filter(Boolean));
  if (!lines.length) return;
  await insertSupabaseJson(`${url}/rest/v1/lead_notes`, key, {
    lead_id: leadId,
    author_email: "system",
    note_type: "inspection",
    note: `Vehicle photo upload:\n${lines.join("\n")}`
  }).catch(() => null);
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

async function touchLeadActivity({ url, key, leadId }) {
  await fetch(`${url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...supabaseServiceHeaders(key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ last_activity_at: new Date().toISOString() })
  }).catch(() => null);
}

function normalizePriority(value) {
  const priority = String(value || "normal").trim().toLowerCase();
  return ["low", "normal", "high", "urgent"].includes(priority) ? priority : "normal";
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

function ownerContactMessage() {
  const configuredContact = String(process.env.OWNER_CONTACT || "").trim();
  if (configuredContact) return configuredContact;

  const ownerEmail = String(process.env.OWNER_EMAIL || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)[0];

  if (ownerEmail) return `Please email ${ownerEmail} for more valuations.`;
  return "Please contact the website owner for more valuations.";
}

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
      contact: ownerContactMessage()
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
    unlimited: annualLimit.limit < 0,
    remaining: annualLimit.limit < 0 ? null : Math.max(0, annualLimit.limit - used.count),
    contact: ownerContactMessage()
  };
}

async function getAnnualLimit({ url, key, userId, year }) {
  if (!userId) return { limit: DEFAULT_ANNUAL_LIMIT };

  const response = await fetch(`${url}/rest/v1/valuation_user_limits?select=annual_limit&user_id=eq.${encodeURIComponent(userId)}&valuation_year=eq.${year}&limit=1`, {
    headers: supabaseServiceHeaders(key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return { error: `Unable to load valuation limit (${response.status})` };

  return { limit: Number(rows?.[0]?.annual_limit ?? DEFAULT_ANNUAL_LIMIT) };
}

async function getUsedCount({ url, key, userId, email, year }) {
  const filter = userId
    ? `auth_user_id=eq.${encodeURIComponent(userId)}`
    : `auth_email=eq.${encodeURIComponent(email)}`;
  const response = await fetch(`${url}/rest/v1/valuation_leads?select=id,input,valuation&${filter}&valuation_year=eq.${year}`, {
    headers: supabaseServiceHeaders(key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return { error: `Unable to load valuation usage (${response.status})` };

  return { count: Array.isArray(rows) ? rows.filter((row) => !isBuyerInquiryLead(row)).length : 0 };
}

async function listUserLimits(year) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, storage: "not_configured", users: [] };

  const [leadsResult, limitsResult, accessRoleResult] = await Promise.all([
    fetchSupabaseJson(`${url}/rest/v1/valuation_leads?select=auth_user_id,auth_email,input,valuation&valuation_year=eq.${year}`, key),
    fetchSupabaseJson(`${url}/rest/v1/valuation_user_limits?select=*&valuation_year=eq.${year}`, key),
    accessRolesForDisplay({ url, key })
  ]);

  if (!leadsResult.ok) return leadsResult;
  if (!limitsResult.ok) return limitsResult;

  const roleByEmail = accessRoleResult.roleByEmail || new Map();
  const limitsByUser = new Map((limitsResult.data || []).map((limit) => [limit.user_id, limit]));
  const usersById = new Map();

  for (const lead of leadsResult.data || []) {
    if (isBuyerInquiryLead(lead)) continue;
    const userId = lead.auth_user_id || lead.auth_email;
    if (!userId) continue;
    const current = usersById.get(userId) || { userId, email: lead.auth_email || "", used: 0 };
    current.used += 1;
    if (!current.email && lead.auth_email) current.email = lead.auth_email;
    usersById.set(userId, current);
  }

  for (const [email, role] of roleByEmail.entries()) {
    const current = usersById.get(email) || { userId: email, email, used: 0, role };
    current.role = role;
    usersById.set(email, current);
  }

  for (const limit of limitsResult.data || []) {
    const userId = limit.user_id;
    if (!userId) continue;
    const current = usersById.get(userId) || { userId, email: limit.email || "", used: 0 };
    current.email = current.email || limit.email || "";
    current.role = current.role || roleByEmail.get(normalizeEmail(current.email || userId)) || "customer";
    usersById.set(userId, current);
  }

  const mergedUsers = mergeUsersByEmail([...usersById.values()]);
  const users = mergedUsers
    .map((user) => {
      const emailKey = normalizeEmail(user.email);
      const limit = limitsByUser.get(user.userId) || limitsByUser.get(emailKey);
      const annualLimit = Number(limit?.annual_limit ?? DEFAULT_ANNUAL_LIMIT);
      const role = user.role || roleByEmail.get(normalizeEmail(user.email || user.userId)) || "customer";
      return {
        ...user,
        role,
        year,
        annualLimit,
        unlimited: annualLimit < 0,
        remaining: annualLimit < 0 ? null : Math.max(0, annualLimit - user.used)
      };
    })
    .sort((a, b) => {
      const roleOrder = { admin: 0, dealer: 1, customer: 2 };
      const roleCompare = (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9);
      return roleCompare || (a.email || a.userId).localeCompare(b.email || b.userId);
    });

  return {
    ok: true,
    storage: "supabase",
    year,
    users,
    staffFilterWarning: accessRoleResult.warning || ""
  };
}

function isBuyerInquiryLead(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  return input.leadType === "buyer_inquiry" || valuation.source === "buyer_inquiry";
}

function mergeUsersByEmail(users) {
  const byEmail = new Map();
  const withoutEmail = [];
  for (const user of users) {
    const email = normalizeEmail(user.email || (String(user.userId || "").includes("@") ? user.userId : ""));
    if (!email) {
      withoutEmail.push(user);
      continue;
    }

    const current = byEmail.get(email);
    if (!current) {
      byEmail.set(email, { ...user, email });
      continue;
    }

    const preferredUserId = preferUserId(current.userId, user.userId);
    byEmail.set(email, {
      ...current,
      ...user,
      userId: preferredUserId,
      email,
      used: Number(current.used || 0) + Number(user.used || 0),
      role: preferredRole(current.role, user.role)
    });
  }
  return [...byEmail.values(), ...withoutEmail];
}

function preferUserId(a, b) {
  if (looksLikeUuid(a)) return a;
  if (looksLikeUuid(b)) return b;
  return a || b;
}

function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function preferredRole(a, b) {
  const order = { admin: 0, dealer: 1, customer: 2 };
  return (order[a] ?? 9) <= (order[b] ?? 9) ? a : b;
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
  if (!Number.isInteger(annualLimit) || annualLimit < -1) {
    return { ok: false, error: "Annual limit must be -1 for unlimited, or 0 or more" };
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

async function listDealerStaff() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const envDealers = configuredEmails(process.env.DEALER_EMAILS).map((email) => ({
    email,
    source: "vercel_env",
    active: true,
    created_at: "",
    created_by: ""
  }));

  if (!url || !key) {
    return { ok: true, storage: "not_configured", staff: envDealers };
  }

  const response = await fetch(`${url}/rest/v1/dealer_staff?select=*&order=email.asc`, {
    headers: supabaseServiceHeaders(key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: `Unable to load dealer staff. Create the dealer_staff table in Supabase first. ${supabaseErrorMessage(rows)}`,
      details: rows
    };
  }

  const dbStaff = (Array.isArray(rows) ? rows : []).map((row) => ({
    email: String(row.email || "").toLowerCase(),
    source: "supabase",
    active: row.active !== false,
    created_at: row.created_at || "",
    created_by: row.created_by || ""
  }));

  const byEmail = new Map([...envDealers, ...dbStaff].map((staff) => [staff.email, staff]));
  return { ok: true, storage: "supabase", staff: [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email)) };
}

async function listDealerDirectory() {
  const staffResult = await listDealerStaff();
  if (!staffResult.ok) return staffResult;
  const emails = [...new Set((staffResult.staff || [])
    .filter((staff) => staff.active !== false)
    .map((staff) => String(staff.email || "").trim().toLowerCase())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  return { ok: true, emails };
}

async function accessRolesForDisplay({ url, key }) {
  const roleByEmail = new Map();
  for (const email of configuredEmails(process.env.ADMIN_EMAILS)) {
    roleByEmail.set(email, "admin");
  }
  for (const email of configuredEmails(process.env.DEALER_EMAILS)) {
    if (!roleByEmail.has(email)) roleByEmail.set(email, "dealer");
  }

  const response = await fetch(`${url}/rest/v1/dealer_staff?select=email,active&active=eq.true`, {
    headers: supabaseServiceHeaders(key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) {
    return {
      roleByEmail,
      warning: "Dealer staff table could not be loaded, so only ADMIN_EMAILS and DEALER_EMAILS were shown as staff roles."
    };
  }

  for (const row of rows || []) {
    const email = normalizeEmail(row.email);
    if (email && !roleByEmail.has(email)) roleByEmail.set(email, "dealer");
  }

  return { roleByEmail, warning: "" };
}

async function addDealerStaff(body, adminUser) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "Supabase is not configured" };

  const email = normalizeEmail(body.email);
  if (!email) return { ok: false, error: "Dealer email is required" };

  const response = await fetch(`${url}/rest/v1/dealer_staff?on_conflict=email`, {
    method: "POST",
    headers: {
      ...supabaseServiceHeaders(key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      email,
      active: true,
      created_by: adminUser?.email || "",
      updated_at: new Date().toISOString()
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: `Unable to save dealer email. Create the dealer_staff table in Supabase first. ${supabaseErrorMessage(data)}`,
      details: data
    };
  }
  return { ok: true, staff: data?.[0] || null };
}

async function deleteDealerStaff(emailValue) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "Supabase is not configured" };

  const email = normalizeEmail(emailValue);
  if (!email) return { ok: false, error: "Dealer email is required" };

  const response = await fetch(`${url}/rest/v1/dealer_staff?email=eq.${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: {
      ...supabaseServiceHeaders(key),
      Prefer: "return=representation"
    }
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: `Unable to remove dealer email. ${supabaseErrorMessage(data)}`,
      details: data
    };
  }
  return { ok: true, deleted: data || [] };
}

async function isDealerStaffEmail(emailValue) {
  const email = normalizeEmail(emailValue);
  if (!email) return { ok: true, allowed: false };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: true, allowed: false };

  const response = await fetch(`${url}/rest/v1/dealer_staff?select=email,active&email=eq.${encodeURIComponent(email)}&active=eq.true&limit=1`, {
    headers: supabaseServiceHeaders(key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) {
    return { ok: false, error: "Unable to verify dealer staff. Create the dealer_staff table in Supabase first." };
  }

  return { ok: true, allowed: Array.isArray(rows) && rows.length > 0 };
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function supabaseErrorMessage(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return String(error.message || error.details || error.hint || "").trim();
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

function sanitizeLeadInput(input) {
  const leadSource = normalizeLeadSource(input.leadSource || input.sourceContext || (input.leadType === "buyer_inquiry" ? "buyer_inquiry" : input.createdByDealer ? "dealer_appraisal" : "owner_self_valuation"));
  return {
    leadSource,
    sourceLabel: leadSourceLabel(leadSource),
    email: String(input.email || "").trim(),
    phone: String(input.phone || "").trim(),
    ownerName: String(input.ownerName || input.name || "").trim(),
    ownerEmail: String(input.ownerEmail || "").trim(),
    ownerPhone: String(input.ownerPhone || "").trim(),
    submitterName: String(input.submitterName || "").trim(),
    submitterEmail: String(input.submitterEmail || input.dealerEmail || input.authEmail || "").trim(),
    submitterRelationship: String(input.submitterRelationship || "").trim(),
    dealerEmail: String(input.dealerEmail || "").trim(),
    authEmail: String(input.authEmail || "").trim(),
    createdByDealer: Boolean(input.createdByDealer || leadSource === "dealer_appraisal"),
    leadType: String(input.leadType || "").trim(),
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
    .slice(0, MAX_LEAD_PHOTOS)
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
    .map((item) =>
      completeVehicleChoice({
        uvc: item.uvc || item.UVC || item.value || "",
        year: item.model_year || item.year || "",
        make: item.make || "",
        model: item.model || "",
        series: item.series || item.trim || "",
        style: item.style || "",
        title: item.description || item.vehicle_description || item.text || vehicleTitle(item)
      })
    )
    .filter((item) => item.title && item.title !== "Vehicle ");
}

function completeVehicleChoice(item) {
  const parsed = parseVehicleTitle(item.title);
  return {
    ...item,
    year: item.year || parsed.year,
    make: item.make || parsed.make,
    model: item.model || parsed.model,
    series: item.series || parsed.series,
    style: item.style || parsed.style
  };
}

function parseVehicleTitle(title = "") {
  const parts = String(title).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2 || !/^\d{4}$/.test(parts[0])) {
    return { year: "", make: "", model: "", series: "", style: "" };
  }

  const styleIndex = parts.findIndex((part) => /^\dD$/i.test(part));
  const detailParts = parts.slice(3);
  const seriesParts = styleIndex > 3 ? parts.slice(3, styleIndex) : [];
  const styleParts = styleIndex > -1 ? parts.slice(styleIndex) : [];

  return {
    year: parts[0] || "",
    make: parts[1] || "",
    model: parts[2] || "",
    series: seriesParts.join(" "),
    style: styleParts.length ? styleParts.join(" ") : detailParts.join(" ")
  };
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
  const styleNodes = activeSeriesNodes.flatMap((seriesItem) =>
    arrayOf(seriesItem?.style_list).map((style) => ({ seriesItem, style }))
  );

  const makes = selectedMake
    ? uniqueSorted(activeMakeNodes.map((item) => item?.name))
    : uniqueSorted(makeNodes.map((item) => item?.name));
  const models = uniqueSorted(modelNodes.map((item) => item?.name));
  const series = selectedModel ? uniqueSorted(seriesNodes.map((item) => item?.name)) : [];
  const styles = selectedModel ? uniqueSorted(styleNodes.map((item) => item?.name)) : [];
  const vehicles = selectedModel
    ? styleNodes.map(({ seriesItem, style }) => ({
      uvc: style?.uvc || "",
      title: [input.year, selectedMake, selectedModel, seriesItem?.name || selectedSeries || "", style?.name || ""].filter(Boolean).join(" "),
      year: String(input.year || ""),
      make: selectedMake,
      model: selectedModel,
      series: seriesItem?.name || selectedSeries || "",
      style: style?.name || ""
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
