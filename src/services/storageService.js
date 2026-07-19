export async function loadShared(key, fallback) {
  try {
    const res = await window.storage.get(key, true);
    return res ? JSON.parse(res.value) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveShared(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
  } catch (e) {
    console.error("saveShared error", e);
  }
}