export default function AuditLog({ doc }) {
  const logs = doc.audit_logs || [];

  if (!logs.length) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
        No audit trail yet. Actions will appear here as they happen.
      </div>
    );
  }

  const actionStyles = {
    approve: { bg: "#f0fdf4", dot: "#16a34a", label: "Approved" },
    reject: { bg: "#fef2f2", dot: "#ef4444", label: "Rejected" },
    receive: { bg: "#fffbeb", dot: "#f59e0b", label: "Received" },
    done: { bg: "#f0fdf4", dot: "#16a34a", label: "Marked Done" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Audit Trail</div>
      {logs.map((log, i) => {
        const style = actionStyles[log.action] || { bg: "#f8fafc", dot: "#64748b", label: log.action };
        const actor = log.actor || {};
        const roleLabel = log.handler_role === "Division" && log.handler_division
          ? `${log.handler_role} — ${log.handler_division}`
          : log.handler_role;

        return (
          <div
            key={log.id || i}
            style={{
              display: "flex",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: style.bg,
              border: "1px solid #f1f5f9",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: style.dot,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {style.label === "Approved" ? "✓" : style.label === "Rejected" ? "✕" : "↩"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span>{style.label}</span>
                <span style={{ color: "#64748b", fontWeight: 400 }}>{roleLabel}</span>
                <span style={{ color: "#94a3b8", fontSize: 11 }}>
                  {new Date(log.acted_at).toLocaleString("en-PH", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                <strong>{actor.full_name || "Unknown"}</strong> ({actor.role || log.handler_role})
              </div>
              {log.comment && (
                <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic", marginTop: 2 }}>
                  "{log.comment}"
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}