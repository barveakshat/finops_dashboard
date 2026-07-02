import { useState, useEffect } from "react";
import { getCosts, getBudget, getAnomalies } from "../api/client";
import StatCard from "./StatCard";
import { makeSpark } from "./Sparkline";

export default function StatsRow({ refreshKey }) {
  const [costs, setCosts] = useState(null);
  const [budget, setBudget] = useState(null);
  const [anomalies, setAnomalies] = useState(null);

  useEffect(() => {
    getCosts("7d").then(setCosts).catch(() => {});
    getBudget("2024-01").then(setBudget).catch(() => {});
    getAnomalies("7d").then(setAnomalies).catch(() => {});
  }, [refreshKey]);

  const remaining = budget ? budget.budget_usd - budget.spent_usd : null;

  return (
    <div className="stats-row">
      <StatCard label="Total Spend (7d)" value={costs ? `$${costs.total_cost_usd.toFixed(2)}` : "—"} sublabel={costs?.period} accent="var(--accent-blue)" spark={makeSpark(1.1)} />
      <StatCard label="Budget Used" value={budget ? `${budget.pct_used}%` : "—"} sublabel={budget ? `$${budget.spent_usd.toFixed(2)} of $${budget.budget_usd.toFixed(2)}` : ""} accent="var(--accent-green)" />
      <StatCard label="Active Anomalies" value={anomalies ? anomalies.anomalies.length : "—"} sublabel="Last 7 days" accent="var(--accent-red)" spark={makeSpark(2.3)} />
      <StatCard label="Forecast (Month-End)" value={budget ? `$${budget.projected_total.toFixed(2)}` : "—"} sublabel="Projected vs Budget" accent="var(--accent-purple)" trend={{ up: true, text: "+0.4%" }} />
      <StatCard label="Remaining Budget" value={remaining != null ? `$${remaining.toFixed(2)}` : "—"} sublabel={budget ? `${budget.days_remaining} days remaining · $${(remaining / (budget.days_remaining || 1)).toFixed(2)}/day avg` : ""} accent="var(--accent-amber)" />
    </div>
  );
}