import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import StatsRow from "./components/StatsRow";
import BudgetGauge from "./components/BudgetGauge";
import CostTrendChart from "./components/CostTrendChart";
import AnomalyList from "./components/AnomalyList";
import ServiceBreakdown from "./components/ServiceBreakdown";
import AnomaliesOverview from "./components/AnomaliesOverview";
import RecentAlerts from "./components/RecentAlerts";
import ReportsPreview from "./components/ReportsPreview";
import Footer from "./components/Footer";
import { getAnomalies } from "./api/client";
import "./index.css";

function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("Overview");
  const [selectedService, setSelectedService] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [now, setNow] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => setRefreshKey(k => k + 1), 10000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  useEffect(() => {
    setSelectedService(null);
    getAnomalies("7d").then(d => setAnomalies(d.anomalies || [])).catch(() => {});
  }, [refreshKey, user?.email]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const lastUpdated = now.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const nowShort = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const dataKey = `${user?.email}-${refreshKey}`;

  function renderSection() {
    switch (activeTab) {
      case "Cost Trend":
        return <CostTrendChart selectedService={selectedService} refreshKey={dataKey} />;
      case "Anomalies":
        return (
          <>
            <AnomalyList period="7d" onSelectService={setSelectedService} refreshKey={dataKey} />
            <AnomaliesOverview total={anomalies.length} critical={anomalies.filter(a => a.z_score >= 3.5).length} />
          </>
        );
      case "Services":
        return <ServiceBreakdown period="7d" selectedService={selectedService} onSelectService={setSelectedService} refreshKey={dataKey} />;
      case "Budgets":
        return <BudgetGauge month={new Date().toISOString().slice(0, 7)} refreshKey={dataKey} />;
      case "Reports":
        return <ReportsPreview />;
      case "Alerts":
        return <RecentAlerts anomalies={anomalies} />;
      case "Settings":
        return <div className="card" style={{ padding: "1.5rem" }}>Settings panel — coming soon.</div>;
      default:
        return (
          <>
            <StatsRow refreshKey={dataKey} />
            <BudgetGauge month={new Date().toISOString().slice(0, 7)} refreshKey={dataKey} />
            <div className="grid-2">
              <CostTrendChart selectedService={selectedService} refreshKey={dataKey} />
              <AnomalyList
                period="7d"
                onSelectService={setSelectedService}
                refreshKey={dataKey}
                filterService={selectedService}
                onViewAll={() => setActiveTab("Anomalies")}
              />
            </div>
            <ServiceBreakdown
              period="7d"
              selectedService={selectedService}
              onSelectService={setSelectedService}
              refreshKey={dataKey}
              onViewAllServices={() => setActiveTab("Services")}
            />
            <AnomaliesOverview total={anomalies.length} critical={anomalies.filter(a => a.z_score >= 3.5).length} />
            <RecentAlerts anomalies={anomalies} />
            <ReportsPreview />
          </>
        );
    }
  }

  return (
    <div className="app-shell">
      <Sidebar active={activeTab} onSelect={setActiveTab} lastUpdated={lastUpdated} />
      <div className="main-area">
        <TopHeader
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(a => !a)}
          anomalies={anomalies}
          theme={theme}
          onToggleTheme={() => setTheme(t => t === "dark" ? "light" : "dark")}
          now={nowShort}
          user={user}
        />
        <div className="dashboard">
          <div className="dashboard-header">
            <h1 className="dashboard-title">{activeTab}</h1>
            <p className="dashboard-sub">Daily cost tracking, anomaly detection and budget status.</p>
          </div>
          <div className="stack">
            {renderSection()}
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const { user } = useAuth();
  return user ? <Dashboard /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}