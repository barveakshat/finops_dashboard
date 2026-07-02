import { useState, useEffect } from "react";
import { getAnomalies } from "../api/client";

function getSeverity(z) {
  if (z >= 3.5) return { label: "Critical", cls: "badge-red" };
  if (z >= 2.5) return { label: "High", cls: "badge-amber" };
  return { label: "Medium", cls: "badge-green" };
}

export default function AnomalyList({ period = "7d", onSelectService }) {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAnomalies(period).then(data => setAnomalies(data.anomalies || [])).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="card-title-row">
        <span className="card-title">Anomaly Feed</span>
        <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{period}</span>
      </div>

      {loading && <p className="mono" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading…</p>}
      {error && <p style={{ color: "var(--accent-red)" }}>Error: {error}</p>}
      {!loading && !error && anomalies.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No anomalies in this period.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {anomalies.map((a, i) => {
          const diff = a.cost_today - a.baseline_avg;
          const pct = a.baseline_avg ? (diff / a.baseline_avg) * 100 : null;
          const severity = getSeverity(a.z_score);
          return (
            <div key={`${a.date}-${a.service}-${i}`} className="anomaly-card" onClick={() => onSelectService && onSelectService(a.service)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{a.service}</span>
                <span className={`badge ${severity.cls}`}><span className="badge-dot" />{severity.label}</span>
              </div>
              <div className="mono" style={{ fontSize: "0.7rem", color: "var(--text-faint)", marginBottom: "0.5rem" }}>{a.date}</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem 1rem", marginBottom: "0.5rem" }}>
                <div><div className="stat-label" style={{ marginBottom: "0.15rem" }}>Today</div><div className="mono" style={{ fontSize: "0.85rem" }}>${a.cost_today.toFixed(2)}</div></div>
                <div><div className="stat-label" style={{ marginBottom: "0.15rem" }}>Expected</div><div className="mono" style={{ fontSize: "0.85rem" }}>${a.baseline_avg.toFixed(2)}</div></div>
                <div><div className="stat-label" style={{ marginBottom: "0.15rem" }}>Difference</div><div className="mono" style={{ fontSize: "0.85rem", color: "var(--accent-red)" }}>+${diff.toFixed(2)}</div></div>
                <div><div className="stat-label" style={{ marginBottom: "0.15rem" }}>Change</div><div className="mono" style={{ fontSize: "0.85rem", color: "var(--accent-red)" }}>+{pct?.toFixed(1)}% · z={a.z_score}</div></div>
              </div>

              <div style={{ fontSize: "0.78rem", color: "var(--accent-red)", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>⚠ {a.anomaly_reason}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}