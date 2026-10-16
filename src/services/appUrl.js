const configured = (import.meta.env.VITE_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");

export function appOrigin() {
  if (configured) return configured;
  return window.location.origin;
}

export function trackingUrl(trackingId) {
  return `${appOrigin()}/track-documents?id=${encodeURIComponent(trackingId)}`;
}
