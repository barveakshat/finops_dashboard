import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { getCosts } from "../api/client";

const COLORS = ["#5B8DEF", "#EF4444", "#34D399", "#F5A623", "#A78BFA", "#22D3EE"];

export default function ServiceBreakdown({ period = "7d" }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getCosts(period).then(res => {
      const totals = {};
      (res.records || []).forEach(r => { totals[r.service] = (totals[r.service] || 0) + r.total_usd; });
      setData(Object.entries(totals).map(([service, total]) => ({ service, total: parseFloat(total.toFixed(2)) })));
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [period]);

  const totalAll = data.reduce((s, d) => s + d.total, 0);

  return (
    <div className="card">
      <div className="card-title-row">
        <span className="card-title">Service Breakdown</span>
        <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{period}</span>
      </div>

      {loading && <p className="mono" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading…</p>}
      {error && <p style={{ color: "var(--accent-red)" }}>Error: {error}</p>}

      {!loading && !error && (
        <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          <ResponsiveContainer width={220} height={220}>
            <PieChart>
              <Pie data={data} dataKey="total" nameKey="service" innerRadius={60} outerRadius={95} paddingAngle={2}>
                {data.map((entry, i) => <Cell key={entry.service} fill={COLORS[i % COLORS.length]} stroke="var(--surface)" strokeWidth={2} />)}
              </Pie>
              <Tooltip formatter={(v) => `$${v}`} contentStyle={{ background: "#1D222D", border: "1px solid #333A4A", borderRadius: "6px", fontFamily: "IBM Plex Mono" }} />
            </PieChart>
          </ResponsiveContainer>

          <div style={{ flex: 1, minWidth: "160px" }}>
            {data.map((d, i) => (
              <div key={d.service} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: COLORS[i % COLORS.length] }} />
                  {d.service}
                </span>
                <span className="mono" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{((d.total / totalAll) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}