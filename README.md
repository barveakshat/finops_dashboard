<div align="center">

# ☁️ FinOps Dashboard

### Serverless AWS Cost Intelligence Platform with Real-Time Anomaly Detection

[![Deploy](https://github.com/barveakshat/finops_dashboard/actions/workflows/deploy.yml/badge.svg)](https://github.com/barveakshat/finops_dashboard/actions/workflows/deploy.yml)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Terraform](https://img.shields.io/badge/Terraform-IaC-844FBA?logo=terraform&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-Serverless-FF9900?logo=amazonaws&logoColor=white)
![Coverage](https://img.shields.io/badge/Test_Coverage-89%25-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

<br />

**An event-driven, fully serverless cost monitoring system that ingests AWS spend daily, detects anomalies using statistical analysis (Z-score + percentage spike), and delivers actionable Slack alerts — so your team catches cost problems *before* the monthly bill arrives.**

<br />

[View Demo](#-demo) · [Architecture](#-architecture) · [Features](#-features) · [Quick Start](#-quick-start) · [API Docs](#-api-reference)

<br />

</div>

---

<!-- 
  ╔══════════════════════════════════════════════════════════════╗
  ║                     📹 DEMO VIDEO                           ║
  ║  Replace the placeholder below with your actual video link  ║
  ╚══════════════════════════════════════════════════════════════╝
-->

## 🎬 Demo

<div align="center">

<!-- OPTION 1: YouTube Embed (Recommended — renders as a clickable thumbnail on GitHub) -->
<!-- Replace YOUR_VIDEO_ID with your actual YouTube video ID -->
[![FinOps Dashboard Demo](https://img.youtube.com/vi/YOUR_VIDEO_ID/maxresdefault.jpg)](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)

*☝️ Click to watch the full demo on YouTube*

<!-- OPTION 2: If hosting as MP4/WebM in the repo or on a CDN, uncomment below -->
<!-- 
<video src="https://YOUR_VIDEO_URL_HERE.mp4" width="800" controls>
  Your browser does not support the video tag.
</video>
-->

<!-- OPTION 3: Direct GitHub video (upload .mp4 to repo or drag into README editor) -->
<!-- 
https://github.com/user-attachments/assets/YOUR_ASSET_ID
-->

</div>

> **📌 Demo video coming soon** — Replace `YOUR_VIDEO_ID` above with your YouTube video ID, or drag-and-drop an `.mp4` file directly into the GitHub README editor to embed it inline.

---

## 🧠 Why This Project Exists

> **FinOps (Financial Operations)** is the discipline of giving engineering teams real-time visibility into cloud spending — and making someone accountable for it.

Most organizations discover AWS cost problems **after the monthly bill arrives**. By then, a misconfigured service or a forgotten resource has already burned through thousands of dollars.

This project flips that model:

| Without FinOps | With This Dashboard |
|:---|:---|
| Bill arrives at month end → surprise | Costs tracked **daily**, not monthly |
| No one knows which service caused the spike | Every spike **flagged automatically** via Slack |
| Investigation starts *after* the damage | Historical data shows **what changed and when** |
| Engineers need AWS console access | Teams see their own usage in a **dedicated UI** |

**Cost: ~$1–2/month** to run the entire platform on AWS.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📊 Intelligence & Monitoring
- **Daily Cost Ingestion** — Automated pull from AWS Cost Explorer (T-2 settled data)
- **Multi-Service Aggregation** — Groups costs by service (EC2, S3, RDS, Lambda…) with rolling baselines
- **Statistical Anomaly Detection** — Dual-algorithm approach: Z-score (30-day) + percentage spike (7-day)
- **Budget Tracking** — Actual spend vs. monthly target with projected end-of-month total
- **90-Day Data Retention** — DynamoDB TTL auto-expires old records

</td>
<td width="50%">

### 🛠️ Engineering & Operations
- **Serverless Architecture** — Zero servers to manage, pay-per-invocation
- **Terraform IaC** — 6 modular Terraform modules, entire infra as code
- **CI/CD Pipeline** — GitHub Actions: unit tests → `terraform plan` → `terraform apply`
- **JWT Authentication** — AWS Cognito with OAuth2 Authorization Code flow
- **39+ Unit Tests** — 89% code coverage, enforced at 80% minimum in CI
- **Slack Block Kit Alerts** — Structured, actionable alerts with deep links

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
                          ┌─────────────────────────────────────────────────┐
                          │              PRESENTATION LAYER                 │
                          │                                                 │
                          │   React 19 + Recharts + Tailwind CSS            │
                          │   ┌─────────┐ ┌──────────┐ ┌──────────────┐     │
                          │   │ Cost    │ │ Anomaly  │ │   Budget     │     │
                          │   │ Trends  │ │  List    │ │   Gauge      │     │
                          │   └────┬────┘ └────┬─────┘ └──────┬───────┘     │
                          │        └───────────┼──────────────┘             │
                          │                    │                            │
                          │         Cognito JWT Auth Token                  │
                          └────────────────────┼────────────────────────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │   API Gateway v2    │
                                    │   (HTTP API + JWT)  │
                                    └──────────┬──────────┘
                                               │
  ┌────────────────────────────────────────────┼────────────────────────────────────┐
  │                                PROCESSING LAYER                                 │
  │                                                                                 │
  │  ┌──────────────┐    ┌───────────────┐    ┌──────────────────┐    ┌──────────┐  │
  │  │  λ Ingestor  │───▶│ λ Aggregator  │───▶│ λ Anomaly        │───▶│ λ API    │  │
  │  │              │    │               │    │   Detector       │    │ Handler  │  │
  │  │ Cost Explorer│    │ Rolling Stats │    │ Z-Score + Spike  │    │ 4 Routes │  │
  │  │ API (T-2)    │    │ 30d avg/std   │    │ Detection        │    │          │  │
  │  └──────┬───────┘    └───────┬───────┘    └────────┬─────────┘    └──────────┘  │
  │         │                    │                     │                            │
  └─────────┼────────────────────┼─────────────────────┼────────────────────────────┘
            │                    │                     │
            ▼                    ▼                     ▼
  ┌──────────────────────────────────────┐   ┌──────────────────┐
  │          STORAGE LAYER               │   │  ALERTING LAYER  │
  │                                      │   │                  │
  │  ┌──────────┐    ┌───────────────┐   │   │   SNS Topic      │
  │  │cost_raw  │    │cost_aggregated│   │   │       │          │
  │  │PK: svc#  │    │PK: date       │   │   │  ┌────▼─────┐    │
  │  │SK: date  │    │SK: service    │   │   │  │λ Slack   │    │
  │  │TTL: 90d  │    │GSI: svc→date  │   │   │  │Notifier  │    │
  │  └──────────┘    └───────────────┘   │   │  └──────────┘    │
  │          DynamoDB (PAY_PER_REQUEST)  │   │                  │
  └──────────────────────────────────────┘   └──────────────────┘
                                                      │
            ┌─────────────┐                           │
            │ EventBridge │                           ▼
            │ ┌─────────┐ │                  ┌────────────────┐
            │ │6:00 UTC │─┼─── Ingestor      │ #aws-cost-     │
            │ │6:30 UTC │─┼─── Aggregator    │  alerts (Slack)│
            │ └─────────┘ │                  └────────────────┘
            └─────────────┘
```

### Data Flow — What Happens Every Morning at 6 AM UTC

```
EventBridge (6:00 AM)
    │
    ▼
λ Ingestor ──── Cost Explorer API (T-2 day) ──── cost_raw table
    │
    │  (30 min gap — ensures data settles)
    │
EventBridge (6:30 AM)
    │
    ▼
λ Aggregator ── Reads cost_raw ── Computes baselines ── cost_aggregated table
    │
    │  (Synchronous invocation)
    │
    ▼
λ Anomaly Detector ── Z-Score check ── % Spike check
    │
    │  (If anomaly detected)
    │
    ▼
SNS Topic ──► λ Slack Notifier ──► 🔔 #aws-cost-alerts
```

> **Why T-2?** Cost Explorer data for a given day isn't fully settled for up to 48 hours. Pulling T-2 guarantees complete, settled data — not partials that would trigger false anomalies.

---

## 🧮 Anomaly Detection Algorithm

The system uses a **dual-condition** approach — either condition triggers an alert. This covers blind spots that a single method would miss.

### Condition 1 — Z-Score (Statistical Deviation)

$$z = \frac{cost_{today} - \mu_{30d}}{\sigma_{30d}}$$

If $|z| > 2.5$ → **anomaly flagged**

*Catches gradual drift that's statistically unusual relative to the service's own 30-day history.*

### Condition 2 — Percentage Spike (Short-Term Jump)

$$\Delta\% = \frac{cost_{today} - \mu_{7d}}{\mu_{7d}} \times 100$$

If $\Delta\% > 40\%$ → **anomaly flagged**

*Catches sudden spikes against a recent stable baseline, even when 30-day variance is high.*

### Cold Start Handling

| History Available | Behavior |
|:---|:---|
| < 7 days | Skip both checks — `insufficient_data` |
| 7–29 days | Run checks with raised Z-score threshold (3.0) |
| ≥ 30 days | Normal detection at threshold 2.5 |

> **Minimum cost floor** ($1.00) prevents false positives on tiny services — a $0.01 → $0.02 jump is 100% change but meaningless.

---

## 🧰 Tech Stack

| Layer | Technology | Why |
|:---|:---|:---|
| **Scheduler** | Amazon EventBridge | Serverless cron — no EC2, no crontab |
| **Compute** | AWS Lambda (Python 3.12) | Pay-per-invocation, zero server management |
| **Cost Data** | AWS Cost Explorer API | Native AWS, no third-party integration |
| **Database** | Amazon DynamoDB | Sub-ms key-value reads, auto-scaling, TTL support |
| **Messaging** | Amazon SNS | Managed pub/sub — fan-out to multiple subscribers |
| **Auth** | Amazon Cognito | OAuth2 + JWT, hosted UI, user management |
| **API** | API Gateway v2 (HTTP) | 70% cheaper than REST API, JWT authorizer built-in |
| **Frontend** | React 19 + Recharts + Tailwind CSS | Modern SPA with interactive data visualizations |
| **IaC** | Terraform (6 modules) | Industry standard, modular, auditable |
| **CI/CD** | GitHub Actions | Automated test → plan → apply pipeline |
| **Secrets** | AWS Secrets Manager | Slack webhook URL never in env vars |

---

## 📂 Project Structure

```
finops-dashboard/
├── 📁 terraform/                      # Infrastructure as Code
│   ├── main.tf                        # Root module — wires all child modules
│   ├── variables.tf                   # Configurable thresholds & env settings
│   ├── outputs.tf                     # API URL, table names, Cognito IDs
│   ├── provider.tf                    # AWS provider + S3 remote state backend
│   └── 📁 modules/
│       ├── 📁 dynamodb/               # cost_raw + cost_aggregated tables, GSI, TTL
│       ├── 📁 lambda/                 # 5 functions + per-function IAM roles
│       │   └── 📁 src/
│       │       ├── ingestor/          # Cost Explorer → cost_raw
│       │       ├── aggregator/        # cost_raw → cost_aggregated (with baselines)
│       │       ├── anomaly_detector/  # Z-score + spike detection → SNS
│       │       ├── slack_notifier/    # SNS → Slack Block Kit alerts
│       │       └── api_handler/       # API Gateway → DynamoDB queries
│       ├── 📁 cognito/               # User Pool, Client, OAuth2, Hosted UI
│       ├── 📁 api_gateway/           # HTTP API, 4 routes, JWT authorizer
│       ├── 📁 eventbridge/           # Daily cron schedules (6:00 + 6:30 UTC)
│       └── 📁 sns_alerting/          # SNS topic subscriptions
│
├── 📁 dashboard/                      # React Frontend (Vite)
│   └── 📁 src/
│       ├── App.jsx                    # Shell: auth gate, routing, theming
│       ├── 📁 components/            # 15 UI components
│       │   ├── CostTrendChart.jsx     # Area chart with anomaly markers
│       │   ├── AnomalyList.jsx        # Severity-coded anomaly feed
│       │   ├── ServiceBreakdown.jsx   # Pie chart + table breakdown
│       │   ├── BudgetGauge.jsx        # Radial gauge with projections
│       │   ├── ReportModal.jsx        # Date range reports + export
│       │   ├── Login.jsx              # Cognito auth form
│       │   └── ...                    # StatsRow, Sidebar, TopHeader, etc.
│       ├── 📁 api/                   # REST client + Cognito auth helpers
│       └── 📁 context/              # React context for auth state
│
├── 📁 tests/                          # Unit tests (pytest + moto)
│   ├── test_ingestor.py               # Ingestor DynamoDB writes
│   ├── test_aggregator.py             # Baseline computation
│   ├── test_anomaly_detector.py       # Z-score, spike, cold start, cost floor
│   ├── test_api_handler.py            # All 4 routes, error cases, CORS
│   ├── test_detector.py               # Pure function tests (no AWS mocking)
│   └── test_slack_notifier.py         # Webhook formatting, Secrets Manager
│
├── 📁 scripts/                        # Operational tooling
│   ├── invoke_pipeline.sh             # Manual pipeline trigger (test/debug)
│   ├── seed_test_data.py              # Populate DynamoDB with sample data
│   ├── seed_spike.py                  # Inject anomaly for testing alerts
│   └── cleanup_test_data.py           # Teardown test data
│
├── 📁 integration-tests/             # Live endpoint testing
├── 📁 docs/                          # API contract & documentation
├── 📁 .github/workflows/            # CI/CD pipeline definition
└── requirements.txt                   # Python dependencies
```

---

## 📡 API Reference

**Base URL:** `https://{api-id}.execute-api.ap-south-1.amazonaws.com/v1`

All routes require a valid **Cognito JWT** in the `Authorization: Bearer <token>` header.

| Method | Endpoint | Description | Query Params |
|:---|:---|:---|:---|
| `GET` | `/costs` | Aggregated costs for all services | `period` (7d \| 14d \| 30d) |
| `GET` | `/costs/{service}` | Single service trend data | `period` (7d \| 14d \| 30d) |
| `GET` | `/anomalies` | Flagged anomalies | `period`, `status` (active) |
| `GET` | `/budget/{month}` | Spend vs. budget target | `month` (YYYY-MM) |

<details>
<summary><strong>📋 Example Response — <code>GET /anomalies?period=7d</code></strong></summary>

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

</details>

<details>
<summary><strong>📋 Example Response — <code>GET /budget/2024-01</code></strong></summary>

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

</details>

---

## 🔔 Slack Alert Format

Alerts use **Slack Block Kit** for structured, at-a-glance readability:

```
🚨 FinOps Alert — AmazonRDS

Cost today:      $412.45
Expected range:  $240 – $280
Anomaly reason:  Z-score 3.57 exceeds threshold 2.5

▶ View dashboard → https://your-dashboard.com/service/AmazonRDS?date=2024-01-15
```

> The deep link at the bottom means whoever reads the alert can investigate in **one click**. Without it, the alert is noise. With it, it's actionable.

---

## 🚀 Quick Start

### Prerequisites

- AWS account with **billing access enabled** (required for Cost Explorer)
- AWS CLI configured (`aws configure`)
- Terraform ≥ 1.5
- Python 3.12 + pip
- Node.js 18+ (for the dashboard)
- A Slack workspace with an Incoming Webhook

### 1. Clone & Install

```bash
git clone https://github.com/barveakshat/finops_dashboard.git
cd finops_dashboard

# Backend dependencies
pip install -r requirements.txt

# Frontend dependencies
cd dashboard && npm install && cd ..
```

### 2. Enable Cost Explorer

```bash
# Enable in AWS Console: Billing → Cost Explorer → Enable
# Then enable cost allocation tags:
aws ce update-cost-allocation-tags-status \
  --cost-allocation-tags-status TagKey=team,Status=Active
```

### 3. Store Slack Webhook

```bash
aws secretsmanager create-secret \
  --name finops/slack-webhook-url \
  --secret-string "https://hooks.slack.com/services/YOUR_WEBHOOK"
```

### 4. Deploy Infrastructure

```bash
cd terraform
terraform init
terraform plan -var="account_id=YOUR_ACCOUNT_ID" -var="environment=dev"
terraform apply -var="account_id=YOUR_ACCOUNT_ID" -var="environment=dev"
```

### 5. Trigger First Run

```bash
# EventBridge fires daily at 6 AM UTC, but you can test immediately:
aws lambda invoke \
  --function-name finops-cost-ingestor-dev \
  --payload '{"manual_trigger": true}' \
  response.json && cat response.json
```

### 6. Run the Dashboard

```bash
cd dashboard
echo "VITE_API_URL=<your-api-gateway-url>" > .env
npm run dev
```

---

## 🧪 Testing

```bash
# Run all unit tests with coverage
pytest tests/ -v --cov=terraform/modules/lambda/src --cov-report=term-missing

# Run the full pipeline manually (Ingestor → Aggregator → Detector)
bash scripts/invoke_pipeline.sh

# Seed test data + inject an anomaly spike
python scripts/seed_test_data.py
python scripts/seed_spike.py
bash scripts/invoke_pipeline.sh --skip-ingestor
```

### Test Coverage

| Module | Tests | Coverage |
|:---|:---|:---|
| `ingestor` | DynamoDB writes, batch operations, TTL | ✅ |
| `aggregator` | Baseline computation, rolling stats | ✅ |
| `anomaly_detector` | Z-score, % spike, cold start, cost floor | ✅ |
| `api_handler` | All 4 routes, error cases, CORS headers | ✅ |
| `slack_notifier` | Webhook formatting, Secrets Manager | ✅ |
| `detector` (pure) | Statistical functions, edge cases | ✅ |

> **39+ tests** • **89% coverage** • CI enforces **80% minimum** via `--cov-fail-under=80`

---

## ⚙️ Configuration

All thresholds are **parameterized via Terraform variables** — tunable without code changes:

```hcl
variable "z_score_threshold"   { default = 2.5  }  # Statistical deviation threshold
variable "spike_threshold_pct" { default = 40    }  # 7-day percentage spike threshold
variable "cost_lookback_days"  { default = 2     }  # T-2 for settled Cost Explorer data
variable "data_retention_days" { default = 90    }  # DynamoDB TTL auto-expiry
variable "monthly_budget_usd"  { default = 500   }  # Budget tracking target
```

---

## 🔄 CI/CD Pipeline

```
Push to main
    │
    ├── 🧪 Unit Tests (pytest, 80% coverage gate)
    │
    ├── 🔧 Terraform Init
    │
    ├── 📋 Terraform Plan
    │
    └── 🚀 Terraform Apply (auto-approve on main)
```

Pull requests run tests + plan only. Deployment to production only triggers on merge to `main`.

---

## 🏛️ Key Engineering Decisions

| Decision | Rationale |
|:---|:---|
| **T-2 data pull** | Cost Explorer data isn't settled for 48h — avoids false anomalies from incomplete data |
| **Two DynamoDB tables** | Separating raw from aggregated keeps dashboard queries fast and cheap |
| **Pure function anomaly detection** | `detector.py` has zero AWS dependencies — fully testable without mocking |
| **Sequential pipeline** | Aggregator invokes detector synchronously, ensuring data consistency |
| **Parameterized thresholds** | Z-score and spike thresholds tunable via Terraform without code deploys |
| **HTTP API v2** (not REST) | 70% cheaper than REST API for simple proxy routes |
| **GSI on cost_aggregated** | Enables O(1) service trend queries instead of expensive full table scans |
| **Secrets Manager** (not env vars) | Slack webhook URL never exposed in Lambda configuration |
| **PAY_PER_REQUEST** billing | Cost-efficient for bursty daily workloads vs. provisioned capacity |

---

## 🗺️ Roadmap

- [ ] Multi-account cost aggregation (AWS Organizations)
- [ ] Per-team cost attribution via resource tags
- [ ] Grafana integration for advanced dashboarding
- [ ] PagerDuty/Microsoft Teams notification channels
- [ ] Cost forecasting with linear regression
- [ ] Reserved Instance / Savings Plan recommendations
- [ ] Terraform Cloud remote backend integration
- [ ] Email digest reports (weekly summary)

---

## 📜 License

This project is open-sourced under the [MIT License](LICENSE).

---

<div align="center">

**Built with ☕ and a healthy fear of surprise AWS bills.**

If this project helped you or impressed you, consider giving it a ⭐

</div>
