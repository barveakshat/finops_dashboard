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

  return (
    <div className="stats-row">
      <StatCard label="Total Spend (7d)" value={costs ? `$${costs.total_cost_usd.toFixed(2)}` : "—"} sublabel={costs?.period} accent="var(--accent-blue)" />
      <StatCard label="Budget Used" value={budget ? `${budget.pct_used}%` : "—"} sublabel={budget ? `$${budget.spent_usd.toFixed(0)} of $${budget.budget_usd.toFixed(0)}` : ""} accent="var(--accent-teal)" />
      <StatCard label="Active Anomalies" value={anomalies ? anomalies.anomalies.length : "—"} sublabel="last 7 days" accent="var(--accent-orange)" />
      <StatCard label="Days Remaining" value={budget ? budget.days_remaining : "—"} sublabel={budget ? `proj. $${budget.projected_total.toFixed(0)}` : ""} accent="var(--accent-purple)" />
    </div>
  );
}