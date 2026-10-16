import { daysUntil, formatDeadline } from "../utils/deadline";

export default function DeadlineTag({ deadline, status }) {
  if (!deadline) return <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>;
  const isDone = status === "completed" || status === "done" || status === "rejected";
  const diff = daysUntil(deadline);
  let color = "#64748b", label = formatDeadline(deadline), bg = "transparent";
  if (!isDone) {
    if (diff < 0)      { color = "#b91c1c"; bg = "#fee2e2"; label = `${formatDeadline(deadline)} · Overdue`; }
    else if (diff === 0){ color = "#b45309"; bg = "#fef3c7"; label = `${formatDeadline(deadline)} · Due today`; }
    else if (diff <= 2) { color = "#b45309"; bg = "#fef3c7"; label = `${formatDeadline(deadline)} · ${diff}d left`; }
  }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color, background: bg,
      borderRadius: 6, padding: bg !== "transparent" ? "2px 7px" : 0, whiteSpace: "nowrap"
    }}>{label}</span>
  );
}
