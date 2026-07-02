// dashboard/mock/server.js
// Run with: node mock/server.js
import http from "http";

const SERVICES = ["AmazonEC2", "AmazonRDS", "AmazonS3", "AWSLambda"];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildAccountConfig(accountId) {
  const seed = hashString(accountId || "default");
  const rand = mulberry32(seed);
  const base = 30 + rand() * 120;
  const budget = 200 + rand() * 800;
  const spentRatio = 0.4 + rand() * 0.5;

  // Each account gets 2–3 anomalies on distinct services
  const anomalyCount = 2 + Math.floor(rand() * 2); // 2 or 3
  const shuffledServices = shuffle(SERVICES, rand).slice(0, anomalyCount);
  const anomalyConfigs = shuffledServices.map((service, i) => ({
    service,
    daysAgo: 2 + i * 3, // spread across different days
    z: parseFloat((2.6 + rand() * 1.8).toFixed(2)),
  }));

  return { base, budget, spentRatio, rand, anomalyConfigs };
}

function buildAccountData(accountId) {
  const cfg = buildAccountConfig(accountId);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  const anomalyByService = {};
  cfg.anomalyConfigs.forEach(a => {
    const d = new Date(today);
    d.setDate(today.getDate() - a.daysAgo);
    anomalyByService[a.service] = { date: fmtDate(d), z: a.z };
  });

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  // costs: today + yesterday, per service
  const records = [];
  [fmtDate(today), fmtDate(yesterday)].forEach(date => {
    SERVICES.forEach((service, i) => {
      const a = anomalyByService[service];
      const isAnomalyRecord = a && a.date === date;
      const total = isAnomalyRecord ? cfg.base * 2.8 : cfg.base * (0.3 + i * 0.25);
      records.push({
        date, service,
        total_usd: parseFloat(total.toFixed(2)),
        is_anomaly: !!isAnomalyRecord,
        anomaly_reason: isAnomalyRecord ? `Z-score: ${a.z} exceeds threshold 2.5` : null,
        pct_change_7d: isAnomalyRecord ? 61.2 : parseFloat((Math.random() * 20 - 10).toFixed(1)),
      });
    });
  });

  const totalCost = records.filter(r => r.date === fmtDate(today)).reduce((s, r) => s + r.total_usd, 0);
  const spent = parseFloat((cfg.budget * cfg.spentRatio).toFixed(2));

  return {
    costs: { period: `${fmtDate(sevenDaysAgo)} to ${fmtDate(today)}`, total_cost_usd: parseFloat(totalCost.toFixed(2)), records },

    serviceTrend: (service) => ({
      service,
      period: `${monthStr}-01 to ${monthStr}-${String(daysInMonth).padStart(2, "0")}`,
      trend: Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(year, month, i + 1);
        const dStr = fmtDate(d);
        const a = anomalyByService[service];
        const isSpikeDay = a && a.date === dStr;
        const val = isSpikeDay ? cfg.base * 2.8 : cfg.base + Math.random() * cfg.base * 0.2 - cfg.base * 0.1;
        return {
          date: dStr,
          total_usd: parseFloat(val.toFixed(2)),
          baseline_30d_avg: parseFloat(cfg.base.toFixed(2)),
          z_score: isSpikeDay ? a.z : parseFloat((Math.random() * 2 - 1).toFixed(2)),
          is_anomaly: !!isSpikeDay
        };
      })
    }),

    anomalies: {
      period: `${fmtDate(sevenDaysAgo)} to ${fmtDate(today)}`,
      anomalies: cfg.anomalyConfigs.map(a => {
        const info = anomalyByService[a.service];
        return {
          date: info.date,
          service: a.service,
          cost_today: parseFloat((cfg.base * 2.8).toFixed(2)),
          baseline_avg: parseFloat(cfg.base.toFixed(2)),
          z_score: a.z,
          pct_change_7d: 61.2,
          anomaly_reason: `Z-score: ${a.z} exceeds threshold 2.5`
        };
      }).sort((x, y) => (x.date < y.date ? 1 : -1))
    },

    budget: {
      month: monthStr,
      budget_usd: parseFloat(cfg.budget.toFixed(2)),
      spent_usd: spent,
      pct_used: parseFloat(((spent / cfg.budget) * 100).toFixed(1)),
      days_remaining: daysRemaining,
      projected_total: parseFloat((spent * 1.3).toFixed(2))
    }
  };
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Account-Id");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }

  const accountId = req.headers["x-account-id"] || "default";
  const mockData = buildAccountData(accountId);

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