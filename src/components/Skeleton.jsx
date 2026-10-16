// Reusable shimmer skeleton blocks for every async loading state.
// Dashboard → DashboardSkeleton · Track Documents → TrackResultSkeleton.
import "./Skeleton.css";

export function Skeleton({ width = "100%", height = 12, radius = 6, style }) {
  return (
    <div
      className="sk"
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

function SkCard({ children }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
      overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      {children}
    </div>
  );
}

// Mirrors the dashboard 2-column layout: 4 stat cards + content panels.
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <SkCard key={i}>
            <div style={{ padding: "14px 16px" }}>
              <Skeleton width="60%" height={11} />
              <Skeleton width="40%" height={26} radius={8} style={{ marginTop: 8 }} />
              <Skeleton width="80%" height={10} style={{ marginTop: 8 }} />
            </div>
          </SkCard>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        {[0, 1].map((p) => (
          <SkCard key={p}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9" }}>
              <Skeleton width={180} height={13} />
            </div>
            <div style={{ padding: "6px 12px 12px" }}>
              {[0, 1, 2, 3, 4].map((r) => (
                <div key={r} style={{ display: "flex", gap: 12, padding: "10px 4px", alignItems: "center" }}>
                  <Skeleton width={90} height={12} />
                  <Skeleton width="30%" height={12} />
                  <Skeleton width="20%" height={12} />
                  <Skeleton width={70} height={18} radius={99} />
                </div>
              ))}
            </div>
          </SkCard>
        ))}
      </div>
    </div>
  );
}

// Mirrors the public track result card + routing history timeline.
export function TrackResultSkeleton() {
  return (
    <div role="status" aria-label="Searching document">
      <div className="page-success" aria-hidden="true">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Skeleton width="45%" height={15} />
          <Skeleton width="70%" height={12} style={{ marginTop: 8 }} />
        </div>
        <Skeleton width={110} height={24} radius={99} style={{ flexShrink: 0 }} />
      </div>
      <div style={{ marginTop: 20 }} aria-hidden="true">
        <Skeleton width={140} height={14} style={{ marginBottom: 12 }} />
        {[0, 1, 2, 3].map((r) => (
          <div key={r} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 16 }}>
            <Skeleton width={22} height={22} radius="50%" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Skeleton width="35%" height={13} />
              <Skeleton width="60%" height={11} style={{ marginTop: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
