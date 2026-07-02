import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getServiceTrend } from "../api/client";

const SERVICES = ["AmazonEC2", "AmazonRDS", "AmazonS3", "AWSLambda"];

function AnomalyDot(props) {
  const { cx, cy, payload } = props;
  if (payload.is_anomaly) return <circle cx={cx} cy={cy} r={5} fill="#EF4444" stroke="#0F1219" strokeWidth={2} />;
  return <circle cx={cx} cy={cy} r={2.5} fill="#5B8DEF" />;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: "#1D222D", border: "1px solid #333A4A", borderRadius: "6px", padding: "0.6rem 0.8rem", fontFamily: "IBM Plex Mono, monospace", fontSize: "0.75rem" }}>
      <div style={{ color: "#8A93A6", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ color: "#E7E9EE" }}>${p.total_usd?.toFixed(2)}</div>
      {p.is_anomaly && <div style={{ color: "#EF4444", marginTop: "0.25rem" }}>⚠ anomaly</div>}
    </div>
  );
}

export default function CostTrendChart({ selectedService }) {
  const [service, setService] = useState(SERVICES[0]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { if (selectedService) setService(selectedService); }, [selectedService]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getServiceTrend(service, "30d").then(data => setTrend(data.trend || [])).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [service]);

  return (
    <div className="card">
      <div className="card-title-row">
        <span className="card-title">Cost Trend</span>
        <select value={service} onChange={e => setService(e.target.value)}>
          {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && <p className="mono" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading…</p>}
      {error && <p style={{ color: "var(--accent-red)" }}>Error: {error}</p>}

      {!loading && !error && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="#262C3A" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#565E70", fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: "#262C3A" }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#565E70", fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="total_usd" stroke="#5B8DEF" strokeWidth={2} dot={<AnomalyDot />} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}