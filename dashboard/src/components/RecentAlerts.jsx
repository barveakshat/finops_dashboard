export default function RecentAlerts({ anomalies = [] }) {
  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <div className="card-title-row">
        <span className="card-title">Recent Alerts</span>
        <span className="mono" style={{ fontSize: "0.75rem", color: "var(--accent-blue)", cursor: "pointer" }}>View all</span>
      </div>
      <table className="data-table">
        <thead><tr><th>Service</th><th>Alert Message</th><th>Severity</th><th>Date</th><th>Time</th></tr></thead>
        <tbody>
          {anomalies.map((a, i) => (
            <tr key={i}>
              <td>⚠ {a.service}</td>
              <td>Spending anomaly detected — cost is {(((a.cost_today - a.baseline_avg) / a.baseline_avg) * 100).toFixed(1)}% higher than expected</td>
              <td><span className="badge badge-red"><span className="badge-dot" />High</span></td>
              <td className="mono">{a.date}</td>
              <td className="mono">10:15 AM</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}