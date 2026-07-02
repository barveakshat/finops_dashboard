import { useAuth } from "../context/AuthContext";

const NAV = ["Overview", "Cost Trend", "Anomalies", "Services", "Budgets", "Reports", "Alerts", "Settings"];

export default function Sidebar({ active, onSelect, lastUpdated }) {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">F</div>
        <div>
          <div className="sidebar-logo-text">FinOps</div>
          <div className="sidebar-logo-sub">AWS Cost Monitoring</div>
        </div>
      </div>

      {user && (
        <div className="card" style={{ padding: "0.9rem", marginBottom: "1rem", display: "flex", gap: "0.7rem", alignItems: "center" }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent-blue), var(--accent-purple))",
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0
          }}>{user.initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{user.org}</div>
            <div className="mono" style={{ fontSize: "0.65rem", color: "var(--text-faint)" }}>{user.accountId} · {user.environment}</div>
          </div>
        </div>
      )}

      <nav>
        {NAV.map((item) => (
          <div key={item} className={`nav-item ${active === item ? "active" : ""}`} onClick={() => onSelect(item)}>
            {item}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer-card">
        <div style={{ color: "var(--text-faint)", marginBottom: "0.3rem" }}>LAST UPDATED</div>
        <div className="mono" style={{ color: "var(--text-muted)", marginBottom: "0.6rem" }}>{lastUpdated}</div>
        <div onClick={logout} style={{ color: "var(--accent-red)", cursor: "pointer", fontSize: "0.75rem" }}>Switch Account →</div>
      </div>
    </aside>
  );
}