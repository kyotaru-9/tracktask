import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, Clock, Bell, LogOut, Users,
} from "lucide-react";
import useDashboardData from "../../hooks/useDashboardData";
import { getProfile, signOut, getSession } from "../../services/authService";
import {
  createDocument,
  actOnDocument,
  isMyTurn,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/documentService";
import {
  ROLES,
  ROLE_LABELS,
} from "../../constants";
import { daysUntil } from "../../utils/deadline";
import { th, td } from "../../utils/styles";

import UrgencyPill from "../../components/UrgencyPill";
import DeadlineTag from "../../components/DeadlineTag";
import StatusPill from "../../components/StatusPill";
import ApprovalSteps from "../../components/ApprovalSteps";
import DocDetailModal from "../../components/DocDetailModal";
import NewDocumentModal from "../../components/NewDocumentModal";
import { Skeleton, DashboardSkeleton } from "../../components/Skeleton";
import HRAdmin from "../HRAdmin/HRAdmin";

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [activeView, setActiveView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const session = await getSession();
      if (!session) {
        if (mounted) navigate("/login", { replace: true });
        return;
      }
      const p = await getProfile();
      if (!mounted) return;
      if (!p) {
        await signOut();
        navigate("/login", { replace: true });
        return;
      }
      setProfile(p);
      setAuthChecked(true);
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const { docs, notifications, loading, refreshDocs, refreshNotifications } =
    useDashboardData(profile);

  // ── Derived data ──────────────────────────────────────────────────
  const pendingForMe = useMemo(
    () => docs.filter(
      (d) =>
        (d.status === "processing" || d.status === "returning") &&
        isMyTurn(d, profile)
    ),
    [docs, profile]
  );
  const newNotifCount = notifications.filter((n) => !n.is_read).length;
  const overdueCount = docs.filter(
    (d) => (d.status === "processing" || d.status === "returning") &&
      d.deadline && daysUntil(d.deadline) < 0
  ).length;
  const activeCount = docs.filter((d) => d.status === "processing").length;
  const returningCount = docs.filter((d) => d.status === "returning").length;
  const doneCount = docs.filter((d) => d.status === "done").length;

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return docs;
    const q = search.toLowerCase();
    return docs.filter(
      (d) =>
        d.tracking_id.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        (d.origin || "").toLowerCase().includes(q)
    );
  }, [docs, search]);

  const selectedDoc = selectedDocId
    ? docs.find((d) => d.id === selectedDocId) || null
    : null;

  if (!authChecked || !profile) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "20px 24px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Skeleton width={240} height={24} radius={8} style={{ marginBottom: 16 }} />
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  // ── Actions ───────────────────────────────────────────────────────
  async function handleSubmitDoc(formData, routeSteps) {
    await createDocument(formData, routeSteps, profile);
    setShowNewModal(false);
    setActiveView("documents");
  }

  async function handleAction(docId, action, comment) {
    await actOnDocument(docId, action, comment, profile);
    setSelectedDocId(null);
    await Promise.all([refreshDocs()]);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(profile.id);
    await refreshNotifications();
  }

  // ── Table helper ─────────────────────────────────────────────────
  function renderDocTable(list, showSteps = true) {
    if (!list.length) {
      return (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          No documents found.
        </div>
      );
    }
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 860 }}>
          <colgroup>
            {(showSteps ? [140, null, 160, 100, 170, 210, 120, 70] : [140, null, 170, 100, 170, 120, 70]).map((w, i) => (
              <col key={i} style={w ? { width: w } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Track ID", "Title", "Origin", "Urgency", "Deadline",
                showSteps && "Progress", "Status", ""].filter(Boolean).map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id}
                style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: "#fff" }}
                onClick={() => setSelectedDocId(d.id)}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              >
                <td style={{ ...td, color: "#2563eb", fontWeight: 600 }}>{d.tracking_id}</td>
                <td style={{ ...td, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.title}>{d.title}</td>
                <td style={{ ...td, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.origin}>{d.origin}</td>
                <td style={td}><UrgencyPill level={d.urgency} /></td>
                <td style={td}><DeadlineTag deadline={d.deadline} status={d.status} /></td>
                {showSteps && <td style={td}><ApprovalSteps doc={d} /></td>}
                <td style={td}><StatusPill status={d.status} /></td>
                <td style={td}>
                  <button className="tt-view-btn" onClick={(e) => { e.stopPropagation(); setSelectedDocId(d.id); }}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Views ────────────────────────────────────────────────────────
  const roleTitle = profile.role === ROLES.DIVISION
    ? profile.division || "Division"
    : ROLE_LABELS[profile.role] || profile.role;

  const dashboardView = (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, alignItems: "start" }}>
      {/* Left column — 4 stats stacked vertically */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { label: "Active Documents", value: activeCount, color: "#2563eb", sub: "In the approval pipeline" },
          { label: "Awaiting My Action", value: pendingForMe.length, color: "#d97706", sub: "Your turn to review / receive" },
          { label: "Returning", value: returningCount, color: "#b45309", sub: "Routing back in reverse" },
          { label: "Completed", value: doneCount, color: "#16a34a", sub: "Marked Done by the Mayor" },
        ].map((s) => (
          <div key={s.label} className="tt-stat-card">
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: "-1px" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Right column — panels */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        {(pendingForMe.length > 0) && (
          <div className="tt-panel">
            <div className="tt-panel-head">
              <span style={{ fontWeight: 700, fontSize: 14 }}>Documents awaiting you</span>
              <button className="tt-btn" onClick={() => setActiveView("actions")}>Review all</button>
            </div>
            {renderDocTable(pendingForMe.slice(0, 5), false)}
          </div>
        )}

        <div className="tt-panel">
          <div className="tt-panel-head">
            <span style={{ fontWeight: 700, fontSize: 14 }}>Recent Documents</span>
            <button className="tt-btn" onClick={() => setActiveView("documents")}>View all</button>
          </div>
          {renderDocTable(docs.slice(0, 5), false)}
        </div>

        {overdueCount > 0 && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
            padding: "10px 16px", fontSize: 12.5, color: "#b91c1c",
          }}>
            {overdueCount} document{overdueCount > 1 ? "s are" : " is"} past their deadline.
          </div>
        )}
      </div>
    </div>
  );

  const documentsView = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
          Documents ({filteredDocs.length})
        </span>
        <button className="tt-btn-primary-lg" onClick={() => setShowNewModal(true)}>
          + Add Document
        </button>
      </div>
      {/* Full-bleed table: breaks out of the content padding to occupy the entire width */}
      <div style={{ margin: "0 -24px", borderTop: "1px solid #e2e8f0" }}>
        {renderDocTable(filteredDocs)}
      </div>
    </div>
  );

  const actionsView = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b", paddingBottom: 12 }}>
        Awaiting my action — {roleTitle}
      </span>
      {pendingForMe.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          No documents are waiting for you right now.
        </div>
      ) : (
        /* Full-bleed table: breaks out of the content padding to occupy the entire width */
        <div style={{ margin: "0 -24px", borderTop: "1px solid #e2e8f0", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 820 }}>
            <colgroup>
              {[140, null, 110, 100, 170, 120, 70].map((w, i) => (
                <col key={i} style={w ? { width: w } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Track ID", "Title", "Type", "Urgency", "Deadline", "Phase", "Actions"].map((h) => (
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
                .map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #f1f5f9", background: "#fff" }}>
                    <td style={{ ...td, color: "#2563eb", fontWeight: 600, cursor: "pointer" }}
                      onClick={() => setSelectedDocId(d.id)}>
                      {d.tracking_id}
                    </td>
                    <td style={{ ...td, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.title}>{d.title}</td>
                    <td style={td}>{d.doc_type}</td>
                    <td style={td}><UrgencyPill level={d.urgency} /></td>
                    <td style={td}><DeadlineTag deadline={d.deadline} status={d.status} /></td>
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, borderRadius: 99, padding: "2px 10px",
                        background: d.phase === "reverse" ? "#fef3c7" : "#dbeafe",
                        color: d.phase === "reverse" ? "#b45309" : "#1d4ed8",
                      }}>
                        {d.phase === "reverse" ? "Return leg" : "Forward leg"}
                      </span>
                    </td>
                    <td style={td}>
                      <button className="tt-view-btn" onClick={() => setSelectedDocId(d.id)}>Open</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const notificationsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Notifications</span>
        <button className="tt-btn" onClick={handleMarkAllRead}>Mark all read</button>
      </div>
      <div className="tt-panel">
        {notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>No notifications yet.</div>
        ) : notifications.map((n) => (
          <div key={n.id}
            onClick={async () => {
              if (!n.is_read) {
                await markNotificationRead(n.id, profile.id);
                await refreshNotifications();
              }
              if (n.document_id) setSelectedDocId(n.document_id);
            }}
            style={{
              display: "flex", gap: 10, padding: "12px 16px",
              borderBottom: "1px solid #f1f5f9", alignItems: "flex-start",
              cursor: n.document_id ? "pointer" : "default",
              background: n.is_read ? "transparent" : "#eff6ff",
            }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: n.dot, marginTop: 5, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {new Date(n.created_at).toLocaleString("en-PH", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
                {!n.is_read && <span style={{ color: "#2563eb", fontWeight: 600 }}> · New</span>}
              </div>
              <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{n.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Layout ───────────────────────────────────────────────────────
  const navItems = [
    { key: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { key: "documents", icon: FileText, label: "Documents" },
    { key: "actions", icon: Clock, label: "Pending Actions", badge: pendingForMe.length },
    { key: "notifications", icon: Bell, label: "Notifications", badge: newNotifCount },
    ...(profile?.role === ROLES.HR ? [{ key: "hradmin", icon: Users, label: "HR Admin" }] : []),
  ];

  return (
    <div className="tt-shell">
      <aside className="tt-sidebar">
        <div className="tt-brand">
          <div className="tt-logo">T</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", letterSpacing: "0.5px" }}>Tracktask</div>
            <div className="tt-role-pill">{roleTitle}</div>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          <div className="tt-nav-section">Menu</div>
          {navItems.map(({ key, icon: Icon, label, badge }) => (
            <button key={key}
              className={"tt-nav-item" + (activeView === key ? " active" : "")}
              onClick={() => setActiveView(key)}>
              <span className="tt-nav-icon"><Icon size={16} /></span>
              <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
              {badge > 0 && (
                <span className={"tt-badge" + (key === "actions" ? " danger" : "")}>{badge}</span>
              )}
            </button>
          ))}
          <button className="tt-nav-item tt-logout" onClick={async () => { await signOut(); navigate("/login"); }}>
            <span className="tt-nav-icon"><LogOut size={16} /></span><span style={{ textAlign: "left" }}>Logout</span>
          </button>
        </nav>

        <div className="tt-user-chip">
          <div className="tt-user-avatar">
            {(profile.full_name || profile.email || "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="tt-online-dot" />
              <span style={{ fontSize: 10, color: "#2563eb", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Logged in
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "#0f172a", fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile.full_name || profile.email}
            </div>
            {profile.role === ROLES.DIVISION && (
              <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.division}</div>
            )}
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header className="tt-topbar">
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
              {roleTitle} Portal
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
              Tracktask · Document Tracking
            </p>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Track ID, title, or origin..."
            className="tt-search"
          />

          <button className="tt-bell" onClick={() => setActiveView("notifications")}>
            <Bell size={18} />
            {newNotifCount > 0 && <span className="tt-bell-badge">{newNotifCount}</span>}
          </button>

          <div className="tt-avatar">
            {(profile.full_name || profile.email || "?").charAt(0).toUpperCase()}
          </div>
        </header>

        <div style={{ flex: 1, minHeight: 0, padding: "20px 24px", overflowY: "auto" }}>
          {loading && <DashboardSkeleton />}
          {!loading && activeView === "dashboard" && dashboardView}
          {!loading && activeView === "documents" && documentsView}
          {!loading && activeView === "actions" && actionsView}
          {!loading && activeView === "notifications" && notificationsView}
          {!loading && activeView === "hradmin" && <HRAdmin />}
        </div>
      </main>

      {selectedDoc && (
        <DocDetailModal
          doc={selectedDoc}
          profile={profile}
          onClose={() => setSelectedDocId(null)}
          onAction={handleAction}
        />
      )}

      {showNewModal && (
        <NewDocumentModal
          onClose={() => setShowNewModal(false)}
          onSubmit={handleSubmitDoc}
          creatorProfile={profile}
        />
      )}

      <style>{`
        .tt-shell { display:flex; height:100vh; font-family:'DM Sans','Segoe UI',sans-serif;
          background:#f1f5f9; color:#1e293b; overflow:hidden; }
        .tt-sidebar { width:248px; background:#fff; border-right:1px solid #e2e8f0;
          display:flex; flex-direction:column; padding:22px 14px 16px; flex-shrink:0; overflow-y:auto; }
        .tt-brand { display:flex; align-items:center; gap:12px; padding:0 10px 20px;
          border-bottom:1px solid #f1f5f9; margin-bottom:12px; }
        .tt-logo { width:42px; height:42px; background:linear-gradient(135deg,#2563eb,#1d4ed8);
          border-radius:12px; color:#fff; display:flex; align-items:center; justify-content:center;
          font-weight:800; font-size:17px; box-shadow:0 4px 12px rgba(37,99,235,0.3); flex-shrink:0; }
        .tt-role-pill { display:inline-block; margin-top:4px; font-size:10px; font-weight:700;
          letter-spacing:0.4px; color:#1d4ed8; background:#eff6ff;
          border:1px solid #bfdbfe; border-radius:99px; padding:2px 9px;
          max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .tt-nav-section { font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;
          color:#94a3b8; padding:4px 12px 8px; }
        .tt-nav-item { display:flex; align-items:center; gap:10px; width:100%; padding:9px 12px;
          margin-bottom:2px; border:none; background:transparent; color:#64748b; cursor:pointer;
          font-size:13px; font-family:inherit; text-align:left; border-radius:10px; transition:all .15s; }
        .tt-nav-item:hover { background:#f1f5f9; color:#0f172a; }
        .tt-nav-item.active { background:#eff6ff; color:#1d4ed8; font-weight:600; }
        .tt-nav-icon { width:30px; height:30px; border-radius:8px; display:flex; align-items:center;
          justify-content:center; background:#f1f5f9; color:#64748b; flex-shrink:0; transition:all .15s; }
        .tt-nav-item:hover .tt-nav-icon { background:#e2e8f0; color:#0f172a; }
        .tt-nav-item.active .tt-nav-icon { background:#2563eb; color:#fff; }
        .tt-nav-item.tt-logout { margin-top:10px; color:#b91c1c; }
        .tt-nav-item.tt-logout:hover { background:#fef2f2; color:#b91c1c; }
        .tt-nav-item.tt-logout .tt-nav-icon { background:#fef2f2; color:#b91c1c; }
        .tt-badge { background:#2563eb; color:#fff; border-radius:99px; font-size:10px; font-weight:700;
          padding:1px 7px; min-width:18px; text-align:center; }
        .tt-badge.danger { background:#ef4444; }
        .tt-user-chip { margin:14px 2px 0; padding:12px; background:#f8fafc;
          border-radius:12px; border:1px solid #e2e8f0; display:flex; gap:10px; align-items:center; }
        .tt-user-avatar { width:36px; height:36px; border-radius:50%; flex-shrink:0;
          background:#2563eb; color:#fff;
          display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; }
        .tt-online-dot { width:7px; height:7px; border-radius:50%; background:#16a34a; }
        .tt-topbar { background:#fff; border-bottom:1px solid #e2e8f0; padding:12px 24px; display:flex;
          align-items:center; gap:12px; box-shadow:0 1px 4px rgba(0,0,0,0.04); flex-shrink:0; }
        .tt-search { padding-left:32px; padding-right:14px; padding-top:7px; padding-bottom:7px;
          border:1px solid #e2e8f0; border-radius:9px; font-size:12px; background:#f8fafc;
          outline:none; width:260px; }
        .tt-bell { position:relative; border:none; background:none; cursor:pointer;
          display:flex; align-items:center; color:#475569; }
        .tt-bell-badge { position:absolute; top:-6px; right:-8px; background:#ef4444; color:#fff;
          border-radius:99px; font-size:9px; font-weight:700; padding:0 4px; min-width:14px; }
        .tt-avatar { width:32px; height:32px; border-radius:50%; background:#dbeafe; color:#1d4ed8;
          display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; }
        .tt-panel { background:#fff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden;
          box-shadow:0 1px 4px rgba(0,0,0,0.04); }
        .tt-panel-head { padding:12px 16px; border-bottom:1px solid #f1f5f9; display:flex;
          justify-content:space-between; align-items:center; }
        .tt-stat-card { background:#fff; border:1px solid #e2e8f0; border-radius:14px;
          padding:14px 16px; box-shadow:0 1px 4px rgba(0,0,0,0.04); }
        .tt-view-btn { padding:4px 10px; border:1px solid #e2e8f0; border-radius:7px; background:#fff;
          color:#334155; cursor:pointer; font-size:11px; }
        .tt-view-btn:hover { background:#f8fafc; border-color:#cbd5e1; }
        .tt-btn { display:inline-flex; align-items:center; gap:6px; padding:6px 14px;
          border:1px solid #bfdbfe; border-radius:8px; background:#eff6ff; color:#1d4ed8;
          font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; transition:all .15s; white-space:nowrap; }
        .tt-btn:hover { background:#dbeafe; border-color:#93c5fd; }
        .tt-btn:active { transform:translateY(1px); }
        .tt-btn-primary-lg { display:inline-flex; align-items:center; gap:8px; padding:9px 18px;
          border:1px solid #2563eb; border-radius:10px; background:#2563eb; color:#fff;
          font-size:13px; font-weight:700; cursor:pointer; font-family:inherit;
          box-shadow:0 2px 6px rgba(37,99,235,0.25); transition:all .15s; white-space:nowrap; }
        .tt-btn-primary-lg:hover { background:#1d4ed8; border-color:#1d4ed8;
          box-shadow:0 4px 10px rgba(37,99,235,0.35); }
        .tt-btn-primary-lg:active { transform:translateY(1px); }
        .tt-btn-primary-lg:disabled { opacity:.6; cursor:not-allowed; box-shadow:none; }
        .tt-step-num { width:22px; height:22px; border-radius:50%; background:#dbeafe; color:#1d4ed8;
          display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;
          flex-shrink:0; }
        .tt-step-fixed { flex:1; padding:7px 10px; border:1px solid #bfdbfe; border-radius:7px;
          font-size:13px; background:#eff6ff; color:#1d4ed8; font-weight:600; }
        .tt-mini-btn { border:1px solid #e2e8f0; background:#fff; border-radius:6px; width:26px;
          height:26px; cursor:pointer; color:#475569; font-size:12px; line-height:1; }
        .tt-mini-btn:disabled { opacity:.35; cursor:not-allowed; }
        .tt-mini-danger { color:#b91c1c; border-color:#fca5a5; }
        .tt-add-step { margin-top:10px; border:1px dashed #cbd5e1; background:#fff; color:#2563eb;
          border-radius:8px; padding:7px 12px; font-size:12px; cursor:pointer; width:100%; }
        .tt-add-step:disabled { opacity:.4; cursor:not-allowed; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:99px; }
      `}</style>
    </div>
  );
}
