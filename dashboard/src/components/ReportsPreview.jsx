import { useState } from "react";
import Sparkline, { makeSpark } from "./Sparkline";
import ReportModal from "./ReportModal";

const REPORTS = [
  { key: "cost", title: "Cost Summary", desc: "Daily cost summary and trends", icon: "📈", color: "var(--accent-green)" },
  { key: "anomaly", title: "Anomaly Report", desc: "Detected anomalies and insights", icon: "📊", color: "var(--accent-red)" },
  { key: "budget", title: "Budget Report", desc: "Budget utilization and forecast", icon: "🥧", color: "var(--accent-purple)" },
  { key: "service", title: "Service Report", desc: "Service-wise cost breakdown", icon: "🗂", color: "var(--accent-orange)" },
];

export default function ReportsPreview() {
  const [openReport, setOpenReport] = useState(null);

  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <div className="card-title-row"><span className="card-title">Reports Preview</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {REPORTS.map(r => (
          <div key={r.key} className="card report-card" onClick={() => setOpenReport(r.key)}>
            <div className="report-icon" style={{ background: "var(--surface-raised)" }}>{r.icon}</div>
            <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.25rem" }}>{r.title}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-faint)", marginBottom: "0.5rem" }}>{r.desc}</div>
            <Sparkline data={makeSpark(Math.random() * 3 + 1)} color={r.color} height={26} />
          </div>
        ))}
      </div>

      {openReport && <ReportModal type={openReport} onClose={() => setOpenReport(null)} />}
    </div>
  );
}