// Lightweight in-memory rate limiter for public Buy/Sell endpoints.
// Not persistent across restarts. Good enough for short bursts of spam.

const buckets = new Map();

function nowMs() {
  return Date.now();
}

function pruneBucket(bucket, windowMs) {
  const cutoff = nowMs() - windowMs;
  while (bucket.length && bucket[0] < cutoff) bucket.shift();
}

function recordHit(key, windowMs) {
  const bucket = buckets.get(key) || [];
  pruneBucket(bucket, windowMs);
  bucket.push(nowMs());
  buckets.set(key, bucket);
  return bucket.length;
}

function countHits(key, windowMs) {
  const bucket = buckets.get(key) || [];
  pruneBucket(bucket, windowMs);
  return bucket.length;
}

function lastHit(key) {
  const bucket = buckets.get(key) || [];
  return bucket.length ? bucket[bucket.length - 1] : 0;
}

export function clientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  if (forwarded) return forwarded;
  const real = String(req.headers?.["x-real-ip"] || "").trim();
  if (real) return real;
  const cf = String(req.headers?.["cf-connecting-ip"] || "").trim();
  if (cf) return cf;
  return req.socket?.remoteAddress || "unknown";
}

export function checkInquiryRateLimit(req, body = {}) {
  const ip = clientIp(req);
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const message = String(body.message || "").trim();
  const honeypot = String(body.website || body.company || body.hp || "").trim();

  if (honeypot) {
    return { ok: false, status: 200, silent: true };
  }

  const minIntervalMs = 15 * 1000;
  const ipLast = lastHit(`inquiry:ip:${ip}`);
  if (ipLast && nowMs() - ipLast < minIntervalMs) {
    const wait = Math.ceil((minIntervalMs - (nowMs() - ipLast)) / 1000);
    return { ok: false, status: 429, error: `Please wait ${wait}s before sending another message.`, retryAfter: wait };
  }

  const ipCount = countHits(`inquiry:ip-window:${ip}`, 60 * 60 * 1000);
  if (ipCount >= 5) {
    return { ok: false, status: 429, error: "Too many messages from this network. Try again in an hour.", retryAfter: 3600 };
  }

  if (email) {
    const emailCount = countHits(`inquiry:email-window:${email}`, 24 * 60 * 60 * 1000);
    if (emailCount >= 5) {
      return { ok: false, status: 429, error: "This email has reached today's message limit. Try again tomorrow or use a different contact.", retryAfter: 86400 };
    }
  }

  if (email && message) {
    const messageKey = `inquiry:dup:${email}:${message.toLowerCase()}`;
    const lastDup = lastHit(messageKey);
    if (lastDup && nowMs() - lastDup < 10 * 60 * 1000) {
      return { ok: false, status: 429, error: "This message looks like a duplicate. Please wait a few minutes before sending again.", retryAfter: 600 };
    }
  }

  if (!email && phone) {
    const phoneCount = countHits(`inquiry:phone-window:${phone}`, 24 * 60 * 60 * 1000);
    if (phoneCount >= 5) {
      return { ok: false, status: 429, error: "This phone number has reached today's message limit. Try again tomorrow.", retryAfter: 86400 };
    }
  }

  return { ok: true, ip, email, phone };
}

export function recordInquirySent(req, body = {}) {
  const ip = clientIp(req);
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const message = String(body.message || "").trim();

  recordHit(`inquiry:ip:${ip}`, 24 * 60 * 60 * 1000);
  recordHit(`inquiry:ip-window:${ip}`, 60 * 60 * 1000);
  if (email) {
    recordHit(`inquiry:email-window:${email}`, 24 * 60 * 60 * 1000);
    if (message) {
      recordHit(`inquiry:dup:${email}:${message.toLowerCase()}`, 10 * 60 * 1000);
    }
  }
  if (!email && phone) {
    recordHit(`inquiry:phone-window:${phone}`, 24 * 60 * 60 * 1000);
  }
}

export function checkLeadRateLimit(req, body = {}) {
  const ip = clientIp(req);
  const email = String(body.input?.email || body.email || "").trim().toLowerCase();
  const vin = String(body.input?.vin || body.vin || "").trim().toUpperCase();
  const honeypot = String(body.website || body.company || body.hp || "").trim();

  if (honeypot) {
    return { ok: false, status: 200, silent: true };
  }

  const minIntervalMs = 20 * 1000;
  const ipLast = lastHit(`lead:ip:${ip}`);
  if (ipLast && nowMs() - ipLast < minIntervalMs) {
    const wait = Math.ceil((minIntervalMs - (nowMs() - ipLast)) / 1000);
    return { ok: false, status: 429, error: `Please wait ${wait}s before submitting another valuation.`, retryAfter: wait };
  }

  const ipCount = countHits(`lead:ip-window:${ip}`, 60 * 60 * 1000);
  if (ipCount >= 8) {
    return { ok: false, status: 429, error: "Too many valuation requests from this network. Try again later.", retryAfter: 3600 };
  }

  if (email && vin) {
    const vinKey = `lead:dup:${email}:${vin}`;
    const lastDup = lastHit(vinKey);
    if (lastDup && nowMs() - lastDup < 5 * 60 * 1000) {
      return { ok: false, status: 429, error: "You already submitted this vehicle. Please wait a few minutes before trying again.", retryAfter: 300 };
    }
  }

  return { ok: true, ip, email, vin };
}

export function recordLeadSaved(req, body = {}) {
  const ip = clientIp(req);
  const email = String(body.input?.email || body.email || "").trim().toLowerCase();
  const vin = String(body.input?.vin || body.vin || "").trim().toUpperCase();

  recordHit(`lead:ip:${ip}`, 24 * 60 * 60 * 1000);
  recordHit(`lead:ip-window:${ip}`, 60 * 60 * 1000);
  if (email && vin) {
    recordHit(`lead:dup:${email}:${vin}`, 10 * 60 * 1000);
  }
}
