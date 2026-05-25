#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  test-e2e.sh  —  Run Maestro E2E flows on iOS and / or Android.
#
#  Usage:
#    bash scripts/test-e2e.sh                   # prompt for platform
#    bash scripts/test-e2e.sh --ios             # iOS simulator only
#    bash scripts/test-e2e.sh --android         # Android emulator only
#    bash scripts/test-e2e.sh --both            # run on both
#    bash scripts/test-e2e.sh --flow 01_sign_in # run one flow (any platform)
#
#  Environment:
#    MAESTRO_TEST_EMAIL      override test account email
#    MAESTRO_TEST_PASSWORD   override test account password
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

FLOWS_DIR="$(cd "$(dirname "$0")/../.maestro/flows" && pwd)"
CONFIG="$(cd "$(dirname "$0")/../.maestro" && pwd)/config.yaml"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; RESET='\033[0m'; BOLD='\033[1m'

# ── helpers ───────────────────────────────────────────────────────────────────

check_maestro() {
  if ! command -v maestro &>/dev/null; then
    echo -e "${RED}✗ Maestro not found.${RESET}"
    echo "  Install it with:"
    echo "    curl -Ls 'https://get.maestro.mobile.dev' | bash"
    echo "  Then restart your terminal and re-run this script."
    exit 1
  fi
}

run_flows() {
  local platform="$1"
  local flow_filter="$2"   # empty = all flows

  local platform_flag=""
  [[ "$platform" == "ios" ]]     && platform_flag="--platform ios"
  [[ "$platform" == "android" ]] && platform_flag="--platform android"

  echo -e "\n${BOLD}▶  Running E2E flows on ${YELLOW}${platform}${RESET}${BOLD}...${RESET}\n"

  local passed=0 failed=0 flow_list=()

  if [[ -n "$flow_filter" ]]; then
    # Single flow — find the file
    local match
    match="$(find "$FLOWS_DIR" -name "*${flow_filter}*" | head -1)"
    if [[ -z "$match" ]]; then
      echo -e "${RED}✗ No flow matching '${flow_filter}' found in ${FLOWS_DIR}${RESET}"
      exit 1
    fi
    flow_list=("$match")
  else
    # All flows, sorted
    while IFS= read -r f; do flow_list+=("$f"); done \
      < <(find "$FLOWS_DIR" -name "*.yaml" | sort)
  fi

  for flow in "${flow_list[@]}"; do
    local name
    name="$(basename "$flow" .yaml)"
    echo -e "  ${BOLD}→ ${name}${RESET}"

    if maestro test $platform_flag \
        --env MAESTRO_TEST_EMAIL="${MAESTRO_TEST_EMAIL:-testplayer@example.com}" \
        --env MAESTRO_TEST_PASSWORD="${MAESTRO_TEST_PASSWORD:-testpass123}" \
        "$flow" 2>&1 | sed 's/^/    /'; then
      echo -e "    ${GREEN}✓ PASSED${RESET}"
      ((passed++))
    else
      echo -e "    ${RED}✗ FAILED${RESET}"
      ((failed++))
    fi
    echo
  done

  echo -e "${BOLD}─────────────────────────────────────${RESET}"
  echo -e "  ${platform} results: ${GREEN}${passed} passed${RESET}  ${RED}${failed} failed${RESET}"
  echo -e "${BOLD}─────────────────────────────────────${RESET}"

  [[ $failed -eq 0 ]]
}

# ── argument parsing ──────────────────────────────────────────────────────────

PLATFORM=""
FLOW_FILTER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ios)      PLATFORM="ios"     ;;
    --android)  PLATFORM="android" ;;
    --both)     PLATFORM="both"    ;;
    --flow)     FLOW_FILTER="$2"; shift ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//' | head -20
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

# Interactive platform picker if none specified
if [[ -z "$PLATFORM" ]]; then
  echo -e "${BOLD}Select platform:${RESET}"
  echo "  1) iOS"
  echo "  2) Android"
  echo "  3) Both"
  read -rp "Choice [1-3]: " choice
  case "$choice" in
    1) PLATFORM="ios"     ;;
    2) PLATFORM="android" ;;
    3) PLATFORM="both"    ;;
    *) echo "Invalid choice"; exit 1 ;;
  esac
fi

# ── run ───────────────────────────────────────────────────────────────────────

check_maestro

EXIT_CODE=0

if [[ "$PLATFORM" == "both" ]]; then
  run_flows "ios"     "$FLOW_FILTER" || EXIT_CODE=1
  run_flows "android" "$FLOW_FILTER" || EXIT_CODE=1
else
  run_flows "$PLATFORM" "$FLOW_FILTER" || EXIT_CODE=1
fi

exit $EXIT_CODE
