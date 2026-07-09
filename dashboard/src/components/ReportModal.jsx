import { useState, useEffect } from "react";
import { getCosts, getBudget, getAnomalies, getServiceTrend } from "../api/client";
import { downloadCSV, printCurrentReport } from "../utils/export";
import { createPortal } from "react-dom";

export default function ReportModal({ type, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (type === "cost") {
          const costs = await getCosts("7d");
          const byDay = {};
          costs.records.forEach(r => { byDay[r.date] = (byDay[r.date] || 0) + r.total_usd; });
          const days = Object.entries(byDay).map(([date, total]) => ({ date, total: parseFloat(total.toFixed(2)) }));
          const highest = days.reduce((a, b) => (b.total > a.total ? b : a), days[0]);
          const byService = {};
          costs.records.forEach(r => { byService[r.service] = (byService[r.service] || 0) + r.total_usd; });
          const topServices = Object.entries(byService).sort((a, b) => b[1] - a[1]).map(([service, total]) => ({ service, total: parseFloat(total.toFixed(2)) }));
          setData({ totalSpend: costs.total_cost_usd, avgDaily: parseFloat((costs.total_cost_usd / days.length).toFixed(2)), highestDay: highest, days, topServices });
        } else if (type === "budget") {
          const b = await getBudget(new Date().toISOString().slice(0, 7));
          const burnRate = parseFloat((b.spent_usd / (30 - b.days_remaining || 1)).toFixed(2));
          setData({ ...b, burnRate });
        } else if (type === "service") {
          const costs = await getCosts("7d");
          const byService = {};
          costs.records.forEach(r => { byService[r.service] = (byService[r.service] || 0) + r.total_usd; });
          const rows = Object.entries(byService).map(([service, total]) => ({ service, total: parseFloat(total.toFixed(2)) })).sort((a, b) => b.total - a.total);
          const totalAll = rows.reduce((s, r) => s + r.total, 0);
          setData({ rows: rows.map(r => ({ ...r, pct: parseFloat(((r.total / totalAll) * 100).toFixed(1)) })), highest: rows[0], totalAll });
        } else if (type === "anomaly") {
          const a = await getAnomalies("7d");
          setData({ anomalies: a.anomalies });
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [type]);

  const titles = { cost: "Cost Summary", budget: "Budget Report", service: "Service Report", anomaly: "Anomaly Report" };

  function handleExportCSV() {
    if (!data) return;
    if (type === "cost") downloadCSV("cost_summary.csv", data.days);
    if (type === "budget") downloadCSV("budget_report.csv", [data]);
    if (type === "service") downloadCSV("service_report.csv", data.rows);
    if (type === "anomaly") downloadCSV("anomaly_report.csv", data.anomalies);
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3rem 1rem", overflowY: "auto" }} onClick={onClose}>
      <div className="card" style={{ padding: "2rem", width: "100%", maxWidth: "760px" }} onClick={e => e.stopPropagation()} id="report-print-area">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.3rem" }}>{titles[type]}</h2>
          <span onClick={onClose} style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: "1.3rem" }}>✕</span>
        </div>

        {loading && <p className="mono" style={{ color: "var(--text-muted)" }}>Loading report…</p>}

        {!loading && data && type === "cost" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
              <Stat label="Total Spend" value={`$${data.totalSpend.toFixed(2)}`} />
              <Stat label="Avg Daily Cost" value={`$${data.avgDaily.toFixed(2)}`} />
              <Stat label="Highest Cost Day" value={`${data.highestDay.date} · $${data.highestDay.total.toFixed(2)}`} />
            </div>
            <div>
              <div className="stat-label" style={{ marginBottom: "0.5rem" }}>Top Spending Services</div>
              {data.topServices.map(s => <Row key={s.service} label={s.service} value={`$${s.total.toFixed(2)}`} />)}
            </div>
          </div>
        )}

        {!loading && data && type === "budget" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
            <Stat label="Budget" value={`$${data.budget_usd.toFixed(2)}`} />
            <Stat label="Used" value={`${data.pct_used}%`} />
            <Stat label="Remaining" value={`$${(data.budget_usd - data.spent_usd).toFixed(2)}`} />
            <Stat label="Forecast" value={`$${data.projected_total.toFixed(2)}`} />
            <Stat label="Burn Rate" value={`$${data.burnRate}/day`} />
            <Stat label="Days Remaining" value={data.days_remaining} />
          </div>
        )}

        {!loading && data && type === "service" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <Stat label="Highest Cost Service" value={`${data.highest.service} · $${data.highest.total.toFixed(2)}`} />
            {data.rows.map(r => (
              <div key={r.service}>
                <Row label={r.service} value={`$${r.total.toFixed(2)} · ${r.pct}%`} />
                <div className="progress-track"><div className="progress-fill" style={{ width: `${r.pct}%`, background: "var(--accent-blue)" }} /></div>
              </div>
            ))}
          </div>
        )}

        {!loading && data && type === "anomaly" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {data.anomalies.length === 0 && <p style={{ color: "var(--text-muted)" }}>No anomalies detected for this service.</p>}
            {data.anomalies.map((a, i) => (
              <div key={i} className="anomaly-card" style={{ cursor: "default" }}>
                <div style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{a.service} — {a.date}</div>
                <Row label="Expected Cost" value={`$${a.baseline_avg.toFixed(2)}`} />
                <Row label="Actual Cost" value={`$${a.cost_today.toFixed(2)}`} />
                <Row label="Difference" value={`$${(a.cost_today - a.baseline_avg).toFixed(2)}`} />
                <Row label="Z-score" value={a.z_score} />
                <Row label="Root Cause" value={a.anomaly_reason} />
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <button className="topbar-control" onClick={handleExportCSV} style={{ cursor: "pointer" }}>⬇ Export CSV</button>
          <button className="topbar-control" onClick={printCurrentReport} style={{ cursor: "pointer" }}>🖨 Print / Save as PDF</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Stat({ label, value }) {
  return <div><div className="stat-label">{label}</div><div className="mono" style={{ fontSize: "1.1rem", fontWeight: 600 }}>{value}</div></div>;
}
function Row({ label, value }) {
  return <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "0.2rem 0" }}><span style={{ color: "var(--text-muted)" }}>{label}</span><span className="mono">{value}</span></div>;
}