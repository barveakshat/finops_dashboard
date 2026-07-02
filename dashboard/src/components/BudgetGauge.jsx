import { useState, useEffect } from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { getBudget } from "../api/client";

function getStatus(pct) {
  if (pct < 80) return { color: "var(--accent-green)", label: "On track" };
  if (pct <= 100) return { color: "var(--accent-amber)", label: "Watch" };
  return { color: "var(--accent-red)", label: "Over budget" };
}

export default function BudgetGauge({ month = "2024-01" }) {
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getBudget(month).then(setBudget).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [month]);

  if (loading) return <div className="card">Loading budget…</div>;
  if (error) return <div className="card" style={{ color: "var(--accent-red)" }}>Error: {error}</div>;
  if (!budget) return null;

  const pct = Math.min(budget.pct_used, 100);
  const status = getStatus(budget.pct_used);

  return (
    <div className="card">
      <div className="card-title-row">
        <span className="card-title">Budget — {budget.month}</span>
        <span className="mono" style={{ fontSize: "0.75rem", color: status.color, fontWeight: 600 }}>● {status.label}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 140, height: 140 }}>
          <RadialBarChart width={140} height={140} cx={70} cy={70} innerRadius={50} outerRadius={65}
            data={[{ value: pct, fill: status.color }]} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: "var(--surface-raised)" }} dataKey="value" cornerRadius={10} />
          </RadialBarChart>
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center"
          }}>
            <span className="mono" style={{ fontSize: "1.4rem", fontWeight: 700, color: status.color }}>{budget.pct_used}%</span>
            <span style={{ fontSize: "0.65rem", color: "var(--text-faint)" }}>used</span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: "180px" }}>
          <div className="mono" style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>${budget.spent_usd.toFixed(2)}</span>
            <span style={{ color: "var(--text-muted)" }}> / ${budget.budget_usd.toFixed(2)}</span>
          </div>
          <div className="mono" style={{ fontSize: "0.8rem", color: "var(--text-faint)" }}>
            {budget.days_remaining}d remaining · projected ${budget.projected_total.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}