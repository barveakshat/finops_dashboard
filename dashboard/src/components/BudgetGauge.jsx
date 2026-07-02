import { useState, useEffect } from "react";
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

      <div style={{ position: "relative", height: "10px", background: "var(--surface-raised)", borderRadius: "5px", overflow: "hidden", border: "1px solid var(--border)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: status.color, transition: "width 0.4s ease", borderRadius: "5px" }} />
        {[25, 50, 75].map(t => (
          <div key={t} style={{ position: "absolute", left: `${t}%`, top: 0, bottom: 0, width: "1px", background: "rgba(0,0,0,0.25)" }} />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
        <span className="mono" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>${budget.spent_usd.toFixed(2)}</span> / ${budget.budget_usd.toFixed(2)}
        </span>
        <span className="mono" style={{ fontSize: "0.85rem", fontWeight: 600, color: status.color }}>{budget.pct_used}%</span>
      </div>

      <div className="mono" style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-faint)" }}>
        {budget.days_remaining}d remaining · projected ${budget.projected_total.toFixed(2)}
      </div>
    </div>
  );
}