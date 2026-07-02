// dashboard/src/components/AnomalyList.jsx
import { useState, useEffect } from "react";
import { getAnomalies } from "../api/client";

export default function AnomalyList({ period = "7d", onSelectService }) {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAnomalies(period)
      .then(data => setAnomalies(data.anomalies || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div style={{ width: "100%", background: "#fff", padding: "1rem", borderRadius: "8px" }}>
      <h2 style={{ marginTop: 0 }}>Anomalies ({period})</h2>

      {loading && <p>Loading anomalies…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && anomalies.length === 0 && (
        <p>No anomalies detected for this period.</p>
      )}

      {!loading && !error && anomalies.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ padding: "0.5rem" }}>Date</th>
              <th style={{ padding: "0.5rem" }}>Service</th>
              <th style={{ padding: "0.5rem" }}>Cost Today</th>
              <th style={{ padding: "0.5rem" }}>Baseline Avg</th>
              <th style={{ padding: "0.5rem" }}>Z-Score</th>
              <th style={{ padding: "0.5rem" }}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {anomalies.map((a, i) => (
              <tr
                key={`${a.date}-${a.service}-${i}`}
                onClick={() => onSelectService && onSelectService(a.service)}
                style={{
                  cursor: onSelectService ? "pointer" : "default",
                  borderBottom: "1px solid #edf2f7"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f7fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <td style={{ padding: "0.5rem" }}>{a.date}</td>
                <td style={{ padding: "0.5rem", fontWeight: 600 }}>{a.service}</td>
                <td style={{ padding: "0.5rem" }}>${a.cost_today?.toFixed(2)}</td>
                <td style={{ padding: "0.5rem" }}>${a.baseline_avg?.toFixed(2)}</td>
                <td style={{ padding: "0.5rem", color: "#e53e3e" }}>{a.z_score}</td>
                <td style={{ padding: "0.5rem" }}>{a.anomaly_reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}