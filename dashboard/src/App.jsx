import CostTrendChart from "./components/CostTrendChart";
import ServiceBreakdown from "./components/ServiceBreakdown";
import "./App.css";

function App() {
  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1>FinOps Dashboard</h1>
      <CostTrendChart />
      <div style={{ marginTop: "2rem" }}>
        <ServiceBreakdown period="7d" />
      </div>
    </div>
  );
}

export default App;