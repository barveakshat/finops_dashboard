import { useState, useEffect } from "react";
import { getCosts, getBudget, getAnomalies } from "../api/client";
import StatCard from "./StatCard";

export default function StatsRow() {
  const [costs, setCosts] = useState(null);
  const [budget, setBudget] = useState(null);
  const [anomalies, setAnomalies] = useState(null);

  useEffect(() => {
    getCosts("7d").then(setCosts).catch(() => {});
    getBudget("2024-01").then(setBudget).catch(() => {});
    getAnomalies("7d").then(setAnomalies).catch(() => {});
  }, []);

  const remaining = budget ? budget.budget_usd - budget.spent_usd : null;

  return (
    <div className="stats-row">
      <StatCard label="Total Spend (7d)" value={costs ? `$${costs.total_cost_usd.toFixed(2)}` : "—"} sublabel={costs?.period} accent="var(--accent-blue)" />
      <StatCard label="Budget Used" value={budget ? `${budget.pct_used}%` : "—"} sublabel={budget ? `$${budget.spent_usd.toFixed(0)} of $${budget.budget_usd.toFixed(0)}` : ""} accent="var(--accent-teal)" />
      <StatCard label="Active Anomalies" value={anomalies ? anomalies.anomalies.length : "—"} sublabel="last 7 days" accent="var(--accent-orange)" />
      <StatCard label="Forecast" value={budget ? `$${budget.projected_total.toFixed(0)}` : "—"} sublabel="month-end estimate" accent="var(--accent-purple)" />
      <StatCard label="Remaining Budget" value={remaining != null ? `$${remaining.toFixed(0)}` : "—"} sublabel={budget ? `${budget.days_remaining}d left` : ""} accent="var(--accent-pink)" />
    </div>
  );
}