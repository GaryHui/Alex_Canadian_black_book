import { requireAdmin } from "./_admin.js";
import { serviceClient, serviceHeaders } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const admin = await requireAdmin(req);
  if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });

  const result = await deleteInventoryPhoto(req.body || {}, admin.user);
  return res.status(result.ok ? 200 : result.status || 400).json(result);
}

async function deleteInventoryPhoto(body, user) {
  const client = serviceClient();
  if (!client.ok) return client;

  const listingId = String(body.listingId || "").trim();
  const leadId = String(body.leadId || "").trim();
  const photoUrl = String(body.url || "").trim();
  const fileId = String(body.fileId || parseDriveFileId(photoUrl)).trim();
  if (!listingId || !leadId || !photoUrl || !fileId) {
    return { ok: false, status: 400, error: "Listing id, lead id, photo URL, and Drive file id are required" };
  }

  const driveDelete = await submitDriveDeleteToWebhook({ listingId, leadId, photoUrl, fileId }, user);
  if (!driveDelete.ok) return driveDelete;

  await fetch(
    `${client.url}/rest/v1/listing_photos?listing_id=eq.${encodeURIComponent(listingId)}&url=eq.${encodeURIComponent(photoUrl)}`,
    {
      method: "DELETE",
      headers: serviceHeaders(client.key)
    }
  ).catch(() => null);

  await fetch(`${client.url}/rest/v1/lead_notes`, {
    method: "POST",
    headers: {
      ...serviceHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      lead_id: leadId,
      author_email: String(user?.email || "").trim().toLowerCase(),
      note_type: "inspection",
      note: `Vehicle photo deleted:\n${photoUrl}`
    })
  }).catch(() => null);

  await fetch(`${client.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...serviceHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ last_activity_at: new Date().toISOString() })
  }).catch(() => null);

  return { ok: true, deleted: true, fileId, url: photoUrl };
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

function parseDriveFileId(url) {
  const value = String(url || "");
  const fileMatch = value.match(/\/d\/([^/]+)/);
  const idMatch = value.match(/[?&]id=([^&]+)/);
  return fileMatch?.[1] || idMatch?.[1] || "";
}

function parseJson(text) {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return null;
  }
}
