import { ROLES } from "../constants";

// Compact horizontal stepper used in document tables.
export default function ApprovalSteps({ doc }) {
  const steps = doc.steps || [];
  const reverse = doc.phase === "reverse";
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {steps.map((s, i) => {
        const isCurrent = i === doc.current_step;
        let bg = "#f1f5f9", border = "#e2e8f0", color = "#64748b";
        if (s.status === "approved" || s.status === "received") { bg = "#dcfce7"; border = "#86efac"; color = "#15803d"; }
        if (s.status === "rejected") { bg = "#fee2e2"; border = "#fca5a5"; color = "#b91c1c"; }
        if (s.status === "pending" && isCurrent && (doc.status === "processing" || doc.status === "returning")) {
          bg = reverse ? "#fef3c7" : "#dbeafe";
          border = reverse ? "#d97706" : "#2563eb";
          color = reverse ? "#b45309" : "#1d4ed8";
        }
        const label = s.handler_role === ROLES.DIVISION
          ? `Div · ${(s.handler_division || "").split(" ")[0]}`
          : shortOffice(s.handler_role);
        return (
          <div key={i} style={{ flex: 1, textAlign: "center", position: "relative", minWidth: 0 }}>
            {i < steps.length - 1 && (
              <div style={{
                position: "absolute", top: 13, left: "50%", width: "100%",
                height: 2,
                background: (s.status === "approved" || s.status === "received") ? "#86efac" : "#e2e8f0",
                zIndex: 0
              }} />
            )}
            <div style={{
              width: 26, height: 26, borderRadius: "50%", border: `2px solid ${border}`,
              background: bg, color, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 10, fontWeight: 700,
              margin: "0 auto 3px", position: "relative", zIndex: 1
            }}>
              {s.status === "approved" || s.status === "received"
                ? "✓"
                : s.status === "rejected" ? "✕" : i + 1}
            </div>
            <div style={{ fontSize: 8, color: "#64748b", lineHeight: 1.2 }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}

function shortOffice(role) {
  const map = {
    "Mayor": "Mayor",
    "City Administrator": "City Admin",
    "City ENRO": "City ENRO",
    "SWM Secretary": "SWM Sec",
  };
  return map[role] || role;
}
