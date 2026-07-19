import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Building2,
  FileText,
  Bell,
  ChevronDown,
  Plus,
  X,
  Calendar,
  CheckCircle2,
  Settings,
  LogOut,
  UserCircle,
  Building,
  Paperclip,
  History,
  Circle,
  Clock,
} from "lucide-react";

const DIVISIONS = [
  { id: "admin", name: "Administrative and Permitting Division" },
  { id: "envi", name: "Environmental Information, Research and Development Division" },
  { id: "greening", name: "City Greening and Forestry Management Division" },
  { id: "natres", name: "Natural Resources Management and Safety Division" },
  { id: "pollution", name: "Pollution Control and Management Division" },
  { id: "septage", name: "Septage Treatment & Management Division" },
];

const CURRENT_USER = "Maria Santos";

const INITIAL_DOCS = [
  {
    id: "APD-2026-0142",
    divisionId: "admin",
    title: "Business Permit Renewal Request — Lot 12 Commercial Block",
    source: "City Business Permits Office",
    receivedDate: "Jul 10, 2026 · 5:15 PM",
    priority: "Medium",
    workflowStatus: "Unread",
    state: "active",
    requestedBy: null,
    history: [
      { stage: "City Mayor", by: "Issued by the Office of the Mayor", status: "complete", date: "Jul 10, 2026 · 1:05 PM" },
      { stage: "City Administrator", by: "Endorsed", status: "complete", date: "Jul 10, 2026 · 2:40 PM" },
      { stage: "City ENRO", by: "Cleared for routing", status: "complete", date: "Jul 10, 2026 · 4:30 PM" },
      { stage: "Administrative and Permitting Division", by: "Received, awaiting review", status: "complete", date: "Jul 10, 2026 · 5:15 PM" },
    ],
  },
  {
    id: "APD-2026-0143",
    divisionId: "admin",
    title: "Memorandum on Updated Filing Procedures",
    source: "Office of the City Administrator",
    receivedDate: "Jul 11, 2026 · 10:30 AM",
    priority: "Low",
    workflowStatus: "In Progress",
    state: "pending",
    requestedBy: null,
    history: [
      { stage: "City Mayor", by: "Issued by the Office of the Mayor", status: "complete", date: "Jul 11, 2026 · 8:00 AM" },
      { stage: "City Administrator", by: "Endorsed", status: "complete", date: "Jul 11, 2026 · 9:15 AM" },
      { stage: "City ENRO", by: "Pending review", status: "current", date: null },
      { stage: "Administrative and Permitting Division", by: "Awaiting City ENRO clearance", status: "pending", date: null },
    ],
  },
  {
    id: "EIR-2026-0089",
    divisionId: "envi",
    title: "Water Quality Baseline Study — Barangay Lawaan Creek",
    source: "Environmental Management Bureau",
    receivedDate: "Jul 9, 2026 · 9:00 AM",
    priority: "Medium",
    workflowStatus: "In Progress",
    state: "pending",
    requestedBy: null,
    history: [
      { stage: "City Mayor", by: "Issued by the Office of the Mayor", status: "complete", date: "Jul 9, 2026 · 7:30 AM" },
      { stage: "City Administrator", by: "Pending review", status: "current", date: null },
      { stage: "City ENRO", by: "Awaiting City Administrator endorsement", status: "pending", date: null },
      { stage: "Environmental Information, Research and Development Division", by: "Awaiting City ENRO clearance", status: "pending", date: null },
    ],
  },
  {
    id: "CGF-2026-0144",
    divisionId: "greening",
    title: "Tree Cutting Permit Application — Purok 3 Roadway",
    source: "Barangay Council Office",
    receivedDate: "Jul 14, 2026 · 8:40 AM",
    priority: "High",
    workflowStatus: "Unread",
    state: "active",
    requestedBy: null,
    history: [
      { stage: "City Mayor", by: "Issued by the Office of the Mayor", status: "complete", date: "Jul 14, 2026 · 6:50 AM" },
      { stage: "City Administrator", by: "Endorsed", status: "complete", date: "Jul 14, 2026 · 7:20 AM" },
      { stage: "City ENRO", by: "Cleared for routing", status: "complete", date: "Jul 14, 2026 · 8:05 AM" },
      { stage: "City Greening and Forestry Management Division", by: "Received, awaiting review", status: "complete", date: "Jul 14, 2026 · 8:40 AM" },
    ],
  },
  {
    id: "NRM-2026-0071",
    divisionId: "natres",
    title: "Quarry Operation Safety Inspection Report",
    source: "Mines and Geosciences Bureau",
    receivedDate: "Jul 8, 2026 · 2:00 PM",
    priority: "High",
    workflowStatus: "In Progress",
    state: "active",
    requestedBy: null,
    history: [
      { stage: "City Mayor", by: "Issued by the Office of the Mayor", status: "complete", date: "Jul 8, 2026 · 10:00 AM" },
      { stage: "City Administrator", by: "Endorsed", status: "complete", date: "Jul 8, 2026 · 11:45 AM" },
      { stage: "City ENRO", by: "Pending review", status: "current", date: null },
      { stage: "Natural Resources Management and Safety Division", by: "Awaiting City ENRO clearance", status: "pending", date: null },
    ],
  },
  {
    id: "NRM-2026-0072",
    divisionId: "natres",
    title: "Landslide Risk Advisory — Sitio Kapayas",
    source: "City Disaster Risk Office",
    receivedDate: "Jul 12, 2026 · 7:15 AM",
    priority: "High",
    workflowStatus: "Unread",
    state: "overdue",
    requestedBy: null,
    history: [
      { stage: "City Mayor", by: "Issued by the Office of the Mayor", status: "complete", date: "Jul 12, 2026 · 6:00 AM" },
      { stage: "City Administrator", by: "Review overdue", status: "current", date: null },
      { stage: "City ENRO", by: "Awaiting City Administrator endorsement", status: "pending", date: null },
      { stage: "Natural Resources Management and Safety Division", by: "Awaiting City ENRO clearance", status: "pending", date: null },
    ],
  },
  {
    id: "NRM-2026-0073",
    divisionId: "natres",
    title: "Annual Resource Utilization Summary",
    source: "Provincial Environment Office",
    receivedDate: "Jul 5, 2026 · 4:00 PM",
    priority: "Low",
    workflowStatus: "Completed",
    state: "complete",
    requestedBy: null,
    history: [
      { stage: "City Mayor", by: "Issued by the Office of the Mayor", status: "complete", date: "Jul 5, 2026 · 9:00 AM" },
      { stage: "City Administrator", by: "Endorsed", status: "complete", date: "Jul 5, 2026 · 11:30 AM" },
      { stage: "City ENRO", by: "Cleared for routing", status: "complete", date: "Jul 5, 2026 · 2:10 PM" },
      { stage: "Natural Resources Management and Safety Division", by: "Received and completed", status: "complete", date: "Jul 5, 2026 · 4:00 PM" },
    ],
  },
  {
    id: "STM-2026-0055",
    divisionId: "septage",
    title: "Desludging Schedule Request — Zone 4",
    source: "City Health Office",
    receivedDate: "Jul 13, 2026 · 11:00 AM",
    priority: "Medium",
    workflowStatus: "In Progress",
    state: "pending",
    requestedBy: null,
    history: [
      { stage: "City Mayor", by: "Issued by the Office of the Mayor", status: "complete", date: "Jul 13, 2026 · 8:30 AM" },
      { stage: "City Administrator", by: "Endorsed", status: "complete", date: "Jul 13, 2026 · 9:45 AM" },
      { stage: "City ENRO", by: "Pending review", status: "current", date: null },
      { stage: "Septage Treatment & Management Division", by: "Awaiting City ENRO clearance", status: "pending", date: null },
    ],
  },
];

const INITIAL_NOTIFICATIONS = [
  {
    id: "n1",
    divisionId: "greening",
    docId: "CGF-2026-0144",
    text: "New document assigned to City Greening and Forestry Management Division",
    time: "10 min ago",
    read: false,
  },
  {
    id: "n2",
    divisionId: "natres",
    docId: "NRM-2026-0072",
    text: "Landslide Risk Advisory marked overdue in Natural Resources Management and Safety Division",
    time: "1 hr ago",
    read: false,
  },
];

const PRIORITY_STYLES = {
  High: { bg: "#FDEAEA", fg: "#C0392B" },
  Medium: { bg: "#FCF1DA", fg: "#9A6B00" },
  Low: { bg: "#EEF1EC", fg: "#586158" },
};

const WORKFLOW_STYLES = {
  Unread: { bg: "#FDEAEA", fg: "#C0392B" },
  "In Progress": { bg: "#E6EEFB", fg: "#2C5FB3" },
  Completed: { bg: "#E7F5EC", fg: "#1E7145" },
};

const STATE_DOT = {
  active: "#1E9E5A",
  pending: "#E3A61B",
  overdue: "#D64545",
  complete: "#8A9187",
};

const FILTERS = [
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "overdue", label: "Overdue" },
  { key: "complete", label: "Complete" },
];

let refCounter = 1;

export default function OfficeRoutingDashboard() {
  const [docs, setDocs] = useState(INITIAL_DOCS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState(null);
  const [highlightedDocId, setHighlightedDocId] = useState(null);
  const [descriptionDoc, setDescriptionDoc] = useState(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ divisionId: DIVISIONS[0].id, title: "", description: "", file: null });
  const [confirmedDoc, setConfirmedDoc] = useState(null);
  const [historyDoc, setHistoryDoc] = useState(null);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const docsByDivision = useMemo(() => {
    const map = {};
    DIVISIONS.forEach((d) => (map[d.id] = []));
    docs.forEach((doc) => {
      if (map[doc.divisionId]) map[doc.divisionId].push(doc);
    });
    return map;
  }, [docs]);

  const unreadNotifCount = notifications.filter((n) => !n.read).length;
  const selectedDivision = DIVISIONS.find((d) => d.id === selectedId) || null;
  const allSelectedDocs = selectedId ? docsByDivision[selectedId] : [];

  const stats = useMemo(() => {
    const s = { active: 0, pending: 0, overdue: 0, complete: 0 };
    allSelectedDocs.forEach((d) => {
      if (s[d.state] !== undefined) s[d.state] += 1;
    });
    return s;
  }, [allSelectedDocs]);

  const visibleDocs = filter ? allSelectedDocs.filter((d) => d.state === filter) : allSelectedDocs;

  // clear a notification-driven highlight after a few seconds
  useEffect(() => {
    if (!highlightedDocId) return;
    const t = setTimeout(() => setHighlightedDocId(null), 2800);
    return () => clearTimeout(t);
  }, [highlightedDocId]);

  function selectDivision(id) {
    if (id === selectedId) {
      setSelectedId(null);
      setFilter(null);
      setHighlightedDocId(null);
      return;
    }
    setSelectedId(id);
    setFilter(null);
    setHighlightedDocId(null);
  }

  function openNotification(notif) {
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
    setSelectedId(notif.divisionId);
    setFilter(null);
    setHighlightedDocId(notif.docId);
    setNotifOpen(false);
  }

  function submitRequest() {
    if (!requestForm.title.trim()) return;
    refCounter += 1;
    const requestingDivisionName = DIVISIONS.find((d) => d.id === requestForm.divisionId).name;
    const newDoc = {
      id: `REQ-2026-${String(refCounter).padStart(4, "0")}`,
      divisionId: requestForm.divisionId,
      title: requestForm.title.trim(),
      description: requestForm.description.trim(),
      attachmentName: requestForm.file ? requestForm.file.name : null,
      source: "Office of the Document Requester",
      receivedDate: "Jul 14, 2026 · 9:13 AM",
      priority: "Medium",
      workflowStatus: "Unread",
      state: "active",
      history: [
        { stage: "Requested", by: requestingDivisionName, status: "complete", date: "Jul 14, 2026 · 9:13 AM" },
        { stage: "City ENRO", by: "Pending review", status: "current", date: null },
        { stage: "City Administrator", by: "Awaiting City ENRO approval", status: "pending", date: null },
        { stage: "Mayor", by: "Awaiting City Administrator approval", status: "pending", date: null },
        { stage: "Returned to Division", by: requestingDivisionName, status: "pending", date: null },
      ],
    };
    setDocs((prev) => [...prev, newDoc]);
    setConfirmedDoc(newDoc);
  }

  function closeRequestModal() {
    setRequestOpen(false);
    setConfirmedDoc(null);
    setRequestForm({ divisionId: DIVISIONS[0].id, title: "", description: "", file: null });
  }

  function finishConfirmation() {
    setSelectedId(confirmedDoc.divisionId);
    setFilter(null);
    setHighlightedDocId(confirmedDoc.id);
    closeRequestModal();
  }

  return (
    <div
      style={{
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        background: "#F6F7F5",
        minHeight: "100%",
        color: "#26302B",
        paddingBottom: 40,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .rd-card { cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease, transform .1s ease; }
        .rd-card:hover { box-shadow: 0 8px 20px -10px rgba(30,113,69,0.28); transform: translateY(-1px); }
        .rd-card:focus-visible { outline: 2px solid #1E7145; outline-offset: 2px; }
        .rd-doc-card { transition: background .15s ease, box-shadow .15s ease; }
        .rd-doc-card:hover { background: #FAFBF9; box-shadow: 0 4px 14px -8px rgba(30,113,69,0.25); }
        .rd-doc-card:focus-visible { outline: 2px solid #1E7145; outline-offset: 2px; }
        .rd-btn { cursor: pointer; transition: background .15s ease, opacity .15s ease; }
        .rd-btn:hover { opacity: .92; }
        .rd-chip { cursor: pointer; transition: background .15s ease, color .15s ease, border-color .15s ease; }
        .rd-icon-btn { cursor: pointer; background: none; border: none; }
        .rd-modal-overlay { position: fixed; inset: 0; background: rgba(20,30,24,0.45); display: flex; align-items: center; justify-content: center; z-index: 60; }
        .rd-dropdown { position: absolute; top: calc(100% + 10px); background: #fff; border: 1px solid #E4E7E1; border-radius: 10px; box-shadow: 0 12px 28px -12px rgba(20,30,24,0.25); z-index: 40; }
        .rd-notif-item { cursor: pointer; transition: background .15s ease; }
        .rd-notif-item:hover { background: #F6F7F5; }
        .rd-menu-item { cursor: pointer; transition: background .15s ease; }
        .rd-menu-item:hover { background: #F6F7F5; }
        @keyframes rd-highlight-pulse {
          0% { box-shadow: 0 0 0 0 rgba(30,113,69,0.35); }
          70% { box-shadow: 0 0 0 8px rgba(30,113,69,0); }
          100% { box-shadow: 0 0 0 0 rgba(30,113,69,0); }
        }
        .rd-highlighted { animation: rd-highlight-pulse 1.4s ease-out 2; border-color: #1E7145 !important; }
        input[type="text"]:focus, select:focus { outline: 2px solid #1E7145; outline-offset: 1px; }

        @keyframes rd-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rd-fade-in-scale {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes rd-fade-in-plain {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .rd-fade-in { animation: rd-fade-in 0.28s ease both; }
        .rd-fade-in-scale { animation: rd-fade-in-scale 0.22s ease both; }
        .rd-fade-in-overlay { animation: rd-fade-in-plain 0.18s ease both; }
        .rd-fade-in-fast { animation: rd-fade-in 0.18s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .rd-fade-in, .rd-fade-in-scale, .rd-fade-in-overlay, .rd-fade-in-fast, .rd-highlighted { animation: none !important; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #E4E7E1",
          padding: "18px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "#1E7145",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Building2 size={22} color="#fff" strokeWidth={1.8} />
          </div>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>
              City Environment &amp; Natural Resources Division
            </h1>
            <p style={{ fontSize: 13, color: "#7A8279", margin: "2px 0 0" }}>
              Document Tracking with Real-Time Notification
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* Notifications */}
          <div style={{ position: "relative" }} ref={notifRef}>
            <button
              className="rd-icon-btn"
              onClick={() => {
                setNotifOpen((o) => !o);
                setProfileOpen(false);
              }}
              aria-label="Notifications"
              style={{ position: "relative", display: "flex" }}
            >
              <Bell size={20} color="#4B534B" strokeWidth={1.8} />
              {unreadNotifCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    background: "#D64545",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    width: 17,
                    height: 17,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="rd-dropdown rd-fade-in-fast" style={{ right: 0, width: 320 }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #EEF0EC", fontSize: 13, fontWeight: 700 }}>
                  Notifications
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 13, color: "#8A9187" }}>You're all caught up.</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="rd-notif-item"
                      onClick={() => openNotification(n)}
                      style={{
                        padding: "12px 16px",
                        display: "flex",
                        gap: 10,
                        borderBottom: "1px solid #F3F5F1",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          marginTop: 5,
                          flexShrink: 0,
                          background: n.read ? "#D9DED7" : "#D64545",
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: "#26302B" }}>
                          {n.text}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#8A9187", marginTop: 2 }}>{n.time}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Profile */}
          <div style={{ position: "relative" }} ref={profileRef}>
            <div
              onClick={() => {
                setProfileOpen((o) => !o);
                setNotifOpen(false);
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "#1E7145",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                MS
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Maria Santos</div>
                <div style={{ fontSize: 12, color: "#8A9187" }}>Document Officer</div>
              </div>
              <ChevronDown size={16} color="#8A9187" />
            </div>

            {profileOpen && (
              <div className="rd-dropdown rd-fade-in-fast" style={{ right: 0, width: 200 }}>
                {[
                  { icon: UserCircle, label: "View Profile" },
                  { icon: Settings, label: "Account Settings" },
                  { icon: LogOut, label: "Sign Out" },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="rd-menu-item"
                    onClick={() => setProfileOpen(false)}
                    style={{
                      padding: "11px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13.5,
                      color: "#3A423A",
                    }}
                  >
                    <Icon size={15} strokeWidth={1.8} />
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>

          <button
            className="rd-btn"
            onClick={() => setRequestOpen(true)}
            style={{
              background: "#1E7145",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Plus size={16} /> Request Document
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 20px" }}>
        {/* Division grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {DIVISIONS.map((d) => {
            const list = docsByDivision[d.id];
            const count = list.length;
            const isSelected = d.id === selectedId;
            return (
              <div
                key={d.id}
                className="rd-card"
                role="button"
                tabIndex={0}
                onClick={() => selectDivision(d.id)}
                onKeyDown={(e) => (e.key === "Enter" ? selectDivision(d.id) : null)}
                style={{
                  position: "relative",
                  background: "#fff",
                  border: `1.5px solid ${isSelected ? "#1E7145" : "#E4E7E1"}`,
                  borderRadius: 12,
                  padding: "22px 20px",
                  textAlign: "center",
                }}
              >
                {count > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -10,
                      right: -10,
                      background: "#1E7145",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid #fff",
                    }}
                  >
                    {count}
                  </span>
                )}
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: "#E7F5EC",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px",
                  }}
                >
                  <FileText size={19} color="#1E7145" strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
                <div style={{ fontSize: 12.5, color: "#8A9187" }}>
                  {count === 0 ? "No documents" : `${count} document${count === 1 ? "" : "s"}`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Assigned documents panel */}
        {selectedDivision && (
          <div
            key={selectedId}
            className="rd-fade-in"
            style={{
              marginTop: 26,
              background: "#fff",
              border: "1px solid #E4E7E1",
              borderRadius: 12,
              padding: "20px 22px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "#8A9187",
                    marginBottom: 4,
                  }}
                >
                  ASSIGNED DOCUMENTS
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{selectedDivision.name}</h2>
                <p style={{ fontSize: 13, color: "#8A9187", margin: "4px 0 0" }}>
                  {visibleDocs.length} of {allSelectedDocs.length} document{allSelectedDocs.length === 1 ? "" : "s"}{" "}
                  {filter ? `shown · filtered by ${FILTERS.find((f) => f.key === filter).label}` : "routed to this division"}
                </p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="rd-icon-btn"
                style={{ color: "#8A9187", padding: 4 }}
                aria-label="Close panel"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter chips */}
            <div style={{ display: "flex", gap: 10, margin: "16px 0 18px", flexWrap: "wrap" }}>
              {FILTERS.map(({ key, label }) => {
                const active = filter === key;
                return (
                  <span
                    key={key}
                    className="rd-chip"
                    onClick={() => setFilter(active ? null : key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      padding: "6px 12px",
                      borderRadius: 20,
                      border: `1.5px solid ${active ? "#1E7145" : "#E4E7E1"}`,
                      background: active ? "#E7F5EC" : "#fff",
                      color: active ? "#1E7145" : "#5B6058",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: STATE_DOT[key],
                        display: "inline-block",
                      }}
                    />
                    {label}
                    <span style={{ fontWeight: 700 }}>{stats[key]}</span>
                  </span>
                );
              })}
              {filter && (
                <span
                  className="rd-chip"
                  onClick={() => setFilter(null)}
                  style={{
                    fontSize: 13,
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: "1.5px dashed #C6CDC3",
                    color: "#5B6058",
                    fontWeight: 600,
                  }}
                >
                  Show all
                </span>
              )}
            </div>

            <div style={{ height: 1, background: "#EEF0EC", marginBottom: 16 }} />

            {visibleDocs.length === 0 ? (
              <div style={{ color: "#8A9187", fontSize: 14, padding: "12px 0" }}>
                {allSelectedDocs.length === 0
                  ? "No documents have been routed to this division yet."
                  : `No documents match "${FILTERS.find((f) => f.key === filter)?.label}". Try Show all.`}
              </div>
            ) : (
              <div key={filter || "all"} className="rd-fade-in-fast" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {visibleDocs.map((doc) => {
                  const isHighlighted = doc.id === highlightedDocId;
                  const priorityStyle = PRIORITY_STYLES[doc.priority] || PRIORITY_STYLES.Low;
                  const workflowStyle = WORKFLOW_STYLES[doc.workflowStatus] || WORKFLOW_STYLES.Unread;
                  return (
                    <div
                      key={doc.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setHistoryDoc(doc)}
                      onKeyDown={(e) => (e.key === "Enter" ? setHistoryDoc(doc) : null)}
                      className={`rd-doc-card ${isHighlighted ? "rd-highlighted" : ""}`}
                      style={{
                        display: "flex",
                        gap: 12,
                        padding: 12,
                        borderRadius: 8,
                        border: "1.5px solid transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 7,
                          background: "#E7F5EC",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        <FileText size={15} color="#1E7145" strokeWidth={1.8} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{doc.title}</div>
                        <div style={{ fontSize: 12.5, color: "#8A9187", margin: "2px 0 8px" }}>{doc.id}</div>
                        {doc.description && (
                          <p style={{ fontSize: 13, color: "#4B534B", margin: "0 0 8px" }}>{doc.description}</p>
                        )}
                        {doc.attachmentName && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 12.5,
                              color: "#5B6058",
                              marginBottom: 9,
                            }}
                          >
                            <Paperclip size={13} strokeWidth={1.8} /> {doc.attachmentName}
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 16,
                            fontSize: 12.5,
                            color: "#6B726A",
                            marginBottom: 9,
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Building size={13} strokeWidth={1.8} /> {doc.source}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Calendar size={13} strokeWidth={1.8} /> {doc.receivedDate}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              background: priorityStyle.bg,
                              color: priorityStyle.fg,
                              fontSize: 11.5,
                              fontWeight: 600,
                              padding: "3px 9px",
                              borderRadius: 5,
                            }}
                          >
                            {doc.priority} priority
                          </span>
                          <span
                            style={{
                              background: workflowStyle.bg,
                              color: workflowStyle.fg,
                              fontSize: 11.5,
                              fontWeight: 600,
                              padding: "3px 9px",
                              borderRadius: 5,
                            }}
                          >
                            {doc.workflowStatus}
                          </span>
                        </div>
                  <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 18,
    marginTop: 12,
    flexWrap: "wrap",
  }}
>
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      setDescriptionDoc(doc);
    }}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 5,
      background: "none",
      border: "none",
      color: "#1E7145",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      padding: 0,
    }}
  >
    <FileText size={13} strokeWidth={1.8} />
    View document description
  </button>

  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      setHistoryDoc(doc);
    }}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 5,
      background: "none",
      border: "none",
      color: "#1E7145",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      padding: 0,
    }}
  >
    <History size={13} strokeWidth={1.8} />
    View movement history
  </button>
</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Request Document modal */}
      {requestOpen && (
        <div className="rd-modal-overlay rd-fade-in-overlay" onClick={closeRequestModal}>
          <div
            key={confirmedDoc ? "confirmation" : "form"}
            className="rd-fade-in-scale"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              width: "min(420px, 90vw)",
              padding: "22px 22px 20px",
            }}
          >
            {!confirmedDoc ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Request Document</h3>
                  <button onClick={closeRequestModal} className="rd-icon-btn" style={{ color: "#8A9187" }} aria-label="Close">
                    <X size={18} />
                  </button>
                </div>

                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#5B6058" }}>Requested by the division of</label>
                <select
                  value={requestForm.divisionId}
                  onChange={(e) => setRequestForm((f) => ({ ...f, divisionId: e.target.value }))}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    marginBottom: 10,
                    padding: "9px 10px",
                    borderRadius: 7,
                    border: "1px solid #E4E7E1",
                    fontSize: 13.5,
                    background: "#fff",
                  }}
                >
                  {DIVISIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>

                <p
                  style={{
                    fontSize: 12,
                    color: "#5B6058",
                    background: "#F2F6F2",
                    border: "1px solid #E4E7E1",
                    borderRadius: 7,
                    padding: "10px 12px",
                    margin: "0 0 14px",
                    lineHeight: 1.5,
                  }}
                >
                  This document will automatically be sent to the City ENRO for approval. Once the
                  City ENRO approves it, it will automatically move to the City Administrator, then
                  the Mayor for final approval. After final approval, it will be sent back to the
                  division it was requested from.
                </p>

                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#5B6058" }}>Document title</label>
                <input
                  type="text"
                  value={requestForm.title}
                  onChange={(e) => setRequestForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Request for Site Inspection — Purok 5"
                  style={{
                    width: "100%",
                    marginTop: 6,
                    marginBottom: 14,
                    padding: "9px 10px",
                    borderRadius: 7,
                    border: "1px solid #E4E7E1",
                    fontSize: 13.5,
                    boxSizing: "border-box",
                  }}
                />

                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#5B6058" }}>Description</label>
                <textarea
                  value={requestForm.description}
                  onChange={(e) => setRequestForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Add context the receiving division should know"
                  rows={3}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    marginBottom: 14,
                    padding: "9px 10px",
                    borderRadius: 7,
                    border: "1px solid #E4E7E1",
                    fontSize: 13.5,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />

                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#5B6058" }}>Attach file (optional)</label>
                <div
                  style={{
                    marginTop: 6,
                    marginBottom: 18,
                    padding: "9px 10px",
                    borderRadius: 7,
                    border: "1px dashed #C6CDC3",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#FAFBF9",
                  }}
                >
                  <Paperclip size={16} color="#5B6058" strokeWidth={1.8} />
                  <label
                    className="rd-btn"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#1E7145",
                      cursor: "pointer",
                    }}
                  >
                    Choose file
                    <input
                      type="file"
                      onChange={(e) => setRequestForm((f) => ({ ...f, file: e.target.files[0] || null }))}
                      style={{ display: "none" }}
                    />
                  </label>
                  <span
                    style={{
                      fontSize: 12.5,
                      color: "#8A9187",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {requestForm.file ? requestForm.file.name : "No file chosen"}
                  </span>
                </div>

                <button
                  className="rd-btn"
                  onClick={submitRequest}
                  disabled={!requestForm.title.trim()}
                  style={{
                    width: "100%",
                    background: requestForm.title.trim() ? "#1E7145" : "#B9C2B6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "11px 0",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: requestForm.title.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Submit Request
                </button>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "10px 4px" }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "#E7F5EC",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <CheckCircle2 size={26} color="#1E7145" strokeWidth={1.8} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>Request submitted</h3>
                <p style={{ fontSize: 13.5, color: "#6B726A", margin: "0 0 4px" }}>
                  Requested by {DIVISIONS.find((d) => d.id === confirmedDoc.divisionId).name} · now pending City ENRO approval
                </p>
                <p style={{ fontSize: 12.5, color: "#8A9187", margin: confirmedDoc.attachmentName ? "0 0 6px" : "0 0 20px" }}>
                  Tracking number {confirmedDoc.id}
                </p>
                {confirmedDoc.attachmentName && (
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "#5B6058",
                      margin: "0 0 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Paperclip size={13} strokeWidth={1.8} /> {confirmedDoc.attachmentName}
                  </p>
                )}
                <button
                  className="rd-btn"
                  onClick={finishConfirmation}
                  style={{
                    width: "100%",
                    background: "#1E7145",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "11px 0",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
{descriptionDoc && (
  <div
    className="rd-modal-overlay rd-fade-in-overlay"
    onClick={() => setDescriptionDoc(null)}
  >
    <div
      className="rd-fade-in-scale"
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "#fff",
        borderRadius: 12,
        width: "min(500px, 90vw)",
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            Document Description
          </h3>

          <p
            style={{
              marginTop: 4,
              color: "#8A9187",
              fontSize: 13,
            }}
          >
            {descriptionDoc.id}
          </p>
        </div>

        <button
          className="rd-icon-btn"
          onClick={() => setDescriptionDoc(null)}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <strong>Title</strong>

        <p style={{ marginTop: 6 }}>
          {descriptionDoc.title}
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <strong>Description</strong>

        <p
          style={{
            marginTop: 6,
            lineHeight: 1.7,
            color: "#555",
          }}
        >
          {descriptionDoc.description || "No description available."}
        </p>
      </div>

      <button
        className="rd-btn"
        onClick={() => setDescriptionDoc(null)}
        style={{
          width: "100%",
          background: "#1E7145",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "10px",
          fontWeight: 600,
        }}
      >
        Close
      </button>
    </div>
  </div>
)}
      {/* Document movement history modal */}
      {historyDoc && (
        <div className="rd-modal-overlay rd-fade-in-overlay" onClick={() => setHistoryDoc(null)}>
          <div
            className="rd-fade-in-scale"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              width: "min(440px, 90vw)",
              maxHeight: "80vh",
              overflowY: "auto",
              padding: "22px 22px 20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#8A9187" }}>
                  MOVEMENT HISTORY
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 2px" }}>{historyDoc.title}</h3>
                <div style={{ fontSize: 12.5, color: "#8A9187" }}>{historyDoc.id}</div>
              </div>
              <button
                onClick={() => setHistoryDoc(null)}
                className="rd-icon-btn"
                style={{ color: "#8A9187", padding: 4 }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ height: 1, background: "#EEF0EC", margin: "16px 0 18px" }} />

            <div>
              {historyDoc.history.map((step, i) => {
                const isLast = i === historyDoc.history.length - 1;
                const iconColor =
                  step.status === "complete" ? "#1E7145" : step.status === "current" ? "#C99A3C" : "#B9C2B6";
                const StepIcon = step.status === "complete" ? CheckCircle2 : step.status === "current" ? Clock : Circle;
                return (
                  <div key={step.stage} style={{ display: "flex", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: step.status === "pending" ? "#fff" : "#F2F6F2",
                          border: `1.5px solid ${iconColor}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <StepIcon size={13} color={iconColor} strokeWidth={2} />
                      </div>
                      {!isLast && (
                        <div
                          style={{
                            width: 2,
                            flex: 1,
                            minHeight: 28,
                            background: step.status === "complete" ? "#1E7145" : "#E4E7E1",
                          }}
                        />
                      )}
                    </div>
                    <div style={{ paddingBottom: isLast ? 0 : 20 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: step.status === "pending" ? "#8A9187" : "#26302B",
                        }}
                      >
                        {step.stage}
                      </div>
                      <div style={{ fontSize: 12.5, color: "#6B726A", marginTop: 2 }}>{step.by}</div>
                      {step.date && (
                        <div style={{ fontSize: 11.5, color: "#8A9187", marginTop: 2 }}>{step.date}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}