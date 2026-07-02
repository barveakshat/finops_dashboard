import { useState, useEffect } from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { getBudget } from "../api/client";

function getStatus(pct) {
  if (pct < 80) return { color: "var(--accent-green)", label: "On Track", badge: "badge-green", msg: "You are currently within budget." };
  if (pct <= 100) return { color: "var(--accent-amber)", label: "Warning", badge: "badge-amber", msg: "Approaching your monthly budget limit." };
  return { color: "var(--accent-red)", label: "Over Budget", badge: "badge-red", msg: "Spending has exceeded the monthly budget." };
}

export default function BudgetGauge({ month = "2024-01", refreshKey }) {
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getBudget(month).then(setBudget).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [month, refreshKey]);

  if (loading) return <div className="card" style={{ padding: "1.5rem" }}>Loading budget…</div>;
  if (error) return <div className="card" style={{ padding: "1.5rem", color: "var(--accent-red)" }}>Error: {error}</div>;
  if (!budget) return null;

  const pct = Math.min(budget.pct_used, 100);
  const status = getStatus(budget.pct_used);
  const remaining = budget.budget_usd - budget.spent_usd;

  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <div className="card-title-row">
        <span className="card-title">Budget — {new Date(budget.month + "-01").toLocaleString("en-US", { month: "long", year: "numeric" })}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "2.5rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
          <RadialBarChart width={140} height={140} cx={70} cy={70} innerRadius={50} outerRadius={65}
            data={[{ value: pct, fill: status.color }]} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: "var(--surface-raised)" }} dataKey="value" cornerRadius={10} />
          </RadialBarChart>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span className="mono" style={{ fontSize: "1.4rem", fontWeight: 700, color: status.color }}>{budget.pct_used}%</span>
            <span style={{ fontSize: "0.65rem", color: "var(--text-faint)" }}>used</span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: "280px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
          <div><div className="stat-label">Spent</div><div className="mono" style={{ fontSize: "1.1rem", fontWeight: 600 }}>${budget.spent_usd.toFixed(2)}</div></div>
          <div><div className="stat-label">Budget</div><div className="mono" style={{ fontSize: "1.1rem", fontWeight: 600 }}>${budget.budget_usd.toFixed(2)}</div></div>
          <div><div className="stat-label">Remaining</div><div className="mono" style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--accent-amber)" }}>${remaining.toFixed(2)}</div></div>
          <div><div className="stat-label">Projected</div><div className="mono" style={{ fontSize: "1.1rem", fontWeight: 600 }}>${budget.projected_total.toFixed(2)} <span style={{ fontSize: "0.7rem", color: "var(--accent-red)" }}>↗+0.4%</span></div></div>
        </div>

        <div style={{ textAlign: "right", minWidth: "180px" }}>
          <span className={`badge ${status.badge}`}><span className="badge-dot" /> {status.label}</span>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.6rem", maxWidth: "180px" }}>{status.msg}</div>
        </div>
      </div>

      <div className="mono" style={{ marginTop: "1.25rem", fontSize: "0.75rem", color: "var(--text-faint)" }}>
        📅 Billing Cycle: Jan 1 – Jan 31 · {budget.days_remaining} days remaining
      </div>
    </div>
  );
}