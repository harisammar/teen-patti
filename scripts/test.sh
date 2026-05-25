#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  test.sh  —  Unified test runner for Teen Patti
#
#  Usage:
#    bash scripts/test.sh                    # unit tests (default)
#    bash scripts/test.sh --unit             # unit + component tests
#    bash scripts/test.sh --unit --coverage  # with HTML coverage report
#    bash scripts/test.sh --unit --watch     # watch mode (re-runs on save)
#    bash scripts/test.sh --unit --file cardUtils          # single file
#    bash scripts/test.sh --unit --test "createDeck"       # test name pattern
#    bash scripts/test.sh --e2e --ios                      # E2E on iOS
#    bash scripts/test.sh --e2e --android                  # E2E on Android
#    bash scripts/test.sh --e2e --both                     # E2E on both
#    bash scripts/test.sh --e2e --flow 01_sign_in          # one E2E flow
#    bash scripts/test.sh --all --ios                      # unit + E2E on iOS
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'; BOLD='\033[1m'

banner() {
  echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${CYAN}  Teen Patti — $1${RESET}"
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}\n"
}

# ── argument parsing ──────────────────────────────────────────────────────────

RUN_UNIT=false
RUN_E2E=false
COVERAGE=false
WATCH=false
FILE_PATTERN=""
TEST_PATTERN=""
E2E_PLATFORM="ios"
E2E_FLOW=""

[[ $# -eq 0 ]] && RUN_UNIT=true  # default: unit tests

while [[ $# -gt 0 ]]; do
  case "$1" in
    --unit)     RUN_UNIT=true ;;
    --e2e)      RUN_E2E=true  ;;
    --all)      RUN_UNIT=true; RUN_E2E=true ;;
    --coverage) COVERAGE=true ;;
    --watch)    WATCH=true ;;
    --file)     FILE_PATTERN="$2"; shift ;;
    --test|-t)  TEST_PATTERN="$2"; shift ;;
    --ios)      E2E_PLATFORM="ios"     ;;
    --android)  E2E_PLATFORM="android" ;;
    --both)     E2E_PLATFORM="both"    ;;
    --flow)     E2E_FLOW="$2"; shift ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *) echo "Unknown option: $1. Try --help."; exit 1 ;;
  esac
  shift
done

UNIT_OK=true
E2E_OK=true

# ── unit tests ────────────────────────────────────────────────────────────────

if $RUN_UNIT; then
  banner "Unit & Component Tests"

  JEST_ARGS=("--no-coverage")
  $COVERAGE && JEST_ARGS=("--coverage")
  $WATCH    && JEST_ARGS+=("--watch")
  [[ -n "$FILE_PATTERN" ]] && JEST_ARGS+=("--testPathPattern" "$FILE_PATTERN")
  [[ -n "$TEST_PATTERN" ]] && JEST_ARGS+=("--testNamePattern" "$TEST_PATTERN")

  echo -e "  Running: ${YELLOW}npx jest ${JEST_ARGS[*]}${RESET}\n"

  cd "$ROOT"
  if npx jest "${JEST_ARGS[@]}"; then
    echo -e "\n${GREEN}✓ All unit tests passed${RESET}"
  else
    echo -e "\n${RED}✗ Unit tests failed${RESET}"
    UNIT_OK=false
  fi

  if $COVERAGE; then
    echo -e "\n  ${CYAN}Coverage report: ${ROOT}/coverage/index.html${RESET}"
    # Open in browser on macOS
    [[ "$(uname)" == "Darwin" ]] && open "${ROOT}/coverage/index.html" 2>/dev/null || true
  fi
fi

# ── E2E tests ─────────────────────────────────────────────────────────────────

if $RUN_E2E; then
  banner "E2E Tests (Maestro)"

  E2E_ARGS=("--${E2E_PLATFORM}")
  [[ -n "$E2E_FLOW" ]] && E2E_ARGS+=("--flow" "$E2E_FLOW")

  echo -e "  Running flows on: ${YELLOW}${E2E_PLATFORM}${RESET}\n"

  if bash "${ROOT}/scripts/test-e2e.sh" "${E2E_ARGS[@]}"; then
    echo -e "\n${GREEN}✓ All E2E tests passed${RESET}"
  else
    echo -e "\n${RED}✗ E2E tests failed${RESET}"
    E2E_OK=false
  fi
fi

# ── summary ───────────────────────────────────────────────────────────────────

if $RUN_UNIT && $RUN_E2E; then
  echo -e "\n${BOLD}══ Summary ══${RESET}"
  $UNIT_OK && echo -e "  Unit tests:  ${GREEN}✓ PASSED${RESET}" || echo -e "  Unit tests:  ${RED}✗ FAILED${RESET}"
  $E2E_OK  && echo -e "  E2E  tests:  ${GREEN}✓ PASSED${RESET}" || echo -e "  E2E  tests:  ${RED}✗ FAILED${RESET}"
fi

$UNIT_OK && $E2E_OK
