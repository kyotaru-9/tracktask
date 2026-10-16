// Generates a unique tracking id like DOC-2026-004821.
// existingIds is a Set of uppercase ids already in the database.
export function genTrackId(existingIds = new Set()) {
  const year = new Date().getFullYear();
  let id;
  do {
    id = `DOC-${year}-${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`;
  } while (existingIds.has(id.toUpperCase()));
  return id;
}
