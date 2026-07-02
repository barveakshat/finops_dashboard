import Sparkline, { makeSpark } from "./Sparkline";

export default function AnomaliesOverview({ total = 1, critical = 1, warning = 0, info = 0 }) {
  const cards = [
    { label: "Total Anomalies", value: total, sub: "Last 7 days", color: "var(--accent-red)" },
    { label: "Critical", value: critical, sub: "Needs attention", color: "var(--accent-red)" },
    { label: "Warning", value: warning, sub: "Monitor", color: "var(--accent-amber)" },
    { label: "Info", value: info, sub: "Informational", color: "var(--accent-blue)" },
  ];
  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <div className="card-title-row"><span className="card-title">Anomalies Overview</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {cards.map(c => (
          <div key={c.label} className="mini-card">
            <div className="stat-label">{c.label}</div>
            <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-faint)", marginBottom: "0.3rem" }}>{c.sub}</div>
            <Sparkline data={makeSpark(c.value + 1)} color={c.color} height={24} />
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: "0.75rem", fontSize: "0.78rem", color: "var(--accent-blue)", cursor: "pointer" }}>View all anomalies →</div>
    </div>
  );
}