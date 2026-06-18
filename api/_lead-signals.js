export function isBuyerLead(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  return input.leadType === "buyer_inquiry" || valuation.source === "buyer_inquiry";
}

export function isClosedLeadStatus(status) {
  return ["won", "lost", "closed", "deleted", "in_inventory"].includes(String(status || "").trim().toLowerCase());
}

export function leadVehicleKeys(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  return vehicleKeysFromFields({
    vin: input.vin || valuation.vin,
    uvc: input.uvc || valuation.uvc,
    year: input.year || valuation.year,
    make: input.make || valuation.make,
    model: input.model || valuation.model,
    series: input.series || valuation.series,
    style: input.style || valuation.style
  });
}

export function listingVehicleKeys(listing) {
  return vehicleKeysFromFields({
    vin: listing?.vin,
    uvc: listing?.uvc,
    year: listing?.vehicle_year || listing?.year,
    make: listing?.make,
    model: listing?.model,
    series: listing?.series,
    style: listing?.style
  });
}

export function leadDisplayTitle(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  const raw = String(valuation.title || [input.year, input.make, input.model, input.series, input.style].filter(Boolean).join(" ") || "Vehicle lead").trim();
  return isBuyerLead(lead) ? raw.replace(/^Buyer inquiry\s*-\s*/i, "") : raw;
}

export function canonicalVehicleKeyForRecord(record) {
  const keys = vehicleKeysForRecord(record);
  return keys[0] || "";
}

export function isVehicleChildLead(lead, relationMap) {
  const state = relationMap?.get(String(lead?.id || "").trim());
  return Boolean(state && ["merged", "linked_inventory"].includes(state.kind));
}

export async function attachLeadSignals(leads, client) {
  if (!Array.isArray(leads) || !leads.length || !client?.url || !client?.key) return Array.isArray(leads) ? leads : [];
  const ids = leads.map((lead) => String(lead.id || "").trim()).filter(Boolean);
  if (!ids.length) return leads;

  const snapshot = await loadVehicleSnapshot(client);
  const duplicateMap = buildDuplicateWarningMap(leads, snapshot);
  const vehicleContextMap = buildVehicleContextMap(leads, snapshot);
  const signalMap = latestSignalByLead(snapshot.notes);
  const ownerReviewMap = latestOwnerReviewStateByLead(snapshot.notes);
  const activitySummaryMap = buildLeadActivitySummaryMap(leads, snapshot);
  const taskSummaryMap = buildLeadTaskSummaryMap(snapshot.tasks);

  return leads.map((lead) => {
    const id = String(lead.id || "").trim();
    return {
      ...lead,
      vehicle_signal: signalMap.get(id) || null,
      duplicate_warning: duplicateMap.get(id) || null,
      vehicle_context: vehicleContextMap.get(id) || null,
      owner_review: lead.owner_review || ownerReviewMap.get(id) || null,
      activity_summary: activitySummaryMap.get(id) || null,
      task_summary: taskSummaryMap.get(id) || null,
      merge_state: snapshot.relationMap.get(id) || null
    };
  });
}

export async function buildVehicleClusters(client) {
  if (!client?.url || !client?.key) return [];
  const snapshot = await loadVehicleSnapshot(client);
  const allLeadsWithSignals = await attachLeadSignals(snapshot.allLeads, client);
  const leadsById = new Map(allLeadsWithSignals.map((lead) => [String(lead.id || "").trim(), lead]));
  const clusters = new Map();

  for (const lead of allLeadsWithSignals) {
    const key = canonicalVehicleKeyForRecord(lead);
    if (!key) continue;
    const current = clusters.get(key) || createEmptyCluster(key, lead);
    if (isBuyerLead(lead)) current.buyer_leads.push(clusterLeadItem(lead));
    else current.seller_leads.push(clusterLeadItem(lead));
    current.needs_review_count += lead.duplicate_warning?.message && !lead.duplicate_warning?.reviewed ? 1 : 0;
    clusters.set(key, current);
  }

  for (const listing of snapshot.inventoryRows) {
    const key = canonicalVehicleKeyForRecord(listing);
    if (!key) continue;
    const current = clusters.get(key) || createEmptyCluster(key, listing);
    current.inventory.push(clusterInventoryItem(listing, leadsById.get(String(listing.source_lead_id || "").trim()) || null));
    clusters.set(key, current);
  }

  return [...clusters.values()]
    .map((cluster) => finalizeCluster(cluster))
    .filter((cluster) => cluster.seller_leads.length || cluster.buyer_leads.length || cluster.inventory.length)
    .sort((a, b) => {
      const needsReviewDiff = (b.needs_review_count || 0) - (a.needs_review_count || 0);
      if (needsReviewDiff) return needsReviewDiff;
      return new Date(b.latest_activity_at || 0).getTime() - new Date(a.latest_activity_at || 0).getTime();
    });
}

export async function notifySameVehicleBuyerLeads(client, reference, options = {}) {
  if (!client?.url || !client?.key) return { ok: false, count: 0 };
  const snapshot = await loadVehicleSnapshot(client);
  if (!snapshot.allLeads.length) return { ok: true, count: 0 };
  const referenceKeys = vehicleKeysForRecord(reference);
  if (!referenceKeys.length) return { ok: true, count: 0 };

  const excludeId = String(options.excludeLeadId || reference?.id || "").trim();
  const targetLeadIds = snapshot.allLeads
    .filter((lead) => {
      const id = String(lead.id || "").trim();
      if (!id || id === excludeId) return false;
      if (!isBuyerLead(lead) || isClosedLeadStatus(lead.status)) return false;
      return sharesVehicle(referenceKeys, leadVehicleKeys(lead));
    })
    .map((lead) => String(lead.id || "").trim());

  if (!targetLeadIds.length) return { ok: true, count: 0 };
  await createVehicleSignalNotes(client, targetLeadIds, options);
  return { ok: true, count: targetLeadIds.length };
}

export async function notifyDuplicateSellerLead(client, lead) {
  if (!client?.url || !client?.key || !lead?.id || isBuyerLead(lead)) return { ok: true, count: 0 };
  const duplicate = await evaluateDuplicateSellerLead(client, lead);
  if (!duplicate) return { ok: true, count: 0 };
  await createOwnerReviewNote(client, String(lead.id || ""), duplicate.message, "system");
  const relatedLeadIds = (duplicate.items || [])
    .filter((item) => item.kind === "lead")
    .map((item) => String(item.id || "").trim())
    .filter(Boolean);
  await createVehicleSignalNotes(client, [String(lead.id || ""), ...relatedLeadIds], {
    code: "duplicate_vehicle",
    message: duplicate.message
  });
  return { ok: true, count: duplicate.count || 0 };
}

export async function evaluateDuplicateSellerLead(client, lead) {
  if (!client?.url || !client?.key || !lead?.id || isBuyerLead(lead)) return null;
  const snapshot = await loadVehicleSnapshot(client);
  return duplicateWarningForLead(lead, snapshot);
}

export async function reviewDuplicateSellerLead(client, leadId, decision, authorEmail, options = {}) {
  const id = String(leadId || "").trim();
  const choice = duplicateDecision(decision);
  if (!client?.url || !client?.key || !id) return { ok: false, error: "Lead id is required" };
  const author = String(authorEmail || "system").trim().toLowerCase() || "system";

  const snapshot = await loadVehicleSnapshot(client);
  const lead = snapshot.leadsById.get(id);
  if (!lead) return { ok: false, error: "Lead not found" };
  if (isBuyerLead(lead)) return { ok: false, error: "Duplicate seller review only supports seller leads." };

  let result = {
    ok: true,
    decision: choice,
    target_lead_id: "",
    target_listing_id: ""
  };

  if (choice === "merge_existing") {
    result = await mergeDuplicateSellerLead(client, snapshot, lead, author, options);
    if (!result.ok) return result;
  } else if (choice === "link_inventory") {
    result = await linkDuplicateSellerLeadToInventory(client, snapshot, lead, author, options);
    if (!result.ok) return result;
  }

  const message = duplicateDecisionMessage(choice, result);
  await insertLeadNote(client, {
    lead_id: id,
    author_email: author,
    note_type: "internal",
    note: `[Vehicle review:duplicate_reviewed:${choice}] ${message}`
  });
  await insertLeadNote(client, {
    lead_id: id,
    author_email: author,
    note_type: "owner_read",
    note: `Duplicate vehicle review completed: ${message}`
  });
  await touchLeadIds(client, [id, result.target_lead_id].filter(Boolean));
  return {
    ok: true,
    decision: choice,
    target_lead_id: result.target_lead_id || "",
    target_listing_id: result.target_listing_id || ""
  };
}

export async function createVehicleSignalNotes(client, leadIds, options = {}) {
  const ids = [...new Set((Array.isArray(leadIds) ? leadIds : []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!client?.url || !client?.key || !ids.length) return;

  const code = signalCode(options.code);
  const message = String(options.message || "").trim();
  if (!message) return;

  await Promise.all(ids.map((leadId) => insertLeadNote(client, {
    lead_id: leadId,
    author_email: String(options.authorEmail || "system").trim().toLowerCase() || "system",
    note_type: "internal",
    note: `[Vehicle signal:${code}] ${message}`
  })));
  await touchLeadIds(client, ids);
}

async function loadVehicleSnapshot(client) {
  const [allLeads, inventoryRows] = await Promise.all([
    fetchAllLeads(client),
    fetchVehicleListings(client)
  ]);
  const noteIds = allLeads.map((lead) => String(lead.id || "").trim()).filter(Boolean);
  const [notes, emails, tasks] = await Promise.all([
    fetchLeadSignalNotes(noteIds, client),
    fetchLeadEmails(noteIds, client),
    fetchLeadTasks(noteIds, client)
  ]);
  const relationMap = latestVehicleRelationByLead(notes);
  return {
    allLeads,
    leadsById: new Map(allLeads.map((lead) => [String(lead.id || "").trim(), lead])),
    inventoryRows,
    notes,
    emails,
    tasks,
    relationMap,
    duplicateReviewMap: latestDuplicateReviewByLead(notes)
  };
}

async function fetchLeadSignalNotes(ids, client) {
  const validIds = (Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!client?.url || !client?.key || !validIds.length) return [];
  const encoded = validIds.map(encodeURIComponent).join(",");
  const response = await fetch(`${client.url}/rest/v1/lead_notes?select=lead_id,created_at,author_email,note,note_type&lead_id=in.(${encoded})&order=created_at.desc&limit=1000`, {
    headers: authHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return [];
  return Array.isArray(rows) ? rows : [];
}

async function fetchLeadEmails(ids, client) {
  const validIds = (Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!client?.url || !client?.key || !validIds.length) return [];
  const encoded = validIds.map(encodeURIComponent).join(",");
  const response = await fetch(`${client.url}/rest/v1/lead_emails?select=lead_id,created_at,sent_to,sent_by,subject,status&lead_id=in.(${encoded})&order=created_at.desc&limit=1000`, {
    headers: authHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return [];
  return Array.isArray(rows) ? rows : [];
}

async function fetchLeadTasks(ids, client) {
  const validIds = (Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!client?.url || !client?.key || !validIds.length) return [];
  const encoded = validIds.map(encodeURIComponent).join(",");
  const response = await fetch(`${client.url}/rest/v1/lead_tasks?select=id,lead_id,title,completed_at,due_at,assigned_to,created_at&lead_id=in.(${encoded})&order=created_at.desc&limit=1000`, {
    headers: authHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return [];
  return Array.isArray(rows) ? rows : [];
}

function buildLeadTaskSummaryMap(tasks) {
  const map = new Map();
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const leadId = String(task?.lead_id || "").trim();
    if (!leadId) continue;
    const current = map.get(leadId) || {
      open_count: 0,
      completed_count: 0,
      latest_open_title: "",
      latest_open_assigned_to: "",
      latest_open_due_at: "",
      latest_open_created_at: "",
      assigned_to: []
    };
    const assignedTo = String(task.assigned_to || "").trim().toLowerCase();
    if (assignedTo && !current.assigned_to.includes(assignedTo)) current.assigned_to.push(assignedTo);
    if (task.completed_at) {
      current.completed_count += 1;
    } else {
      current.open_count += 1;
      const currentTime = new Date(current.latest_open_due_at || current.latest_open_created_at || 0).getTime();
      const nextTime = new Date(task.due_at || task.created_at || 0).getTime();
      if (!current.latest_open_title || (!Number.isNaN(nextTime) && (Number.isNaN(currentTime) || nextTime < currentTime))) {
        current.latest_open_title = String(task.title || "Task").trim();
        current.latest_open_assigned_to = assignedTo;
        current.latest_open_due_at = task.due_at || "";
        current.latest_open_created_at = task.created_at || "";
      }
    }
    map.set(leadId, current);
  }
  return map;
}

async function fetchAllLeads(client) {
  const response = await fetch(`${client.url}/rest/v1/valuation_leads?select=*&order=created_at.desc&limit=200`, {
    headers: authHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  return response.ok && Array.isArray(rows) ? rows : [];
}

async function fetchVehicleListings(client) {
  const response = await fetch(`${client.url}/rest/v1/vehicle_listings?select=id,source_lead_id,status,title,vin,uvc,vehicle_year,make,model,series,style,asking_price,updated_at,created_at&order=updated_at.desc.nullslast,created_at.desc&limit=200`, {
    headers: authHeaders(client.key)
  });
  const rows = await response.json().catch(() => []);
  return response.ok && Array.isArray(rows) ? rows : [];
}

function buildDuplicateWarningMap(leads, snapshot) {
  const map = new Map();
  for (const lead of leads) {
    const warning = duplicateWarningForLead(lead, snapshot);
    if (warning) map.set(String(lead.id || "").trim(), warning);
  }
  return map;
}

function duplicateWarningForLead(lead, snapshot) {
  const id = String(lead?.id || "").trim();
  if (!id || isBuyerLead(lead)) return null;
  if (isVehicleChildLead(lead, snapshot.relationMap)) return null;

  const matches = duplicateMatchesForLead(lead, snapshot).slice(0, 4);
  if (!matches.length) return null;
  const review = snapshot.duplicateReviewMap.get(id) || null;
  return {
    count: matches.length,
    items: matches,
    reviewed: Boolean(review),
    reviewed_at: review?.created_at || "",
    reviewed_by: review?.author_email || "",
    decision: review?.decision || "",
    message: matches.some((item) => item.kind === "inventory")
      ? "Possible duplicate seller vehicle already exists in CRM / Warehouse."
      : "Possible duplicate seller vehicle already exists in CRM."
  };
}

function duplicateMatchesForLead(lead, snapshot) {
  const sourceId = String(lead?.id || "").trim();
  const keys = leadVehicleKeys(lead);
  if (!keys.length) return [];

  const leadMatches = snapshot.allLeads
    .filter((item) => {
      const id = String(item?.id || "").trim();
      return id
        && id !== sourceId
        && !isBuyerLead(item)
        && !isVehicleChildLead(item, snapshot.relationMap)
        && sharesVehicle(keys, leadVehicleKeys(item));
    })
    .map((item) => ({
      kind: "lead",
      id: String(item.id || ""),
      title: leadDisplayTitle(item),
      status: String(item.status || "new").replaceAll("_", " "),
      createdAt: item.created_at || ""
    }));

  const inventoryMatches = snapshot.inventoryRows
    .filter((item) => String(item?.source_lead_id || "").trim() !== sourceId && sharesVehicle(keys, listingVehicleKeys(item)))
    .map((item) => ({
      kind: "inventory",
      id: String(item.id || ""),
      title: String(item.title || [item.vehicle_year, item.make, item.model, item.series, item.style].filter(Boolean).join(" ") || "Warehouse listing").trim(),
      status: String(item.status || "draft"),
      createdAt: item.updated_at || item.created_at || ""
    }));

  return [...leadMatches, ...inventoryMatches];
}

function latestSignalByLead(notes) {
  const map = new Map();
  for (const note of (Array.isArray(notes) ? notes : []).filter((row) => isVehicleSignalNote(row?.note))) {
    const leadId = String(note.lead_id || "").trim();
    if (!leadId || map.has(leadId)) continue;
    const parsed = parseVehicleSignalNote(note.note);
    if (!parsed) continue;
    map.set(leadId, {
      code: parsed.code,
      message: parsed.message,
      at: note.created_at || "",
      by: note.author_email || "system",
      tone: signalTone(parsed.code)
    });
  }
  return map;
}

function buildLeadActivitySummaryMap(leads, snapshot) {
  const summaries = new Map();
  const notesByLead = groupByLeadId(snapshot?.notes || []);
  const emailsByLead = groupByLeadId(snapshot?.emails || []);
  const now = Date.now();
  for (const lead of Array.isArray(leads) ? leads : []) {
    const id = String(lead?.id || "").trim();
    if (!id) continue;
    const createdAt = String(lead?.created_at || "").trim();
    const createdMs = new Date(createdAt || 0).getTime();
    const ageDays = createdMs > 0 ? Math.max(0, Math.floor((now - createdMs) / (24 * 60 * 60 * 1000))) : 0;
    const outboundTouch = latestOutboundTouch(notesByLead.get(id) || [], emailsByLead.get(id) || []);
    const inboundLabel = isBuyerLead(lead) ? "Buyer inquiry" : "Seller inquiry";
    summaries.set(id, {
      last_inbound_at: createdAt,
      last_inbound_label: createdAt ? `${inboundLabel} ${createdAt}` : inboundLabel,
      last_outbound_at: outboundTouch?.at || "",
      last_outbound_label: outboundTouch?.label || "",
      last_outbound_channel: outboundTouch?.channel || "",
      age_days: ageDays,
      age_bucket: leadAgeBucket(ageDays),
      age_label: leadAgeLabel(ageDays),
      deal_desk: buildDealDeskSummary(lead, notesByLead.get(id) || [])
    });
  }
  return summaries;
}

function groupByLeadId(rows) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const leadId = String(row?.lead_id || "").trim();
    if (!leadId) continue;
    const current = map.get(leadId) || [];
    current.push(row);
    map.set(leadId, current);
  }
  return map;
}

function latestOutboundTouch(notes, emails) {
  const emailTouches = (Array.isArray(emails) ? emails : []).map((email) => ({
    at: email.created_at || "",
    label: "Last outbound email",
    channel: "email"
  }));
  const noteTouches = (Array.isArray(notes) ? notes : [])
    .filter((note) => ["call", "sms", "email"].includes(String(note?.note_type || "").trim().toLowerCase()))
    .map((note) => {
      const type = String(note?.note_type || "").trim().toLowerCase();
      const label = type === "call"
        ? "Last outbound call"
        : type === "sms"
          ? "Last outbound text"
          : "Last outbound email";
      return {
        at: note.created_at || "",
        label,
        channel: type
      };
    });
  return [...emailTouches, ...noteTouches]
    .map((item) => ({ ...item, time: new Date(item.at || 0).getTime() }))
    .filter((item) => item.at && !Number.isNaN(item.time))
    .sort((a, b) => b.time - a.time)[0] || null;
}

function leadAgeBucket(days) {
  if (days >= 7) return "critical";
  if (days >= 3) return "at_risk";
  return "fresh";
}

function leadAgeLabel(days) {
  if (days >= 7) return `Aging ${days}d`;
  if (days >= 3) return `Open ${days}d`;
  return days > 0 ? `Fresh ${days}d` : "Fresh today";
}

function buildDealDeskSummary(lead, notes) {
  const template = dealChecklistTemplateItems(lead);
  if (!template.length) {
    return {
      total: 0,
      completed: 0,
      pending: 0,
      progress_label: "",
      items: [],
      delivery_at: "",
      key_handoff_status: "pending",
      key_handoff_label: "Key handoff pending"
    };
  }
  const state = latestDealDeskState(notes);
  const matched = template.map((item) => {
    const current = state.checks.get(item.key) || null;
    return {
      key: item.key,
      label: item.label,
      completed: Boolean(current?.completed),
      completed_at: current?.at || ""
    };
  });
  if (state.delivery_at) {
    const deliveryItem = matched.find((item) => item.key === "delivery_booked");
    if (deliveryItem) {
      deliveryItem.completed = true;
      deliveryItem.completed_at = state.delivery_at;
    }
  }
  const completed = matched.filter((item) => item.completed).length;
  const total = matched.length;
  return {
    total,
    completed,
    pending: total - completed,
    progress_label: total ? `Checklist ${completed}/${total}` : "",
    items: matched,
    delivery_at: state.delivery_at,
    key_handoff_status: state.key_handoff_status,
    key_handoff_label: keyHandoffLabel(state.key_handoff_status)
  };
}

function dealChecklistTemplateItems(lead) {
  const status = String(lead?.status || "").trim().toLowerCase();
  if (isBuyerLead(lead) && status === "won") {
    return [
      { key: "docs_ready", label: "Docs ready" },
      { key: "keys_ready", label: "Keys ready" },
      { key: "delivery_booked", label: "Delivery booked" },
      { key: "vehicle_picked_up", label: "Vehicle picked up" }
    ];
  }
  if (!isBuyerLead(lead) && ["in_inventory", "won"].includes(status)) {
    return [
      { key: "intake_photos_complete", label: "Intake photos complete" },
      { key: "keys_collected", label: "Keys collected" },
      { key: "pricing_approved", label: "Pricing approved" },
      { key: "publish_review_complete", label: "Publish review complete" }
    ];
  }
  return [];
}

function latestDealDeskState(notes) {
  const checks = new Map();
  let deliveryAt = "";
  let keyHandoffStatus = "pending";
  for (const note of Array.isArray(notes) ? notes : []) {
    const parsed = parseDealDeskNote(note?.note);
    if (!parsed) continue;
    if (parsed.kind === "check" && parsed.key && !checks.has(parsed.key)) {
      checks.set(parsed.key, {
        completed: parsed.state === "done",
        at: note?.created_at || ""
      });
    }
    if (parsed.kind === "delivery" && parsed.value && !deliveryAt) deliveryAt = parsed.value;
    if (parsed.kind === "key_handoff" && parsed.value && keyHandoffStatus === "pending") keyHandoffStatus = parsed.value;
  }
  return {
    checks,
    delivery_at: deliveryAt,
    key_handoff_status: keyHandoffStatus
  };
}

function parseDealDeskNote(note) {
  const text = String(note || "").trim();
  let match = text.match(/^\[Deal desk:check:([a-z_]+):(done|open)\]/i);
  if (match) return { kind: "check", key: String(match[1] || "").trim().toLowerCase(), state: String(match[2] || "").trim().toLowerCase() };
  match = text.match(/^\[Deal desk:delivery_at:([^\]]+)\]/i);
  if (match) return { kind: "delivery", value: String(match[1] || "").trim() };
  match = text.match(/^\[Deal desk:key_handoff:(pending|ready|complete)\]/i);
  if (match) return { kind: "key_handoff", value: String(match[1] || "").trim().toLowerCase() };
  return null;
}

function keyHandoffLabel(status) {
  const value = String(status || "pending").trim().toLowerCase();
  if (value === "ready") return "Keys ready for handoff";
  if (value === "complete") return "Keys handed off";
  return "Key handoff pending";
}

function latestDuplicateReviewByLead(notes) {
  const map = new Map();
  for (const note of Array.isArray(notes) ? notes : []) {
    const leadId = String(note?.lead_id || "").trim();
    const parsed = parseDuplicateReviewNote(note?.note);
    if (!leadId || !parsed) continue;
    if (map.has(leadId)) continue;
    map.set(leadId, {
      created_at: note.created_at || "",
      author_email: note.author_email || "",
      decision: parsed.decision,
      message: parsed.message
    });
  }
  return map;
}

function latestOwnerReviewStateByLead(notes) {
  const latestReview = latestNoteByType(notes, "owner_review");
  const latestRead = latestNoteByType(notes, "owner_read");
  const leadIds = new Set([...latestReview.keys(), ...latestRead.keys()]);
  const map = new Map();
  for (const leadId of leadIds) {
    const review = latestReview.get(leadId) || null;
    const read = latestRead.get(leadId) || null;
    const reviewTime = review ? new Date(review.created_at || 0).getTime() : 0;
    const readTime = read ? new Date(read.created_at || 0).getTime() : 0;
    map.set(leadId, {
      unread: Boolean(review && reviewTime > readTime),
      reason: review?.note || "",
      at: review?.created_at || "",
      by: review?.author_email || "",
      read_at: read?.created_at || "",
      read_by: read?.author_email || ""
    });
  }
  return map;
}

function latestNoteByType(notes, type) {
  const map = new Map();
  const expectedType = String(type || "").trim().toLowerCase();
  for (const note of Array.isArray(notes) ? notes : []) {
    if (String(note?.note_type || "").trim().toLowerCase() !== expectedType) continue;
    const leadId = String(note?.lead_id || "").trim();
    if (!leadId || map.has(leadId)) continue;
    map.set(leadId, note);
  }
  return map;
}

function latestVehicleRelationByLead(notes) {
  const map = new Map();
  for (const note of Array.isArray(notes) ? notes : []) {
    const leadId = String(note?.lead_id || "").trim();
    const parsed = parseVehicleRelationNote(note?.note);
    if (!leadId || !parsed || map.has(leadId)) continue;
    map.set(leadId, {
      ...parsed,
      at: note.created_at || "",
      by: note.author_email || ""
    });
  }
  return map;
}

function parseVehicleSignalNote(note) {
  const match = String(note || "").match(/^\[Vehicle signal:([a-z_]+)\]\s*(.+)$/i);
  if (!match) return null;
  return {
    code: signalCode(match[1]),
    message: String(match[2] || "").trim()
  };
}

function parseDuplicateReviewNote(note) {
  const match = String(note || "").match(/^\[Vehicle review:duplicate_reviewed:([a-z_]+)\]\s*(.+)$/i);
  if (!match) return null;
  return {
    decision: duplicateDecision(match[1]),
    message: String(match[2] || "").trim()
  };
}

function parseVehicleRelationNote(note) {
  const text = String(note || "").trim();
  let match = text.match(/^\[Vehicle relation:merged_into:([^\]]+)\]/i);
  if (match) {
    return {
      kind: "merged",
      primary_lead_id: String(match[1] || "").trim(),
      listing_id: ""
    };
  }
  match = text.match(/^\[Vehicle relation:linked_inventory:([^:\]]+):lead:([^\]]+)\]/i);
  if (match) {
    return {
      kind: "linked_inventory",
      listing_id: String(match[1] || "").trim(),
      primary_lead_id: String(match[2] || "").trim()
    };
  }
  return null;
}

function isVehicleSignalNote(note) {
  return /^\[Vehicle signal:[a-z_]+\]/i.test(String(note || ""));
}

function signalCode(value) {
  return String(value || "shared_update").trim().toLowerCase().replace(/[^a-z_]/g, "") || "shared_update";
}

function signalTone(code) {
  if (["vehicle_sold", "duplicate_vehicle"].includes(code)) return "danger";
  if (["vehicle_unlisted", "shared_offer"].includes(code)) return "warning";
  return "info";
}

function buildVehicleContextMap(leads, snapshot) {
  const map = new Map();
  for (const lead of Array.isArray(leads) ? leads : []) {
    const id = String(lead?.id || "").trim();
    if (!id) continue;
    const keys = leadVehicleKeys(lead);
    if (!keys.length) continue;

    const relatedLeads = snapshot.allLeads.filter((item) => {
      const itemId = String(item?.id || "").trim();
      return itemId && itemId !== id && sharesVehicle(keys, leadVehicleKeys(item));
    });
    const relatedBuyerLeads = relatedLeads.filter(isBuyerLead);
    const activeBuyerLeads = relatedBuyerLeads.filter((item) => !isClosedLeadStatus(item.status));
    const visibleSellerLeads = relatedLeads.filter((item) => !isBuyerLead(item) && !isVehicleChildLead(item, snapshot.relationMap));
    const mergedSellerLeads = relatedLeads.filter((item) => !isBuyerLead(item) && isVehicleChildLead(item, snapshot.relationMap));
    const matchingInventory = snapshot.inventoryRows.filter((item) => sharesVehicle(keys, listingVehicleKeys(item)));
    const activeOffer = activeBuyerLeads.some((item) => ["finance_sent", "appointment_booked", "offer_sent"].includes(String(item.status || "").toLowerCase()));
    const soldState = activeBuyerLeads.some((item) => String(item.status || "").toLowerCase() === "won")
      || matchingInventory.some((item) => String(item.status || "").toLowerCase() === "sold");
    const offMarket = matchingInventory.length > 0 && matchingInventory.every((item) => ["archived", "draft", "review"].includes(String(item.status || "").toLowerCase()));
    const primaryLead = pickPrimarySellerLead(lead, relatedLeads.filter((item) => !isBuyerLead(item)), matchingInventory, snapshot.relationMap);

    map.set(id, {
      related_lead_count: relatedLeads.length,
      related_buyer_count: relatedBuyerLeads.length,
      active_buyer_count: activeBuyerLeads.length,
      seller_duplicate_count: visibleSellerLeads.length,
      merged_seller_count: mergedSellerLeads.length,
      inventory_count: matchingInventory.length,
      inventory_statuses: [...new Set(matchingInventory.map((item) => String(item.status || "").toLowerCase()).filter(Boolean))],
      has_active_offer: activeOffer,
      sold_elsewhere: soldState,
      off_market: offMarket,
      primary_inventory_status: matchingInventory[0]?.status || "",
      primary_lead_id: String(primaryLead?.id || "").trim(),
      primary_lead_title: primaryLead ? leadDisplayTitle(primaryLead) : "",
      primary_listing_id: String(matchingInventory[0]?.id || "").trim(),
      cluster_label: vehicleClusterLabel(lead)
    });
  }
  return map;
}

async function mergeDuplicateSellerLead(client, snapshot, lead, author, options = {}) {
  const duplicateLeadId = String(lead?.id || "").trim();
  const matchingSellerLeads = snapshot.allLeads.filter((item) => {
    const id = String(item?.id || "").trim();
    return id && id !== duplicateLeadId && !isBuyerLead(item) && sharesVehicle(leadVehicleKeys(lead), leadVehicleKeys(item));
  });
  const targetLead = resolveTargetLead(options.targetLeadId, matchingSellerLeads)
    || pickPrimarySellerLead(lead, matchingSellerLeads, snapshot.inventoryRows, snapshot.relationMap);
  if (!targetLead) {
    return { ok: false, error: "No primary seller lead found for merge_existing." };
  }

  const targetLeadId = String(targetLead.id || "").trim();
  if (!targetLeadId || targetLeadId === duplicateLeadId) {
    return { ok: false, error: "Merge target is invalid." };
  }

  await reassignLeadActivity(client, duplicateLeadId, targetLeadId);
  await reassignLeadListings(client, duplicateLeadId, targetLeadId);

  const now = new Date().toISOString();
  await patchLead(client, targetLeadId, mergedPrimaryPatch(targetLead, lead, now));
  await patchLead(client, duplicateLeadId, {
    status: "closed",
    assigned_to: String(targetLead.assigned_to || "").trim().toLowerCase(),
    next_follow_up_at: null,
    last_activity_at: now
  });
  await insertLeadNote(client, {
    lead_id: targetLeadId,
    author_email: author,
    note_type: "internal",
    note: `Merged duplicate seller lead ${duplicateLeadId} into this CRM record.`
  });
  await insertLeadNote(client, {
    lead_id: duplicateLeadId,
    author_email: author,
    note_type: "internal",
    note: `[Vehicle relation:merged_into:${targetLeadId}] Lead merged into primary CRM record ${targetLeadId}.`
  });

  return {
    ok: true,
    decision: "merge_existing",
    target_lead_id: targetLeadId,
    target_listing_id: ""
  };
}

async function linkDuplicateSellerLeadToInventory(client, snapshot, lead, author, options = {}) {
  const duplicateLeadId = String(lead?.id || "").trim();
  const matchingListings = snapshot.inventoryRows.filter((item) => sharesVehicle(leadVehicleKeys(lead), listingVehicleKeys(item)));
  const listing = resolveTargetListing(options.listingId, matchingListings) || pickInventoryCandidate(matchingListings);
  if (!listing) {
    return { ok: false, error: "No warehouse listing found for link_inventory." };
  }

  const listingId = String(listing.id || "").trim();
  const sourceLeadId = String(listing.source_lead_id || "").trim();
  const matchingSellerLeads = snapshot.allLeads.filter((item) => {
    const id = String(item?.id || "").trim();
    return id && id !== duplicateLeadId && !isBuyerLead(item) && sharesVehicle(leadVehicleKeys(lead), leadVehicleKeys(item));
  });
  const targetLead = resolveTargetLead(options.targetLeadId, matchingSellerLeads)
    || snapshot.leadsById.get(sourceLeadId)
    || pickPrimarySellerLead(lead, matchingSellerLeads, matchingListings, snapshot.relationMap)
    || lead;
  const targetLeadId = String(targetLead?.id || duplicateLeadId).trim();

  await patchListing(client, listingId, {
    source_lead_id: targetLeadId,
    updated_at: new Date().toISOString()
  });
  await patchLead(client, duplicateLeadId, {
    status: "in_inventory",
    last_activity_at: new Date().toISOString()
  });
  if (targetLeadId && targetLeadId !== duplicateLeadId) {
    await insertLeadNote(client, {
      lead_id: targetLeadId,
      author_email: author,
      note_type: "internal",
      note: `Linked duplicate seller lead ${duplicateLeadId} to warehouse listing ${listingId} under this CRM record.`
    });
  }
  await insertLeadNote(client, {
    lead_id: duplicateLeadId,
    author_email: author,
    note_type: "internal",
    note: `[Vehicle relation:linked_inventory:${listingId}:lead:${targetLeadId}] Lead linked to warehouse listing ${listingId} and tracked under primary CRM record ${targetLeadId}.`
  });

  return {
    ok: true,
    decision: "link_inventory",
    target_lead_id: targetLeadId,
    target_listing_id: listingId
  };
}

function resolveTargetLead(targetLeadId, leads) {
  const id = String(targetLeadId || "").trim();
  if (!id) return null;
  return (Array.isArray(leads) ? leads : []).find((lead) => String(lead?.id || "").trim() === id) || null;
}

function resolveTargetListing(listingId, listings) {
  const id = String(listingId || "").trim();
  if (!id) return null;
  return (Array.isArray(listings) ? listings : []).find((listing) => String(listing?.id || "").trim() === id) || null;
}

function pickPrimarySellerLead(currentLead, matchingSellerLeads, inventoryRows, relationMap) {
  const currentId = String(currentLead?.id || "").trim();
  const candidates = [...new Map([
    currentLead,
    ...(Array.isArray(matchingSellerLeads) ? matchingSellerLeads : [])
  ]
    .filter(Boolean)
    .map((item) => [String(item?.id || "").trim(), item]))
    .values()]
    .filter((item) => {
      const id = String(item?.id || "").trim();
      if (!id) return false;
      if (id === currentId) return true;
      return !isVehicleChildLead(item, relationMap);
    });
  const inventoryLeadIds = new Set((Array.isArray(inventoryRows) ? inventoryRows : [])
    .map((row) => String(row?.source_lead_id || "").trim())
    .filter(Boolean));
  return candidates.sort((a, b) => {
    const inventoryDiff = Number(inventoryLeadIds.has(String(b.id || "").trim())) - Number(inventoryLeadIds.has(String(a.id || "").trim()));
    if (inventoryDiff) return inventoryDiff;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  })[0] || currentLead || null;
}

function pickInventoryCandidate(listings) {
  return [...(Array.isArray(listings) ? listings : [])]
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())[0] || null;
}

function mergedPrimaryPatch(primaryLead, duplicateLead, now) {
  return {
    assigned_to: String(primaryLead?.assigned_to || duplicateLead?.assigned_to || "").trim().toLowerCase(),
    priority: higherPriority(primaryLead?.priority, duplicateLead?.priority),
    next_follow_up_at: earliestDate(primaryLead?.next_follow_up_at, duplicateLead?.next_follow_up_at),
    notes: mergeNotes(primaryLead?.notes, duplicateLead?.notes),
    owner_adjustment: mergeOwnerAdjustment(primaryLead?.owner_adjustment, duplicateLead?.owner_adjustment, now),
    status: mergeLeadStatus(primaryLead?.status, duplicateLead?.status),
    last_activity_at: now
  };
}

function mergeLeadStatus(primaryStatus, duplicateStatus) {
  const primary = String(primaryStatus || "new").trim().toLowerCase();
  const duplicate = String(duplicateStatus || "new").trim().toLowerCase();
  if (isClosedLeadStatus(primary) && !isClosedLeadStatus(duplicate)) return duplicate;
  return primary || duplicate || "new";
}

function mergeOwnerAdjustment(primary, duplicate, now) {
  const base = primary && typeof primary === "object" ? { ...primary } : {};
  const next = duplicate && typeof duplicate === "object" ? duplicate : {};
  return {
    wholesale: numberOrNull(base.wholesale ?? next.wholesale),
    retail: numberOrNull(base.retail ?? next.retail),
    reason: String(base.reason || next.reason || "").trim(),
    updated_at: now
  };
}

function mergeNotes(primaryNotes, duplicateNotes) {
  const left = String(primaryNotes || "").trim();
  const right = String(duplicateNotes || "").trim();
  if (!left) return right;
  if (!right || left.includes(right)) return left;
  return `${left}\n\n[Merged duplicate lead notes]\n${right}`.trim();
}

function higherPriority(left, right) {
  const rank = {
    low: 0,
    normal: 1,
    high: 2,
    urgent: 3
  };
  const first = String(left || "normal").trim().toLowerCase();
  const second = String(right || "normal").trim().toLowerCase();
  return (rank[second] ?? 1) > (rank[first] ?? 1) ? second : first;
}

function earliestDate(left, right) {
  const dates = [left, right]
    .map((value) => {
      const timestamp = new Date(value || "").getTime();
      return Number.isNaN(timestamp) ? null : { value: new Date(timestamp).toISOString(), timestamp };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
  return dates[0]?.value || null;
}

function buildVehicleContextMapLabel(record) {
  return vehicleClusterLabel(record);
}

function createEmptyCluster(key, record) {
  return {
    key,
    label: buildVehicleContextMapLabel(record),
    seller_leads: [],
    buyer_leads: [],
    inventory: [],
    needs_review_count: 0,
    latest_activity_at: ""
  };
}

function finalizeCluster(cluster) {
  const sellerLeads = [...cluster.seller_leads].sort(compareClusterLeadItems);
  const buyerLeads = [...cluster.buyer_leads].sort(compareClusterLeadItems);
  const inventory = [...cluster.inventory].sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
  const primarySeller = sellerLeads.find((lead) => !lead.merge_state) || sellerLeads[0] || null;
  const latestActivity = [
    ...sellerLeads.map((lead) => lead.last_activity_at || lead.created_at || ""),
    ...buyerLeads.map((lead) => lead.last_activity_at || lead.created_at || ""),
    ...inventory.map((listing) => listing.updated_at || listing.created_at || "")
  ].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || "";

  return {
    ...cluster,
    seller_leads: sellerLeads,
    buyer_leads: buyerLeads,
    inventory,
    primary_lead_id: String(primarySeller?.id || "").trim(),
    primary_listing_id: String(inventory[0]?.id || "").trim(),
    total_related: sellerLeads.length + buyerLeads.length + inventory.length,
    latest_activity_at: latestActivity
  };
}

function clusterLeadItem(lead) {
  return {
    id: String(lead.id || "").trim(),
    title: leadDisplayTitle(lead),
    status: String(lead.status || "new").trim(),
    assigned_to: String(lead.assigned_to || "").trim().toLowerCase(),
    priority: String(lead.priority || "normal").trim().toLowerCase(),
    created_at: lead.created_at || "",
    last_activity_at: lead.last_activity_at || "",
    owner_review: lead.owner_review || null,
    duplicate_warning: lead.duplicate_warning || null,
    merge_state: lead.merge_state || null,
    vehicle_context: lead.vehicle_context || null
  };
}

function clusterInventoryItem(listing, sourceLead) {
  return {
    id: String(listing.id || "").trim(),
    title: String(listing.title || [listing.vehicle_year, listing.make, listing.model, listing.series, listing.style].filter(Boolean).join(" ") || "Warehouse listing").trim(),
    status: String(listing.status || "draft").trim(),
    source_lead_id: String(listing.source_lead_id || "").trim(),
    source_lead_title: sourceLead ? leadDisplayTitle(sourceLead) : "",
    asking_price: numberOrNull(listing.asking_price),
    created_at: listing.created_at || "",
    updated_at: listing.updated_at || ""
  };
}

function compareClusterLeadItems(a, b) {
  const childDiff = Number(Boolean(a.merge_state)) - Number(Boolean(b.merge_state));
  if (childDiff) return childDiff;
  return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
}

function vehicleKeysForRecord(record) {
  if (record?.input || record?.valuation) return leadVehicleKeys(record);
  return listingVehicleKeys(record);
}

function sharesVehicle(leftKeys, rightKeys) {
  const right = new Set(rightKeys || []);
  return Array.isArray(leftKeys) && leftKeys.some((key) => right.has(key));
}

function vehicleKeysFromFields(fields) {
  const vin = cleanVin(fields?.vin);
  const uvc = normalizeVehicleText(fields?.uvc);
  const year = normalizeVehicleText(fields?.year);
  const make = normalizeVehicleText(fields?.make);
  const model = normalizeVehicleText(fields?.model);
  const series = normalizeVehicleText(fields?.series);
  const style = normalizeVehicleText(fields?.style);
  const keys = [];
  if (vin) keys.push(`vin:${vin}`);
  if (uvc) keys.push(`uvc:${uvc}`);
  if (year && make && model) keys.push(`spec:${[year, make, model, series, style].join("|")}`);
  return [...new Set(keys)];
}

function vehicleClusterLabel(lead) {
  const input = lead?.input || {};
  const valuation = lead?.valuation || {};
  return String([input.year || valuation.year, input.make || valuation.make, input.model || valuation.model].filter(Boolean).join(" ") || leadDisplayTitle(lead)).trim();
}

function normalizeVehicleText(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function cleanVin(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function createOwnerReviewNote(client, leadId, reason, authorEmail) {
  if (!leadId || !reason) return;
  await insertLeadNote(client, {
    lead_id: leadId,
    author_email: String(authorEmail || "system").trim().toLowerCase(),
    note_type: "owner_review",
    note: String(reason || "").trim()
  });
}

async function reassignLeadActivity(client, fromLeadId, toLeadId) {
  if (!fromLeadId || !toLeadId || fromLeadId === toLeadId) return;
  await Promise.all([
    patchTableByLeadId(client, "lead_tasks", fromLeadId, { lead_id: toLeadId }),
    patchTableByLeadId(client, "lead_emails", fromLeadId, { lead_id: toLeadId }),
    patchTableByLeadId(client, "lead_notes", fromLeadId, { lead_id: toLeadId })
  ]);
}

async function reassignLeadListings(client, fromLeadId, toLeadId) {
  if (!fromLeadId || !toLeadId || fromLeadId === toLeadId) return;
  await fetch(`${client.url}/rest/v1/vehicle_listings?source_lead_id=eq.${encodeURIComponent(fromLeadId)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      source_lead_id: toLeadId,
      updated_at: new Date().toISOString()
    })
  }).catch(() => null);
}

async function patchTableByLeadId(client, table, leadId, payload) {
  await fetch(`${client.url}/rest/v1/${table}?lead_id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }).catch(() => null);
}

async function patchLead(client, leadId, payload) {
  await fetch(`${client.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }).catch(() => null);
}

async function patchListing(client, listingId, payload) {
  await fetch(`${client.url}/rest/v1/vehicle_listings?id=eq.${encodeURIComponent(listingId)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }).catch(() => null);
}

async function touchLeadIds(client, ids) {
  const timestamp = new Date().toISOString();
  await Promise.all(ids.map((leadId) => fetch(`${client.url}/rest/v1/valuation_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ last_activity_at: timestamp })
  }).catch(() => null)));
}

async function insertLeadNote(client, payload) {
  await fetch(`${client.url}/rest/v1/lead_notes`, {
    method: "POST",
    headers: {
      ...authHeaders(client.key),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }).catch(() => null);
}

function duplicateDecision(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["keep_separate", "merge_existing", "link_inventory"].includes(normalized) ? normalized : "keep_separate";
}

function duplicateDecisionMessage(decision, result = {}) {
  if (decision === "merge_existing") {
    return result.target_lead_id
      ? `Owner reviewed duplicate seller vehicle and merged it into CRM lead ${result.target_lead_id}.`
      : "Owner reviewed duplicate seller vehicle and will merge it into the existing CRM record.";
  }
  if (decision === "link_inventory") {
    return result.target_listing_id
      ? `Owner reviewed duplicate seller vehicle and linked it to warehouse listing ${result.target_listing_id}.`
      : "Owner reviewed duplicate seller vehicle and linked it to the existing warehouse record.";
  }
  return "Owner reviewed duplicate seller vehicle and chose to keep it as a separate lead.";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function authHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}
