// dashboard/src/api/client.js
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

let currentAccountId = null;
let authToken = null;

export function setAccountId(accountId) {
  currentAccountId = accountId;
}

export function setAuthToken(token) {
  authToken = token;
}

function headers() {
  const h = {};
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  if (currentAccountId) h["X-Account-Id"] = currentAccountId;
  return h;
}

export async function getCosts(period = "7d") {
  const res = await fetch(`${API_BASE}/costs?period=${period}`, { headers: headers() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getServiceTrend(service, period = "30d") {
  const res = await fetch(`${API_BASE}/costs/${encodeURIComponent(service)}?period=${period}`, { headers: headers() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getAnomalies(period = "7d") {
  const res = await fetch(`${API_BASE}/anomalies?period=${period}`, { headers: headers() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getBudget(month) {
  const res = await fetch(`${API_BASE}/budget/${month}`, { headers: headers() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}