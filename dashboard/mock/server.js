// dashboard/mock/server.js
// Run with: node mock/server.js
const http = require("http");

const mockData = {
  costs: {
    period: "2024-01-09 to 2024-01-15",
    total_cost_usd: 1842.34,
    records: [
      { date: "2024-01-15", service: "AmazonEC2", total_usd: 142.56, is_anomaly: false, anomaly_reason: null, pct_change_7d: 12.3 },
      { date: "2024-01-15", service: "AmazonRDS", total_usd: 412.45, is_anomaly: true, anomaly_reason: "Z-score: 3.57 exceeds threshold 2.5", pct_change_7d: 61.2 },
      { date: "2024-01-15", service: "AmazonS3", total_usd: 18.20, is_anomaly: false, anomaly_reason: null, pct_change_7d: -2.1 },
      { date: "2024-01-15", service: "AWSLambda", total_usd: 3.10, is_anomaly: false, anomaly_reason: null, pct_change_7d: 5.0 },
      { date: "2024-01-14", service: "AmazonEC2", total_usd: 138.20, is_anomaly: false, anomaly_reason: null, pct_change_7d: 8.1 },
      { date: "2024-01-14", service: "AmazonRDS", total_usd: 265.00, is_anomaly: false, anomaly_reason: null, pct_change_7d: 3.5 },
    ]
  },
  serviceTrend: (service) => ({
    service,
    period: "2024-01-01 to 2024-01-31",
    trend: Array.from({ length: 31 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, "0")}`,
      total_usd: parseFloat((100 + Math.random() * 20 - 10).toFixed(2)),
      baseline_30d_avg: 100.0,
      z_score: parseFloat((Math.random() * 2 - 1).toFixed(2)),
      is_anomaly: i === 14
    }))
  }),
  anomalies: {
    period: "2024-01-09 to 2024-01-15",
    anomalies: [
      {
        date: "2024-01-15",
        service: "AmazonRDS",
        cost_today: 412.45,
        baseline_avg: 256.30,
        z_score: 3.57,
        pct_change_7d: 61.2,
        anomaly_reason: "Z-score: 3.57 exceeds threshold 2.5"
      }
    ]
  },
  budget: {
    month: "2024-01",
    budget_usd: 500.00,
    spent_usd: 387.20,
    pct_used: 77.4,
    days_remaining: 8,
    projected_total: 502.10
  }
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  const url = new URL(req.url, "http://localhost:3001");
  const path = url.pathname;

  if (path === "/costs") return res.end(JSON.stringify(mockData.costs));
  if (path.startsWith("/costs/")) {
    const service = path.split("/costs/")[1];
    return res.end(JSON.stringify(mockData.serviceTrend(service)));
  }
  if (path === "/anomalies") return res.end(JSON.stringify(mockData.anomalies));
  if (path.startsWith("/budget/")) return res.end(JSON.stringify(mockData.budget));

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(3001, () => console.log("Mock API running on http://localhost:3001"));