#!/usr/bin/env bash
# OWASP ZAP baseline scan — run locally against a running instance
# Usage: ./security/zap-baseline.sh http://localhost:5173

set -euo pipefail

TARGET="${1:-http://localhost:5173}"
REPORT_DIR="${2:-./security/reports}"

mkdir -p "$REPORT_DIR"

echo "Running OWASP ZAP baseline scan against $TARGET"

docker run --rm --network host \
  -v "$(pwd)/$REPORT_DIR:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t "$TARGET" \
  -r zap-report.html \
  -J zap-report.json \
  -d \
  -T 5 \
  -a || true

echo "Report saved to $REPORT_DIR/zap-report.html"
