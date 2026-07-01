import CostTrendChart from "./components/CostTrendChart";
import "./App.css";

function App() {
  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1>FinOps Dashboard</h1>
      <CostTrendChart />
    </div>
  );
}

export default App;