import { requireAdmin } from "./_admin.js";
import { serviceClient, serviceHeaders } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const admin = await requireAdmin(req);
  if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });

  const result = await syncInventoryDrivePhotos(req.body || {}, admin.user);
  return res.status(result.ok ? 200 : result.status || 400).json(result);
}

async function syncInventoryDrivePhotos(body, user) {
  const client = serviceClient();
  if (!client.ok) return client;

  const listingId = String(body.listingId || "").trim();
  const leadId = String(body.leadId || "").trim();
  if (!listingId || !leadId) return { ok: false, status: 400, error: "Listing id and lead id are required" };

  const folderUrl = String(body.folderUrl || await findLeadDriveFolderUrl(client, leadId) || "").trim();
  if (!folderUrl) {
    return {
      ok: false,
      status: 404,
      error: "No Google Drive vehicle folder is recorded for this lead yet. Upload one photo through this vehicle first, then sync the folder."
    };
  }

  const webhook = await listDriveFolderFiles({ listingId, leadId, folderUrl }, user);
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
  const files = normalizeDriveFiles(parsed);
  await recordSyncedPhotos(client, leadId, user, folderUrl, files);
  return { ok: true, folderUrl, photos: files, count: files.length };
}

async function findLeadDriveFolderUrl(client, leadId) {
  const result = await fetchJson(
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

async function listDriveFolderFiles(payload, user) {
  const webhookUrl = String(process.env.LEAD_WEBHOOK_URL || "").trim();
  if (!webhookUrl) return { submitted: false, skipped: true, reason: "LEAD_WEBHOOK_URL is not configured" };
  const body = {
    action: "list-drive-folder-files",
    status: "list-drive-folder-files",
    listingId: payload.listingId,
    id: payload.leadId,
    leadId: payload.leadId,
    folderUrl: payload.folderUrl,
    folderId: driveFolderIdFromUrl(payload.folderUrl),
    authEmail: String(user?.email || "").trim()
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await response.text().catch(() => "");
    const data = parseJson(text);
    return {
      submitted: response.ok,
      status: response.status,
      data,
      response: text.slice(0, 1000),
      error: response.ok ? "" : data?.error || `Drive folder sync webhook rejected the request (${response.status})`
    };
  } catch (error) {
    return { submitted: false, error: error.message || "Drive folder sync failed" };
  }
}

function normalizeDriveFiles(parsed) {
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
      url: driveFileUrl(file),
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

function driveFileUrl(file) {
  const direct = String(file.url || file.webViewLink || file.webUrl || "").trim();
  if (direct) return direct;
  const id = String(file.id || file.fileId || parseDriveFileId(file.thumbnailLink)).trim();
  return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/view` : "";
}

function parseDriveFileId(url) {
  const value = String(url || "");
  const fileMatch = value.match(/\/d\/([^/?#]+)/);
  const idMatch = value.match(/[?&]id=([^&]+)/);
  return fileMatch?.[1] || idMatch?.[1] || "";
}

async function recordSyncedPhotos(client, leadId, user, folderUrl, files) {
  const lines = [`Vehicle Drive folder: ${folderUrl}`];
  lines.push(...files.map((file, index) => `${file.name || `Vehicle photo ${index + 1}`}: ${file.url}`));
  await fetch(`${client.url}/rest/v1/lead_notes`, {
    method: "POST",
    headers: {
      ...serviceHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      lead_id: leadId,
      author_email: String(user?.email || "system").trim().toLowerCase(),
      note_type: "inspection",
      note: `Vehicle photo upload:\n${lines.join("\n")}`
    })
  }).catch(() => null);
}

async function fetchJson(url, key) {
  const response = await fetch(url, { headers: serviceHeaders(key) });
  const data = await response.json().catch(() => []);
  if (!response.ok) return { ok: false, status: response.status, error: data };
  return { ok: true, data };
}

function driveFolderIdFromUrl(url) {
  const value = String(url || "");
  const folderMatch = value.match(/\/folders\/([^/?#]+)/);
  const idMatch = value.match(/[?&]id=([^&]+)/);
  return folderMatch?.[1] || idMatch?.[1] || "";
}

function isDriveFolderUrl(url) {
  return /drive\.google\.com\/(?:drive\/)?folders\//i.test(String(url || ""));
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
