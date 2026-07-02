import { useState, useEffect } from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { getBudget } from "../api/client";

function getStatus(pct) {
  if (pct < 80) return { color: "var(--accent-green)", label: "On Track", badge: "badge-green" };
  if (pct <= 100) return { color: "var(--accent-amber)", label: "Warning", badge: "badge-amber" };
  return { color: "var(--accent-red)", label: "Over Budget", badge: "badge-red" };
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
  const remaining = budget.budget_usd - budget.spent_usd;

  return (
    <div className="card">
      <div className="card-title-row">
        <span className="card-title">Budget — {budget.month}</span>
        <span className={`badge ${status.badge}`}><span className="badge-dot" /> {status.label}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "2.5rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
          <RadialBarChart width={150} height={150} cx={75} cy={75} innerRadius={54} outerRadius={70}
            data={[{ value: pct, fill: status.color }]} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: "var(--surface-raised)" }} dataKey="value" cornerRadius={12} />
          </RadialBarChart>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: status.color }}>{budget.pct_used}%</span>
            <span style={{ fontSize: "0.65rem", color: "var(--text-faint)" }}>used</span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: "260px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem 1.5rem" }}>
          <div>
            <div className="stat-label">Spent</div>
            <div className="mono" style={{ fontSize: "1.15rem", fontWeight: 600 }}>${budget.spent_usd.toFixed(2)}</div>
          </div>
          <div>
            <div className="stat-label">Remaining</div>
            <div className="mono" style={{ fontSize: "1.15rem", fontWeight: 600, color: remaining >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>${remaining.toFixed(2)}</div>
          </div>
          <div>
            <div className="stat-label">Monthly Budget</div>
            <div className="mono" style={{ fontSize: "1.15rem", fontWeight: 600 }}>${budget.budget_usd.toFixed(2)}</div>
          </div>
          <div>
            <div className="stat-label">Projected Total</div>
            <div className="mono" style={{ fontSize: "1.15rem", fontWeight: 600, color: budget.projected_total > budget.budget_usd ? "var(--accent-amber)" : "var(--text-primary)" }}>${budget.projected_total.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="mono" style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--text-faint)" }}>
        {budget.days_remaining} days remaining in {budget.month}
      </div>
    </div>
  );
}