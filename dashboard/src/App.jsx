import { useState } from "react";
import CostTrendChart from "./components/CostTrendChart";
import ServiceBreakdown from "./components/ServiceBreakdown";
import AnomalyList from "./components/AnomalyList";
import BudgetGauge from "./components/BudgetGauge";
import "./App.css";

function App() {
  const [selectedService, setSelectedService] = useState(null);

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1>FinOps Dashboard</h1>
      <BudgetGauge month="2024-01" />
      <div style={{ marginTop: "2rem" }}>
        <CostTrendChart selectedService={selectedService} />
      </div>
      <div style={{ marginTop: "2rem" }}>
        <ServiceBreakdown period="7d" />
      </div>
      <div style={{ marginTop: "2rem" }}>
        <AnomalyList period="7d" onSelectService={setSelectedService} />
      </div>
    </div>
  );
}

export default App;