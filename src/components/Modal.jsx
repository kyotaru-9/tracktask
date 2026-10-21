export default function Modal({ children, onClose, style }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
      padding: "20px"
    }}>
      <div style={{
        background: "#fff", borderRadius: 14, width: 580, maxHeight: "90vh",
        overflowY: "auto", border: "1px solid #e2e8f0", boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        ...style
      }}>
        {children}
      </div>
    </div>
  );
}
