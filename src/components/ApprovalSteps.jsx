export default function ApprovalSteps({ doc }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
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
