import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Download, Printer } from "lucide-react";

// Generates and displays the tracking QR code for a document.
// Scanning it (or the printed routing slip) opens the public track page.
export default function QrCodeModal({ doc, onClose }) {
  const [dataUrl, setDataUrl] = useState("");

  const url = `${window.location.origin}/track-documents?id=${encodeURIComponent(doc.tracking_id)}`;

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(url, {
      width: 480,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((u) => mounted && setDataUrl(u))
      .catch((e) => console.error("QR generation failed:", e));
    return () => { mounted = false; };
  }, [url]);

  function download() {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${doc.tracking_id}-qr.png`;
    a.click();
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: 340, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Tracking QR Code</span>
          <button onClick={onClose} className="tt-icon-btn"><X size={16} /></button>
        </div>

        <div style={{ border: "2px dashed #cbd5e1", borderRadius: 12, padding: 18, marginBottom: 14 }}>
          {dataUrl ? (
            <img src={dataUrl} alt={`QR code for ${doc.tracking_id}`} style={{ width: 200, height: 200 }} />
          ) : (
            <div style={{ width: 200, height: 200, margin: "0 auto", background: "#f1f5f9", borderRadius: 8 }} />
          )}
        </div>

        <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, letterSpacing: 1, color: "#2563eb", marginBottom: 4 }}>
          {doc.tracking_id}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>{doc.title}</div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={download} disabled={!dataUrl} className="tt-btn-primary">
            <Download size={14} /> Download PNG
          </button>
          <button
            onClick={() => window.open(url, "_blank")}
            title="Open public tracking page"
            className="tt-btn"
          >
            <Printer size={14} /> Open link
          </button>
        </div>
      </div>

      <style>{`
        .tt-icon-btn { border:none; background:none; cursor:pointer; color:#64748b; padding:4px; }
        .tt-btn-primary { display:inline-flex; align-items:center; gap:6px; padding:"7px 14px"; border-radius:8px;
          border:1px solid #2563eb; background:#2563eb; color:#fff; font-size:12px; cursor:pointer; font-family:inherit; }
        .tt-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px;
          border:1px solid #e2e8f0; background:#fff; color:#334155; font-size:12px; cursor:pointer; font-family:inherit; }
      `}</style>
    </div>
  );
}
