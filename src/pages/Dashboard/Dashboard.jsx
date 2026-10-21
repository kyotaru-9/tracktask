import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, Bell, LogOut, Users, Share2,
  Plus, AlertTriangle, CheckCircle2, RotateCcw, Clock, Building2,
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
import TrackDocumentModal from "../../components/TrackDocumentModal";
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
  const [trackDocId, setTrackDocId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [notifFilter, setNotifFilter] = useState("all");

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

  const { docs, sharedDocs, notifications, profiles, loading, refreshDocs, refreshNotifications } =
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
  const rejectedCount = docs.filter((d) => d.status === "rejected").length;

  const filteredDocs = useMemo(() => {
    let list = docs;
    if (statusFilter !== "all") {
      list = list.filter((d) => d.status === statusFilter);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (d) =>
        d.tracking_id.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        (d.origin || "").toLowerCase().includes(q)
    );
  }, [docs, search, statusFilter]);

  const STATUS_FILTERS = [
    { key: "all", label: "All", count: docs.length },
    { key: "processing", label: "In Progress", count: activeCount },
    { key: "returning", label: "Returning", count: returningCount },
    { key: "done", label: "Done", count: doneCount },
    { key: "rejected", label: "Rejected", count: rejectedCount },
  ];

  const selectedDoc = selectedDocId
    ? docs.find((d) => d.id === selectedDocId) || null
    : null;

  if (!authChecked || !profile) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", padding: "20px 24px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
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
  function renderDocTable(list, showSteps = true, { showTrackId = true } = {}) {
    // Column widths: give Title enough room so text is not cut off.
    const colWidths = showSteps
      ? [110, 210, 120, 80, 110, 140, 100, 55]
      : [110, 250, 180, 80, 110, 100, 55];
    const widths = showTrackId
      ? colWidths
      : colWidths.slice(1);
    const minWidth = widths.reduce((a, b) => a + b, 0);

    const headers = ["Track ID", "Title", "Origin", "Urgency", "Deadline",
      showSteps && "Progress", "Status", "Action"].filter(Boolean);
    const visibleHeaders = showTrackId ? headers : headers.slice(1);

    if (!list.length) {
      return (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          No documents found.
        </div>
      );
    }
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth }}>
          <colgroup>
            {widths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {visibleHeaders.map((h) => (
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
                {showTrackId && <td style={{ ...td, color: "#2563eb", fontWeight: 600 }}>{d.tracking_id}</td>}
                <td style={{ ...td, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.title}>{d.title}</td>
                <td style={{ ...td, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.origin}>{d.origin}</td>
                <td style={td}><UrgencyPill level={d.urgency} /></td>
                <td style={td}><DeadlineTag deadline={d.deadline} status={d.status} stacked /></td>
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

  const firstName = (() => {
    const raw = (profile.full_name || profile.email || "").trim();
    if (!raw) return "";
    const HONORIFICS = ["hon", "mr", "mrs", "ms", "dr", "atty", "attorney", "sir", "madam"];
    const parts = raw.split(/\s+/);
    const first = parts[0].toLowerCase().replace(/\./g, "");
    if (HONORIFICS.includes(first)) {
      // Honorific only — use the full name instead of "Hon." / "Dr."
      return raw;
    }
    return parts[0];
  })();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const STAT_CARDS = [
    { label: "Active", value: activeCount, color: "#2563eb", bg: "#eff6ff", icon: FileText, sub: "In the approval pipeline" },
    { label: "Awaiting You", value: pendingForMe.length, color: "#d97706", bg: "#fffbeb", icon: Clock, sub: "Your turn to review" },
    { label: "Returning", value: returningCount, color: "#b45309", bg: "#fef3c7", icon: RotateCcw, sub: "Routing back in reverse" },
    { label: "Completed", value: doneCount, color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle2, sub: "Marked Done" },
  ];

  const PIPELINE = [
    { label: "In Progress", value: activeCount, color: "#2563eb" },
    { label: "Returning", value: returningCount, color: "#d97706" },
    { label: "Completed", value: doneCount, color: "#16a34a" },
    { label: "Rejected", value: rejectedCount, color: "#ef4444" },
  ];
  const pipelineTotal = PIPELINE.reduce((a, r) => a + r.value, 0);

  const dashboardView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Hero */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
            {greeting}, {firstName}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
            {roleTitle} ·{" "}
            {pendingForMe.length > 0
              ? `${pendingForMe.length} document${pendingForMe.length > 1 ? "s" : ""} need${pendingForMe.length > 1 ? "" : "s"} your action`
              : "Nothing needs your action right now"}
          </p>
        </div>
        <button className="tt-btn-primary-lg" onClick={() => setShowNewModal(true)}>
          <Plus size={15} /> New Document
        </button>
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
          padding: "10px 16px", fontSize: 12.5, color: "#b91c1c",
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          {overdueCount} document{overdueCount > 1 ? "s are" : " is"} past their deadline.
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="tt-stat-card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: s.bg, color: s.color,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <s.icon size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: "-1px", lineHeight: 1.15 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>{s.label}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Body — 60/40 */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, alignItems: "start" }}>

        {/* Awaiting your action */}
        <div className="tt-panel">
          <div className="tt-panel-head">
            <span style={{ fontWeight: 700, fontSize: 14 }}>Awaiting your action</span>
            {pendingForMe.length > 0 && <span className="tt-badge danger">{pendingForMe.length}</span>}
          </div>
          {pendingForMe.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              <CheckCircle2 size={28} style={{ color: "#86efac", marginBottom: 8 }} />
              <div>Nothing needs your action right now.</div>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {pendingForMe.slice(0, 5).map((d) => (
                <li
                  key={d.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 16px", borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: d.phase === "reverse" ? "#fef3c7" : "#eff6ff",
                    color: d.phase === "reverse" ? "#b45309" : "#1d4ed8",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {d.phase === "reverse" ? <RotateCcw size={16} /> : <Clock size={16} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13.5, fontWeight: 600, color: "#0f172a",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }} title={d.title}>
                      {d.title}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}>{d.tracking_id}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>·</span>
                      <span style={{
                        fontSize: 11, color: "#64748b",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160,
                      }} title={d.origin}>
                        {d.origin}
                      </span>
                      <UrgencyPill level={d.urgency} />
                    </div>
                  </div>

                  <DeadlineTag deadline={d.deadline} status={d.status} />
                  <button className="tt-view-btn" onClick={() => setSelectedDocId(d.id)}>Review</button>
                </li>
              ))}
            </ul>
          )}
          {pendingForMe.length > 5 && (
            <button
              onClick={() => setActiveView("documents")}
              style={{
                width: "100%", padding: "10px 16px", border: "none",
                borderTop: "1px solid #f1f5f9", background: "#fff",
                fontSize: 12.5, fontWeight: 600, color: "#2563eb",
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}
            >
              more... ({pendingForMe.length - 5} more)
            </button>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

          {/* Recent documents */}
          <div className="tt-panel">
            <div className="tt-panel-head">
              <span style={{ fontWeight: 700, fontSize: 14 }}>Recent documents</span>
              <button className="tt-btn" onClick={() => setActiveView("documents")}>View all</button>
            </div>
            {docs.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                No documents yet.
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {docs.slice(0, 5).map((d) => (
                  <li
                    key={d.id}
                    onClick={() => setSelectedDocId(d.id)}
                    style={{
                      padding: "11px 16px", borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    }}
                  >
                    <FileText size={15} style={{ color: "#94a3b8", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500, color: "#0f172a",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }} title={d.title}>
                        {d.title}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {d.tracking_id} · {new Date(d.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                    <StatusPill status={d.status} />
                  </li>
                ))}
              </ul>
            )}
            {docs.length > 5 && (
              <button
                onClick={() => setActiveView("documents")}
                style={{
                  width: "100%", padding: "10px 16px", border: "none",
                  borderTop: "1px solid #f1f5f9", background: "#fff",
                  fontSize: 12.5, fontWeight: 600, color: "#2563eb",
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}
              >
                more... ({docs.length - 5} more)
              </button>
            )}
          </div>

          {/* Pipeline breakdown */}
          <div className="tt-panel">
            <div className="tt-panel-head">
              <span style={{ fontWeight: 700, fontSize: 14 }}>Pipeline</span>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 13 }}>
              {PIPELINE.map((r) => (
                <div key={r.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: "#475569", fontWeight: 500 }}>{r.label}</span>
                    <span style={{ color: "#0f172a", fontWeight: 700 }}>{r.value}</span>
                  </div>
                  <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${pipelineTotal ? (r.value / pipelineTotal) * 100 : 0}%`,
                      background: r.color, borderRadius: 99,
                      transition: "width .3s ease",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const documentsView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.3px" }}>
            Documents
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748b" }}>
            {filteredDocs.length} of {docs.length} document{docs.length === 1 ? "" : "s"}
            {statusFilter !== "all" && ` · ${STATUS_FILTERS.find((f) => f.key === statusFilter)?.label}`}
          </p>
        </div>
        <button className="tt-btn-primary-lg" onClick={() => setShowNewModal(true)}>
          <Plus size={15} /> Add Document
        </button>
      </div>

      {/* Status filter chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "6px 13px", borderRadius: 99,
                border: `1px solid ${active ? "#2563eb" : "#e2e8f0"}`,
                background: active ? "#eff6ff" : "#fff",
                color: active ? "#1d4ed8" : "#64748b",
                fontSize: 12, fontWeight: active ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
              }}
            >
              {f.label}
              <span style={{
                fontSize: 10.5, fontWeight: 700,
                background: active ? "#2563eb" : "#f1f5f9",
                color: active ? "#fff" : "#64748b",
                borderRadius: 99, padding: "1px 6px", minWidth: 18, textAlign: "center",
              }}>
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 50/50 split — main table left, pending actions right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Left — main documents table */}
        <div style={{ borderTop: "1px solid #e2e8f0" }}>
          {renderDocTable(filteredDocs, false, { showTrackId: false })}
        </div>

        {/* Right — only the documents that require the user's action */}
        <div className="tt-panel">
          <div className="tt-panel-head">
            <span style={{ fontWeight: 700, fontSize: 14 }}>Pending Actions</span>
            {pendingForMe.length > 0 && (
              <span className="tt-badge danger">{pendingForMe.length}</span>
            )}
          </div>
          {pendingForMe.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 12.5 }}>
              No documents require your action right now.
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
              {pendingForMe.map((d) => (
                <li
                  key={d.id}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#2563eb", cursor: "pointer" }} onClick={() => setSelectedDocId(d.id)}>
                      {d.tracking_id}
                    </span>
                    <UrgencyPill level={d.urgency} />
                  </div>
                  <div
                    onClick={() => setSelectedDocId(d.id)}
                    style={{
                      fontSize: 13, fontWeight: 600, color: "#0f172a", cursor: "pointer",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}
                    title={d.title}
                  >
                    {d.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.origin}>
                    {d.origin}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <DeadlineTag deadline={d.deadline} status={d.status} />
                    <span style={{
                      fontSize: 10, fontWeight: 600, borderRadius: 99, padding: "2px 8px",
                      background: d.phase === "reverse" ? "#fef3c7" : "#dbeafe",
                      color: d.phase === "reverse" ? "#b45309" : "#1d4ed8",
                    }}>
                      {d.phase === "reverse" ? "Return leg" : "Forward leg"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button
                      className="tt-view-btn"
                      onClick={() => setSelectedDocId(d.id)}
                    >
                      Review
                    </button>
                    <button
                      className="tt-view-btn"
                      onClick={() => setTrackDocId(d.tracking_id)}
                    >
                      Open
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  const notificationsView = (() => {
    const visible = notifFilter === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications;

    // Group by Today / Yesterday / Earlier
    const groups = [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const buckets = [
      { title: "Today", from: startOfToday.getTime() },
      { title: "Yesterday", from: startOfYesterday.getTime(), to: startOfToday.getTime() },
      { title: "Earlier", to: startOfYesterday.getTime() },
    ];
    buckets.forEach((b) => {
      const items = visible.filter((n) => {
        const t = new Date(n.created_at).getTime();
        if (b.from && t < b.from) return false;
        if (b.to && t >= b.to) return false;
        return true;
      });
      if (items.length) groups.push({ title: b.title, items });
    });

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.3px" }}>
              Notifications
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748b" }}>
              {newNotifCount > 0
                ? `${newNotifCount} unread`
                : "You're all caught up"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "inline-flex", padding: 3, background: "#f1f5f9", borderRadius: 9 }}>
              {[
                { key: "all", label: "All" },
                { key: "unread", label: `Unread${newNotifCount ? ` (${newNotifCount})` : ""}` },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setNotifFilter(t.key)}
                  style={{
                    padding: "5px 13px", border: "none", borderRadius: 7,
                    background: notifFilter === t.key ? "#fff" : "transparent",
                    color: notifFilter === t.key ? "#0f172a" : "#64748b",
                    fontSize: 12, fontWeight: notifFilter === t.key ? 700 : 500,
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: notifFilter === t.key ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {newNotifCount > 0 && (
              <button className="tt-btn" onClick={handleMarkAllRead}>Mark all read</button>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="tt-panel">
            <div style={{ padding: 56, textAlign: "center", color: "#94a3b8" }}>
              <Bell size={30} style={{ marginBottom: 10, opacity: 0.6 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>
                {notifFilter === "unread" ? "No unread notifications" : "No notifications yet"}
              </div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>
                Activity on your documents will show up here.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {groups.map((g) => (
              <div key={g.title} className="tt-panel">
                <div className="tt-panel-head">
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{g.title}</span>
                  <span style={{ fontSize: 11.5, color: "#94a3b8" }}>{g.items.length}</span>
                </div>
                {g.items.map((n) => {
                  const tone = n.dot || "#2563eb";
                  return (
                    <div
                      key={n.id}
                      onClick={async () => {
                        if (!n.is_read) {
                          await markNotificationRead(n.id, profile.id);
                          await refreshNotifications();
                        }
                        if (n.document_id) setSelectedDocId(n.document_id);
                      }}
                      style={{
                        display: "flex", gap: 12, padding: "13px 16px",
                        borderBottom: "1px solid #f1f5f9", alignItems: "flex-start",
                        cursor: n.document_id ? "pointer" : "default",
                        background: n.is_read ? "#fff" : "#f8fbff",
                      }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                        background: `${tone}1a`, color: tone,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Bell size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, fontWeight: n.is_read ? 400 : 500 }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                          {new Date(n.created_at).toLocaleString("en-PH", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      </div>
                      {!n.is_read && (
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%", background: "#2563eb",
                          flexShrink: 0, marginTop: 5,
                        }} title="Unread" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  })();

  const sharedView = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.3px" }}>
          Shared with Me
        </h2>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748b" }}>
          {sharedDocs.length} document{sharedDocs.length === 1 ? "" : "s"} shared with you by your colleagues
        </p>
      </div>

      {sharedDocs.length === 0 ? (
        <div className="tt-panel">
          <div style={{ padding: 56, textAlign: "center", color: "#94a3b8" }}>
            <Share2 size={30} style={{ marginBottom: 10, opacity: 0.6 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>No documents shared with you yet</div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>
              When a colleague shares a document, it will appear here.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {sharedDocs.map((d) => (
            <div key={d.id} className="tt-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: "#eff6ff", color: "#2563eb",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <FileText size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13.5, fontWeight: 700, color: "#0f172a", lineHeight: 1.35,
                    overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }} title={d.title}>
                    {d.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#2563eb", fontWeight: 600, marginTop: 2 }}>{d.tracking_id}</div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                <Building2 size={12} style={{ flexShrink: 0, color: "#94a3b8" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.origin}>{d.origin}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <StatusPill status={d.status} />
                <UrgencyPill level={d.urgency} />
                <DeadlineTag deadline={d.deadline} status={d.status} />
              </div>

              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                background: "#f8fafc", borderRadius: 9, border: "1px solid #f1f5f9",
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: "#dbeafe", color: "#1d4ed8",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700,
                }}>
                  {(d.shared_by?.full_name || d.shared_by?.email || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 11.5, fontWeight: 600, color: "#334155",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }} title={d.shared_by?.full_name || d.shared_by?.email}>
                    {d.shared_by?.full_name || d.shared_by?.email}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8" }}>
                    Shared {d.share_created_at ? new Date(d.share_created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : ""}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <button className="tt-view-btn" style={{ flex: 1 }} onClick={() => setSelectedDocId(d.id)}>View</button>
                <button className="tt-view-btn" style={{ flex: 1 }} onClick={() => setTrackDocId(d.tracking_id)}>Open</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Layout ───────────────────────────────────────────────────────
  const navGroups = [
    {
      title: "Workspace",
      items: [
        { key: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { key: "documents", icon: FileText, label: "Documents" },
      ],
    },
    {
      title: "Collaborate",
      items: [
        { key: "shared", icon: Share2, label: "Shared with Me" },
        { key: "notifications", icon: Bell, label: "Notifications", badge: newNotifCount, badgeTone: "danger" },
      ],
    },
    ...(profile?.role === ROLES.HR
      ? [{ title: "Administration", items: [{ key: "hradmin", icon: Users, label: "HR Admin" }] }]
      : []),
  ];

  return (
    <div className="tt-shell">
      <aside className="tt-sidebar">
        <div className="tt-brand">
          <div className="tt-logo">T</div>
          <div style={{ minWidth: 0 }}>
            <div className="tt-logo-brand">Tracktask</div>
            <div className="tt-role-pill">{roleTitle}</div>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {navGroups.map((group) => (
            <div key={group.title} style={{ marginBottom: 18 }}>
              <div className="tt-nav-section">{group.title}</div>
              {group.items.map(({ key, icon: Icon, label, badge, badgeTone }) => (
                <button key={key}
                  className={"tt-nav-item" + (activeView === key ? " active" : "")}
                  onClick={() => setActiveView(key)}
                >
                  <span className="tt-nav-icon"><Icon size={16} /></span>
                  <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
                  {badge > 0 && <span className={"tt-badge" + (badgeTone ? " " + badgeTone : "")}>{badge}</span>}
                </button>
              ))}
            </div>
          ))}

          <div className="tt-nav-section">Account</div>
          <button className="tt-nav-item tt-logout" onClick={async () => { await signOut(); navigate("/login"); }}>
            <span className="tt-nav-icon"><LogOut size={16} /></span>
            <span style={{ textAlign: "left" }}>Sign out</span>
          </button>
        </nav>

        <div className="tt-user-chip">
          <div className="tt-user-avatar">
            {(profile.full_name || profile.email || "?").charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile.full_name || profile.email}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
              <span className="tt-online-dot" />
              <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile.role === ROLES.DIVISION ? profile.division : profile.role}
              </span>
            </div>
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

          {activeView === "documents" && (
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Track ID, title, or origin..."
              className="tt-search"
            />
          )}

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
          {!loading && activeView === "shared" && sharedView}
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
          profiles={profiles}
        />
      )}

      {trackDocId && (
        <TrackDocumentModal
          onClose={() => setTrackDocId(null)}
          initialId={trackDocId}
        />
      )}

      <style>{`
        .tt-shell { display:flex; height:100vh; font-family:'DM Sans','Segoe UI',sans-serif;
          background:#fff; color:#1e293b; overflow:hidden; }
        .tt-sidebar { width:256px; background:#fff; border-right:1px solid #e2e8f0;
          display:flex; flex-direction:column; padding:20px 14px 14px; flex-shrink:0; overflow-y:auto; }
        .tt-brand { display:flex; align-items:center; gap:12px; padding:0 8px 18px;
          border-bottom:1px solid #f1f5f9; margin-bottom:18px; }
        .tt-logo { width:40px; height:40px; background:linear-gradient(135deg,#2563eb,#1d4ed8);
          border-radius:11px; color:#fff; display:flex; align-items:center; justify-content:center;
          font-weight:800; font-size:17px; box-shadow:0 4px 12px rgba(37,99,235,0.3); flex-shrink:0; }
        .tt-logo-brand { font-weight:800; font-size:15.5px; color:#0f172a; letter-spacing:"0.3px"; }
        .tt-role-pill { display:inline-block; margin-top:4px; font-size:10px; font-weight:700;
          letter-spacing:0.4px; color:#1d4ed8; background:#eff6ff;
          border:1px solid #bfdbfe; border-radius:99px; padding:2px 9px;
          max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .tt-nav-section { font-size:10px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase;
          color:#94a3b8; padding:0 10px 7px; }
        .tt-nav-item { display:flex; align-items:center; gap:10px; width:100%; padding:9px 12px;
          margin-bottom:2px; border:none; background:transparent; color:#64748b; cursor:pointer;
          font-size:13px; font-family:inherit; text-align:left; border-radius:9px; transition:all .15s;
          position:relative; }
        .tt-nav-item:hover { background:#f8fafc; color:#0f172a; }
        .tt-nav-item.active { background:#eff6ff; color:#1d4ed8; font-weight:600; }
        .tt-nav-item.active::before { content:""; position:absolute; left:-14px; top:50%;
          transform:translateY(-50%); width:3px; height:20px; background:#2563eb; border-radius:0 3px 3px 0; }
        .tt-nav-icon { width:28px; height:28px; border-radius:8px; display:flex; align-items:center;
          justify-content:center; color:#94a3b8; flex-shrink:0; transition:all .15s; }
        .tt-nav-item:hover .tt-nav-icon { color:#475569; }
        .tt-nav-item.active .tt-nav-icon { color:#2563eb; }
        .tt-nav-item.tt-logout { margin-top:4px; color:#b91c1c; }
        .tt-nav-item.tt-logout:hover { background:#fef2f2; color:#b91c1c; }
        .tt-nav-item.tt-logout .tt-nav-icon { color:#b91c1c; }
        .tt-nav-item.tt-logout:hover .tt-nav-icon { color:#b91c1c; }
        .tt-badge { background:#2563eb; color:#fff; border-radius:99px; font-size:10px; font-weight:700;
          padding:1px 7px; min-width:18px; text-align:center; }
        .tt-badge.danger { background:#ef4444; }
        .tt-user-chip { margin:14px 0 0; padding:11px 12px; background:#f8fafc;
          border-radius:12px; border:1px solid #e2e8f0; display:flex; gap:10px; align-items:center; }
        .tt-user-avatar { width:34px; height:34px; border-radius:50%; flex-shrink:0;
          background:linear-gradient(135deg,#2563eb,#1d4ed8); color:#fff;
          display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; }
        .tt-online-dot { width:7px; height:7px; border-radius:50%; background:#16a34a; flex-shrink:0; }
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
