#!/usr/bin/env bash
# scripts/invoke_pipeline.sh
#
# Runs the full FinOps pipeline in order (Ingestor → Aggregator → Anomaly Detector)
# and reports pass/fail at each stage, mimicking what EventBridge does automatically
# but on-demand for testing.
#
# Corresponds to: finops-implementation-plan-team.md Phase A4 operational tooling.
# Run after `scripts/seed_test_data.py` + `scripts/seed_spike.py`.
#
# Usage:
#   bash scripts/invoke_pipeline.sh
#   bash scripts/invoke_pipeline.sh --skip-ingestor

set -e

# ── Load .env if present ────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# ── Configuration from environment ──────────────────────────
AWS_REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
INGESTOR_FN="${INGESTOR_FUNCTION_NAME:-finops-cost-ingestor-${ENVIRONMENT}}"
AGGREGATOR_FN="${AGGREGATOR_FUNCTION_NAME:-finops-cost-aggregator-${ENVIRONMENT}}"
DETECTOR_FN="${DETECTOR_FUNCTION_NAME:-finops-anomaly-detector-${ENVIRONMENT}}"
TODAY="$(date -u +%Y-%m-%d)"

# ── Output colors ───────────────────────────────────────────
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
BOLD="\033[1m"
RESET="\033[0m"

pass()  { echo -e "${GREEN}✅ PASS${RESET} $1"; }
fail()  { echo -e "${RED}❌ FAIL${RESET} $1"; }
info()  { echo -e "${CYAN}ℹ ${RESET} $1"; }
step()  { echo -e "\n${BOLD}── Step $1: $2 ──${RESET}"; }

# ── Parse arguments ─────────────────────────────────────────
SKIP_INGESTOR=false
for arg in "$@"; do
    case "$arg" in
        --skip-ingestor) SKIP_INGESTOR=true ;;
        --help|-h)
            echo "Usage: bash scripts/invoke_pipeline.sh [--skip-ingestor]"
            echo ""
            echo "Runs the FinOps pipeline: Ingestor → Aggregator → Anomaly Detector."
            echo "Use --skip-ingestor to re-run aggregation + detection against already-seeded data."
            exit 0
            ;;
        *)
            echo "Unknown argument: $arg"
            echo "Usage: bash scripts/invoke_pipeline.sh [--skip-ingestor]"
            exit 1
            ;;
    esac
done

# ── Response file directory ─────────────────────────────────
RESPONSE_DIR="${SCRIPT_DIR}/.pipeline_responses"
mkdir -p "$RESPONSE_DIR"

echo -e "${BOLD}FinOps Pipeline — ${TODAY}${RESET}"
echo -e "Region: ${AWS_REGION}  Environment: ${ENVIRONMENT}"
echo ""

# ── Helper: invoke a Lambda and check status ────────────────
invoke_lambda() {
    local fn_name="$1"
    local response_file="$2"
    local payload="${3:-{}}"

    info "Invoking ${fn_name}..."

    local status_code
    status_code=$(aws lambda invoke \
        --function-name "$fn_name" \
        --region "$AWS_REGION" \
        --payload "$payload" \
        --cli-binary-format raw-in-base64-out \
        "$response_file" \
        --query 'StatusCode' \
        --output text 2>&1) || {
        fail "${fn_name} — invoke command failed"
        echo "  Response file: ${response_file}"
        cat "$response_file" 2>/dev/null || true
        return 1
    }

    if [ "$status_code" = "200" ]; then
        pass "${fn_name} — StatusCode ${status_code}"
        info "Response: $(cat "$response_file")"
        return 0
    else
        fail "${fn_name} — StatusCode ${status_code}"
        echo "  Response file: ${response_file}"
        cat "$response_file" 2>/dev/null || true
        return 1
    fi
}

# ── Step 1: Ingestor ────────────────────────────────────────
if [ "$SKIP_INGESTOR" = true ]; then
    step "1" "Ingestor (SKIPPED — using seeded data)"
    info "Skipping ingestor as --skip-ingestor was passed"
else
    step "1" "Cost Ingestor → cost_raw"
    if ! invoke_lambda "$INGESTOR_FN" "${RESPONSE_DIR}/response_ingestor.json"; then
        fail "Pipeline aborted — ingestor failed. Fix before proceeding."
        exit 1
    fi
fi

# ── Step 2: Aggregator ──────────────────────────────────────
step "2" "Cost Aggregator → cost_aggregated"
if ! invoke_lambda "$AGGREGATOR_FN" "${RESPONSE_DIR}/response_aggregator.json"; then
    fail "Pipeline aborted — aggregator failed. Fix before proceeding."
    exit 1
fi

# ── Step 3: Anomaly Detector ────────────────────────────────
step "3" "Anomaly Detector (date: ${TODAY})"
DETECTOR_PAYLOAD='{"date": "'"${TODAY}"'"}'
if ! invoke_lambda "$DETECTOR_FN" "${RESPONSE_DIR}/response_detector.json" "$DETECTOR_PAYLOAD"; then
    fail "Pipeline aborted — anomaly detector failed."
    exit 1
fi

# ── Parse detector results ──────────────────────────────────
echo ""
ANOMALIES=$(python3 -c "
import json, sys
try:
    data = json.load(open('${RESPONSE_DIR}/response_detector.json'))
    print(data.get('anomalies_found', 0))
except Exception:
    print(0)
" 2>/dev/null || echo "0")

SERVICES_CHECKED=$(python3 -c "
import json, sys
try:
    data = json.load(open('${RESPONSE_DIR}/response_detector.json'))
    print(data.get('services_checked', 0))
except Exception:
    print(0)
" 2>/dev/null || echo "0")

echo -e "${BOLD}── Results ──${RESET}"
info "Services checked: ${SERVICES_CHECKED}"

if [ "$ANOMALIES" -gt 0 ] 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Anomalies found: ${ANOMALIES}${RESET}"
    info "Check #aws-cost-alerts in Slack for alert details"
else
    pass "No anomalies found"
fi

echo ""
info "Response files saved in: ${RESPONSE_DIR}/"
echo "  response_ingestor.json   — raw cost ingestion result"
echo "  response_aggregator.json — aggregation result"
echo "  response_detector.json   — anomaly detection result"

