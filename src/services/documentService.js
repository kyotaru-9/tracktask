import { supabase } from "./supabaseClient";
import { genTrackId } from "../utils/genTrackId";
import { ROLES, DIVISION_NAMES } from "../constants";

export { ROLES };

// ── Storage ─────────────────────────────────────────────────────────────

const ATTACHMENT_BUCKET = "attachments";

async function uploadAttachment(file, userId) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(fileName, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return data.path;
}

export async function getAttachmentUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60 * 60); // 1 hour expiry
  if (error) throw error;
  return data.signedUrl;
}

// ── Helpers ───────────────────────────────────────────────────────────

export function stepLabel(step) {
  return step.handler_role === ROLES.DIVISION && step.handler_division
    ? `${step.handler_role} — ${step.handler_division}`
    : step.handler_role;
}

// Is this document currently waiting on `profile`?
export function isMyTurn(doc, profile) {
  if (!profile) return false;
  const step = doc.steps?.find((s) => s.step_order === doc.current_step);
  if (!step || step.status !== "pending") return false;
  return matchOffice(step, profile);
}

function matchOffice(step, profile) {
  if (step.handler_role !== profile.role) return false;
  if (profile.role !== ROLES.DIVISION) return true;
  return step.handler_division === profile.division;
}

// ── Audit Log ─────────────────────────────────────────────────────────

async function logAudit({ documentId, action, profile, step }) {
  const { error } = await supabase.from("audit_logs").insert({
    document_id: documentId,
    action,
    acted_by: profile.id,
    step_order: step.step_order,
    handler_role: step.handler_role,
    handler_division: step.handler_division,
    comment: step.comment || null,
  });
  if (error) console.error("audit log insert failed:", error);
}

async function fetchDocumentsQuery() {
  const { data, error } = await supabase
    .from("documents")
    .select("*, steps:document_steps(*)")
    .order("created_at", { ascending: false })
    .order("step_order", { referencedTable: "document_steps", ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchDocuments() {
  return fetchDocumentsQuery();
}

export async function fetchNotifications(userId) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

export async function markNotificationRead(notificationId, userId) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ── Notifications fan-out ─────────────────────────────────────────────

async function insertNotifications(rows) {
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) console.error("notification insert failed:", error);
}

// Notify every account that belongs to an office (role [+ division])
async function notifyOffice({ role, division }, doc, message, dot, excludeUserId) {
  let query = supabase.from("profiles").select("id").eq("role", role);
  if (role === ROLES.DIVISION) query = query.eq("division", division);
  const { data } = await query;
  const targets = (data || []).filter((p) => p.id !== excludeUserId);
  if (!targets.length) return;
  await insertNotifications(
    targets.map((p) => ({
      user_id: p.id,
      document_id: doc.id,
      message,
      dot,
    }))
  );
}

// On "Done": notify every office that ever touched the document + creator
async function notifyAllInvolved(doc, actorProfile) {
  const offices = [];
  const seen = new Set();
  (doc.steps || []).forEach((s) => {
    const key = `${s.handler_role}|${s.handler_division || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      offices.push({ role: s.handler_role, division: s.handler_division });
    }
  });

  const message = `Document ${doc.tracking_id} “${doc.title}” has been successfully completed and marked DONE by the Office of the Mayor.`;

  const rows = [];
  const notified = new Set([actorProfile.id]);

  // creator
  if (!notified.has(doc.created_by)) {
    rows.push({ user_id: doc.created_by, document_id: doc.id, message, dot: "#16a34a" });
    notified.add(doc.created_by);
  }
  // every office involved
  for (const office of offices) {
    let query = supabase.from("profiles").select("id").eq("role", office.role);
    if (office.role === ROLES.DIVISION) query = query.eq("division", office.division);
    const { data } = await query;
    (data || []).forEach((p) => {
      if (notified.has(p.id)) return;
      notified.add(p.id);
      rows.push({ user_id: p.id, document_id: doc.id, message, dot: "#16a34a" });
    });
  }

  if (rows.length) await insertNotifications(rows);
}

// ── Create document (any authenticated user) ────────────────────────────

export async function createDocument(form, routeOptions, creatorProfile) {
  const { data: existing } = await supabase.from("documents").select("tracking_id");
  const tracking_id = genTrackId(new Set((existing || []).map((d) => d.tracking_id)));

  // Upload attachment if provided
  let attachmentPath = null;
  if (form.attachment && form.attachment instanceof File) {
    attachmentPath = await uploadAttachment(form.attachment, creatorProfile.id);
  }

  const creatorRole = creatorProfile.role;
  const isMayor = creatorRole === ROLES.MAYOR;
  const isCityAdmin = creatorRole === ROLES.CITY_ADMIN;

  // Build route steps based on creator's role
  let routeSteps;
  
  if (isMayor || isCityAdmin) {
    // Mayor and City Administrator can define their own route
    // Step 0 is the creator
    routeSteps = [
      { handler_role: creatorRole, handler_division: null },
      ...routeOptions.map((opt) => ({
        handler_role: DIVISION_NAMES.includes(opt) ? ROLES.DIVISION : opt,
        handler_division: DIVISION_NAMES.includes(opt) ? opt : null,
      })),
    ];
  } else {
    // All other roles: auto-route to City Administrator → Mayor
    routeSteps = [
      { handler_role: creatorRole, handler_division: creatorProfile.division || null },
      { handler_role: ROLES.CITY_ADMIN, handler_division: null },
      { handler_role: ROLES.MAYOR, handler_division: null },
    ];
  }

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      tracking_id,
      title: form.title.trim(),
      doc_type: form.type,
      origin: form.origin.trim(),
      submitted_by: form.submittedBy.trim(),
      notes: form.notes.trim() || null,
      urgency: form.urgency || "Normal",
      deadline: form.deadline || null,
      attachment: attachmentPath,
      created_by: creatorProfile.id,
      status: "processing",
      phase: "forward",
      current_step: 0,
    })
    .select()
    .single();
  if (error) throw error;

  const stepsPayload = routeSteps.map((s, i) => ({
    document_id: doc.id,
    step_order: i,
    ...s,
    status: i === 0 ? "pending" : "waiting",
  }));
  const { error: stepsError } = await supabase.from("document_steps").insert(stepsPayload);
  if (stepsError) throw stepsError;

  // Notify the next office (step 1)
  const nextOffice = routeSteps[1];
  const creatorOfficeLabel = isMayor || isCityAdmin 
    ? "Office of the " + creatorRole 
    : creatorProfile.division 
      ? `Division — ${creatorProfile.division}`
      : creatorRole;
  
  await notifyOffice(
    nextOffice,
    doc,
    `New document ${doc.tracking_id} “${doc.title}” was submitted by ${creatorOfficeLabel} and awaits your review.`,
    "#2563eb",
    creatorProfile.id
  );

  return doc;
}

// ── Workflow engine ───────────────────────────────────────────────────
// actions:
//   approve  – forward leg sign-off (final step auto-marks Complete)
//   reject   – terminal rejection (forward leg only)
//   receive  – acknowledge during reverse routing
//   done     – Mayor closes the loop once the document returns
export async function actOnDocument(documentId, action, comment, profile) {
  const [{ data: doc, error: docErr }, { data: steps, error: stepsErr }] = await Promise.all([
    supabase.from("documents").select("*").eq("id", documentId).single(),
    supabase
      .from("document_steps")
      .select("*")
      .eq("document_id", documentId)
      .order("step_order"),
  ]);
  if (docErr) throw docErr;
  if (stepsErr) throw stepsErr;

  const idx = doc.current_step;
  const step = steps.find((s) => s.step_order === idx);
  if (!step) throw new Error("Invalid routing step.");

  const now = new Date().toISOString();
  const stamp = { comment: comment?.trim() || null, acted_by: profile.id, acted_at: now };

  if (doc.phase === "forward") {
    if (!matchOffice(step, profile)) throw new Error("This document is not awaiting your action.");

    if (action === "approve") {
      await supabase.from("document_steps").update({ status: "approved", ...stamp }).eq("id", step.id);
      await logAudit({ documentId, action: "approve", profile, step: { ...step, ...stamp } });

      if (idx < steps.length - 1) {
        const next = steps[idx + 1];
        await supabase.from("document_steps").update({ status: "pending" }).eq("id", next.id);
        await supabase.from("documents").update({ current_step: idx + 1 }).eq("id", doc.id);
        await notifyOffice(next, doc, `${doc.tracking_id} “${doc.title}” was forwarded to your office for review.`, "#2563eb", profile.id);
      } else {
        // Final approver marks Complete → automatic reverse routing
        if (idx > 0) {
          const prev = steps[idx - 1];
          await supabase.from("document_steps").update({ status: "pending" }).eq("id", prev.id);
          await notifyOffice(prev, doc, `${doc.tracking_id} “${doc.title}” was marked COMPLETE by ${stepLabel(step)} and is being returned to your office.`, "#f59e0b", profile.id);
        }
        await supabase
          .from("documents")
          .update({ status: "returning", phase: "reverse", current_step: Math.max(0, idx - 1) })
          .eq("id", doc.id);
      }
      return;
    }

    if (action === "reject") {
      await supabase.from("document_steps").update({ status: "rejected", ...stamp }).eq("id", step.id);
      await logAudit({ documentId, action: "reject", profile, step: { ...step, ...stamp } });
      await supabase.from("documents").update({ status: "rejected" }).eq("id", doc.id);
      await insertNotifications([{
        user_id: doc.created_by,
        document_id: doc.id,
        message: `${doc.tracking_id} “${doc.title}” was REJECTED by ${stepLabel(step)}.`,
        dot: "#ef4444",
      }]);
      return;
    }
    throw new Error(`Unsupported forward action: ${action}`);
  }

  // ── Reverse leg ──
  if (action === "receive") {
    if (!matchOffice(step, profile)) throw new Error("This document is not awaiting your action.");
    await supabase.from("document_steps").update({ status: "received", ...stamp }).eq("id", step.id);
    await logAudit({ documentId, action: "receive", profile, step: { ...step, ...stamp } });

    const prev = steps[idx - 1];
    if (prev) {
      await supabase.from("document_steps").update({ status: "pending" }).eq("id", prev.id);
      await notifyOffice(prev, doc, `${doc.tracking_id} “${doc.title}” was received by ${stepLabel(step)} and returned to your office.`, "#f59e0b", profile.id);
    }
    await supabase.from("documents").update({ current_step: Math.max(0, idx - 1) }).eq("id", doc.id);
    return;
  }

  if (action === "done") {
    // In reverse phase, step 0 is always the original creator
    // They are the one who marks the document as Done
    if (idx !== 0) throw new Error("Only the original creator can mark a returned document as Done.");
    await supabase.from("document_steps").update({ status: "received", ...stamp }).eq("id", step.id);
    await logAudit({ documentId, action: "done", profile, step: { ...step, ...stamp } });
    await supabase.from("documents").update({ status: "done" }).eq("id", doc.id);

    const full = { ...doc, steps };
    await notifyAllInvolved(full, profile);
    return;
  }

  throw new Error(`Unsupported action: ${action}`);
}

// ── Audit Log fetch ───────────────────────────────────────────────────

export async function fetchAuditLogs(documentId) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select(`
      *,
      actor:profiles!acted_by (id, full_name, role, division)
    `)
    .eq("document_id", documentId)
    .order("acted_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function deleteDocument(documentId, profile) {
  if (![ROLES.MAYOR, ROLES.CITY_ADMIN].includes(profile.role)) {
    throw new Error("Only Mayor or City Administrator can delete documents.");
  }

  await supabase.from("audit_logs").delete().eq("document_id", documentId);
  await supabase.from("document_steps").delete().eq("document_id", documentId);
  await supabase.from("notifications").delete().eq("document_id", documentId);
  
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) throw error;
}
