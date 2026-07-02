import { useState } from "react";
import CostTrendChart from "./components/CostTrendChart";
import ServiceBreakdown from "./components/ServiceBreakdown";
import AnomalyList from "./components/AnomalyList";
import BudgetGauge from "./components/BudgetGauge";
import StatsRow from "./components/StatsRow";
import "./index.css";

function App() {
  const [selectedService, setSelectedService] = useState(null);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="eyebrow">AWS Cost Monitoring</div>
        <h1 className="dashboard-title">FinOps Dashboard</h1>
        <p className="dashboard-sub">Daily cost tracking, anomaly detection, and budget status.</p>
      </div>

      <div className="stack">
        <StatsRow />
        <BudgetGauge month="2024-01" />
        <div className="grid-2">
          <CostTrendChart selectedService={selectedService} />
          <AnomalyList period="7d" onSelectService={setSelectedService} />
        </div>
        <ServiceBreakdown period="7d" />
      </div>
    </div>
  );
}

export default App;