// dashboard/src/components/CostTrendChart.jsx
import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Dot
} from "recharts";
import { getServiceTrend } from "../api/client";

const SERVICES = ["AmazonEC2", "AmazonRDS", "AmazonS3", "AWSLambda"];

// Custom dot renderer: red + bigger for anomaly days, default otherwise
function AnomalyDot(props) {
  const { cx, cy, payload } = props;
  if (payload.is_anomaly) {
    return <circle cx={cx} cy={cy} r={6} fill="#e53e3e" stroke="#7f1d1d" strokeWidth={1} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill="#3182ce" />;
}

export default function CostTrendChart() {
  const [service, setService] = useState(SERVICES[0]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getServiceTrend(service, "30d")
      .then(data => setTrend(data.trend || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [service]);

  return (
    <div style={{ width: "100%", background: "#fff", padding: "1rem", borderRadius: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0 }}>Cost Trend</h2>
        <select value={service} onChange={e => setService(e.target.value)}>
          {SERVICES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading && <p>Loading trend data…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="total_usd"
              name={`${service} — Daily Cost ($)`}
              stroke="#3182ce"
              dot={<AnomalyDot />}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}