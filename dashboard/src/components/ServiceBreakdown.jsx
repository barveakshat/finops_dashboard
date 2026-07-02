import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { getCosts } from "../api/client";

const COLORS = ["#4C9FFF", "#FF8A3D", "#2DD4BF", "#A66BFF", "#FF6B9D", "#34D399"];

export default function ServiceBreakdown({ period = "7d", selectedService, onSelectService }) {
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
              <Pie data={data} dataKey="total" nameKey="service" innerRadius={60} outerRadius={95} paddingAngle={2}
                onClick={(entry) => onSelectService && onSelectService(entry.service)}
                style={{ cursor: onSelectService ? "pointer" : "default" }}>
                {data.map((entry, i) => (
                  <Cell key={entry.service} fill={COLORS[i % COLORS.length]} stroke="var(--surface)"
                    strokeWidth={entry.service === selectedService ? 3 : 2}
                    opacity={selectedService && entry.service !== selectedService ? 0.4 : 1} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `$${v}`} contentStyle={{ background: "#16233A", border: "1px solid #2E3F5C", borderRadius: "10px", fontFamily: "IBM Plex Mono" }} />
            </PieChart>
          </ResponsiveContainer>

          <div style={{ flex: 1, minWidth: "200px" }}>
            {data.map((d, i) => (
              <div key={d.service} className={`service-row ${selectedService === d.service ? "selected" : ""}`} onClick={() => onSelectService && onSelectService(d.service)}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.85rem" }}>
                  <span style={{ width: "9px", height: "9px", borderRadius: "3px", background: COLORS[i % COLORS.length] }} />
                  {d.service}
                </span>
                <span style={{ display: "flex", gap: "0.75rem", alignItems: "baseline" }}>
                  <span className="mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>${d.total.toFixed(2)}</span>
                  <span className="mono" style={{ fontSize: "0.85rem", fontWeight: 600 }}>{((d.total / totalAll) * 100).toFixed(0)}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}