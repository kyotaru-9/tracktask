export function genTrackId(existingDocs) {
  const ids = existingDocs.map(d => d.id);
  let id;
  do { id = "TT-" + Math.floor(1000 + Math.random() * 9000); } while (ids.includes(id));
  return id;
}
