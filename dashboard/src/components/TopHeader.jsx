import { useState } from "react";

export default function TopHeader({ autoRefresh, onToggleAutoRefresh, anomalies, theme, onToggleTheme, now, user }) {
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <div className="topbar" style={{ position: "relative", justifyContent: "space-between" }}>
      {user && (
        <div className="mono" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Viewing: <span style={{ color: "var(--accent-blue)", fontWeight: 600 }}>{user.org}</span> · {user.accountId} · {user.environment}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <div className="topbar-control">📅 {now}</div>
        <div className={`topbar-control ${autoRefresh ? "active" : ""}`} onClick={onToggleAutoRefresh}>
          🔄 Auto refresh {autoRefresh ? "ON" : "OFF"}
        </div>
        <div className="icon-btn" onClick={onToggleTheme}>{theme === "dark" ? "☀️" : "🌙"}</div>
        <div className="icon-btn" onClick={() => setNotifOpen(o => !o)}>
          🔔
          {anomalies.length > 0 && <span className="notif-badge">{anomalies.length}</span>}
        </div>
        <div className="avatar" />
      </div>

      {notifOpen && (
        <div className="notif-dropdown">
          {anomalies.length === 0 && <div className="notif-item">No new notifications.</div>}
          {anomalies.map((a, i) => (
            <div className="notif-item" key={i}>
              <strong>{a.service}</strong> — cost anomaly on {a.date} (${a.cost_today.toFixed(2)}, z={a.z_score})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}