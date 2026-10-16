import { useState, useEffect } from "react";
import { Users, Plus, Edit, Trash2, Mail, Shield, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "../../services/supabaseClient";
import { ROLES, ROLE_LABELS } from "../../constants";
import { inp } from "../../utils/styles";
import Modal from "../../components/Modal";

const ROLE_OPTIONS = [
  { value: ROLES.MAYOR, label: ROLE_LABELS[ROLES.MAYOR] },
  { value: ROLES.CITY_ADMIN, label: ROLE_LABELS[ROLES.CITY_ADMIN] },
  { value: ROLES.CITY_ENRO, label: ROLE_LABELS[ROLES.CITY_ENRO] },
  { value: ROLES.SWM_SECRETARY, label: ROLE_LABELS[ROLES.SWM_SECRETARY] },
  { value: ROLES.DIVISION, label: ROLE_LABELS[ROLES.DIVISION] },
  { value: ROLES.HR, label: ROLE_LABELS[ROLES.HR] },
];

const DIVISIONS = [
  "Administrative and Permitting Division",
  "Environmental Information, Research and Development Division",
  "City Greening and Forestry Management Division",
  "Natural Resources Management and Safety Division",
  "Pollution Control and Management Division",
  "Septage Treatment and Management Division",
];

async function adminApi(action, params = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...params }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}

export default function HRAdmin() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  function initialForm() {
    return {
      email: "",
      full_name: "",
      role: ROLES.CITY_ADMIN,
      division: "",
      password: "",
      confirmPassword: "",
    };
  }

  async function fetchProfiles() {
    const data = await adminApi("list");
    const profilesWithRole = data.map((u) => {
      // We need to get the profile info for each user
      return u;
    });
    // Fetch profiles separately to get role and division
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("role", { ascending: true })
      .order("full_name", { ascending: true });
    if (error) throw error;
    setProfiles(profiles || []);
  }

  useEffect(() => {
    fetchProfiles().finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(initialForm());
    setShowModal(true);
  }

  function openEdit(profile) {
    setEditing(profile);
    setForm({
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      division: profile.division || "",
      password: "",
      confirmPassword: "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setError("");
  }

  async function handleSubmit() {
    if (!form.email || !form.full_name || !form.role) {
      setError("Email, full name, and role are required.");
      return;
    }
    if (form.role === ROLES.DIVISION && !form.division) {
      setError("Division is required for Division role.");
      return;
    }
    if (!editing && (!form.password || form.password.length < 8)) {
      setError("Password must be at least 8 characters for new accounts.");
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (editing) {
        await adminApi("update", {
          id: editing.id,
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          division: form.role === ROLES.DIVISION ? form.division : null,
          password: form.password || undefined,
        });
      } else {
        await adminApi("create", {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
          division: form.role === ROLES.DIVISION ? form.division : null,
        });
      }

      await fetchProfiles();
      closeModal();
    } catch (e) {
      setError(e.message || "Operation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(profile) {
    setDeleteConfirm(profile);
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setSubmitting(true);
    try {
      await adminApi("delete", { id: deleteConfirm.id });
      await fetchProfiles();
    } catch (e) {
      setError(e.message || "Delete failed.");
    } finally {
      setSubmitting(false);
      setDeleteConfirm(null);
    }
  }

  function getRoleBadgeColor(role) {
    const colors = {
      [ROLES.MAYOR]: "#7c3aed",
      [ROLES.CITY_ADMIN]: "#2563eb",
      [ROLES.CITY_ENRO]: "#0d9488",
      [ROLES.SWM_SECRETARY]: "#dc2626",
      [ROLES.DIVISION]: "#16a34a",
      [ROLES.HR]: "#ea580c",
    };
    return colors[role] || "#64748b";
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Loader2 className="animate-spin" size={32} style={{ color: "#2563eb", margin: "0 auto 16px" }} />
        <div style={{ color: "#64748b" }}>Loading accounts...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0f172a" }}>HR Admin Panel</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Manage staff accounts and roles</p>
        </div>
        <button onClick={openCreate} className="tt-btn-primary-lg" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Add Account
        </button>
      </div>

      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10,
          padding: "12px 16px", marginBottom: 16, color: "#b91c1c", fontSize: 13,
          display: "flex", alignItems: "center", gap: 8
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="tt-panel" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Name", "Email", "Role", "Division", "Actions"].map((h) => (
                <th key={h} style={{ ...td, textAlign: "left", padding: "12px 16px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...td, textAlign: "center", padding: 40, color: "#94a3b8" }}>
                  No accounts found.
                </td>
              </tr>
            ) : (
              profiles.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ ...td, padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.full_name}</div>
                  </td>
                  <td style={{ ...td, padding: "12px 16px", color: "#334155" }}>
                    <a href={`mailto:${p.email}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                      <Mail size={14} style={{ verticalAlign: "middle", marginRight: 4 }} /> {p.email}
                    </a>
                  </td>
                  <td style={{ ...td, padding: "12px 16px" }}>
                    <span style={{
                      display: "inline-block", padding: "4px 10px", borderRadius: 99,
                      fontSize: 11, fontWeight: 700, background: getRoleBadgeColor(p.role) + "15",
                      color: getRoleBadgeColor(p.role),
                    }}>
                      {ROLE_LABELS[p.role] || p.role}
                    </span>
                  </td>
                  <td style={{ ...td, padding: "12px 16px", color: p.division ? "#334155" : "#94a3b8" }}>
                    {p.division || (p.role === ROLES.DIVISION ? "Not assigned" : "—")}
                  </td>
                  <td style={{ ...td, padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => openEdit(p)}
                        className="tt-mini-btn"
                        title="Edit"
                        style={{ background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }}
                      >
                        <Edit size={14} />
                      </button>
                      {p.id !== (window.__CURRENT_USER_ID || "") && (
                        <button
                          onClick={() => handleDelete(p)}
                          className="tt-mini-btn tt-mini-danger"
                          title="Delete"
                          disabled={submitting}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal onClose={closeModal} style={{ maxWidth: 520 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{editing ? "Edit Account" : "Create Account"}</span>
            <button onClick={closeModal} className="tt-x-btn">X</button>
          </div>

          <div style={{ padding: 20 }}>
            {[
              { label: "Email *", key: "email", type: "email", placeholder: "user@city.gov.ph" },
              { label: "Full Name *", key: "full_name", type: "text", placeholder: "Juan Dela Cruz" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
                  {f.label}
                </label>
                <input
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  type={f.type}
                  style={inp}
                  disabled={editing}
                />
                {editing && f.key === "email" && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Email cannot be changed for existing accounts.</div>
                )}
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
                Role *
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value, division: "" }))}
                style={inp}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {form.role === ROLES.DIVISION && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
                  Division *
                </label>
                <select
                  value={form.division}
                  onChange={(e) => setForm((prev) => ({ ...prev, division: e.target.value }))}
                  style={inp}
                >
                  <option value="">Select division</option>
                  {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            {!editing && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
                    Password * (min 8 chars)
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password"
                    style={inp}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirm password"
                    style={inp}
                  />
                </div>
              </>
            )}

            {editing && (
              <div style={{ marginBottom: 14, padding: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
                  <Shield size={14} /> Leave password blank to keep current password.
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={closeModal} className="tt-btn-plain" disabled={submitting}>Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="tt-btn-primary-lg">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : editing ? "Save Changes" : "Create Account"}
            </button>
          </div>

          <style>{`
            .tt-x-btn { border:none; background:none; color:#64748b; cursor:pointer; font-size:14px; }
            .tt-btn-plain { padding:7px 14px; border-radius:8px; border:1px solid #e2e8f0;
              background:#fff; color:#334155; font-size:12px; cursor:pointer; font-family:inherit; }
            .tt-btn-primary-lg { display:inline-flex; align-items:center; gap:8px; padding:9px 18px;
              border:1px solid #2563eb; border-radius:10px; background:#2563eb; color:#fff;
              font-size:13px; font-weight:700; cursor:pointer; font-family:inherit;
              box-shadow:0 2px 6px rgba(37,99,235,0.25); transition:all .15s; white-space:nowrap; }
            .tt-btn-primary-lg:hover { background:#1d4ed8; border-color:#1d4ed8; box-shadow:0 4px 10px rgba(37,99,235,0.35); }
            .tt-btn-primary-lg:disabled { opacity:.6; cursor:not-allowed; box-shadow:none; }
            .tt-mini-btn { border:1px solid #e2e8f0; background:#fff; border-radius:6px; width:32px;
              height:32px; cursor:pointer; color:#475569; font-size:14px; display:flex; align-items:center; justify-content:center; }
            .tt-mini-btn:hover { background:#f1f5f9; border-color:#cbd5e1; }
            .tt-mini-btn:disabled { opacity:.35; cursor:not-allowed; }
            .tt-mini-danger { color:#b91c1c; border-color:#fca5a5; }
            .tt-mini-danger:hover { background:#fef2f2; border-color:#ef4444; }
            .animate-spin { animation: spin 1s linear infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal onClose={() => setDeleteConfirm(null)} style={{ maxWidth: 420 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Delete Account</span>
          </div>
          <div style={{ padding: 20, textAlign: "center" }}>
            <Trash2 size={48} style={{ color: "#ef4444", marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: "#334155", marginBottom: 8 }}>
              Are you sure you want to delete <strong>{deleteConfirm.full_name}</strong>?
            </p>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>
              {deleteConfirm.email}<br />
              This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setDeleteConfirm(null)} className="tt-btn-plain">Cancel</button>
              <button onClick={confirmDelete} disabled={submitting} className="tt-btn-primary-lg" style={{ background: "#ef4444", borderColor: "#ef4444" }}>
                {submitting ? <Loader2 className="animate-spin" size={16} /> : "Delete"}
              </button>
            </div>
          </div>
          <style>{`
            .tt-btn-plain { padding:7px 14px; border-radius:8px; border:1px solid #e2e8f0;
              background:#fff; color:#334155; font-size:12px; cursor:pointer; font-family:inherit; }
            .tt-btn-primary-lg { display:inline-flex; align-items:center; gap:8px; padding:9px 18px;
              border-radius:10px; color:#fff; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit;
              box-shadow:0 2px 6px rgba(239,68,68,0.25); transition:all .15s; white-space:nowrap; }
            .tt-btn-primary-lg:hover { box-shadow:0 4px 10px rgba(239,68,68,0.35); }
            .tt-btn-primary-lg:disabled { opacity:.6; cursor:not-allowed; box-shadow:none; }
            .animate-spin { animation: spin 1s linear infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>
        </Modal>
      )}
    </div>
  );
}

const td = { padding: "12px 16px", fontSize: 13, color: "#334155" };