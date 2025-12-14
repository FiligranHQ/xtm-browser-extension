#!/bin/bash
#
# Local Test Runner Script
#
# This script helps run tests locally with optional OpenCTI/OpenAEV integration.
#
# Usage:
#   ./scripts/test-local.sh [options]
#
# Options:
#   --unit        Run unit tests only
#   --opencti     Run OpenCTI integration tests
#   --openaev     Run OpenAEV integration tests
#   --all         Run all tests
#   --coverage    Run tests with coverage
#   --watch       Run tests in watch mode
#   --help        Show this help message
#
# Environment Variables:
#   OPENCTI_URL   - OpenCTI API URL (default: http://localhost:8080)
#   OPENCTI_TOKEN - OpenCTI API token
#   OPENAEV_URL   - OpenAEV API URL (default: http://localhost:8080)
#   OPENAEV_TOKEN - OpenAEV API token
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
RUN_UNIT=false
RUN_OPENCTI=false
RUN_OPENAEV=false
RUN_COVERAGE=false
RUN_WATCH=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --unit)
      RUN_UNIT=true
      shift
      ;;
    --opencti)
      RUN_OPENCTI=true
      shift
      ;;
    --openaev)
      RUN_OPENAEV=true
      shift
      ;;
    --all)
      RUN_UNIT=true
      RUN_OPENCTI=true
      RUN_OPENAEV=true
      shift
      ;;
    --coverage)
      RUN_COVERAGE=true
      shift
      ;;
    --watch)
      RUN_WATCH=true
      shift
      ;;
    --help)
      head -35 "$0" | tail -28
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# If no specific test is selected, run unit tests
if ! $RUN_UNIT && ! $RUN_OPENCTI && ! $RUN_OPENAEV; then
  RUN_UNIT=true
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          XTM Browser Extension - Test Runner               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
fi

# Run unit tests
if $RUN_UNIT; then
  echo -e "${GREEN}Running unit tests...${NC}"
  if $RUN_WATCH; then
    npm run test:watch -- tests/unit
  elif $RUN_COVERAGE; then
    npm run test:coverage -- tests/unit
  else
    npm run test:unit
  fi
  echo -e "${GREEN}✓ Unit tests completed${NC}"
  echo
fi

# Run OpenCTI integration tests
if $RUN_OPENCTI; then
  echo -e "${GREEN}Running OpenCTI integration tests...${NC}"
  
  # Check for OpenCTI connection
  OPENCTI_URL=${OPENCTI_URL:-http://localhost:8080}
  OPENCTI_TOKEN=${OPENCTI_TOKEN:-}
  
  if [ -z "$OPENCTI_TOKEN" ]; then
    echo -e "${YELLOW}⚠ OPENCTI_TOKEN not set. Some tests may be skipped.${NC}"
    echo -e "${YELLOW}  Set OPENCTI_TOKEN environment variable to run full integration tests.${NC}"
  else
    # Test connection
    echo -e "${BLUE}Testing connection to OpenCTI at $OPENCTI_URL...${NC}"
    if curl -s -H "Authorization: Bearer $OPENCTI_TOKEN" "$OPENCTI_URL/graphql" \
       -d '{"query":"{ about { version } }"}' -H "Content-Type: application/json" \
       | grep -q "version"; then
      echo -e "${GREEN}✓ OpenCTI connection successful${NC}"
    else
      echo -e "${RED}✗ Cannot connect to OpenCTI. Check URL and token.${NC}"
      echo -e "${YELLOW}  Running tests anyway (they may skip integration tests)...${NC}"
    fi
  fi
  
  export OPENCTI_URL
  export OPENCTI_TOKEN
  
  if $RUN_COVERAGE; then
    npm run test:coverage -- --config vitest.config.opencti.ts
  else
    npm run test:opencti
  fi
  echo -e "${GREEN}✓ OpenCTI integration tests completed${NC}"
  echo
fi

# Run OpenAEV integration tests
if $RUN_OPENAEV; then
  echo -e "${GREEN}Running OpenAEV integration tests...${NC}"
  
  # Check for OpenAEV connection
  OPENAEV_URL=${OPENAEV_URL:-http://localhost:8080}
  OPENAEV_TOKEN=${OPENAEV_TOKEN:-}
  
  if [ -z "$OPENAEV_TOKEN" ]; then
    echo -e "${YELLOW}⚠ OPENAEV_TOKEN not set. Some tests may be skipped.${NC}"
    echo -e "${YELLOW}  Set OPENAEV_TOKEN environment variable to run full integration tests.${NC}"
  else
    # Test connection
    echo -e "${BLUE}Testing connection to OpenAEV at $OPENAEV_URL...${NC}"
    if curl -s -H "Authorization: Bearer $OPENAEV_TOKEN" "$OPENAEV_URL/api/settings" \
       | grep -q "platform"; then
      echo -e "${GREEN}✓ OpenAEV connection successful${NC}"
    else
      echo -e "${RED}✗ Cannot connect to OpenAEV. Check URL and token.${NC}"
      echo -e "${YELLOW}  Running tests anyway (they may skip integration tests)...${NC}"
    fi
  fi
  
  export OPENAEV_URL
  export OPENAEV_TOKEN
  
  if $RUN_COVERAGE; then
    npm run test:coverage -- --config vitest.config.openaev.ts
  else
    npm run test:openaev
  fi
  echo -e "${GREEN}✓ OpenAEV integration tests completed${NC}"
  echo
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    All tests completed!                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
