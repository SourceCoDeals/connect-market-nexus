#!/usr/bin/env bash
# =============================================================================
# Developer Setup Script for connect-market-nexus
# =============================================================================
# Usage:
#   bash scripts/setup.sh         # Full setup
#   bash scripts/setup.sh --skip-install  # Skip npm install
#
# This script prepares your local environment for development.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors for output
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERR]${NC}  $1"; }

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
SKIP_INSTALL=false

for arg in "$@"; do
  case $arg in
    --skip-install)
      SKIP_INSTALL=true
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Navigate to project root
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo ""
echo "=============================================="
echo "  connect-market-nexus - Developer Setup"
echo "=============================================="
echo ""

# ---------------------------------------------------------------------------
# 1. Check Node.js version
# ---------------------------------------------------------------------------
info "Checking Node.js version..."

REQUIRED_NODE_VERSION=$(cat .nvmrc 2>/dev/null || echo "20")

if command -v node &> /dev/null; then
  CURRENT_NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$CURRENT_NODE_VERSION" -ge "$REQUIRED_NODE_VERSION" ]; then
    success "Node.js v$(node -v | sed 's/v//') (required: >=$REQUIRED_NODE_VERSION)"
  else
    warn "Node.js v$(node -v | sed 's/v//') detected, but v$REQUIRED_NODE_VERSION+ is required."
    if command -v nvm &> /dev/null; then
      info "Switching Node.js version via nvm..."
      nvm install "$REQUIRED_NODE_VERSION"
      nvm use "$REQUIRED_NODE_VERSION"
    else
      error "Please install Node.js v$REQUIRED_NODE_VERSION or later."
      error "  Recommended: Install nvm (https://github.com/nvm-sh/nvm)"
      exit 1
    fi
  fi
else
  error "Node.js is not installed."
  error "  Install it from https://nodejs.org/ or use nvm."
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Check npm
# ---------------------------------------------------------------------------
info "Checking npm..."

if command -v npm &> /dev/null; then
  success "npm v$(npm -v)"
else
  error "npm is not installed."
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. Set up environment file
# ---------------------------------------------------------------------------
info "Checking environment configuration..."

if [ -f .env ]; then
  success ".env file already exists"
else
  if [ -f .env.example ]; then
    cp .env.example .env
    warn ".env file created from .env.example"
    warn "Please update .env with your Supabase credentials before running the app."
  else
    error ".env.example not found. Cannot create .env file."
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 4. Install dependencies
# ---------------------------------------------------------------------------
if [ "$SKIP_INSTALL" = false ]; then
  info "Installing dependencies..."
  npm ci
  success "Dependencies installed"
else
  info "Skipping dependency installation (--skip-install)"
fi

# ---------------------------------------------------------------------------
# 5. Verify critical tooling
# ---------------------------------------------------------------------------
info "Verifying project tooling..."

# Check TypeScript
if npx tsc --version &> /dev/null; then
  success "TypeScript $(npx tsc --version)"
else
  warn "TypeScript check failed"
fi

# Check Vite
if npx vite --version &> /dev/null; then
  success "Vite $(npx vite --version)"
else
  warn "Vite check failed"
fi

# ---------------------------------------------------------------------------
# 6. Validate build
# ---------------------------------------------------------------------------
info "Running lint check..."
if npm run lint &> /dev/null; then
  success "Lint passed"
else
  warn "Lint check has warnings or errors (run 'npm run lint' for details)"
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "=============================================="
echo "  Setup complete!"
echo "=============================================="
echo ""
info "Quick commands:"
echo "  npm run dev        - Start development server (http://localhost:8080)"
echo "  npm run build      - Build for production"
echo "  npm run lint       - Run ESLint"
echo "  npm run test       - Run tests"
echo "  npm run test:watch - Run tests in watch mode"
echo ""
info "Docker commands:"
echo "  docker compose up app              - Start dev server in Docker"
echo "  docker compose --profile production up app-production  - Test production build"
echo ""
