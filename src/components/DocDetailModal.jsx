import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Trash2, AlertCircle, Download, Share2, X } from "lucide-react";
import Modal from "./Modal";
import StatusPill from "./StatusPill";
import UrgencyPill from "./UrgencyPill";
import DeadlineTag from "./DeadlineTag";
import QrCodeModal from "./QrCodeModal";
import AuditLog from "./AuditLog";
import { isMyTurn, stepLabel, fetchAuditLogs, getAttachmentUrl, deleteDocument, updateDocument, shareDocument, unshareDocument, fetchDocumentShares, ROLES } from "../services/documentService";
import { supabase } from "../services/supabaseClient";
import { trackingUrl } from "../services/appUrl";
import { inp } from "../utils/styles";
import NewDocumentModal from "./NewDocumentModal";
import TrackDocumentModal from "./TrackDocumentModal";

const STEP_STYLE = {
  approved: { bg: "#f0fdf4", dot: "#16a34a", icon: "OK", hint: "Approved" },
  received: { bg: "#f0fdf4", dot: "#16a34a", icon: "OK", hint: "Received" },
  rejected: { bg: "#fef2f2", dot: "#ef4444", icon: "X", hint: "Rejected" },
};

export default function DocDetailModal({ doc, profile, onClose, onAction }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentMissing, setAttachmentMissing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showTrack, setShowTrack] = useState(false);
  const [shares, setShares] = useState([]);
  const [shareSearch, setShareSearch] = useState("");
  const [shareResults, setShareResults] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);

  const trackUrl = trackingUrl(doc.tracking_id);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(trackUrl, {
      width: 300,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((u) => mounted && setQrDataUrl(u))
      .catch((e) => console.error("QR generation failed:", e));

    fetchAuditLogs(doc.id).then((logs) => mounted && setAuditLogs(logs));
    fetchDocumentShares(doc.id).then((s) => mounted && setShares(s));

    if (doc.attachment) {
      getAttachmentUrl(doc.attachment)
        .then((url) => mounted && setAttachmentUrl(url))
        .catch((e) => {
          console.error("attachment link failed:", e);
          if (mounted) setAttachmentMissing(true);
        });
    }
    return () => { mounted = false; };
  }, [trackUrl, doc.id, doc.attachment]);

  const canDelete = profile && [ROLES.MAYOR, ROLES.CITY_ADMIN].includes(profile.role);

  const canEdit =
    profile &&
    doc.created_by === profile.id &&
    doc.current_step === 0 &&
    doc.phase === "forward" &&
    doc.steps?.[0]?.status === "pending";

  const canEditRoute = profile && (profile.role === ROLES.MAYOR || profile.role === ROLES.CITY_ADMIN);

  const canShare = profile && (doc.created_by === profile.id || shares.some(s => s.shared_by === profile.id));

  async function handleDelete() {
    setBusy(true);
    setError("");
    try {
      await deleteDocument(doc.id, profile);
      onClose();
    } catch (e) {
      setError(e.message || "Delete failed.");
    } finally {
      setBusy(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleEditSubmit(form, route) {
    setBusy(true);
    setError("");
    try {
      await updateDocument(doc.id, form, route, profile);
      onClose();
    } catch (e) {
      setError(e.message || "Edit failed.");
    } finally {
      setBusy(false);
    }
  }

  const canAct =
    (doc.status === "processing" || doc.status === "returning") &&
    isMyTurn(doc, profile);
  const isFinalForward =
    doc.phase === "forward" && doc.current_step === (doc.steps?.length || 0) - 1;
  // In reverse phase, step 0 is the original creator - they mark Done
  const creatorDone =
    doc.phase === "reverse" && doc.current_step === 0 && doc.created_by === profile?.id;

  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await onAction(doc.id, action, comment);
      onClose();
    } catch (e) {
      setError(e.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function searchUsers(query) {
    if (!query.trim() || query.length < 2) {
      setShareResults([]);
      return;
    }
    setShareLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, division")
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .neq("id", profile.id)
        .limit(10);
      setShareResults(data || []);
    } catch (e) {
      console.error("User search failed:", e);
      setShareResults([]);
    } finally {
      setShareLoading(false);
    }
  }

  async function handleShare(userId) {
    setBusy(true);
    setError("");
    try {
      await shareDocument(doc.id, userId, profile);
      setShowShare(false);
      setShareSearch("");
      setShareResults([]);
      const updated = await fetchDocumentShares(doc.id);
      setShares(updated);
    } catch (e) {
      setError(e.message || "Share failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnshare(userId) {
    setBusy(true);
    setError("");
    try {
      await unshareDocument(doc.id, userId, profile);
      const updated = await fetchDocumentShares(doc.id);
      setShares(updated);
    } catch (e) {
      setError(e.message || "Unshare failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal onClose={onClose}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{doc.title}</div>
              <UrgencyPill level={doc.urgency} />
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {doc.tracking_id} · {doc.doc_type} · {doc.origin}
            </div>
          </div>
          <button onClick={onClose} className="tt-x-btn">X</button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* 1st column — QR code (click to enlarge / download) */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>QR Code</div>
              <button
                onClick={() => setShowQr(true)}
                title="Enlarge / download QR code"
                style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 6, background: "#fff", cursor: "pointer" }}
              >
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={`QR code for ${doc.tracking_id}`} style={{ width: 110, height: 110, display: "block" }} />
                ) : (
                  <div style={{ width: 110, height: 110, background: "#f1f5f9", borderRadius: 6 }} />
                )}
              </button>
              <div style={{ fontFamily: "monospace", fontSize: 10.5, fontWeight: 700, color: "#2563eb", marginTop: 6, wordBreak: "break-all" }}>
                {doc.tracking_id}
              </div>
            </div>
            {/* 2nd column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Submitted by</div>
                <div style={{ fontSize: 13 }}>{doc.submitted_by}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Notes</div>
                <div style={{ fontSize: 13 }}>{doc.notes || "-"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Deadline</div>
                <div style={{ fontSize: 13 }}>
                  <DeadlineTag deadline={doc.deadline} status={doc.status} />
                </div>
              </div>
            </div>
            {/* 3rd column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Created</div>
                <div style={{ fontSize: 13 }}>{new Date(doc.created_at).toLocaleDateString("en-PH")}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Attachment</div>
                <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  {doc.attachment ? (
                    attachmentUrl ? (
                      <>
                        <a
                          href={attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#2563eb", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          📎 {doc.attachment.split("/").pop()?.split(".").pop() || "View"}
                        </a>
                        <a
                          href={attachmentUrl}
                          download
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 8px",
                            border: "1px solid #e2e8f0",
                            borderRadius: 6,
                            background: "#f8fafc",
                            color: "#334155",
                            fontSize: 12,
                            textDecoration: "none",
                            cursor: "pointer"
                          }}
                        >
                          <Download size={14} /> Download
                        </a>
                      </>
                    ) : attachmentMissing ? (
                      <span style={{ color: "#94a3b8" }} title={doc.attachment}>
                        📎 Unavailable
                      </span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>Loading…</span>
                    )
                  ) : (
                    "-"
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Status</div>
                <StatusPill status={doc.status} />
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Routing Progress</div>
          {doc.phase === "reverse" && (
            <div style={{
              background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e",
              borderRadius: 8, padding: "6px 10px", fontSize: 11.5, marginBottom: 10,
            }}>
              Document approved — automatically returning through offices in reverse order.
            </div>
          )}
          {doc.status === "done" && (
            <div style={{
              background: "#f0fdf4", border: "1px solid #86efac", color: "#166534",
              borderRadius: 8, padding: "6px 10px", fontSize: 11.5, marginBottom: 10,
            }}>
              Document completed. All handlers have been notified.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {(doc.steps || []).map((s, i) => {
              const st = STEP_STYLE[s.status];
              let bg = "#f8fafc", dot = "#94a3b8", icon = String(i + 1);
              if (st) { bg = st.bg; dot = st.dot; icon = st.icon; }
              if (!st && s.status === "pending" && i === doc.current_step) {
                bg = doc.phase === "reverse" ? "#fefbeb" : "#eff6ff";
                dot = doc.phase === "reverse" ? "#d97706" : "#2563eb";
                icon = "~";
              }
              return (
                <div key={s.id} style={{ display: "flex", gap: 10, padding: 10, borderRadius: 10, background: bg, border: "1px solid #f1f5f9" }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", background: dot, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, flexShrink: 0,
                  }}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{stepLabel(s)}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {s.status === "waiting" && "Waiting for prior approval"}
                      {s.status === "pending" && (doc.phase === "reverse"
                        ? "Awaiting receipt of returned document"
                        : "Awaiting review")}
                      {st?.hint}
                      {s.acted_at && ` · ${new Date(s.acted_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                    {s.comment && (
                      <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic", marginTop: 2 }}>
                        "{s.comment}"
                      </div>
                    )}
                  </div>
                  {i === 0 && s.step_order === 0 && (
                    <span style={{ fontSize: 9, color: "#94a3b8", alignSelf: "center" }}>origin</span>
                  )}
                </div>
              );
            })}
          </div>

          {canAct && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                Your action ({stepLabel(doc.steps[doc.current_step])})
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add your remarks (optional)..."
                style={{
                  width: "100%", minHeight: 70, resize: "vertical",
                  padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8,
                  background: "#f8fafc", fontSize: 13, outline: "none", fontFamily: "inherit",
                }}
              />
            </div>
          )}

          {error && (
            <div style={{ marginTop: 10, color: "#b91c1c", fontSize: 12 }}>{error}</div>
          )}

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
            <AuditLog doc={{ ...doc, audit_logs: auditLogs }} />
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {canAct && doc.phase === "forward" && (
            <>
              <button disabled={busy} onClick={() => run("reject")} className="tt-btn-danger">Reject</button>
              <button disabled={busy} onClick={() => run("approve")} className="tt-btn-primary">
                {isFinalForward ? "Approve and Mark Complete" : "Approve and Forward"}
              </button>
            </>
          )}
          {canAct && doc.phase === "reverse" && !creatorDone && (
            <button disabled={busy} onClick={() => run("receive")} className="tt-btn-warn">
              Receive and Return
            </button>
          )}
          {canAct && creatorDone && (
            <button disabled={busy} onClick={() => run("done")} className="tt-btn-done">
              Mark as Done
            </button>
          )}
          {canDelete && (
            <button 
              disabled={busy} 
              onClick={() => setShowDeleteConfirm(true)} 
              className="tt-btn-danger"
              style={{ background: "#fff", color: "#b91c1c", borderColor: "#fca5a5" }}
            >
              <Trash2 size={14} style={{ marginRight: 4 }} /> Delete Document
            </button>
          )}
          {canEdit && !busy && (
            <button onClick={() => setShowEdit(true)} className="tt-btn-primary" style={{ marginLeft: 8 }}>
              Edit Document
            </button>
          )}
          {canShare && !busy && (
            <button onClick={() => { setShowShare(true); searchUsers(""); }} className="tt-btn-primary" style={{ marginLeft: 8 }}>
              <Share2 size={14} style={{ marginRight: 4 }} /> Share
            </button>
          )}
          <button onClick={onClose} className="tt-btn-plain">Close</button>
        </div>
      </Modal>

      {showQr && (
        <QrCodeModal
          doc={doc}
          onClose={() => setShowQr(false)}
          onOpenTrack={() => { setShowQr(false); setShowTrack(true); }}
        />
      )}

      {showTrack && (
        <TrackDocumentModal
          onClose={() => setShowTrack(false)}
          initialId={doc.tracking_id}
        />
      )}

      {showDeleteConfirm && (
        <Modal onClose={() => setShowDeleteConfirm(false)} style={{ maxWidth: 420 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Delete Document</span>
          </div>
          <div style={{ padding: 20, textAlign: "center" }}>
            <AlertCircle size={48} style={{ color: "#ef4444", marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: "#334155", marginBottom: 8 }}>
              Are you sure you want to delete <strong>{doc.tracking_id} — {doc.title}</strong>?
            </p>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>
              This will permanently remove the document, all routing steps, audit logs, and notifications.
              This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setShowDeleteConfirm(false)} className="tt-btn-plain" disabled={busy}>Cancel</button>
              <button onClick={handleDelete} disabled={busy} className="tt-btn-primary-lg" style={{ background: "#ef4444", borderColor: "#ef4444" }}>
                {busy ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showEdit && (
        <NewDocumentModal
          onClose={() => setShowEdit(false)}
          onSubmit={handleEditSubmit}
          creatorProfile={profile}
          initialDoc={doc}
          initialRoute={canEditRoute
            ? doc.steps?.slice(1).map((s) => (s.handler_role === ROLES.DIVISION ? s.handler_division : s.handler_role)) || []
            : null}
        />
      )}

      {showShare && (
        <Modal onClose={() => setShowShare(false)} style={{ maxWidth: 520 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Share Document</span>
            <button onClick={() => setShowShare(false)} className="tt-x-btn">X</button>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
                Search users by name or email
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={shareSearch}
                  onChange={(e) => { setShareSearch(e.target.value); searchUsers(e.target.value); }}
                  placeholder="Type to search users..."
                  style={{ ...inp, flex: 1 }}
                />
                {shareLoading && <span style={{ padding: "8px 12px", color: "#64748b", fontSize: 12 }}>Searching...</span>}
              </div>
            </div>

            {shareResults.length > 0 && (
              <div style={{ marginBottom: 16, borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Search Results</div>
                {shareResults.map((u) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "#f8fafc", marginBottom: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                      {(u.full_name || u.email).charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.full_name || u.email}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{u.role}{u.division ? ` — ${u.division}` : ""}</div>
                    </div>
                    {shares.some(s => s.shared_with === u.id) ? (
                      <span style={{ fontSize: 11, color: "#16a34a", background: "#f0fdf4", padding: "2px 8px", borderRadius: 99 }}>Already shared</span>
                    ) : (
                      <button onClick={() => handleShare(u.id)} disabled={busy} className="tt-btn-primary" style={{ padding: "6px 12px", fontSize: 12 }}>Share</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Currently Shared With ({shares.length})</div>
              {shares.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Not shared with anyone yet.</div>
              ) : (
                shares.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "#f8fafc", marginBottom: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                      {(s.shared_with_profile?.full_name || s.shared_with_profile?.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.shared_with_profile?.full_name || s.shared_with_profile?.email}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>Shared by {s.shared_by_profile?.full_name || s.shared_by_profile?.email} · {new Date(s.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</div>
                    </div>
                    {s.shared_by === profile.id && (
                      <button onClick={() => handleUnshare(s.shared_with)} disabled={busy} className="tt-btn-danger" style={{ padding: "4px 8px", fontSize: 11 }}>
                        <X size={12} style={{ marginRight: 3 }} /> Remove
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        .tt-x-btn { border:none; background:none; color:#64748b; cursor:pointer; font-size:14px; }
        .tt-btn-primary { padding:7px 14px; border-radius:8px; border:1px solid #2563eb;
          background:#2563eb; color:#fff; font-size:12px; cursor:pointer; }
        .tt-btn-danger { padding:7px 14px; border-radius:8px; border:1px solid #fca5a5;
          background:#fff; color:#b91c1c; font-size:12px; cursor:pointer; }
        .tt-btn-warn { padding:7px 14px; border-radius:8px; border:1px solid #d97706;
          background:#d97706; color:#fff; font-size:12px; cursor:pointer; }
        .tt-btn-done { padding:7px 14px; border-radius:8px; border:1px solid #16a34a;
          background:#16a34a; color:#fff; font-size:12px; cursor:pointer; }
        .tt-btn-plain { padding:7px 14px; border-radius:8px; border:1px solid #e2e8f0;
          background:#fff; color:#334155; font-size:12px; cursor:pointer; }
      `}</style>
    </>
  );
}
