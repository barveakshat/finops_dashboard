// dashboard/src/components/BudgetGauge.jsx
import { useState, useEffect } from "react";
import { getBudget } from "../api/client";

function getColor(pct) {
  if (pct < 80) return "#38a169";   // green
  if (pct <= 100) return "#d69e2e"; // orange
  return "#e53e3e";                 // red
}

export default function BudgetGauge({ month = "2024-01" }) {
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getBudget(month)
      .then(setBudget)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [month]);

  if (loading) return <div style={{ padding: "1rem" }}>Loading budget…</div>;
  if (error) return <div style={{ padding: "1rem", color: "red" }}>Error: {error}</div>;
  if (!budget) return null;

  const pct = Math.min(budget.pct_used, 100);
  const color = getColor(budget.pct_used);

  return (
    <div style={{ width: "100%", background: "#fff", padding: "1rem", borderRadius: "8px" }}>
      <h2 style={{ marginTop: 0 }}>Budget — {budget.month}</h2>

      <div style={{ background: "#edf2f7", borderRadius: "8px", overflow: "hidden", height: "24px" }}>
        <div
          style={{
            width: `${pct}%`,
            background: color,
            height: "100%",
            transition: "width 0.3s ease"
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem", fontSize: "0.9rem" }}>
        <span>${budget.spent_usd.toFixed(2)} spent of ${budget.budget_usd.toFixed(2)}</span>
        <span style={{ color, fontWeight: 600 }}>{budget.pct_used}% used</span>
      </div>

      <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#718096" }}>
        {budget.days_remaining} days remaining · Projected total: ${budget.projected_total.toFixed(2)}
      </div>
    </div>
  );
}