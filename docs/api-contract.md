# FinOps Dashboard — API Contract

> **Locked: [FILL IN DATE]. Changes require both A and B to agree before any code is modified.**
>
> This is the boundary between backend (Person A) and frontend (Person B). Person A's
> `api-handler` Lambda must return exactly this shape. Person B's React client and mock
> server must consume exactly this shape. Neither side guesses the other's format.

Base URL (dev): `https://{api-id}.execute-api.ap-south-1.amazonaws.com/v1`

---

## GET /costs

Query params: `period` (`7d` | `14d` | `30d`), `group_by` (`service`)

Response:
```json
{
  "period": "2024-01-09 to 2024-01-15",
  "total_cost_usd": 1842.34,
  "records": [
    {
      "date": "2024-01-15",
      "service": "AmazonEC2",
      "total_usd": 952.10,
      "is_anomaly": false,
      "anomaly_reason": null,
      "pct_change_7d": 12.3
    }
  ]
}
```

---

## GET /costs/{service}

Query params: `period` (`7d` | `14d` | `30d`)

Response:
```json
{
  "service": "AmazonEC2",
  "period": "2024-01-01 to 2024-01-31",
  "trend": [
    {
      "date": "2024-01-01",
      "total_usd": 98.20,
      "baseline_30d_avg": 100.0,
      "z_score": -0.18,
      "is_anomaly": false
    }
  ]
}
```

---

## GET /anomalies

Query params: `period` (`7d` | `14d` | `30d`), `status` (`active`)

Response:
```json
{
  "period": "2024-01-09 to 2024-01-15",
  "anomalies": [
    {
      "date": "2024-01-15",
      "service": "AmazonRDS",
      "cost_today": 412.45,
      "baseline_avg": 256.30,
      "z_score": 3.57,
      "pct_change_7d": 61.2,
      "anomaly_reason": "Z-score: 3.57 exceeds threshold 2.5"
    }
  ]
}
```

---

## GET /budget/{month}

Path param: `month` in format `YYYY-MM`

Response:
```json
{
  "month": "2024-01",
  "budget_usd": 500.00,
  "spent_usd": 387.20,
  "pct_used": 77.4,
  "days_remaining": 8,
  "projected_total": 502.10
}
```

---

## Field Types (strict — no deviations)

- All dates: ISO string `"YYYY-MM-DD"`
- All costs: number (float, 2 decimal places)
- `is_anomaly`: boolean (`true`/`false` — never `0`/`1` or `"true"`/`"false"` strings)
- `anomaly_reason`: string | null (never omit the key — use `null` when no anomaly)
- `z_score`: number | null
- `pct_change_7d`: number | null

---

## Error Responses

All error responses follow this shape regardless of endpoint:

```json
{
  "error": "string description of what went wrong"
}
```

| Status | When |
|---|---|
| `400` | Invalid query param (e.g. `period=99d`) |
| `404` | Unknown service name in `/costs/{service}`, or no data for `/budget/{month}` |
| `500` | Unhandled Lambda error |

---

## Sign-off

- [ ] Person A reviewed and agrees
- [ ] Person B reviewed and agrees

Once both boxes are checked, this file does not change without a conversation between both people. If a change is needed mid-project, update this file in the same PR as the code change, and tag the other person for review.