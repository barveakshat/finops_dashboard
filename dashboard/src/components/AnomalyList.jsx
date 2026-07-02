import { useState, useEffect } from "react";
import { getAnomalies } from "../api/client";

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

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {anomalies.map((a, i) => (
          <div key={`${a.date}-${a.service}-${i}`} onClick={() => onSelectService && onSelectService(a.service)}
            style={{ display: "flex", flexDirection: "column", gap: "0.3rem", padding: "0.75rem 0.9rem", borderLeft: "3px solid var(--accent-red)", background: "var(--surface-raised)", borderRadius: "0 6px 6px 0", cursor: onSelectService ? "pointer" : "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{a.service}</span>
              <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>{a.date}</span>
            </div>
            <div className="mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              ${a.cost_today?.toFixed(2)} vs ${a.baseline_avg?.toFixed(2)} baseline · z={a.z_score}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--accent-red)" }}>{a.anomaly_reason}</div>
          </div>
        ))}
      </div>
    </div>
  );
}