import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getServiceTrend, getCosts } from "../api/client";

function AnomalyDot(props) {
  const { cx, cy, payload } = props;
  if (payload.is_anomaly) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={13} fill="#FF5C5C" opacity={0.15} />
        <circle cx={cx} cy={cy} r={8} fill="#FF5C5C" opacity={0.35} />
        <circle cx={cx} cy={cy} r={5} fill="#FF5C5C" stroke="#08111F" strokeWidth={1.5} />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={2.5} fill="#4C9FFF" />;
}

export default function CostTrendChart({ selectedService, refreshKey }) {
  const [services, setServices] = useState([]);
  const [service, setService] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Derive the service list from whatever the backend actually returns — no hardcoding
  useEffect(() => {
    getCosts("7d").then(data => {
      const unique = [...new Set((data.records || []).map(r => r.service))].sort();
      setServices(unique);
      if (!service && unique.length > 0) setService(unique[0]);
    }).catch(() => {});
  }, [refreshKey]);

  useEffect(() => { if (selectedService) setService(selectedService); }, [selectedService]);

  useEffect(() => {
    if (!service) return;
    setLoading(true);
    setError(null);
    getServiceTrend(service, "30d").then(data => setTrend(data.trend || [])).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [service, refreshKey]);

  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    const actual = p.total_usd;
    const expected = p.baseline_30d_avg;
    const diff = expected != null ? actual - expected : null;
    const pct = expected ? (diff / expected) * 100 : null;

    return (
      <div className="chart-tooltip">
        <div className="tooltip-date mono">{label}</div>
        <div className="tooltip-row"><span>Service</span><span>{service}</span></div>
        <div className="tooltip-row"><span>Actual Cost</span><span className="mono">${actual?.toFixed(2)}</span></div>
        <div className="tooltip-row"><span>Expected</span><span className="mono">${expected?.toFixed(2)}</span></div>
        {diff != null && <div className="tooltip-row"><span>Difference</span><span className="mono" style={{ color: diff >= 0 ? "var(--accent-red)" : "var(--accent-green)" }}>{diff >= 0 ? "+" : ""}${diff.toFixed(2)}</span></div>}
        {pct != null && <div className="tooltip-row"><span>Increase</span><span className="mono" style={{ color: pct >= 0 ? "var(--accent-red)" : "var(--accent-green)" }}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span></div>}
        <div className="tooltip-row"><span>Z-score</span><span className="mono">{p.z_score ?? "—"}</span></div>
        {p.is_anomaly && <div className="tooltip-reason">⚠ Spending exceeded statistical threshold.</div>}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <div className="card-title-row">
        <span className="card-title">Cost Trend</span>
        <select value={service || ""} onChange={e => setService(e.target.value)}>
          {services.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && <p className="mono" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading…</p>}
      {error && <p style={{ color: "var(--accent-red)" }}>Error: {error}</p>}

      {!loading && !error && (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#1A2740" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#5A6B87", fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: "#1F2C42" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#5A6B87", fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#4C9FFF", strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Line type="monotone" dataKey="baseline_30d_avg" stroke="#5A6B87" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              <Line type="monotone" dataKey="total_usd" stroke="#4C9FFF" strokeWidth={2.5} dot={<AnomalyDot />} activeDot={{ r: 6, fill: "#4C9FFF", stroke: "#08111F", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
            <span>— <span style={{ color: "var(--accent-blue)" }}>Actual Cost ($)</span></span>
            <span style={{ color: "var(--text-faint)" }}>┄┄ Baseline (Expected)</span>
          </div>
        </>
      )}
    </div>
  );
}