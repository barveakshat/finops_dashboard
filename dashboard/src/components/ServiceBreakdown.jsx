import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { getCosts } from "../api/client";

const COLORS = ["#4C9FFF", "#FF8A3D", "#2DD4BF", "#A66BFF", "#FF6B9D", "#34D399"];

export default function ServiceBreakdown({ period = "7d", selectedService, onSelectService, refreshKey, onViewAllServices }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getCosts(period).then(res => {
      const totals = {};
      (res.records || []).forEach(r => { totals[r.service] = (totals[r.service] || 0) + r.total_usd; });
      const list = Object.entries(totals).map(([service, total]) => ({ service, total: parseFloat(total.toFixed(2)) })).sort((a, b) => b.total - a.total);
      setData(list);
      // Default-select the top service if nothing is selected yet, so the panel isn't blank
      if (!selectedService && list.length > 0) onSelectService && onSelectService(list[0].service);
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [period, refreshKey]);

  const totalAll = data.reduce((s, d) => s + d.total, 0);
  const selected = data.find(d => d.service === selectedService);

  function handlePieClick(entry) {
    if (entry && entry.service) onSelectService && onSelectService(entry.service);
  }

  return (
    <div className="grid-2">
      <div className="card" style={{ padding: "1.5rem" }}>
        <div className="card-title-row">
          <span className="card-title">Service Breakdown ({period.toUpperCase()})</span>
          <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Group by: Service</span>
        </div>

        {loading && <p className="mono" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading…</p>}
        {error && <p style={{ color: "var(--accent-red)" }}>Error: {error}</p>}

        {!loading && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
            <div style={{ position: "relative", width: 190, height: 190, flexShrink: 0 }}>
              <ResponsiveContainer width={190} height={190}>
                <PieChart>
                  <Pie
                    data={data} dataKey="total" nameKey="service" innerRadius={62} outerRadius={90} paddingAngle={2}
                    onClick={handlePieClick} style={{ cursor: "pointer" }}
                  >
                    {data.map((entry, i) => (
                      <Cell
                        key={entry.service}
                        fill={COLORS[i % COLORS.length]}
                        stroke="var(--surface)"
                        strokeWidth={entry.service === selectedService ? 3 : 2}
                        opacity={selectedService && entry.service !== selectedService ? 0.35 : 1}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <span className="mono" style={{ fontSize: "1.15rem", fontWeight: 700 }}>${totalAll.toFixed(2)}</span>
                <span style={{ fontSize: "0.65rem", color: "var(--text-faint)" }}>Total Spend</span>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: "260px" }}>
              <div className="service-table-row" style={{ paddingBottom: "0.4rem", borderBottom: "1px solid var(--border)", marginBottom: "0.3rem" }}>
                <span className="stat-label">Service</span><span className="stat-label">Total Cost</span><span></span><span className="stat-label" style={{ textAlign: "right" }}>% of Total</span>
              </div>
              {data.map((d, i) => (
                <div key={d.service} className={`service-table-row ${selectedService === d.service ? "selected" : ""}`} onClick={() => onSelectService && onSelectService(d.service)}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "3px", background: COLORS[i % COLORS.length] }} />{d.service}
                  </span>
                  <span className="mono" style={{ fontSize: "0.82rem" }}>${d.total.toFixed(2)}</span>
                  <div className="progress-track" style={{ pointerEvents: "none" }}><div className="progress-fill" style={{ width: `${(d.total / totalAll) * 100}%`, background: COLORS[i % COLORS.length] }} /></div>
                  <span className="mono" style={{ fontSize: "0.82rem", textAlign: "right" }}>{((d.total / totalAll) * 100).toFixed(1)}%</span>
                </div>
              ))}
              {onViewAllServices && (
                <div style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.78rem", color: "var(--accent-blue)", cursor: "pointer" }} onClick={onViewAllServices}>
                  View all services →
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: "1.5rem" }}>
        {selected ? (
          <>
            <div style={{ color: "var(--accent-blue)", fontWeight: 600, marginBottom: "0.3rem" }}>{selected.service}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1rem" }}>{((selected.total / totalAll) * 100).toFixed(1)}% of total spend</div>
            <div className="mono" style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "0.2rem" }}>${selected.total.toFixed(2)}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>Total Cost</div>
          </>
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Select a service to view details.</div>
        )}
      </div>
    </div>
  );
}