// dashboard/src/components/ServiceBreakdown.jsx
import { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { getCosts } from "../api/client";

const COLORS = ["#3182ce", "#e53e3e", "#38a169", "#d69e2e", "#805ad5", "#dd6b20"];

export default function ServiceBreakdown({ period = "7d" }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getCosts(period)
      .then(res => {
        const totals = {};
        (res.records || []).forEach(r => {
          totals[r.service] = (totals[r.service] || 0) + r.total_usd;
        });
        const chartData = Object.entries(totals).map(([service, total]) => ({
          service,
          total: parseFloat(total.toFixed(2))
        }));
        setData(chartData);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div style={{ width: "100%", background: "#fff", padding: "1rem", borderRadius: "8px" }}>
      <h2 style={{ marginTop: 0 }}>Service Breakdown ({period})</h2>

      {loading && <p>Loading breakdown…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="service"
              cx="50%"
              cy="50%"
              outerRadius={110}
              label={({ service, percent }) => `${service} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={entry.service} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `$${value}`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}