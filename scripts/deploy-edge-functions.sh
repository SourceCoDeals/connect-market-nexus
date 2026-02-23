#!/usr/bin/env bash
#
# Deploy all Supabase edge functions.
#
# Usage:
#   ./scripts/deploy-edge-functions.sh <project-ref>
#   PROJECT_REF=<project-ref> ./scripts/deploy-edge-functions.sh
#
# The script discovers every function directory inside supabase/functions/,
# skips internal entries (_shared, deno.json), and deploys each one.
# It exits immediately on the first failure.

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve PROJECT_REF from the first argument or the environment variable.
# ---------------------------------------------------------------------------
PROJECT_REF="${1:-${PROJECT_REF:-}}"

if [ -z "$PROJECT_REF" ]; then
  echo "ERROR: PROJECT_REF is required."
  echo "Pass it as the first argument or export it as an environment variable."
  echo ""
  echo "  Usage:  ./scripts/deploy-edge-functions.sh <project-ref>"
  echo "          PROJECT_REF=<ref> ./scripts/deploy-edge-functions.sh"
  exit 1
fi

# ---------------------------------------------------------------------------
# Locate the functions directory relative to the repository root.
# ---------------------------------------------------------------------------
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FUNCTIONS_DIR="${REPO_ROOT}/supabase/functions"

if [ ! -d "$FUNCTIONS_DIR" ]; then
  echo "ERROR: Functions directory not found at ${FUNCTIONS_DIR}"
  exit 1
fi

# ---------------------------------------------------------------------------
# Collect every function (directory only, skip _shared and non-directories).
# ---------------------------------------------------------------------------
FUNCTIONS=()
for entry in "$FUNCTIONS_DIR"/*/; do
  name="$(basename "$entry")"
  # Skip shared helpers and hidden directories
  if [[ "$name" == _* ]]; then
    continue
  fi
  FUNCTIONS+=("$name")
done

if [ ${#FUNCTIONS[@]} -eq 0 ]; then
  echo "ERROR: No edge functions found in ${FUNCTIONS_DIR}"
  exit 1
fi

echo "Deploying ${#FUNCTIONS[@]} edge functions to project ${PROJECT_REF}..."
echo ""

# ---------------------------------------------------------------------------
# Deploy each function. The script exits on the first failure (set -e).
# ---------------------------------------------------------------------------
DEPLOYED=0
for func in "${FUNCTIONS[@]}"; do
  echo "--- Deploying: ${func}"
  supabase functions deploy "$func" --project-ref "$PROJECT_REF"
  DEPLOYED=$((DEPLOYED + 1))
  echo "    OK (${DEPLOYED}/${#FUNCTIONS[@]})"
  echo ""
done

echo "All ${DEPLOYED} edge functions deployed successfully."
