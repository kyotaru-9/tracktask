import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_DOCS_KEY     = "tracktask-docs";
const STORAGE_NOTIF_KEY    = "tracktask-notifications";
const STORAGE_ACCOUNTS_KEY = "tracktask-accounts";
const STORAGE_SETTINGS_KEY = "tracktask-settings";
const MY_DEPT = "City Administrator";

const DEFAULT_SETTINGS = {
  displayName: MY_DEPT,
  email: "",
  notifyInApp: true,
  notifyEmail: false,
};

// Approval chain for new requests submitted by City Administrator
const DEFAULT_STEPS = [
  { dept: "City Administrator", status: "approved", comment: "Submitted by originating office.", date: "" },
  { dept: "Mayor's Office",     status: "pending",  comment: "", date: "" },
];

const DOC_TYPES = [
  "Resolution",
  "Ordinance",
  "Memorandum",
  "Contract / MOA",
  "Budget Request",
  "Travel Order",
  "Permit",
  "Certification",
  "Endorsement",
  "Other",
];

const ACCOUNT_DEPARTMENTS = ["City Administrator", "Mayor's Office", "Other"];
const ACCOUNT_ROLES = ["Administrator", "Approver", "Staff", "Viewer"];

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

function downloadAttachment(att) {
  if (!att) return;
  const blob = base64ToBlob(att.data, att.type);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = att.name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  try { await window.storage.set(key, JSON.stringify(value), true); } catch {}
}

// Account data is personal (only visible to this browser/session), never shared.
async function loadPersonal(key, fallback) {
  try {
    const res = await window.storage.get(key, false);
    return res ? JSON.parse(res.value) : fallback;
  } catch {
    return fallback;
  }
}
async function savePersonal(key, value) {
  try { await window.storage.set(key, JSON.stringify(value), false); } catch {}
}

function StatusPill({ status }) {
  const map = {
    processing: { bg: "#dbeafe", color: "#1d4ed8", label: "In Progress" },
    completed:  { bg: "#dcfce7", color: "#15803d", label: "Completed"  },
    rejected:   { bg: "#fee2e2", color: "#b91c1c", label: "Rejected"   },
    pending:    { bg: "#fef9c3", color: "#a16207", label: "Pending"    },
    waiting:    { bg: "#f1f5f9", color: "#475569", label: "Waiting"    },
    approved:   { bg: "#dcfce7", color: "#15803d", label: "Approved"   },
    active:     { bg: "#dcfce7", color: "#15803d", label: "Active"     },
    inactive:   { bg: "#f1f5f9", color: "#64748b", label: "Inactive"   },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      background: s.bg, color: s.color, borderRadius: 99,
      fontSize: 11, fontWeight: 600, padding: "2px 10px",
      display: "inline-block", whiteSpace: "nowrap"
    }}>{s.label}</span>
  );
}

function ApprovalSteps({ doc }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {doc.steps.map((s, i) => {
        let bg = "#f1f5f9", border = "#e2e8f0", color = "#64748b";
        if (s.status === "approved") { bg = "#dcfce7"; border = "#86efac"; color = "#15803d"; }
        if (s.status === "rejected") { bg = "#fee2e2"; border = "#fca5a5"; color = "#b91c1c"; }
        if (s.status === "pending" && i === doc.currentStep && doc.status === "processing") {
          bg = "#dbeafe"; border = "#2563eb"; color = "#1d4ed8";
        }
        return (
          <div key={i} style={{ flex: 1, textAlign: "center", position: "relative" }}>
            {i < doc.steps.length - 1 && (
              <div style={{
                position: "absolute", top: 13, left: "50%", width: "100%",
                height: 2, background: s.status === "approved" ? "#86efac" : "#e2e8f0", zIndex: 0
              }} />
            )}
            <div style={{
              width: 26, height: 26, borderRadius: "50%", border: `2px solid ${border}`,
              background: bg, color, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 10, fontWeight: 700,
              margin: "0 auto 3px", position: "relative", zIndex: 1
            }}>
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
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 14, width: 560, maxHeight: "90vh",
        overflowY: "auto", border: "1px solid #e2e8f0",
        boxShadow: "0 8px 32px rgba(0,0,0,0.14)"
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Attachment picker (shared by both request forms) ──────
function AttachmentField({ attachment, error, attaching, onChange, onRemove }) {
  const label = { fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" };
  const btn = {
    padding: "3px 9px", border: "1px solid #e2e8f0", borderRadius: 8,
    background: "transparent", color: "#334155", cursor: "pointer",
    fontSize: 11, fontFamily: "inherit"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
      <label style={label}>Attachment</label>
      {!attachment ? (
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: "16px 10px",
          cursor: "pointer", color: "#64748b", fontSize: 12, background: "#f8fafc"
        }}>
          <input type="file" onChange={onChange} style={{ display: "none" }} />
          {attaching ? "Reading file…" : <>📎 Click to attach a file (max {formatBytes(MAX_ATTACHMENT_BYTES)})</>}
        </label>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 10, padding: "8px 12px"
        }}>
          <span style={{ fontSize: 12, color: "#1d4ed8" }}>
            📎 {attachment.name} <span style={{ color: "#64748b" }}>({formatBytes(attachment.size)})</span>
          </span>
          <button onClick={onRemove} style={btn}>Remove</button>
        </div>
      )}
      {error && <div style={{ color: "#b91c1c", fontSize: 11, marginTop: 5 }}>{error}</div>}
    </div>
  );
}

function useAttachment() {
  const [attachment, setAttachment] = useState(null); // { name, type, size, data }
  const [error,      setError]      = useState("");
  const [attaching,  setAttaching]  = useState(false);

  async function handleChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`File is too large (${formatBytes(file.size)}). Max size is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
      return;
    }
    setAttaching(true);
    try {
      const data = await fileToBase64(file);
      setAttachment({ name: file.name, type: file.type || "application/octet-stream", size: file.size, data });
    } catch {
      setError("Could not read that file. Please try again.");
    } finally {
      setAttaching(false);
    }
  }

  function remove() {
    setAttachment(null);
    setError("");
  }

  function reset() {
    setAttachment(null);
    setError("");
    setAttaching(false);
  }

  return { attachment, error, attaching, handleChange, remove, reset };
}

// ── Request Document Modal ────────────────────────────────
function RequestDocModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    title: "",
    type: DOC_TYPES[0],
    origin: MY_DEPT,
    submittedBy: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const att = useAttachment();

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: "" }));
  }

  function validate() {
    const e = {};
    if (!form.title.trim())       e.title       = "Document title is required.";
    if (!form.submittedBy.trim()) e.submittedBy = "Submitted by is required.";
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    await onSubmit({ ...form, attachment: att.attachment });
    setSubmitting(false);
    onClose();
  }

  const inp = {
    width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8,
    background: "#f8fafc", color: "#1e293b", fontSize: 13, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };
  const errStyle = { color: "#b91c1c", fontSize: 11, marginTop: 3 };
  const label = { fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" };
  const field = { display: "flex", flexDirection: "column", marginBottom: 14 };

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid #e2e8f0",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>📄 Request Document</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            Submit a new document for Mayor's Office approval
          </div>
        </div>
        <button onClick={onClose} style={{
          padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 8,
          background: "transparent", color: "#334155", cursor: "pointer", fontSize: 11, fontFamily: "inherit"
        }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ padding: "20px 20px 4px" }}>

        {/* Approval flow preview */}
        <div style={{
          background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10,
          padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10
        }}>
          <span style={{ fontSize: 13 }}>ℹ️</span>
          <span style={{ fontSize: 12, color: "#0369a1", lineHeight: 1.5 }}>
            After submission, this document will be routed to the <strong>Mayor's Office</strong> for review and approval.
          </span>
        </div>

        {/* Document Title */}
        <div style={field}>
          <label style={label}>Document Title <span style={{ color: "#ef4444" }}>*</span></label>
          <input
            value={form.title}
            onChange={e => set("title", e.target.value)}
            placeholder="e.g. Resolution No. 2025-001 – Approving Annual Budget"
            style={{ ...inp, borderColor: errors.title ? "#fca5a5" : "#e2e8f0" }}
          />
          {errors.title && <div style={errStyle}>{errors.title}</div>}
        </div>

        {/* Type + Origin row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={label}>Document Type</label>
            <select
              value={form.type}
              onChange={e => set("type", e.target.value)}
              style={{ ...inp }}
            >
              {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={label}>Originating Office</label>
            <input
              value={form.origin}
              onChange={e => set("origin", e.target.value)}
              placeholder="City Administrator"
              style={inp}
            />
          </div>
        </div>

        {/* Submitted By */}
        <div style={field}>
          <label style={label}>Submitted By <span style={{ color: "#ef4444" }}>*</span></label>
          <input
            value={form.submittedBy}
            onChange={e => set("submittedBy", e.target.value)}
            placeholder="Full name of the requesting officer"
            style={{ ...inp, borderColor: errors.submittedBy ? "#fca5a5" : "#e2e8f0" }}
          />
          {errors.submittedBy && <div style={errStyle}>{errors.submittedBy}</div>}
        </div>

        {/* Notes */}
        <div style={field}>
          <label style={label}>Notes / Remarks</label>
          <textarea
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
            placeholder="Brief description, purpose, or special instructions…"
            style={{ ...inp, minHeight: 72, resize: "vertical" }}
          />
        </div>

        {/* Attachment */}
        <AttachmentField
          attachment={att.attachment}
          error={att.error}
          attaching={att.attaching}
          onChange={att.handleChange}
          onRemove={att.remove}
        />
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 20px", borderTop: "1px solid #e2e8f0",
        display: "flex", gap: 8, justifyContent: "flex-end"
      }}>
        <button onClick={onClose} style={{
          padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 8,
          background: "transparent", color: "#334155", cursor: "pointer",
          fontSize: 12, fontWeight: 500, fontFamily: "inherit"
        }}>Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={submitting || att.attaching}
          style={{
            padding: "7px 18px", border: "1px solid #2563eb", borderRadius: 8,
            background: (submitting || att.attaching) ? "#93c5fd" : "#2563eb", color: "#fff",
            cursor: (submitting || att.attaching) ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 6
          }}
        >
          {submitting ? "Submitting…" : "📤 Submit to Mayor's Office"}
        </button>
      </div>
    </Modal>
  );
}

// ── Account Modal (add / edit) ─────────────────────────────
function AccountModal({ mode, account, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name:       account?.name       || "",
    username:   account?.username   || "",
    department: account?.department || ACCOUNT_DEPARTMENTS[0],
    role:       account?.role       || ACCOUNT_ROLES[0],
    password:   "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const isEdit = mode === "edit";

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: "" }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim())     e.name     = "Full name is required.";
    if (!form.username.trim()) e.username = "Username is required.";
    if (!isEdit) {
      if (!form.password.trim())      e.password = "Password is required.";
      else if (form.password.length < 4) e.password = "Password must be at least 4 characters.";
    }
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    await onSubmit(form);
    setSubmitting(false);
    onClose();
  }

  const inp = {
    width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8,
    background: "#f8fafc", color: "#1e293b", fontSize: 13, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };
  const errStyle = { color: "#b91c1c", fontSize: 11, marginTop: 3 };
  const label = { fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" };
  const field = { display: "flex", flexDirection: "column", marginBottom: 14 };

  return (
    <Modal onClose={onClose}>
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid #e2e8f0",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
            {isEdit ? "✏️ Edit Account" : "👤 Add Account"}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {isEdit ? "Update this account's details" : "Create a new account for this portal"}
          </div>
        </div>
        <button onClick={onClose} style={{
          padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 8,
          background: "transparent", color: "#334155", cursor: "pointer", fontSize: 11, fontFamily: "inherit"
        }}>✕</button>
      </div>

      <div style={{ padding: "20px 20px 4px" }}>
        <div style={field}>
          <label style={label}>Full Name <span style={{ color: "#ef4444" }}>*</span></label>
          <input
            value={form.name}
            onChange={e => set("name", e.target.value)}
            placeholder="e.g. Juan Dela Cruz"
            style={{ ...inp, borderColor: errors.name ? "#fca5a5" : "#e2e8f0" }}
          />
          {errors.name && <div style={errStyle}>{errors.name}</div>}
        </div>

        <div style={field}>
          <label style={label}>Username <span style={{ color: "#ef4444" }}>*</span></label>
          <input
            value={form.username}
            onChange={e => set("username", e.target.value)}
            placeholder="e.g. jdelacruz"
            style={{ ...inp, borderColor: errors.username ? "#fca5a5" : "#e2e8f0" }}
          />
          {errors.username && <div style={errStyle}>{errors.username}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={label}>Department / Office</label>
            <select value={form.department} onChange={e => set("department", e.target.value)} style={inp}>
              {ACCOUNT_DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={label}>Role</label>
            <select value={form.role} onChange={e => set("role", e.target.value)} style={inp}>
              {ACCOUNT_ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {!isEdit && (
          <div style={field}>
            <label style={label}>Password <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              type="password"
              value={form.password}
              onChange={e => set("password", e.target.value)}
              placeholder="At least 4 characters"
              style={{ ...inp, borderColor: errors.password ? "#fca5a5" : "#e2e8f0" }}
            />
            {errors.password && <div style={errStyle}>{errors.password}</div>}
          </div>
        )}
        {isEdit && (
          <div style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
            padding: "9px 12px", marginBottom: 14, fontSize: 11, color: "#64748b"
          }}>
            To change this account's password, use "Reset Password" from the account list.
          </div>
        )}
      </div>

      <div style={{
        padding: "12px 20px", borderTop: "1px solid #e2e8f0",
        display: "flex", gap: 8, justifyContent: "flex-end"
      }}>
        <button onClick={onClose} style={{
          padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 8,
          background: "transparent", color: "#334155", cursor: "pointer",
          fontSize: 12, fontWeight: 500, fontFamily: "inherit"
        }}>Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: "7px 18px", border: "1px solid #2563eb", borderRadius: 8,
            background: submitting ? "#93c5fd" : "#2563eb", color: "#fff",
            cursor: submitting ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 600, fontFamily: "inherit",
          }}
        >
          {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Account"}
        </button>
      </div>
    </Modal>
  );
}

// ── Reset Password Modal ───────────────────────────────────
function ResetPasswordModal({ account, onClose, onSubmit }) {
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!password.trim() || password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    await onSubmit(password);
    setSubmitting(false);
    onClose();
  }

  const inp = {
    width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8,
    background: "#f8fafc", color: "#1e293b", fontSize: 13, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };
  const label = { fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" };
  const field = { display: "flex", flexDirection: "column", marginBottom: 14 };

  return (
    <Modal onClose={onClose}>
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid #e2e8f0",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>🔑 Reset Password</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {account.name} · {account.username}
          </div>
        </div>
        <button onClick={onClose} style={{
          padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 8,
          background: "transparent", color: "#334155", cursor: "pointer", fontSize: 11, fontFamily: "inherit"
        }}>✕</button>
      </div>

      <div style={{ padding: "20px 20px 4px" }}>
        <div style={field}>
          <label style={label}>New Password</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            placeholder="At least 4 characters"
            style={inp}
          />
        </div>
        <div style={field}>
          <label style={label}>Confirm New Password</label>
          <input
            type="password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError(""); }}
            placeholder="Re-enter password"
            style={inp}
          />
        </div>
        {error && <div style={{ color: "#b91c1c", fontSize: 11, marginTop: -8, marginBottom: 12 }}>{error}</div>}
      </div>

      <div style={{
        padding: "12px 20px", borderTop: "1px solid #e2e8f0",
        display: "flex", gap: 8, justifyContent: "flex-end"
      }}>
        <button onClick={onClose} style={{
          padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 8,
          background: "transparent", color: "#334155", cursor: "pointer",
          fontSize: 12, fontWeight: 500, fontFamily: "inherit"
        }}>Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: "7px 18px", border: "1px solid #2563eb", borderRadius: 8,
            background: submitting ? "#93c5fd" : "#2563eb", color: "#fff",
            cursor: submitting ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 600, fontFamily: "inherit",
          }}
        >
          {submitting ? "Saving…" : "Reset Password"}
        </button>
      </div>
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────
export default function CityAdministrator() {
  const navigate = useNavigate();
  const [docs,             setDocs]             = useState([]);
  const [notifications,    setNotifications]    = useState([]);
  const [accounts,         setAccounts]         = useState([]);
  const [activeView,       setActiveView]       = useState("dashboard");
  const [selectedDoc,      setSelectedDoc]      = useState(null);
  const [comment,          setComment]          = useState("");
  const [search,           setSearch]           = useState("");
  const [visible,          setVisible]          = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [accountModal,     setAccountModal]     = useState(null); // { mode: "add" } | { mode: "edit", account }
  const [resetPwAccount,   setResetPwAccount]   = useState(null);
  const [seenMsgs,         setSeenMsgs]         = useState(new Set());
  const [settingsForm,     setSettingsForm]     = useState(DEFAULT_SETTINGS);
  const [pwForm,           setPwForm]           = useState({ newPassword: "", confirmPassword: "" });
  const [pwError,          setPwError]          = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [d, n, a, s] = await Promise.all([
        loadShared(STORAGE_DOCS_KEY,  []),
        loadShared(STORAGE_NOTIF_KEY, []),
        loadPersonal(STORAGE_ACCOUNTS_KEY, []),
        loadPersonal(STORAGE_SETTINGS_KEY, DEFAULT_SETTINGS),
      ]);
      if (!mounted) return;
      setDocs(d);
      setNotifications(n);
      setAccounts(a);
      setSettingsForm(s);
      setSeenMsgs(new Set(n.map(x => x.msg)));
      setVisible(true);
    })();

    const poll = setInterval(async () => {
      const [d, n] = await Promise.all([
        loadShared(STORAGE_DOCS_KEY,  null),
        loadShared(STORAGE_NOTIF_KEY, null),
      ]);
      if (!mounted) return;
      if (d) setDocs(prev => JSON.stringify(prev) === JSON.stringify(d) ? prev : d);
      if (n) setNotifications(prev => JSON.stringify(prev) === JSON.stringify(n) ? prev : n);
    }, 3000);

    return () => { mounted = false; clearInterval(poll); };
  }, []);

  function updateDocs(updater) {
    setDocs(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveShared(STORAGE_DOCS_KEY, next);
      return next;
    });
  }
  function updateNotifications(updater) {
    setNotifications(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveShared(STORAGE_NOTIF_KEY, next);
      return next;
    });
  }
  function updateAccounts(updater) {
    setAccounts(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      savePersonal(STORAGE_ACCOUNTS_KEY, next);
      return next;
    });
  }

  function addNotif(msg, dot) {
    const time = new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
    updateNotifications(prev => [{ time, msg, dot, isNew: true }, ...prev]);
  }

  // ── Submit new document ──────────────────────────────
  async function handleRequestSubmit(form) {
    const now  = new Date();
    const date = now.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
    const time = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
    const ts   = `${date} ${time}`;

    // Generate sequential ID
    const existing = await loadShared(STORAGE_DOCS_KEY, []);
    const maxNum = existing.reduce((max, d) => {
      const m = d.id?.match(/TRK-(\d+)/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const newId = `TRK-${String(maxNum + 1).padStart(4, "0")}`;

    const steps = [
      { dept: MY_DEPT,        status: "approved", comment: "Submitted by originating office.", date: ts },
      { dept: "Mayor's Office", status: "pending",  comment: "", date: "" },
    ];

    const newDoc = {
      id:          newId,
      title:       form.title.trim(),
      type:        form.type,
      origin:      form.origin.trim() || MY_DEPT,
      submittedBy: form.submittedBy.trim(),
      date,
      notes:       form.notes.trim(),
      attachment:  form.attachment || null,
      status:      "processing",
      steps,
      currentStep: 1,
    };

    updateDocs(prev => [newDoc, ...prev]);
    addNotif(
      `${newId} "${newDoc.title}" submitted to Mayor's Office for approval.`,
      "#2563eb"
    );
  }

  function processApproval(id, action, cmt) {
    const ts = new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric" }) +
               " " + new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
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
          addNotif(`${id} "${d.title}" forwarded to ${updated.steps[next].dept}.`, "#2563eb");
        } else {
          updated.status = "completed";
          addNotif(`${id} "${d.title}" fully approved by all departments.`, "#16a34a");
        }
      } else {
        updated.status = "rejected";
        addNotif(`${id} "${d.title}" was rejected by ${MY_DEPT}.`, "#ef4444");
      }
      return updated;
    }));
    setSelectedDoc(null);
    setComment("");
  }

  // ── Account management ────────────────────────────────
  async function handleAccountSubmit(form) {
    if (accountModal?.mode === "edit") {
      const id = accountModal.account.id;
      updateAccounts(prev => prev.map(a => a.id === id ? {
        ...a,
        name:       form.name.trim(),
        username:   form.username.trim(),
        department: form.department,
        role:       form.role,
      } : a));
      addNotif(`Account "${form.name.trim()}" was updated.`, "#2563eb");
    } else {
      const existing = await loadPersonal(STORAGE_ACCOUNTS_KEY, []);
      const maxNum = existing.reduce((max, a) => {
        const m = a.id?.match(/ACC-(\d+)/);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);
      const newId = `ACC-${String(maxNum + 1).padStart(4, "0")}`;
      const date = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

      const newAccount = {
        id:         newId,
        name:       form.name.trim(),
        username:   form.username.trim(),
        password:   form.password,
        department: form.department,
        role:       form.role,
        status:     "active",
        createdDate: date,
      };
      updateAccounts(prev => [newAccount, ...prev]);
      addNotif(`Account "${newAccount.name}" (${newAccount.username}) was created.`, "#16a34a");
    }
  }

  function toggleAccountStatus(id) {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    const nextStatus = acc.status === "active" ? "inactive" : "active";
    updateAccounts(prev => prev.map(a => a.id === id ? { ...a, status: nextStatus } : a));
    addNotif(
      `Account "${acc.name}" was ${nextStatus === "active" ? "reactivated" : "deactivated"}.`,
      nextStatus === "active" ? "#16a34a" : "#ef4444"
    );
  }

  function deleteAccount(id) {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    if (!confirm(`Delete account "${acc.name}"? This cannot be undone.`)) return;
    updateAccounts(prev => prev.filter(a => a.id !== id));
    addNotif(`Account "${acc.name}" was deleted.`, "#ef4444");
  }

  async function handleResetPassword(newPassword) {
    const id = resetPwAccount.id;
    updateAccounts(prev => prev.map(a => a.id === id ? { ...a, password: newPassword } : a));
    addNotif(`Password was reset for "${resetPwAccount.name}".`, "#2563eb");
  }

  // ── Settings ───────────────────────────────────────────
  function saveSettings() {
    savePersonal(STORAGE_SETTINGS_KEY, settingsForm);
    addNotif("Your profile settings were updated.", "#2563eb");
  }

  function changeMyPassword() {
    if (!pwForm.newPassword.trim() || pwForm.newPassword.length < 4) {
      setPwError("Password must be at least 4 characters.");
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    setPwError("");
    savePersonal(STORAGE_SETTINGS_KEY, { ...settingsForm, password: pwForm.newPassword });
    setPwForm({ newPassword: "", confirmPassword: "" });
    addNotif("Your password was changed.", "#2563eb");
  }

  // ── Derived ──────────────────────────────────────────
  const myPending = docs.filter(
    d => d.status === "processing" &&
         d.steps[d.currentStep]?.dept === MY_DEPT &&
         d.steps[d.currentStep]?.status === "pending"
  );
  const newNotifCount  = notifications.filter(n => n.isNew).length;
  const filteredDocs   = docs.filter(d =>
    !search ||
    d.id.toLowerCase().includes(search.toLowerCase()) ||
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    (d.origin || "").toLowerCase().includes(search.toLowerCase())
  );

  const active    = docs.filter(d => d.status === "processing").length;
  const completed = docs.filter(d => d.status === "completed").length;
  const rejected  = docs.filter(d => d.status === "rejected").length;

  // ── Style tokens ──────────────────────────────────────
  const btn = {
    padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 8,
    background: "transparent", color: "#334155", cursor: "pointer",
    fontSize: 12, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6,
    fontFamily: "inherit"
  };
  const th = {
    padding: "9px 14px", textAlign: "left", fontSize: 11,
    fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap"
  };
  const td = { padding: "10px 14px", fontSize: 12, color: "#334155" };
  const inp = {
    width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8,
    background: "#f8fafc", color: "#1e293b", fontSize: 13, outline: "none", fontFamily: "inherit"
  };

  const navItems = [
    { key: "dashboard",     icon: "⊞", label: "Dashboard"          },
    { key: "request",       icon: "📤", label: "Request Document"   },
    { key: "documents",     icon: "📄", label: "All Documents"      },
    { key: "approvals",     icon: "🕐", label: "Pending Approvals", badge: myPending.length },
    { key: "notifications", icon: "🔔", label: "Notifications",     badge: newNotifCount    },
    { key: "manage-accounts", icon: "👤", label: "Manage Accounts"  },
    { key: "settings",      icon: "⚙️", label: "Settings"           },
    { key: "logout",        icon: "🚪", label: "Logout"             },
  ];

  // ── renderDocTable ────────────────────────────────────
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
              {["Track ID","Title","Origin","Submitted by","Date",
                showSteps && "Progress","Status",""].filter(Boolean).map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((d, i) => (
              <tr key={i}
                style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <td style={td}>
                  <span style={{ color: "#2563eb", fontWeight: 600 }}
                    onClick={() => { setSelectedDoc(d); setComment(""); }}>{d.id}</span>
                </td>
                <td style={td}>{d.title}</td>
                <td style={td}>{d.origin}</td>
                <td style={td}>{d.submittedBy}</td>
                <td style={td}>{d.date}</td>
                {showSteps && (
                  <td style={{ ...td, minWidth: 160 }}><ApprovalSteps doc={d} /></td>
                )}
                <td style={td}><StatusPill status={d.status} /></td>
                <td style={td}>
                  <button style={{ ...btn, fontSize: 11, padding: "4px 10px" }}
                    onClick={() => { setSelectedDoc(d); setComment(""); }}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── renderModal ───────────────────────────────────────
  function renderModal(doc) {
    const canAct =
      doc.status === "processing" &&
      doc.steps[doc.currentStep]?.dept === MY_DEPT &&
      doc.steps[doc.currentStep]?.status === "pending";

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
            {[
              { label: "Submitted by", value: doc.submittedBy },
              { label: "Date",         value: doc.date        },
              { label: "Notes",        value: doc.notes || "—" },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{f.label}</div>
                <div style={{ fontSize: 13 }}>{f.value}</div>
              </div>
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
                    {s.comment && s.dept !== MY_DEPT && (
                      <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic", marginTop: 2 }}>"{s.comment}"</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {canAct && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Your Action — {MY_DEPT}</div>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add your remarks (optional)..."
                style={{ ...inp, minHeight: 70, resize: "vertical" }}
              />
            </div>
          )}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {canAct && <>
            <button onClick={() => processApproval(doc.id, "rejected", comment)}
              style={{ ...btn, color: "#b91c1c", borderColor: "#fca5a5" }}>✕ Reject</button>
            <button onClick={() => processApproval(doc.id, "approved", comment)}
              style={{ ...btn, background: "#2563eb", color: "#fff", borderColor: "#2563eb" }}>✓ Approve</button>
          </>}
          <button onClick={() => setSelectedDoc(null)} style={btn}>Close</button>
        </div>
      </Modal>
    );
  }

  // ── Dashboard ─────────────────────────────────────────
  const dashboardView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { label: "Active",            value: active,           color: "#2563eb", icon: "📄" },
          { label: "Pending My Action", value: myPending.length, color: "#d97706", icon: "🕐" },
          { label: "Completed",         value: completed,        color: "#16a34a", icon: "✅" },
          { label: "Rejected",          value: rejected,         color: "#ef4444", icon: "❌" },
        ].map((s, i) => (
          <div key={i} style={{
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
            padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
          }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-1px" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick action */}
      <div style={{
        background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
        borderRadius: 14, padding: "18px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16
      }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Need to route a document?</div>
          <div style={{ color: "#bfdbfe", fontSize: 12, marginTop: 3 }}>
            Submit a new document directly to the Mayor's Office for approval.
          </div>
        </div>
        <button
          onClick={() => setShowRequestModal(true)}
          style={{
            padding: "9px 18px", border: "none", borderRadius: 9,
            background: "#fff", color: "#2563eb", cursor: "pointer",
            fontSize: 13, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          📤 Request Document
        </button>
      </div>

      {/* Pending queue */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            🕐 Awaiting My Approval
            {myPending.length > 0 && (
              <span style={{ marginLeft: 8, background: "#ef4444", color: "#fff", borderRadius: 99, fontSize: 10, padding: "1px 7px", fontWeight: 700 }}>{myPending.length}</span>
            )}
          </span>
          <button onClick={() => setActiveView("approvals")} style={btn}>View all</button>
        </div>
        {myPending.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>✅ No documents waiting for your approval.</div>
        ) : renderDocTable(myPending, true)}
      </div>

      {/* Recent notifications */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>🔔 Recent Notifications</span>
          <button onClick={() => setActiveView("notifications")} style={btn}>See all</button>
        </div>
        {notifications.slice(0, 5).map((n, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "11px 16px", borderBottom: i < 4 ? "1px solid #f1f5f9" : "none", alignItems: "flex-start" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: n.dot, marginTop: 5, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {n.time}{n.isNew && <span style={{ color: "#2563eb", fontWeight: 700 }}> · New</span>}
              </div>
              <div style={{ fontSize: 13, color: "#334155" }}>{n.msg}</div>
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No notifications yet.</div>
        )}
      </div>
    </div>
  );

  // ── Request view (inline form page) ──────────────────
  const requestView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 620 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
        Request Document — <span style={{ color: "#2563eb" }}>{MY_DEPT}</span>
      </span>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {/* Info banner */}
        <div style={{
          background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10,
          padding: "10px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10
        }}>
          <span style={{ fontSize: 14 }}>ℹ️</span>
          <span style={{ fontSize: 12, color: "#0369a1", lineHeight: 1.5 }}>
            Documents submitted here are immediately routed to the <strong>Mayor's Office</strong> for review and approval.
          </span>
        </div>

        <RequestForm
          onSubmit={async (form) => { await handleRequestSubmit(form); setActiveView("documents"); }}
          onCancel={() => setActiveView("dashboard")}
          inlineMode
        />
      </div>
    </div>
  );

  // ── Approvals ─────────────────────────────────────────
  const approvalsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
        Pending My Approval — <span style={{ color: "#2563eb" }}>{MY_DEPT}</span>
      </span>
      {myPending.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 40, textAlign: "center", color: "#64748b" }}>
          ✅ No pending approvals right now.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Track ID","Title","Type","Origin","Submitted by","Actions"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
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
                      <button onClick={() => processApproval(d.id, "approved", "")}
                        style={{ ...btn, background: "#2563eb", color: "#fff", borderColor: "#2563eb", fontSize: 11, padding: "4px 10px" }}>✓ Approve</button>
                      <button onClick={() => { const c = prompt("Rejection reason (optional):"); if (c !== null) processApproval(d.id, "rejected", c); }}
                        style={{ ...btn, color: "#b91c1c", borderColor: "#fca5a5", fontSize: 11, padding: "4px 10px" }}>✕ Reject</button>
                      <button onClick={() => { setSelectedDoc(d); setComment(""); }}
                        style={{ ...btn, fontSize: 11, padding: "4px 10px" }}>View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── Documents ─────────────────────────────────────────
  const documentsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>All Documents ({filteredDocs.length})</span>
        <button
          onClick={() => setShowRequestModal(true)}
          style={{ ...btn, background: "#2563eb", color: "#fff", borderColor: "#2563eb" }}
        >📤 Request Document</button>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {renderDocTable(filteredDocs, true)}
      </div>
    </div>
  );

  // ── Notifications ─────────────────────────────────────
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
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No notifications.</div>
        ) : notifications.map((n, i) => (
          <div key={i} style={{
            display: "flex", gap: 10, padding: "12px 16px",
            borderBottom: i < notifications.length - 1 ? "1px solid #f1f5f9" : "none",
            alignItems: "flex-start",
            background: n.isNew ? "#fafbff" : "transparent"
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: n.dot, marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {n.time}{n.isNew && <span style={{ color: "#2563eb", fontWeight: 700 }}> · New</span>}
              </div>
              <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{n.msg}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Settings ────────────────────────────────────────────
  const settingsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Settings</span>

      {/* Profile */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>Profile</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 18 }}>
          This is how your name appears on documents you submit and approve.
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" }}>Display Name</label>
          <input
            value={settingsForm.displayName}
            onChange={e => setSettingsForm(f => ({ ...f, displayName: e.target.value }))}
            style={inp}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" }}>Email Address</label>
          <input
            value={settingsForm.email}
            onChange={e => setSettingsForm(f => ({ ...f, email: e.target.value }))}
            placeholder="name@cityhall.gov.ph"
            style={inp}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" }}>Department / Office</label>
          <input value={MY_DEPT} disabled style={{ ...inp, background: "#f1f5f9", color: "#94a3b8" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={saveSettings}
            style={{
              padding: "7px 18px", border: "1px solid #2563eb", borderRadius: 8,
              background: "#2563eb", color: "#fff", cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "inherit"
            }}
          >Save Changes</button>
        </div>
      </div>

      {/* Notifications */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>Notifications</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
          Choose how you want to be notified about document activity.
        </div>

        {[
          { key: "notifyInApp",  label: "In-app notifications", desc: "Show a badge and entry in the Notifications page." },
          { key: "notifyEmail",  label: "Email notifications",  desc: "Send an email when a document needs your approval." },
        ].map(opt => (
          <label key={opt.key} style={{
            display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0",
            borderTop: opt.key === "notifyEmail" ? "1px solid #f1f5f9" : "none", cursor: "pointer"
          }}>
            <input
              type="checkbox"
              checked={settingsForm[opt.key]}
              onChange={e => setSettingsForm(f => ({ ...f, [opt.key]: e.target.checked }))}
              style={{ marginTop: 3 }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{opt.desc}</div>
            </div>
          </label>
        ))}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            onClick={saveSettings}
            style={{
              padding: "7px 18px", border: "1px solid #2563eb", borderRadius: 8,
              background: "#2563eb", color: "#fff", cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "inherit"
            }}
          >Save Changes</button>
        </div>
      </div>

      {/* Password */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>Password</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
          Change the password you use to sign in.
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" }}>New Password</label>
          <input
            type="password"
            value={pwForm.newPassword}
            onChange={e => { setPwForm(f => ({ ...f, newPassword: e.target.value })); setPwError(""); }}
            placeholder="At least 4 characters"
            style={inp}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" }}>Confirm New Password</label>
          <input
            type="password"
            value={pwForm.confirmPassword}
            onChange={e => { setPwForm(f => ({ ...f, confirmPassword: e.target.value })); setPwError(""); }}
            placeholder="Re-enter password"
            style={inp}
          />
        </div>
        {pwError && <div style={{ color: "#b91c1c", fontSize: 11, marginBottom: 12 }}>{pwError}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={changeMyPassword}
            style={{
              padding: "7px 18px", border: "1px solid #2563eb", borderRadius: 8,
              background: "#2563eb", color: "#fff", cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "inherit"
            }}
          >Change Password</button>
        </div>
      </div>
    </div>
  );

  // ── Manage Accounts ────────────────────────────────────
  const accountsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Manage Accounts ({accounts.length})</span>
        <button
          onClick={() => setAccountModal({ mode: "add" })}
          style={{ ...btn, background: "#2563eb", color: "#fff", borderColor: "#2563eb" }}
        >👤 Add Account</button>
      </div>

      <div style={{
        background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10,
        padding: "10px 14px", display: "flex", alignItems: "center", gap: 10
      }}>
        <span style={{ fontSize: 13 }}>ℹ️</span>
        <span style={{ fontSize: 12, color: "#0369a1", lineHeight: 1.5 }}>
          Accounts you manage here are only visible to you on this device.
        </span>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {accounts.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            No accounts yet. Click "Add Account" to create one.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Name","Username","Department","Role","Status","Created",""].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={td}>{a.name}</td>
                    <td style={td}>{a.username}</td>
                    <td style={td}>{a.department}</td>
                    <td style={td}>{a.role}</td>
                    <td style={td}><StatusPill status={a.status} /></td>
                    <td style={td}>{a.createdDate}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          onClick={() => setAccountModal({ mode: "edit", account: a })}
                          style={{ ...btn, fontSize: 11, padding: "4px 10px" }}
                        >Edit</button>
                        <button
                          onClick={() => setResetPwAccount(a)}
                          style={{ ...btn, fontSize: 11, padding: "4px 10px" }}
                        >Reset Password</button>
                        <button
                          onClick={() => toggleAccountStatus(a.id)}
                          style={{
                            ...btn, fontSize: 11, padding: "4px 10px",
                            color: a.status === "active" ? "#d97706" : "#15803d",
                            borderColor: a.status === "active" ? "#fde68a" : "#bbf7d0",
                          }}
                        >{a.status === "active" ? "Deactivate" : "Activate"}</button>
                        <button
                          onClick={() => deleteAccount(a.id)}
                          style={{ ...btn, fontSize: 11, padding: "4px 10px", color: "#b91c1c", borderColor: "#fca5a5" }}
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // ── Root ──────────────────────────────────────────────
  return (
    <div style={{
      display: "flex", minHeight: "100vh", fontFamily: "'DM Sans','Segoe UI',sans-serif",
      background: "#f1f5f9", color: "#1e293b",
      opacity: visible ? 1 : 0, transition: "opacity 0.4s ease"
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: "#fff", borderRight: "1px solid #e2e8f0",
        display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0,
        boxShadow: "2px 0 8px rgba(0,0,0,0.04)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px 20px", borderBottom: "1px solid #f1f5f9", marginBottom: 8 }}>
          <div style={{
            width: 34, height: 34, background: "#0f172a", borderRadius: 9,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 15
          }}>T</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>Tracktask</div>
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>City Administrator</div>
          </div>
        </div>
        <nav style={{ flex: 1 }}>
          {navItems.map(({ key, icon, label, badge }) => {
            const isActive = activeView === key;
            return (
              <button key={key} onClick={() => {
                if (key === "request") { setShowRequestModal(true); return; }
                if (key === "logout")  { setShowLogoutConfirm(true); return; }
                setActiveView(key);
              }} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 20px", border: "none",
                background: isActive ? "#f0fdf4" : "transparent",
                color: isActive ? "#15803d" : "#64748b",
                cursor: "pointer", fontSize: 13, fontWeight: isActive ? 600 : 400,
                textAlign: "left", borderLeft: isActive ? "3px solid #16a34a" : "3px solid transparent",
                transition: "all .15s", fontFamily: "inherit"
              }}>
                <span>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {badge > 0 && (
                  <span style={{
                    background: key === "approvals" ? "#ef4444" : "#2563eb",
                    color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 700,
                    padding: "1px 6px", minWidth: 18, textAlign: "center"
                  }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ margin: "16px 12px 0", padding: "10px 12px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: 10, color: "#15803d", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Logged in as</div>
          <div style={{ fontSize: 12, color: "#0f172a", fontWeight: 600, marginTop: 2 }}>{MY_DEPT}</div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{
          background: "#fff", borderBottom: "1px solid #e2e8f0",
          padding: "12px 24px", display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
        }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-0.5px", color: "#0f172a" }}>
              City Administrator Portal
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
              Tracktask · Document Tracking
            </p>
          </div>

          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 13 }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents..."
              style={{
                paddingLeft: 32, paddingRight: 14, paddingTop: 7, paddingBottom: 7,
                border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 12,
                background: "#f8fafc", color: "#1e293b", outline: "none", width: 200, fontFamily: "inherit"
              }}
            />
          </div>

          {/* Request button in header */}
          <button
            onClick={() => setShowRequestModal(true)}
            style={{
              padding: "7px 14px", border: "none", borderRadius: 8,
              background: "#2563eb", color: "#fff", cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap"
            }}
          >📤 Request</button>

          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setActiveView("notifications")}>
            <span style={{ fontSize: 20 }}>🔔</span>
            {newNotifCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4, background: "#ef4444",
                color: "#fff", borderRadius: 99, fontSize: 9, fontWeight: 700,
                padding: "0 4px", minWidth: 14, textAlign: "center",
                animation: "pulse 1.5s infinite"
              }}>{newNotifCount}</span>
            )}
          </div>

          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: "#dcfce7",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#15803d", fontWeight: 700, fontSize: 13
          }}>CA</div>
        </header>

        <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>
          {activeView === "dashboard"       && dashboardView}
          {activeView === "documents"       && documentsView}
          {activeView === "approvals"       && approvalsView}
          {activeView === "notifications"   && notificationsView}
          {activeView === "manage-accounts" && accountsView}
          {activeView === "settings"        && settingsView}
        </div>
      </main>

      {selectedDoc && renderModal(docs.find(d => d.id === selectedDoc.id) || selectedDoc)}

      {showRequestModal && (
        <RequestDocModal
          onClose={() => setShowRequestModal(false)}
          onSubmit={handleRequestSubmit}
        />
      )}

      {accountModal && (
        <AccountModal
          mode={accountModal.mode}
          account={accountModal.account}
          onClose={() => setAccountModal(null)}
          onSubmit={handleAccountSubmit}
        />
      )}

      {resetPwAccount && (
        <ResetPasswordModal
          account={resetPwAccount}
          onClose={() => setResetPwAccount(null)}
          onSubmit={handleResetPassword}
        />
      )}

      {showLogoutConfirm && (
        <Modal onClose={() => setShowLogoutConfirm(false)}>
          <div style={{ padding: "20px 20px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🚪</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 6 }}>
              Log out of Tracktask?
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
              Are you sure you want to log out? You'll need to sign in again to access the City Administrator Portal.
            </div>
          </div>
          <div style={{
            padding: "20px", display: "flex", gap: 8, justifyContent: "center"
          }}>
            <button onClick={() => setShowLogoutConfirm(false)} style={{
              padding: "7px 18px", border: "1px solid #e2e8f0", borderRadius: 8,
              background: "transparent", color: "#334155", cursor: "pointer",
              fontSize: 12, fontWeight: 500, fontFamily: "inherit"
            }}>Cancel</button>
            <button
              onClick={() => { setShowLogoutConfirm(false); navigate("/login"); }}
              style={{
                padding: "7px 18px", border: "1px solid #ef4444", borderRadius: 8,
                background: "#ef4444", color: "#fff", cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "inherit"
              }}
            >🚪 Log Out</button>
          </div>
        </Modal>
      )}

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}

// ── Inline form used by the "Request" nav page ────────────
function RequestForm({ onSubmit, onCancel, inlineMode }) {
  const [form, setForm] = useState({
    title: "",
    type: DOC_TYPES[0],
    origin: MY_DEPT,
    submittedBy: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const att = useAttachment();

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: "" }));
  }

  function validate() {
    const e = {};
    if (!form.title.trim())       e.title       = "Document title is required.";
    if (!form.submittedBy.trim()) e.submittedBy = "Submitted by is required.";
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    await onSubmit({ ...form, attachment: att.attachment });
    setSubmitting(false);
  }

  const inp = {
    width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8,
    background: "#f8fafc", color: "#1e293b", fontSize: 13, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };
  const errStyle = { color: "#b91c1c", fontSize: 11, marginTop: 3 };
  const label    = { fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" };
  const field    = { display: "flex", flexDirection: "column", marginBottom: 14 };

  return (
    <div>
      <div style={field}>
        <label style={label}>Document Title <span style={{ color: "#ef4444" }}>*</span></label>
        <input
          value={form.title}
          onChange={e => set("title", e.target.value)}
          placeholder="e.g. Resolution No. 2025-001 – Approving Annual Budget"
          style={{ ...inp, borderColor: errors.title ? "#fca5a5" : "#e2e8f0" }}
        />
        {errors.title && <div style={errStyle}>{errors.title}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={label}>Document Type</label>
          <select value={form.type} onChange={e => set("type", e.target.value)} style={inp}>
            {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={label}>Originating Office</label>
          <input
            value={form.origin}
            onChange={e => set("origin", e.target.value)}
            placeholder="City Administrator"
            style={inp}
          />
        </div>
      </div>

      <div style={field}>
        <label style={label}>Submitted By <span style={{ color: "#ef4444" }}>*</span></label>
        <input
          value={form.submittedBy}
          onChange={e => set("submittedBy", e.target.value)}
          placeholder="Full name of the requesting officer"
          style={{ ...inp, borderColor: errors.submittedBy ? "#fca5a5" : "#e2e8f0" }}
        />
        {errors.submittedBy && <div style={errStyle}>{errors.submittedBy}</div>}
      </div>

      <div style={field}>
        <label style={label}>Notes / Remarks</label>
        <textarea
          value={form.notes}
          onChange={e => set("notes", e.target.value)}
          placeholder="Brief description, purpose, or special instructions…"
          style={{ ...inp, minHeight: 72, resize: "vertical" }}
        />
      </div>

      <AttachmentField
        attachment={att.attachment}
        error={att.error}
        attaching={att.attaching}
        onChange={att.handleChange}
        onRemove={att.remove}
      />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} style={{
          padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 8,
          background: "transparent", color: "#334155", cursor: "pointer",
          fontSize: 12, fontWeight: 500, fontFamily: "inherit"
        }}>Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={submitting || att.attaching}
          style={{
            padding: "7px 18px", border: "1px solid #2563eb", borderRadius: 8,
            background: (submitting || att.attaching) ? "#93c5fd" : "#2563eb", color: "#fff",
            cursor: (submitting || att.attaching) ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 6
          }}
        >
          {submitting ? "Submitting…" : "📤 Submit to Mayor's Office"}
        </button>
      </div>
    </div>
  );
}