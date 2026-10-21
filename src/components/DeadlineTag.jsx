import { daysUntil, formatDeadline } from "../utils/deadline";

export default function DeadlineTag({ deadline, status, stacked = false }) {
  if (!deadline) {
    return stacked
      ? <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
      : <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>;
  }

  const isDone = status === "completed" || status === "done" || status === "rejected";
  const diff = daysUntil(deadline);
  let color = "#64748b", label = formatDeadline(deadline), bg = "transparent", tag = null;

  if (!isDone) {
    if (diff < 0)        { color = "#b91c1c"; bg = "#fee2e2"; tag = "Overdue"; }
    else if (diff === 0) { color = "#b45309"; bg = "#fef3c7"; tag = "Due today"; }
    else if (diff <= 2)  { color = "#b45309"; bg = "#fef3c7"; tag = `${diff}d left`; }
  }

  // Two-row layout: date on the first line (left aligned), status tag below.
  if (stacked) {
    return (
      <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#334155", whiteSpace: "nowrap" }}>
          {label}
        </span>
        {tag && (
          <span style={{
            fontSize: 10, fontWeight: 600, color, background: bg,
            borderRadius: 5, padding: "1px 6px", whiteSpace: "nowrap"
          }}>
            {tag}
          </span>
        )}
      </div>
    );
  }

  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color, background: bg,
      borderRadius: 6, padding: bg !== "transparent" ? "2px 7px" : 0, whiteSpace: "nowrap"
    }}>
      {tag ? `${label} · ${tag}` : label}
    </span>
  );
}
