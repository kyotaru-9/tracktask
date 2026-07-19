import { useState, useEffect } from "react";

import { DEPTS, SECOND_STEP_OPTIONS, URGENCY_LEVELS, STORAGE_DOCS_KEY, STORAGE_NOTIF_KEY } from "../../constants";
import { daysUntil, formatDeadline } from "../../utils/deadline";
import { genTrackId } from "../../utils/genTrackId";
import { btn, th, td, inp } from "../../utils/styles";
import { loadShared, saveShared } from "../../services/storageService";

import DeadlineTag from "../../components/DeadlineTag";
import UrgencyPill from "../../components/UrgencyPill";
import StatusPill from "../../components/StatusPill";
import ApprovalSteps from "../../components/ApprovalSteps";
import Modal from "../../components/Modal";

export default function Mayor() {
  const [docs,          setDocs]          = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeView,    setActiveView]    = useState("dashboard");
  const [currentUser,   setCurrentUser]   = useState("Mayor's Office");
  const [search,        setSearch]        = useState("");
  const [selectedDoc,   setSelectedDoc]   = useState(null);
  const [actionComment, setActionComment] = useState("");
  const [form,          setForm]          = useState({
    title: "", type: "", origin: "", submittedBy: "", notes: "", attachment: null,
    urgency: "Normal", deadline: ""
  });
  const [secondApprover,setSecondApprover]= useState("City ENRO");
  const [visible,       setVisible]       = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState("");

  // ── Load + poll ──────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [d, n] = await Promise.all([
        loadShared(STORAGE_DOCS_KEY,  []),
        loadShared(STORAGE_NOTIF_KEY, []),
      ]);
      if (!mounted) return;
      setDocs(d || []);
      setNotifications(n || []);
      setVisible(true);
    })();

    const interval = setInterval(async () => {
      const [d, n] = await Promise.all([
        loadShared(STORAGE_DOCS_KEY,  null),
        loadShared(STORAGE_NOTIF_KEY, null),
      ]);
      if (!mounted) return;
      if (d) setDocs(prev => JSON.stringify(prev) === JSON.stringify(d) ? prev : d);
      if (n) setNotifications(prev => JSON.stringify(prev) === JSON.stringify(n) ? prev : n);
    }, 3000);

    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // ── Mutators ─────────────────────────────────────────
  async function updateDocs(updater) {
    return new Promise(resolve => {
      setDocs(prev => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        saveShared(STORAGE_DOCS_KEY, next).then(resolve);
        return next;
      });
    });
  }

  function updateNotifications(updater) {
    setNotifications(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveShared(STORAGE_NOTIF_KEY, next);
      return next;
    });
  }

  function addNotif(msg, dot) {
    const time = new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
    updateNotifications(prev => [{ time, msg, dot, isNew: true }, ...prev]);
  }

  // ── Submit new document ───────────────────────────────
  async function submitDoc() {
    if (!form.title || !form.type || !form.origin || !form.submittedBy) {
      alert("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    setSubmitSuccess("");

    // Read current docs fresh from storage to avoid stale state race
    const currentDocs = await loadShared(STORAGE_DOCS_KEY, []) || [];
    const id   = genTrackId(currentDocs);
    const date = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "2-digit", day: "2-digit" });

    const steps = [
      { dept: "City Administrator", status: "pending",  comment: "", date: "" },
      { dept: secondApprover,       status: "waiting",  comment: "", date: "" },
    ];

    const newDoc = {
      id, title: form.title, type: form.type, origin: form.origin,
      submittedBy: form.submittedBy, date, status: "processing",
      currentStep: 0, notes: form.notes,
      urgency: form.urgency || "Normal",
      deadline: form.deadline || "",
      attachment: form.attachment ? { name: form.attachment.name, size: form.attachment.size } : null,
      steps,
    };

    const updatedDocs = [...currentDocs, newDoc];

    // Write to shared storage FIRST, then update local state
    await saveShared(STORAGE_DOCS_KEY, updatedDocs);
    setDocs(updatedDocs);

    // Add notification
    addNotif(
      `New document ${id} "${form.title}" submitted (${form.urgency} priority). Awaiting City Administrator approval.`,
      "#2563eb"
    );

    setForm({ title: "", type: "", origin: "", submittedBy: "", notes: "", attachment: null, urgency: "Normal", deadline: "" });
    setSecondApprover("City ENRO");
    setSubmitting(false);
    setSubmitSuccess(`✅ Document ${id} submitted! Route: City Administrator → ${secondApprover}.`);

    setTimeout(() => {
      setSubmitSuccess("");
      setActiveView("documents");
    }, 2500);
  }

  // ── Approval action ───────────────────────────────────
  function processApproval(id, action, comment) {
    const ts = new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric" }) +
               " " + new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
    setDocs(prev => {
      const next = prev.map(d => {
        if (d.id !== id) return d;
        const updated = { ...d, steps: d.steps.map(s => ({ ...s })) };
        updated.steps[updated.currentStep].status  = action;
        updated.steps[updated.currentStep].comment = comment;
        updated.steps[updated.currentStep].date    = ts;
        if (action === "approved") {
          const nxt = updated.currentStep + 1;
          if (nxt < updated.steps.length) {
            updated.currentStep = nxt;
            updated.steps[nxt].status = "pending";
            addNotif(`${id} "${d.title}" forwarded to ${updated.steps[nxt].dept}.`, "#2563eb");
          } else {
            updated.status = "completed";
            addNotif(`${id} "${d.title}" fully approved.`, "#16a34a");
          }
        } else {
          updated.status = "rejected";
          addNotif(`${id} "${d.title}" was rejected by City Mayor.`, "#ef4444");
        }
        return updated;
      });
      saveShared(STORAGE_DOCS_KEY, next);
      return next;
    });
    setSelectedDoc(null);
    setActionComment("");
  }

  // ── Derived ───────────────────────────────────────────
  const pendingForMe = docs.filter(
    d => d.status === "processing" &&
         d.steps[d.currentStep]?.dept === currentUser &&
         d.steps[d.currentStep]?.status === "pending"
  );
  const newNotifCount  = notifications.filter(n => n.isNew).length;
  const filteredDocs   = docs.filter(d =>
    !search ||
    d.id.toLowerCase().includes(search.toLowerCase()) ||
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    (d.origin || "").toLowerCase().includes(search.toLowerCase())
  );
  const overdueCount = docs.filter(d =>
    d.status === "processing" && d.deadline && daysUntil(d.deadline) < 0
  ).length;

  const navItems = [
    { key: "dashboard",     icon: "⊞",  label: "Dashboard"          },
    { key: "documents",     icon: "📄", label: "All Documents"       },
    { key: "approvals",     icon: "🕐", label: "Pending Approvals",  badge: pendingForMe.length },
    { key: "new",           icon: "➕", label: "New Request"         },
    { key: "notifications", icon: "🔔", label: "Notifications",      badge: newNotifCount       },
    { key: "settings",      icon: "⚙️", label: "Settings"            },
    { key: "logout",        icon: "🚪", label: "Logout"              },
  ];

  // ── Doc table helper ──────────────────────────────────
  function renderDocTable(list, showSteps) {
    if (!list.length) return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
        No documents found.
      </div>
    );
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Track ID","Title","Origin","Submitted by","Date","Urgency","Deadline",
                showSteps && "Progress","Status",""].filter(Boolean).map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((d, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <td style={td}>
                  <span style={{ color: "#2563eb", fontWeight: 600 }}
                    onClick={() => { setSelectedDoc(d); setActionComment(""); }}>{d.id}</span>
                </td>
                <td style={td}>{d.title}</td>
                <td style={td}>{d.origin}</td>
                <td style={td}>{d.submittedBy}</td>
                <td style={td}>{d.date}</td>
                <td style={td}><UrgencyPill level={d.urgency} /></td>
                <td style={td}><DeadlineTag deadline={d.deadline} status={d.status} /></td>
                {showSteps && <td style={{ ...td, minWidth: 180 }}><ApprovalSteps doc={d} /></td>}
                <td style={td}><StatusPill status={d.status} /></td>
                <td style={td}>
                  <button style={{ ...btn, fontSize: 11, padding: "4px 10px" }}
                    onClick={() => { setSelectedDoc(d); setActionComment(""); }}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Doc modal helper ──────────────────────────────────
  function renderDocModal(doc) {
    const canAct = doc.status === "processing" &&
      doc.steps[doc.currentStep]?.dept === currentUser &&
      doc.steps[doc.currentStep]?.status === "pending";

    return (
      <Modal onClose={() => setSelectedDoc(null)}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{doc.title}</div>
              <UrgencyPill level={doc.urgency} />
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{doc.id} · {doc.type} · {doc.origin}</div>
          </div>
          <button onClick={() => setSelectedDoc(null)} style={{ ...btn, fontSize: 11, padding: "4px 10px" }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Submitted by", value: doc.submittedBy },
              { label: "Date",         value: doc.date },
              { label: "Notes",        value: doc.notes || "—" },
              { label: "Attachment",   value: doc.attachment ? `📎 ${doc.attachment.name}` : "—" },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{f.label}</div>
                <div style={{ fontSize: 13 }}>{f.value}</div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Deadline</div>
              <div style={{ fontSize: 13 }}><DeadlineTag deadline={doc.deadline} status={doc.status} /></div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Status</div>
              <StatusPill status={doc.status} />
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Approval Progress</div>
          <ApprovalSteps doc={doc} />

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {doc.steps.map((s, i) => {
              let bg = "#f8fafc", dot = "#94a3b8", icon = "–";
              if (s.status === "approved") { bg = "#f0fdf4"; dot = "#16a34a"; icon = "✓"; }
              if (s.status === "rejected") { bg = "#fef2f2"; dot = "#ef4444"; icon = "✕"; }
              if (s.status === "pending" && i === doc.currentStep && doc.status === "processing") {
                bg = "#eff6ff"; dot = "#2563eb"; icon = "⏳";
              }
              return (
                <div key={i} style={{ display: "flex", gap: 10, padding: 10, borderRadius: 10, background: bg, border: "1px solid #f1f5f9" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: dot, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0 }}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.dept}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {s.status === "waiting"  ? "Waiting for prior approval" :
                       s.status === "pending"  ? "Awaiting review" :
                       s.status === "approved" ? `Approved${s.date ? " · " + s.date : ""}` :
                       s.status === "rejected" ? `Rejected${s.date ? " · " + s.date : ""}` : s.status}
                    </div>
                    {s.comment && <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic", marginTop: 2 }}>"{s.comment}"</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {canAct && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Your Action (City Mayor)</div>
              <textarea
                value={actionComment}
                onChange={e => setActionComment(e.target.value)}
                placeholder="Add your remarks (optional)..."
                style={{ ...inp, minHeight: 70, resize: "vertical" }}
              />
            </div>
          )}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {canAct && <>
            <button onClick={() => processApproval(doc.id, "rejected", actionComment)} style={{ ...btn, color: "#b91c1c", borderColor: "#fca5a5" }}>✕ Reject</button>
            <button onClick={() => processApproval(doc.id, "approved", actionComment)} style={{ ...btn, background: "#2563eb", color: "#fff", borderColor: "#2563eb" }}>✓ Approve</button>
          </>}
          <button onClick={() => setSelectedDoc(null)} style={btn}>Close</button>
        </div>
      </Modal>
    );
  }

  // ── Views ─────────────────────────────────────────────
  const active    = docs.filter(d => d.status === "processing").length;
  const completed = docs.filter(d => d.status === "completed").length;

  const dashboardView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { label: "Active Documents",    value: active,              color: "#2563eb", sub: "Currently in pipeline" },
          { label: "Pending My Approval", value: pendingForMe.length, color: "#d97706", sub: "Awaiting your action"  },
          { label: "Overdue",             value: overdueCount,        color: "#b91c1c", sub: "Past their deadline"    },
          { label: "Completed",           value: completed,           color: "#16a34a", sub: "Fully approved"         },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: "-1px" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Departments</span>
          <span style={{ fontSize: 11, color: "#64748b" }}></span>
        </div>
        <div style={{ padding: 14, display: "flex", gap: 8 }}>
          {DEPTS.map(dept => {
            const waiting = docs.filter(x =>
              x.status === "processing" &&
              x.steps[x.currentStep]?.dept === dept &&
              x.steps[x.currentStep]?.status === "pending"
            ).length;
            return (
              <div key={dept} style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{dept}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: waiting ? "#d97706" : "#94a3b8" }}>{waiting}</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>awaiting</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Recent Documents</span>
          <button onClick={() => setActiveView("documents")} style={btn}>View all</button>
        </div>
        {renderDocTable(docs.slice().reverse().slice(0, 5), false)}
      </div>
    </div>
  );

  const documentsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>All Documents ({filteredDocs.length})</span>
        <button onClick={() => setActiveView("new")} style={{ ...btn, background: "#2563eb", color: "#fff", borderColor: "#2563eb" }}>+ New Document</button>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {renderDocTable(filteredDocs, true)}
      </div>
    </div>
  );

  const approvalsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
        Pending My Approval — <span style={{ color: "#2563eb" }}>City Mayor</span>
      </span>
      {pendingForMe.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 40, textAlign: "center", color: "#64748b" }}>
          ✅ No pending approvals for you right now.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Track ID","Title","Type","Origin","Submitted by","Urgency","Deadline","Actions"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingForMe
                .slice()
                .sort((a, b) => {
                  const order = { Critical: 0, High: 1, Normal: 2, Low: 3 };
                  return (order[a.urgency] ?? 2) - (order[b.urgency] ?? 2);
                })
                .map((d, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={td}><span style={{ color: "#2563eb", fontWeight: 600, cursor: "pointer" }} onClick={() => { setSelectedDoc(d); setActionComment(""); }}>{d.id}</span></td>
                  <td style={td}>{d.title}</td>
                  <td style={td}>{d.type}</td>
                  <td style={td}>{d.origin}</td>
                  <td style={td}>{d.submittedBy}</td>
                  <td style={td}><UrgencyPill level={d.urgency} /></td>
                  <td style={td}><DeadlineTag deadline={d.deadline} status={d.status} /></td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => processApproval(d.id, "approved", "")} style={{ ...btn, background: "#2563eb", color: "#fff", borderColor: "#2563eb", fontSize: 11, padding: "4px 10px" }}>✓ Approve</button>
                      <button onClick={() => { const c = prompt("Reason for rejection (optional):"); if (c !== null) processApproval(d.id, "rejected", c); }} style={{ ...btn, color: "#b91c1c", borderColor: "#fca5a5", fontSize: 11, padding: "4px 10px" }}>✕ Reject</button>
                      <button onClick={() => { setSelectedDoc(d); setActionComment(""); }} style={{ ...btn, fontSize: 11, padding: "4px 10px" }}>View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>All In-Progress Documents</span>
        </div>
        {renderDocTable(docs.filter(d => d.status === "processing"), true)}
      </div>
    </div>
  );

  const newRequestView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Submit New Document</span>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, maxWidth: 540, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

        {/* Success banner */}
        {submitSuccess && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#15803d", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            {submitSuccess}
          </div>
        )}

        {[
          { label: "Document Title *",    key: "title",       placeholder: "e.g. Budget Proposal Q2" },
          { label: "Originating Unit *",  key: "origin",      placeholder: "e.g. Finance Dept." },
          { label: "Submitted By *",      key: "submittedBy", placeholder: "Full name" },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>{f.label}</label>
            <input
              value={form[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              style={inp}
            />
          </div>
        ))}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>Document Type *</label>
          <select value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))} style={inp}>
            <option value="">— Select type —</option>
            {["Budget","Permit","Report","Memo","Resolution","Other"].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>Urgency Level</label>
            <select
              value={form.urgency}
              onChange={e => setForm(prev => ({ ...prev, urgency: e.target.value }))}
              style={inp}
            >
              {URGENCY_LEVELS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>Deadline</label>
            <input
              type="date"
              value={form.deadline}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => setForm(prev => ({ ...prev, deadline: e.target.value }))}
              style={inp}
            />
          </div>
        </div>
        <div style={{ marginTop: -8, marginBottom: 14 }}>
          <UrgencyPill level={form.urgency} />
          {form.deadline && (
            <span style={{ marginLeft: 8 }}>
              <DeadlineTag deadline={form.deadline} status="processing" />
            </span>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>Description / Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Brief description of this document..."
            style={{ ...inp, minHeight: 80, resize: "vertical" }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>Attach Document</label>
          <input
            type="file"
            onChange={e => {
              const file = e.target.files && e.target.files[0];
              setForm(prev => ({ ...prev, attachment: file ? { name: file.name, size: file.size } : null }));
            }}
            style={{ ...inp, padding: "6px 10px", cursor: "pointer" }}
          />
          {form.attachment && (
            <div style={{ fontSize: 11, color: "#475569", marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <span>📎 {form.attachment.name} ({Math.max(1, Math.round(form.attachment.size / 1024))} KB)</span>
              <button onClick={() => setForm(prev => ({ ...prev, attachment: null }))} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14, fontSize: 11, color: "#94a3b8" }}>
          A unique Tracking ID will be generated automatically (e.g. TT-4821).
        </div>

        {/* Approval route */}
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Approval Route (sequential):</div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>1</div>
            <div style={{ flex: 1, padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, background: "#eff6ff", color: "#1d4ed8", fontWeight: 600 }}>
              City Administrator
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", color: "#94a3b8", fontSize: 12, margin: "2px 0 6px 10px" }}>↓</div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>2</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Final approver — select one:</div>
              <div style={{ display: "flex", gap: 8 }}>
                {SECOND_STEP_OPTIONS.map(opt => {
                  const isSel = secondApprover === opt;
                  return (
                    <label key={opt} style={{
                      flex: 1, display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 10px", border: `1.5px solid ${isSel ? "#2563eb" : "#e2e8f0"}`,
                      borderRadius: 8, cursor: "pointer", fontSize: 12,
                      background: isSel ? "#eff6ff" : "#fff",
                      color: isSel ? "#1d4ed8" : "#334155",
                      fontWeight: isSel ? 600 : 500
                    }}>
                      <input type="radio" name="secondApprover" value={opt} checked={isSel} onChange={() => setSecondApprover(opt)} style={{ accentColor: "#2563eb" }} />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 10 }}>
            Every document goes to City Administrator first, then routes to the selected department for final approval.
          </div>
        </div>

        <button
          onClick={submitDoc}
          disabled={submitting}
          style={{
            ...btn,
            background: submitting ? "#93c5fd" : "#2563eb",
            color: "#fff", borderColor: submitting ? "#93c5fd" : "#2563eb",
            padding: "10px 20px", fontSize: 13,
            cursor: submitting ? "not-allowed" : "pointer"
          }}
        >
          {submitting ? "⏳ Submitting..." : "➤ Submit for Approval"}
        </button>
      </div>
    </div>
  );

  const notificationsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Notifications</span>
        <button onClick={() => updateNotifications(prev => prev.map(n => ({ ...n, isNew: false })))} style={btn}>
          Mark all read
        </button>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>No notifications.</div>
        ) : notifications.map((n, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: i < notifications.length - 1 ? "1px solid #f1f5f9" : "none", alignItems: "flex-start" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: n.dot, marginTop: 5, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {n.time}{n.isNew && <span style={{ color: "#2563eb", fontWeight: 600 }}> · New</span>}
              </div>
              <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{n.msg}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{
      display: "flex", height: "100vh", fontFamily: "'DM Sans','Segoe UI',sans-serif",
      background: "#f1f5f9", color: "#1e293b", overflow: "hidden",
      opacity: visible ? 1 : 0, transition: "opacity 0.4s ease"
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: "#fff", borderRight: "1px solid #e2e8f0",
        display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0,
        boxShadow: "2px 0 8px rgba(0,0,0,0.04)", overflowY: "auto"
      }}>
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 20px 20px",
    borderBottom: "1px solid #f1f5f9",
    marginBottom: 8
  }}
>
  <div
    style={{
      width: 40,
      height: 40,
      background: "#2563eb",
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontWeight: 800,
      fontSize: 16
    }}
  >
    T
  </div>

  <div style={{ display: "flex", flexDirection: "column" }}>
    <div
      style={{
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: "-0.3px",
        color: "#0f172a"
      }}
    >
      Tracktask
    </div>

    <div
      style={{
        fontSize: 12,
        color: "#94a3b8",
        marginTop: 2
      }}
    >
      City Mayor
    </div>
  </div>
</div>
        <nav style={{ flex: 1 }}>
          {navItems.map(({ key, icon, label, badge }) => {
            const isActive = activeView === key;
            return (
              <button key={key} onClick={() => setActiveView(key)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 20px", border: "none",
                background: isActive ? "#eff6ff" : "transparent",
                color: isActive ? "#2563eb" : "#64748b",
                cursor: "pointer", fontSize: 13, fontWeight: isActive ? 600 : 400,
                textAlign: "left", borderLeft: isActive ? "3px solid #2563eb" : "3px solid transparent",
                transition: "all .15s", fontFamily: "inherit"
              }}>
                <span>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {badge > 0 && (
                  <span style={{ background: key === "approvals" ? "#ef4444" : "#2563eb", color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 6px", minWidth: 18, textAlign: "center" }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ margin: "16px 12px 0", padding: "10px 12px", background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe" }}>
          <div style={{ fontSize: 10, color: "#2563eb", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Logged in as</div>
          <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 600, marginTop: 2 }}>City Mayor</div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px", color: "#0f172a" }}>City Mayor Portal</h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>Tracktask · Document Tracking</p>
          </div>

          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 13 }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents..."
              style={{ paddingLeft: 32, paddingRight: 14, paddingTop: 7, paddingBottom: 7, border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 12, background: "#f8fafc", color: "#1e293b", outline: "none", width: 220, fontFamily: "inherit" }}
            />
          </div>

          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setActiveView("notifications")}>
            <span style={{ fontSize: 20 }}>🔔</span>
            {newNotifCount > 0 && (
              <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff", borderRadius: 99, fontSize: 9, fontWeight: 700, padding: "0 4px", minWidth: 14, textAlign: "center" }}>{newNotifCount}</span>
            )}
          </div>

          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8", fontWeight: 700, fontSize: 13 }}>M</div>
        </header>

        <div style={{ flex: 1, minHeight: 0, padding: "20px 24px", overflowY: "auto" }}>
          {activeView === "dashboard"     && dashboardView}
          {activeView === "documents"     && documentsView}
          {activeView === "approvals"     && approvalsView}
          {activeView === "new"           && newRequestView}
          {activeView === "notifications" && notificationsView}
        </div>
      </main>

      {selectedDoc && renderDocModal(docs.find(d => d.id === selectedDoc.id) || selectedDoc)}

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
        button, select, input, textarea { font-family: inherit; }
      `}</style>
    </div>
  );
}