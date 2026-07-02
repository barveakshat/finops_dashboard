export default function StatCard({ label, value, sublabel, accent = "var(--accent-blue)" }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value mono" style={{ color: accent }}>{value}</div>
      {sublabel && <div className="stat-sublabel mono">{sublabel}</div>}
    </div>
  );
}