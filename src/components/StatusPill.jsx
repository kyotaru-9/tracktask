export default function StatusPill({ status }) {
  const map = {
    processing: { bg: "#dbeafe", color: "#1d4ed8", label: "In Progress" },
    completed:  { bg: "#dcfce7", color: "#15803d", label: "Completed"  },
    returning:  { bg: "#fef3c7", color: "#b45309", label: "Returning"  },
    done:       { bg: "#dcfce7", color: "#166534", label: "Done"       },
    rejected:   { bg: "#fee2e2", color: "#b91c1c", label: "Rejected"   },
    pending:    { bg: "#fef9c3", color: "#a16207", label: "Pending"    },
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
