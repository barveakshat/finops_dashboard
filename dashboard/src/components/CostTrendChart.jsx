import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getServiceTrend } from "../api/client";

const SERVICES = ["AmazonEC2", "AmazonRDS", "AmazonS3", "AWSLambda"];

function AnomalyDot(props) {
  const { cx, cy, payload } = props;
  if (payload.is_anomaly) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={12} fill="#FF5C5C" opacity={0.15} />
        <circle cx={cx} cy={cy} r={7} fill="#FF5C5C" opacity={0.35} />
        <circle cx={cx} cy={cy} r={4.5} fill="#FF5C5C" stroke="#0A1420" strokeWidth={1.5} />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={2.5} fill="#4C9FFF" />;
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

  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    const actual = p.total_usd;
    const expected = p.baseline_30d_avg;
    const diff = expected != null ? actual - expected : null;
    const pct = expected ? (diff / expected) * 100 : null;
    const reason = p.is_anomaly ? `Z-score ${p.z_score} exceeds threshold 2.5` : "Normal variation";

    return (
      <div className="chart-tooltip">
        <div className="tooltip-date mono">{label}</div>
        <div className="tooltip-row"><span>Service</span><span>{service}</span></div>
        <div className="tooltip-row"><span>Actual</span><span className="mono">${actual?.toFixed(2)}</span></div>
        <div className="tooltip-row"><span>Expected</span><span className="mono">${expected?.toFixed(2)}</span></div>
        {diff != null && (
          <div className="tooltip-row"><span>Difference</span>
            <span className="mono" style={{ color: diff >= 0 ? "var(--accent-red)" : "var(--accent-green)" }}>{diff >= 0 ? "+" : ""}${diff.toFixed(2)}</span>
          </div>
        )}
        {pct != null && (
          <div className="tooltip-row"><span>Change</span>
            <span className="mono" style={{ color: pct >= 0 ? "var(--accent-red)" : "var(--accent-green)" }}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>
          </div>
        )}
        <div className="tooltip-row"><span>Z-score</span><span className="mono">{p.z_score ?? "—"}</span></div>
        {p.is_anomaly && <div className="tooltip-reason">⚠ {reason}</div>}
      </div>
    );
  }

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
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="#1C2A42" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#5A6B87", fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: "#223049" }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#5A6B87", fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#4C9FFF", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Line type="monotone" dataKey="total_usd" stroke="#4C9FFF" strokeWidth={2.5} dot={<AnomalyDot />} activeDot={{ r: 6, fill: "#4C9FFF", stroke: "#0A1420", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}