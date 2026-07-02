import Sparkline from "./Sparkline";

export default function StatCard({ label, value, sublabel, accent = "var(--accent-blue)", spark, trend }) {
  return (
    <div className="card stat-card" style={{ padding: "1.1rem 1.25rem" }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value mono" style={{ color: accent }}>{value}</div>
      {trend && <div className="mono" style={{ fontSize: "0.72rem", color: trend.up ? "var(--accent-red)" : "var(--accent-green)", marginTop: "0.2rem" }}>{trend.up ? "↗" : "↘"} {trend.text}</div>}
      {sublabel && <div className="stat-sublabel mono">{sublabel}</div>}
      {spark && <div style={{ marginTop: "0.5rem" }}><Sparkline data={spark} color={accent} /></div>}
    </div>
  );
}