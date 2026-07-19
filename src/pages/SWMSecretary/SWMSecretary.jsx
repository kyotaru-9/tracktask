import { useState, useEffect } from "react";

const STORAGE_DOCS_KEY  = "tracktask-docs";
const STORAGE_NOTIF_KEY = "tracktask-notifications";
const STORAGE_REQ_KEY   = "tracktask-requests";
const MY_DEPT = "SWM Secretary"; // must match DEPTS[2] in Mayor.jsx exactly

const DOC_TYPES = [
  "Waste Disposal Permit",
  "Solid Waste Management Plan",
  "Sanitation Compliance Certificate",
  "Collection Route Approval",
  "Landfill Usage Authorization",
  "Recycling Program Registration",
  "Other",
];

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // keep comfortably under the 5MB storage value limit

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function base64ToBlob(base64, mime) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mime });
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadShared(key, fallback) {
  try {
    const res = await window.storage.get(key, true);
    return res ? JSON.parse(res.value) : fallback;
  } catch {
    return fallback;
  }
}

async function saveShared(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
  } catch {}
}

function StatusPill({ status }) {
  const map = {
    processing: { bg: "#dbeafe", color: "#1d4ed8", label: "In Progress" },
    completed:  { bg: "#dcfce7", color: "#15803d", label: "Completed"   },
    rejected:   { bg: "#fee2e2", color: "#b91c1c", label: "Rejected"    },
    pending:    { bg: "#fef9c3", color: "#a16207", label: "Pending"      },
    waiting:    { bg: "#f1f5f9", color: "#475569", label: "Waiting"      },
    approved:   { bg: "#dcfce7", color: "#15803d", label: "Approved"     },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, fontSize: 11, fontWeight: 600, padding: "2px 10px", display: "inline-block", whiteSpace: "nowrap" }}>{s.label}</span>
  );
}

function ApprovalSteps({ doc }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {doc.steps.map((s, i) => {
        let bg = "#f1f5f9", border = "#e2e8f0", color = "#64748b";
        if (s.status === "approved") { bg = "#dcfce7"; border = "#86efac"; color = "#15803d"; }
        if (s.status === "rejected") { bg = "#fee2e2"; border = "#fca5a5"; color = "#b91c1c"; }
        if (s.status === "pending" && i === doc.currentStep && doc.status === "processing") { bg = "#dbeafe"; border = "#2563eb"; color = "#1d4ed8"; }
        return (
          <div key={i} style={{ flex: 1, textAlign: "center", position: "relative" }}>
            {i < doc.steps.length - 1 && <div style={{ position: "absolute", top: 13, left: "50%", width: "100%", height: 2, background: s.status === "approved" ? "#86efac" : "#e2e8f0", zIndex: 0 }} />}
            <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${border}`, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, margin: "0 auto 3px", position: "relative", zIndex: 1 }}>
              {s.status === "approved" ? "✓" : s.status === "rejected" ? "✕" : i + 1}
            </div>
            <div style={{ fontSize: 8, color: "#64748b", lineHeight: 1.2 }}>{s.dept}</div>
          </div>
        );
      })}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 560, maxHeight: "90vh", overflowY: "auto", border: "1px solid #e2e8f0", boxShadow: "0 8px 32px rgba(0,0,0,0.14)" }}>
        {children}
      </div>
    </div>
  );
}

const ACCENT = "#7c3aed";

export default function SWMSecretary() {
  const [docs,          setDocs]          = useState([]);
  const [requests,      setRequests]      = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeView,    setActiveView]    = useState("dashboard");
  const [selectedDoc,   setSelectedDoc]   = useState(null);
  const [comment,       setComment]       = useState("");
  const [search,        setSearch]        = useState("");
  const [visible,       setVisible]       = useState(false);

  // Request modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqTitle,         setReqTitle]         = useState("");
  const [reqDocType,       setReqDocType]       = useState(DOC_TYPES[0]);
  const [reqRequestedBy,   setReqRequestedBy]   = useState("");
  const [reqNotes,         setReqNotes]         = useState("");
  const [reqSent,          setReqSent]          = useState(false);
  const [reqAttachment,    setReqAttachment]    = useState(null); // { name, type, size, data }
  const [reqAttachError,   setReqAttachError]   = useState("");
  const [reqAttaching,     setReqAttaching]     = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [d, r, n] = await Promise.all([
        loadShared(STORAGE_DOCS_KEY, []),
        loadShared(STORAGE_REQ_KEY, []),
        loadShared(STORAGE_NOTIF_KEY, []),
      ]);
      if (!mounted) return;
      setDocs(d); setRequests(r); setNotifications(n); setVisible(true);
    })();
    const poll = setInterval(async () => {
      const [d, r, n] = await Promise.all([
        loadShared(STORAGE_DOCS_KEY, null),
        loadShared(STORAGE_REQ_KEY, null),
        loadShared(STORAGE_NOTIF_KEY, null),
      ]);
      if (!mounted) return;
      if (d) setDocs(prev => JSON.stringify(prev) === JSON.stringify(d) ? prev : d);
      if (r) setRequests(prev => JSON.stringify(prev) === JSON.stringify(r) ? prev : r);
      if (n) setNotifications(prev => JSON.stringify(prev) === JSON.stringify(n) ? prev : n);
    }, 3000);
    return () => { mounted = false; clearInterval(poll); };
  }, []);

  function updateDocs(updater) {
    setDocs(prev => { const next = typeof updater === "function" ? updater(prev) : updater; saveShared(STORAGE_DOCS_KEY, next); return next; });
  }
  function updateRequests(updater) {
    setRequests(prev => { const next = typeof updater === "function" ? updater(prev) : updater; saveShared(STORAGE_REQ_KEY, next); return next; });
  }
  function updateNotifications(updater) {
    setNotifications(prev => { const next = typeof updater === "function" ? updater(prev) : updater; saveShared(STORAGE_NOTIF_KEY, next); return next; });
  }
  function addNotif(msg, dot) {
    const time = new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
    updateNotifications(prev => [{ time, msg, dot, isNew: true }, ...prev]);
  }

  async function handleAttachmentChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setReqAttachError("");
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setReqAttachError(`File is too large (${formatBytes(file.size)}). Max size is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
      return;
    }
    setReqAttaching(true);
    try {
      const data = await fileToBase64(file);
      setReqAttachment({ name: file.name, type: file.type || "application/octet-stream", size: file.size, data });
    } catch {
      setReqAttachError("Could not read that file. Please try again.");
    } finally {
      setReqAttaching(false);
    }
  }

  function removeAttachment() {
    setReqAttachment(null);
    setReqAttachError("");
  }

  function downloadAttachment(att) {
    if (!att) return;
    const blob = base64ToBlob(att.data, att.type);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = att.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function submitRequest() {
    if (!reqTitle.trim() || !reqRequestedBy.trim()) return;
    const id   = `REQ-${Date.now()}`;
    const date = new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    const req  = { id, title: reqTitle.trim(), docType: reqDocType, fromDept: MY_DEPT, requestedBy: reqRequestedBy.trim(), notes: reqNotes.trim(), date, status: "new", attachment: reqAttachment };
    updateRequests(prev => [req, ...prev]);
    addNotif(`Document request "${reqTitle}" sent to City Administrator for approval.`, "#6d28d9");
    setReqSent(true);
  }

  function closeRequestModal() {
    setShowRequestModal(false);
    setReqTitle(""); setReqDocType(DOC_TYPES[0]); setReqRequestedBy(""); setReqNotes(""); setReqSent(false);
    setReqAttachment(null); setReqAttachError(""); setReqAttaching(false);
  }

  function processApproval(id, action, cmt) {
    const ts = new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric" }) + " " + new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
    updateDocs(prev => prev.map(d => {
      if (d.id !== id) return d;
      const updated = { ...d, steps: d.steps.map(s => ({ ...s })) };
      updated.steps[updated.currentStep].status  = action;
      updated.steps[updated.currentStep].comment = cmt;
      updated.steps[updated.currentStep].date    = ts;
      if (action === "approved") {
        const next = updated.currentStep + 1;
        if (next < updated.steps.length) {
          updated.currentStep = next;
          updated.steps[next].status = "pending";
          addNotif(`${id} "${d.title}" approved. Forwarded to ${updated.steps[next].dept}.`, "#2563eb");
        } else {
          updated.status = "completed";
          addNotif(`🎉 ${id} "${d.title}" fully approved by all departments!`, "#16a34a");
        }
      } else {
        updated.status = "rejected";
        addNotif(`${id} "${d.title}" was rejected by ${MY_DEPT}.`, "#ef4444");
      }
      return updated;
    }));
    setSelectedDoc(null); setComment("");
  }

  const myPending     = docs.filter(d => d.status === "processing" && d.steps[d.currentStep]?.dept === MY_DEPT && d.steps[d.currentStep]?.status === "pending");
  const myRequests    = requests.filter(r => r.fromDept === MY_DEPT);
  const newNotifCount = notifications.filter(n => n.isNew).length;
  const filteredDocs  = docs.filter(d => !search || d.id.toLowerCase().includes(search.toLowerCase()) || d.title.toLowerCase().includes(search.toLowerCase()) || (d.origin || "").toLowerCase().includes(search.toLowerCase()));

  const btn = { padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 8, background: "transparent", color: "#334155", cursor: "pointer", fontSize: 12, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" };
  const th  = { padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" };
  const td  = { padding: "10px 14px", fontSize: 12, color: "#334155" };
  const inp = { width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#1e293b", fontSize: 13, outline: "none", fontFamily: "inherit" };

  const navItems = [
    { key: "dashboard",     icon: "⊞", label: "Dashboard"          },
    { key: "documents",     icon: "📄", label: "All Documents"      },
    { key: "approvals",     icon: "🕐", label: "Pending Approvals", badge: myPending.length },
    { key: "myrequests",    icon: "📤", label: "My Requests",       badge: myRequests.filter(r => r.status === "new").length },
    { key: "notifications", icon: "🔔", label: "Notifications",     badge: newNotifCount    },
    { key: "logout",        icon: "🚪", label: "Logout"             },
  ];

  function renderDocTable(list, showSteps) {
    if (!list.length) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No documents found.</div>;
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f8fafc" }}>{["Track ID","Title","Origin","Submitted by","Date", showSteps && "Progress","Status",""].filter(Boolean).map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {list.map((d, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={td}><span style={{ color: "#2563eb", fontWeight: 600, cursor: "pointer" }} onClick={() => { setSelectedDoc(d); setComment(""); }}>{d.id}</span></td>
                <td style={td}>{d.title}</td>
                <td style={td}>{d.origin}</td>
                <td style={td}>{d.submittedBy}</td>
                <td style={td}>{d.date}</td>
                {showSteps && <td style={{ ...td, minWidth: 160 }}><ApprovalSteps doc={d} /></td>}
                <td style={td}><StatusPill status={d.status} /></td>
                <td style={td}><button style={{ ...btn, fontSize: 11, padding: "4px 10px" }} onClick={() => { setSelectedDoc(d); setComment(""); }}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderModal(doc) {
    const canAct = doc.status === "processing" && doc.steps[doc.currentStep]?.dept === MY_DEPT && doc.steps[doc.currentStep]?.status === "pending";
    return (
      <Modal onClose={() => setSelectedDoc(null)}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{doc.title}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{doc.id} · {doc.type} · {doc.origin}</div>
          </div>
          <button onClick={() => setSelectedDoc(null)} style={{ ...btn, fontSize: 11, padding: "4px 10px" }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[{ label: "Submitted by", value: doc.submittedBy }, { label: "Date", value: doc.date }, { label: "Notes", value: doc.notes || "—" }].map(f => (
              <div key={f.label}><div style={{ fontSize: 11, color: "#94a3b8" }}>{f.label}</div><div style={{ fontSize: 13 }}>{f.value}</div></div>
            ))}
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Attachment</div>
              {doc.attachment ? (
                <button onClick={() => downloadAttachment(doc.attachment)}
                  style={{ ...btn, padding: "3px 8px", fontSize: 12, color: "#2563eb", borderColor: "#bfdbfe", background: "#eff6ff" }}>
                  📎 {doc.attachment.name} ({formatBytes(doc.attachment.size)})
                </button>
              ) : <div style={{ fontSize: 13 }}>—</div>}
            </div>
            <div><div style={{ fontSize: 11, color: "#94a3b8" }}>Status</div><StatusPill status={doc.status} /></div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Approval Progress</div>
          <ApprovalSteps doc={doc} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {doc.steps.map((s, i) => {
              let bg = "#f8fafc", dot = "#94a3b8", icon = "–";
              if (s.status === "approved") { bg = "#f0fdf4"; dot = "#16a34a"; icon = "✓"; }
              if (s.status === "rejected") { bg = "#fef2f2"; dot = "#ef4444"; icon = "✕"; }
              if (s.status === "pending" && i === doc.currentStep && doc.status === "processing") { bg = "#faf5ff"; dot = ACCENT; icon = "⏳"; }
              return (
                <div key={i} style={{ display: "flex", gap: 10, padding: 10, borderRadius: 10, background: bg, border: "1px solid #f1f5f9" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: dot, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 }}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.dept}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {s.status === "waiting" ? "Waiting for prior approval" : s.status === "pending" ? "Awaiting review" : s.status === "approved" ? `Approved${s.date ? " · " + s.date : ""}` : s.status === "rejected" ? `Rejected${s.date ? " · " + s.date : ""}` : s.status}
                    </div>
                    {s.comment && <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic", marginTop: 2 }}>"{s.comment}"</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {canAct && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Your Action — {MY_DEPT}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>⚠️ This is the final approval step. Approving will mark the document as fully completed.</div>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Add waste management verification remarks (optional)..."
                style={{ ...inp, minHeight: 70, resize: "vertical" }} />
            </div>
          )}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {canAct && <>
            <button onClick={() => processApproval(doc.id, "rejected", comment)} style={{ ...btn, color: "#b91c1c", borderColor: "#fca5a5" }}>✕ Reject</button>
            <button onClick={() => processApproval(doc.id, "approved", comment)} style={{ ...btn, background: ACCENT, color: "#fff", borderColor: ACCENT }}>✓ Final Approve</button>
          </>}
          <button onClick={() => setSelectedDoc(null)} style={btn}>Close</button>
        </div>
      </Modal>
    );
  }

  function renderRequestModal() {
    return (
      <Modal onClose={closeRequestModal}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Request a Document</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Submit a document request to City Administrator</div>
          </div>
          <button onClick={closeRequestModal} style={{ ...btn, fontSize: 11, padding: "4px 10px" }}>✕</button>
        </div>

        {reqSent ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Request Sent!</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Your request has been submitted to the City Administrator for review. You'll be notified once it's processed.</div>
            <button onClick={closeRequestModal} style={{ ...btn, background: ACCENT, color: "#fff", borderColor: ACCENT }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>Document title <span style={{ color: "#ef4444" }}>*</span></label>
                <input value={reqTitle} onChange={e => setReqTitle(e.target.value)} placeholder="e.g. Waste Disposal Permit for Barangay XYZ"
                  style={{ ...inp }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>Document type <span style={{ color: "#ef4444" }}>*</span></label>
                <select value={reqDocType} onChange={e => setReqDocType(e.target.value)} style={{ ...inp }}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>Requested by <span style={{ color: "#ef4444" }}>*</span></label>
                <input value={reqRequestedBy} onChange={e => setReqRequestedBy(e.target.value)} placeholder="Full name of requesting officer"
                  style={{ ...inp }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>Notes / Purpose</label>
                <textarea value={reqNotes} onChange={e => setReqNotes(e.target.value)} placeholder="Describe the purpose or provide additional details..."
                  style={{ ...inp, minHeight: 80, resize: "vertical" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>Attachment</label>
                {!reqAttachment ? (
                  <label style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "16px 10px",
                    cursor: "pointer", color: "#64748b", fontSize: 12, background: "#f8fafc"
                  }}>
                    <input type="file" onChange={handleAttachmentChange} style={{ display: "none" }} />
                    {reqAttaching ? "Reading file…" : <>📎 Click to attach a file (max {formatBytes(MAX_ATTACHMENT_BYTES)})</>}
                  </label>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid #e9d5ff`, background: "#faf5ff", borderRadius: 10, padding: "8px 12px" }}>
                    <span style={{ fontSize: 12, color: ACCENT }}>📎 {reqAttachment.name} <span style={{ color: "#64748b" }}>({formatBytes(reqAttachment.size)})</span></span>
                    <button onClick={removeAttachment} style={{ ...btn, padding: "3px 9px", fontSize: 11 }}>Remove</button>
                  </div>
                )}
                {reqAttachError && <div style={{ color: "#b91c1c", fontSize: 11, marginTop: 5 }}>{reqAttachError}</div>}
              </div>
              <div style={{ background: "#faf5ff", borderRadius: 10, padding: 10, border: `1px solid #e9d5ff`, fontSize: 12, color: ACCENT }}>
                📤 This request will be sent to the <strong>City Administrator</strong> for review and approval before entering the document workflow.
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={closeRequestModal} style={btn}>Cancel</button>
              <button onClick={submitRequest} disabled={!reqTitle.trim() || !reqRequestedBy.trim() || reqAttaching}
                style={{ ...btn, background: ACCENT, color: "#fff", borderColor: ACCENT, opacity: (!reqTitle.trim() || !reqRequestedBy.trim() || reqAttaching) ? 0.5 : 1, cursor: (!reqTitle.trim() || !reqRequestedBy.trim() || reqAttaching) ? "not-allowed" : "pointer" }}>
                📤 Send Request
              </button>
            </div>
          </>
        )}
      </Modal>
    );
  }

  const active    = docs.filter(d => d.status === "processing").length;
  const completed = docs.filter(d => d.status === "completed").length;

  const dashboardView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Active",            value: active,           color: "#2563eb", icon: "📄" },
          { label: "Pending My Action", value: myPending.length, color: "#d97706", icon: "🕐" },
          { label: "Completed",         value: completed,         color: "#16a34a", icon: "✅" },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-1px" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            🕐 Awaiting Final Approval
            {myPending.length > 0 && <span style={{ marginLeft: 8, background: "#ef4444", color: "#fff", borderRadius: 99, fontSize: 10, padding: "1px 7px", fontWeight: 700 }}>{myPending.length}</span>}
          </span>
          <button onClick={() => setActiveView("approvals")} style={btn}>View all</button>
        </div>
        {myPending.length === 0
          ? <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>✅ No documents waiting for your final approval.</div>
          : renderDocTable(myPending, true)
        }
      </div>
      {myRequests.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>📤 My Recent Requests</span>
            <button onClick={() => setActiveView("myrequests")} style={btn}>View all</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8fafc" }}>{["Title","Type","Requested by","Date","Status"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {myRequests.slice(0, 3).map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={td}>{r.title}</td>
                    <td style={td}>{r.docType}</td>
                    <td style={td}>{r.requestedBy}</td>
                    <td style={td}>{r.date}</td>
                    <td style={td}>
                      {r.status === "new"      && <span style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 99, fontSize: 11, fontWeight: 600, padding: "2px 10px" }}>Pending Review</span>}
                      {r.status === "approved" && <span style={{ background: "#dcfce7", color: "#15803d", borderRadius: 99, fontSize: 11, fontWeight: 600, padding: "2px 10px" }}>Approved · {r.docId}</span>}
                      {r.status === "rejected" && <span style={{ background: "#fee2e2", color: "#b91c1c", borderRadius: 99, fontSize: 11, fontWeight: 600, padding: "2px 10px" }}>Rejected</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>🔔 Recent Notifications</span>
          <button onClick={() => setActiveView("notifications")} style={btn}>See all</button>
        </div>
        {notifications.slice(0, 4).map((n, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "11px 16px", borderBottom: i < 3 ? "1px solid #f1f5f9" : "none", alignItems: "flex-start" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: n.dot, marginTop: 5, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{n.time}{n.isNew && <span style={{ color: ACCENT, fontWeight: 700 }}> · New</span>}</div>
              <div style={{ fontSize: 13, color: "#334155" }}>{n.msg}</div>
            </div>
          </div>
        ))}
        {notifications.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No notifications yet.</div>}
      </div>
    </div>
  );

  const approvalsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Pending Final Approval — <span style={{ color: ACCENT }}>{MY_DEPT}</span></span>
      {myPending.length === 0
        ? <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 40, textAlign: "center", color: "#64748b" }}>✅ No pending approvals right now.</div>
        : (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f8fafc" }}>{["Track ID","Title","Type","Origin","Submitted by","Actions"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {myPending.map((d, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={td}><span style={{ color: "#2563eb", fontWeight: 600, cursor: "pointer" }} onClick={() => { setSelectedDoc(d); setComment(""); }}>{d.id}</span></td>
                    <td style={td}>{d.title}</td>
                    <td style={td}>{d.type}</td>
                    <td style={td}>{d.origin}</td>
                    <td style={td}>{d.submittedBy}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => processApproval(d.id, "approved", "")} style={{ ...btn, background: ACCENT, color: "#fff", borderColor: ACCENT, fontSize: 11, padding: "4px 10px" }}>✓ Final Approve</button>
                        <button onClick={() => { const c = prompt("Rejection reason (optional):"); if (c !== null) processApproval(d.id, "rejected", c); }} style={{ ...btn, color: "#b91c1c", borderColor: "#fca5a5", fontSize: 11, padding: "4px 10px" }}>✕ Reject</button>
                        <button onClick={() => { setSelectedDoc(d); setComment(""); }} style={{ ...btn, fontSize: 11, padding: "4px 10px" }}>View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );

  const documentsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>All Documents ({filteredDocs.length})</span>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {renderDocTable(filteredDocs, true)}
      </div>
    </div>
  );

  const myRequestsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>My Document Requests ({myRequests.length})</span>
        <button onClick={() => setShowRequestModal(true)} style={{ ...btn, background: ACCENT, color: "#fff", borderColor: ACCENT }}>+ New Request</button>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {myRequests.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No requests yet. Click "New Request" to send one to the City Administrator.</div>
          : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#f8fafc" }}>{["Title","Type","Requested by","Date","Status","Attachment","Doc ID"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {myRequests.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={td}>{r.title}</td>
                      <td style={td}>{r.docType}</td>
                      <td style={td}>{r.requestedBy}</td>
                      <td style={td}>{r.date}</td>
                      <td style={td}>
                        {r.status === "new"      && <span style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 99, fontSize: 11, fontWeight: 600, padding: "2px 10px" }}>Pending Review</span>}
                        {r.status === "approved" && <span style={{ background: "#dcfce7", color: "#15803d", borderRadius: 99, fontSize: 11, fontWeight: 600, padding: "2px 10px" }}>Approved</span>}
                        {r.status === "rejected" && <span style={{ background: "#fee2e2", color: "#b91c1c", borderRadius: 99, fontSize: 11, fontWeight: 600, padding: "2px 10px" }}>Rejected</span>}
                      </td>
                      <td style={td}>
                        {r.attachment
                          ? <button onClick={() => downloadAttachment(r.attachment)} style={{ ...btn, padding: "3px 8px", fontSize: 11, color: "#2563eb", borderColor: "#bfdbfe", background: "#eff6ff" }}>📎 {r.attachment.name}</button>
                          : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                      <td style={td}>
                        {r.docId ? <span style={{ color: "#2563eb", fontWeight: 600 }}>{r.docId}</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );

  const notificationsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Notifications</span>
        <button onClick={() => updateNotifications(prev => prev.map(n => ({ ...n, isNew: false })))} style={btn}>Mark all read</button>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {notifications.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No notifications.</div>
          : notifications.map((n, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: i < notifications.length - 1 ? "1px solid #f1f5f9" : "none", alignItems: "flex-start", background: n.isNew ? "#faf5ff" : "transparent" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: n.dot, marginTop: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{n.time}{n.isNew && <span style={{ color: ACCENT, fontWeight: 700 }}> · New</span>}</div>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{n.msg}</div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#f1f5f9", color: "#1e293b", opacity: visible ? 1 : 0, transition: "opacity 0.4s ease" }}>
      <aside style={{ width: 220, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0, boxShadow: "2px 0 8px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px 20px", borderBottom: "1px solid #f1f5f9", marginBottom: 8 }}>
          <div style={{ width: 34, height: 34, background: ACCENT, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>T</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>Tracktask</div>
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>SWM Secretary</div>
          </div>
        </div>
        <nav style={{ flex: 1 }}>
          {navItems.map(({ key, icon, label, badge }) => {
            const isActive = activeView === key;
            return (
              <button key={key} onClick={() => setActiveView(key)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 20px", border: "none", background: isActive ? "#faf5ff" : "transparent", color: isActive ? ACCENT : "#64748b", cursor: "pointer", fontSize: 13, fontWeight: isActive ? 600 : 400, textAlign: "left", borderLeft: isActive ? `3px solid ${ACCENT}` : "3px solid transparent", transition: "all .15s", fontFamily: "inherit" }}>
                <span>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {badge > 0 && <span style={{ background: key === "approvals" ? "#ef4444" : ACCENT, color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 6px", minWidth: 18, textAlign: "center" }}>{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div style={{ margin: "16px 12px 0", padding: "10px 12px", background: "#faf5ff", borderRadius: 10, border: "1px solid #e9d5ff" }}>
          <div style={{ fontSize: 10, color: ACCENT, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Logged in as</div>
          <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 600, marginTop: 2 }}>{MY_DEPT}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Final approver</div>
        </div>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-0.5px", color: "#0f172a" }}>SWM Secretary Portal</h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>Tracktask · Document Tracking</p>
          </div>
          <button onClick={() => setShowRequestModal(true)}
            style={{ ...btn, background: ACCENT, color: "#fff", borderColor: ACCENT, fontWeight: 600, padding: "8px 16px" }}>
            📤 Request Document
          </button>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 13 }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..."
              style={{ paddingLeft: 32, paddingRight: 14, paddingTop: 7, paddingBottom: 7, border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 12, background: "#f8fafc", color: "#1e293b", outline: "none", width: 200, fontFamily: "inherit" }} />
          </div>
          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setActiveView("notifications")}>
            <span style={{ fontSize: 20 }}>🔔</span>
            {newNotifCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff", borderRadius: 99, fontSize: 9, fontWeight: 700, padding: "0 4px", minWidth: 14, textAlign: "center" }}>{newNotifCount}</span>}
          </div>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT, fontWeight: 700, fontSize: 12 }}>SW</div>
        </header>
        <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
          {activeView === "dashboard"     && dashboardView}
          {activeView === "documents"     && documentsView}
          {activeView === "approvals"     && approvalsView}
          {activeView === "myrequests"    && myRequestsView}
          {activeView === "notifications" && notificationsView}
        </div>
      </main>

      {selectedDoc && renderModal(docs.find(d => d.id === selectedDoc.id) || selectedDoc)}
      {showRequestModal && renderRequestModal()}

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
      `}</style>
    </div>
  );
}