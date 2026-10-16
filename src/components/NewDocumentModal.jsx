import { useState, useRef } from "react";
import Modal from "./Modal";
import {
  ROUTE_OPTIONS,
  routeOptionLabel,
  DEFAULT_ROUTE,
  URGENCY_LEVELS,
  DOC_TYPES,
  ROLES,
  ROLE_LABELS,
} from "../constants";
import { inp } from "../utils/styles";

const EMPTY_FORM = {
  title: "", type: "", origin: "", submittedBy: "",
  notes: "", attachment: null, urgency: "Normal", deadline: "",
};

export default function NewDocumentModal({ onClose, onSubmit, creatorProfile }) {
  const [form, setForm] = useState(EMPTY_FORM);
  
  // Auto-set route based on creator's role
  const getInitialRoute = () => {
    if (!creatorProfile) return [...DEFAULT_ROUTE];
    
    const { role } = creatorProfile;
    // Mayor and City Administrator can define their own route
    if (role === ROLES.MAYOR || role === ROLES.CITY_ADMIN) {
      return [...DEFAULT_ROUTE];
    }
    // All other roles: route goes to City Administrator → Mayor
    return [ROLES.CITY_ADMIN, ROLES.MAYOR];
  };
  
  const [route, setRoute] = useState(getInitialRoute);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // Disable route editing for non-Mayor/non-CityAdmin roles
  const canEditRoute = creatorProfile && (creatorProfile.role === ROLES.MAYOR || creatorProfile.role === ROLES.CITY_ADMIN);

  async function handleSubmit() {
    if (!form.title || !form.type || !form.origin || !form.submittedBy || route.length === 0) {
      setError("Please fill in all required fields and define at least one approver.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(form, route);
    } catch (e) {
      setError(e.message || "Could not submit document.");
    } finally {
      setSubmitting(false);
    }
  }

  function addRouteStep() {
    const used = new Set(route);
    const next = ROUTE_OPTIONS.find((o) => !used.has(o));
    if (next) setRoute((r) => [...r, next]);
  }

  function moveRouteStep(i, dir) {
    setRoute((r) => {
      const copy = [...r];
      const j = i + dir;
      if (j < 0 || j >= copy.length) return r;
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Add Document</span>
        <button onClick={onClose} className="tt-x-btn">X</button>
      </div>

      <div style={{ padding: 20 }}>
        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10,
            padding: "10px 14px", marginBottom: 14, color: "#b91c1c", fontSize: 12.5,
          }}>
            {error}
          </div>
        )}

        {[
          { label: "Document Title *", key: "title", placeholder: "e.g. Budget Proposal Q2" },
          { label: "Originating Unit *", key: "origin", placeholder: "e.g. Office of the Mayor" },
          { label: "Submitted By *", key: "submittedBy", placeholder: "Full name" },
        ].map((f) => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
              {f.label}
            </label>
            <input
              value={form[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              style={inp}
            />
          </div>
        ))}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
              Document Type *
            </label>
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} style={inp}>
              <option value="">Select type</option>
              {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
              Urgency Level
            </label>
            <select value={form.urgency} onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value }))} style={inp}>
              {URGENCY_LEVELS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
            Deadline
          </label>
          <input
            type="date"
            value={form.deadline}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
            style={{ ...inp, maxWidth: 220 }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
            Description / Notes
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Brief description of this document..."
            style={{ ...inp, minHeight: 70, resize: "vertical" }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5, fontWeight: 600 }}>
            Attachment (optional)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="file"
              ref={fileInputRef}
              id="attachment"
              style={{ ...inp, flex: 1, display: "none" }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  if (file.size > 10 * 1024 * 1024) {
                    setError("File size must be less than 10MB");
                    return;
                  }
                  setForm((p) => ({ ...p, attachment: file }));
                }
              }}
            />
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              {form.attachment instanceof File ? (
                <span style={{ fontSize: 12, color: "#334155" }}>
                  {form.attachment.name} ({(form.attachment.size / 1024).toFixed(1)} KB)
                </span>
              ) : (
                <span style={{ fontSize: 12, color: "#94a3b8" }}>No file selected</span>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="tt-btn"
                style={{ padding: "6px 12px", fontSize: 12 }}
              >
                {form.attachment instanceof File ? "Change" : "Choose File"}
              </button>
              {form.attachment instanceof File && (
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, attachment: null }))}
                  className="tt-btn tt-btn-danger"
                  style={{ padding: "6px 12px", fontSize: 12 }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            Max 10MB. Allowed: PDF, DOC, XLS, PNG, JPG, TXT
          </div>
        </div>

        {/* Approval route builder */}
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Approval Route</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
            {canEditRoute 
              ? "The document moves forward through each office in sequence. After the final approval it automatically routes back in reverse and ends with you to be marked DONE."
              : `Documents from ${creatorProfile?.role || "your office"} route to City Administrator for approval, then to the Mayor for final approval.`
            }
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div className="tt-step-num">1</div>
            <div className="tt-step-fixed">
              {canEditRoute 
                ? "Office of the City Mayor (you)"
                : creatorProfile?.role 
                  ? `${ROLE_LABELS[creatorProfile.role] || creatorProfile.role} (you)`
                  : "Your Office (you)"
              }
            </div>
          </div>

          {canEditRoute ? (
            route.map((opt, i) => {
              const available = ROUTE_OPTIONS.filter(
                (o) => o === opt || !route.includes(o)
              );
              return (
                <div key={`${opt}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <div className="tt-step-num">{i + 2}</div>
                  <select
                    value={opt}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRoute((r) => r.map((x, j) => (j === i ? v : x)));
                    }}
                    style={{ ...inp, flex: 1 }}
                  >
                    {available.map((o) => (
                      <option key={o} value={o}>{routeOptionLabel(o)}</option>
                    ))}
                  </select>
                  <button className="tt-mini-btn" title="Move up" disabled={i === 0}
                    onClick={() => moveRouteStep(i, -1)}>↑</button>
                  <button className="tt-mini-btn" title="Move down" disabled={i === route.length - 1}
                    onClick={() => moveRouteStep(i, 1)}>↓</button>
                  <button className="tt-mini-btn tt-mini-danger" title="Remove step"
                    onClick={() => setRoute((r) => r.filter((_, j) => j !== i))}>✕</button>
                </div>
              );
            })
          ) : (
            // Show fixed route for non-Mayor/non-CityAdmin
            [
              { role: ROLES.CITY_ADMIN, label: "City Administrator", step: 2 },
              { role: ROLES.MAYOR, label: "City Mayor (final approval)", step: 3 }
            ].map((s) => (
              <div key={s.role} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <div className="tt-step-num">{s.step}</div>
                <div className="tt-step-fixed">{s.label}</div>
              </div>
            ))
          )}

          {canEditRoute && (
            <button className="tt-add-step" onClick={addRouteStep}
              disabled={route.length >= ROUTE_OPTIONS.length}>
              + Add approver
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onClose} className="tt-btn-plain" disabled={submitting}>Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="tt-btn-primary-lg"
        >
          {submitting ? "Submitting..." : "Submit for Approval"}
        </button>
      </div>

      <style>{`
        .tt-x-btn { border:none; background:none; color:#64748b; cursor:pointer; font-size:14px; }
        .tt-btn-plain { padding:7px 14px; border-radius:8px; border:1px solid #e2e8f0;
          background:#fff; color:#334155; font-size:12px; cursor:pointer; font-family:inherit; }
        .tt-btn-danger { padding:7px 14px; border-radius:8px; border:1px solid #fca5a5;
          background:#fff; color:#b91c1c; font-size:12px; cursor:pointer; font-family:inherit; }
        .tt-btn-danger:hover { background:#fef2f2; border-color:#ef4444; }
      `}</style>
    </Modal>
  );
}
