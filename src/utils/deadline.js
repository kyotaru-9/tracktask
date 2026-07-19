// ── Deadline helpers ─────────────────────────────────────
export function daysUntil(deadline) {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

export function formatDeadline(deadline) {
  if (!deadline) return "—";
  const d = new Date(deadline + "T00:00:00");
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}
