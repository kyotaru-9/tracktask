export default function UrgencyPill({ level }) {
  const map = {
    Low:      { bg: "#f1f5f9", color: "#475569" },
    Normal:   { bg: "#dbeafe", color: "#1d4ed8" },
    High:     { bg: "#ffedd5", color: "#c2410c" },
    Critical: { bg: "#fee2e2", color: "#b91c1c" },
  };
  const s = map[level] || map.Normal;
  return (
    <span style={{
      background: s.bg, color: s.color, borderRadius: 99,
      fontSize: 11, fontWeight: 600, padding: "2px 10px",
      display: "inline-block", whiteSpace: "nowrap"
    }}>{level || "Normal"}</span>
  );
}
