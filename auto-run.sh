#!/usr/bin/env bash

# ============================================================
# SMART PARKING SYSTEM — AUTO RUN SCRIPT (Linux / macOS)
# ============================================================

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================
# ENVIRONMENT DETECTION
# ============================================================

detect_os() {
    case "$(uname -s)" in
        Linux*)     OS="linux";;
        Darwin*)    OS="mac";;
        *)          OS="unknown";;
    esac
    echo -e "${BLUE}Detected OS: ${OS}${NC}"
}

detect_npm() {
    if command -v npm &> /dev/null; then
        NPM_CMD="npm"
    else
        echo -e "${RED}Error: npm is not installed or not in PATH${NC}"
        exit 1
    fi
}

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC}   $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

cleanup() {
    echo ""
    log_warning "Shutting down all services..."

    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null
        log_info "Backend stopped (PID: $BACKEND_PID)"
    fi

    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null
        log_info "Frontend stopped (PID: $FRONTEND_PID)"
    fi

    log_info "All services stopped. Goodbye!"
    exit 0
}

trap cleanup INT TERM

# ============================================================
# MAIN SCRIPT
# ============================================================

echo ""
echo "=========================================="
echo "SMART PARKING SYSTEM — AUTO RUN"
echo "=========================================="
echo ""

# Detect environment
detect_os
detect_npm

# Set root directory (where this script lives)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create logs directory
mkdir -p "$ROOT_DIR/logs"

# ============================================================
# STEP 1 — BACKEND SETUP
# ============================================================
echo ""
log_info "[1/6] Setting up backend..."

cd "$ROOT_DIR/backend"

# Check node_modules
if [ ! -d "node_modules" ]; then
    log_info "Installing backend dependencies..."
    if ! $NPM_CMD install; then
        echo ""
        log_error "Failed to install backend dependencies."
        log_error "[FIX]   Run manually: cd backend && npm install"
        exit 1
    fi
    log_success "Backend dependencies installed."
else
    log_success "Backend dependencies already exist."
fi

# Check .env file
if [ ! -f ".env" ]; then
    log_info ".env file not found. Generating from .env.example..."
    if [ -f ".env.example" ]; then
        cp ".env.example" ".env"
        log_success ".env file created. Please edit it with your actual credentials."
    else
        log_warning ".env.example not found. Creating default .env..."
        cat > .env << 'ENVEOF'
DATABASE_URL=postgresql://username:password@host:6543/postgres
MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/SmartParking
REDIS_URL=redis://default:password@host:6379
PORT=8000
JWT_SECRET=your_secret_here
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
ENVEOF
        log_warning "Default .env created. Edit it with your credentials."
    fi
else
    log_success ".env file exists."
fi

# ============================================================
# STEP 2 — DATABASE MIGRATIONS
# ============================================================
echo ""
log_info "[2/6] Running database migrations..."

if npx drizzle-kit push >> "$ROOT_DIR/logs/backend.log" 2>&1; then
    log_success "Database migrations completed."
else
    log_warning "Migration failed. This is normal if DB is not configured yet."
    log_warning "The backend will still start, but database features won't work."
fi

# ============================================================
# STEP 3 — TEST DATABASE CONNECTIONS
# ============================================================
echo ""
log_info "[3/6] Testing database connections..."

# Test PostgreSQL
echo "      Testing PostgreSQL..."
if node src/db/test-postgres.js >> "$ROOT_DIR/logs/backend.log" 2>&1; then
    PG_STATUS="CONNECTED"
    log_success "PostgreSQL connected."
else
    PG_STATUS="DISCONNECTED"
    log_warning "PostgreSQL not connected. Check .env credentials."
fi

# Test MongoDB
echo "      Testing MongoDB..."
if node src/db/test-mongo.js >> "$ROOT_DIR/logs/backend.log" 2>&1; then
    MONGO_STATUS="CONNECTED"
    log_success "MongoDB connected."
else
    MONGO_STATUS="DISCONNECTED"
    log_warning "MongoDB not connected. Check .env credentials."
fi

# Test Redis
echo "      Testing Redis..."
if node src/db/test-redis.js >> "$ROOT_DIR/logs/backend.log" 2>&1; then
    REDIS_STATUS="CONNECTED"
    log_success "Redis connected."
else
    REDIS_STATUS="DISCONNECTED (optional)"
    log_warning "Redis not connected. This is optional."
fi

# ============================================================
# STEP 4 — START BACKEND
# ============================================================
echo ""
log_info "[4/6] Starting backend server..."

cd "$ROOT_DIR/backend"
$NPM_CMD run dev >> "$ROOT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

if kill -0 "$BACKEND_PID" 2>/dev/null; then
    log_success "Backend server running (PID: $BACKEND_PID, port: 8000)"
else
    echo ""
    log_error "Backend failed to start!"
    log_error "Check logs: cat $ROOT_DIR/logs/backend.log"
    log_error "[FIX] Possible issues:"
    log_error "  1. Port 8000 is already in use"
    log_error "  2. Missing dependencies — run: cd backend && npm install"
    log_error "  3. Invalid .env configuration"
    exit 1
fi

# ============================================================
# STEP 5 — FRONTEND SETUP
# ============================================================
echo ""
log_info "[5/6] Setting up frontend..."

cd "$ROOT_DIR/frontend"

# Check node_modules
if [ ! -d "node_modules" ]; then
    log_info "Installing frontend dependencies..."
    if ! $NPM_CMD install; then
        echo ""
        log_error "Failed to install frontend dependencies."
        log_error "[FIX]   Run manually: cd frontend && npm install"
        kill "$BACKEND_PID" 2>/dev/null
        exit 1
    fi
    log_success "Frontend dependencies installed."
else
    log_success "Frontend dependencies already exist."
fi

# ============================================================
# STEP 6 — START FRONTEND
# ============================================================
echo ""
log_info "[6/6] Starting frontend dev server..."

$NPM_CMD run dev >> "$ROOT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 3

if kill -0 "$FRONTEND_PID" 2>/dev/null; then
    log_success "Frontend server running (PID: $FRONTEND_PID, port: 5173)"
else
    echo ""
    log_error "Frontend failed to start!"
    log_error "Check logs: cat $ROOT_DIR/logs/frontend.log"
    log_error "[FIX] Possible issues:"
    log_error "  1. Port 5173 is already in use"
    log_error "  2. Missing dependencies — run: cd frontend && npm install"
    kill "$BACKEND_PID" 2>/dev/null
    exit 1
fi

# ============================================================
# STATUS REPORT
# ============================================================
echo ""
echo "=========================================="
echo "SMART PARKING SYSTEM — AUTO RUN STATUS"
echo "------------------------------------------"
echo "Backend:    RUNNING (port 8000)"
echo "Frontend:  RUNNING (port 5173)"
echo "PostgreSQL: $PG_STATUS"
echo "MongoDB:    $MONGO_STATUS"
echo "Redis:      $REDIS_STATUS"
echo "Logs saved in: $ROOT_DIR/logs/"
echo "=========================================="
echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all servers."
echo ""

# Wait for user to press Ctrl+C
wait
