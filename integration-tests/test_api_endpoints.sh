#!/bin/bash
# integration-tests/test_api_endpoints.sh
# Usage: ./test_api_endpoints.sh <API_BASE_URL>

API_URL="${1:-http://localhost:3001}"
PASS=0
FAIL=0

check() {
  local desc="$1"
  local condition="$2"
  if [ "$condition" = "true" ]; then
    echo "✅ PASS: $desc"
    PASS=$((PASS+1))
  else
    echo "❌ FAIL: $desc"
    FAIL=$((FAIL+1))
  fi
}

echo "Testing API at: $API_URL"
echo "---------------------------------"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/costs")
check "/costs returns 200" "$([ "$STATUS" = "200" ] && echo true || echo false)"

COSTS_BODY=$(curl -s "$API_URL/costs")
HAS_TOTAL=$(echo "$COSTS_BODY" | python -c "import json,sys; d=json.load(sys.stdin); print(str('total_cost_usd' in d and 'records' in d).lower())")
check "/costs has total_cost_usd and records" "$HAS_TOTAL"

TREND_BODY=$(curl -s "$API_URL/costs/AmazonEC2")
HAS_TREND=$(echo "$TREND_BODY" | python -c "import json,sys; d=json.load(sys.stdin); print(str('trend' in d and isinstance(d['trend'], list)).lower())")
check "/costs/{service} has trend array" "$HAS_TREND"

ANOM_BODY=$(curl -s "$API_URL/anomalies")
HAS_ANOM=$(echo "$ANOM_BODY" | python -c "import json,sys; d=json.load(sys.stdin); print(str('anomalies' in d and isinstance(d['anomalies'], list)).lower())")
check "/anomalies has anomalies array" "$HAS_ANOM"

IS_BOOL=$(echo "$COSTS_BODY" | python -c "
import json,sys
d = json.load(sys.stdin)
records = d.get('records', [])
result = all(isinstance(r.get('is_anomaly'), bool) for r in records) if records else False
print(str(result).lower())
")
check "is_anomaly is a real boolean" "$IS_BOOL"

START=$(date +%s%N)
curl -s -o /dev/null "$API_URL/costs"
END=$(date +%s%N)
ELAPSED_MS=$(( (END - START) / 1000000 ))
check "Response time under 1000ms (got ${ELAPSED_MS}ms)" "$([ "$ELAPSED_MS" -lt 1000 ] && echo true || echo false)"

echo "---------------------------------"
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1