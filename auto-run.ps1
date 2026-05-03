# ============================================================
# SMART PARKING SYSTEM — AUTO RUN SCRIPT (PowerShell)
# ============================================================

$ErrorActionPreference = "Stop"

# Color codes
function Write-Info    { Write-Host "[INFO] $($args -join ' ')" -ForegroundColor Cyan }
function Write-Ok      { Write-Host "[OK]   $($args -join ' ')" -ForegroundColor Green }
function Write-Warn    { Write-Host "[WARN] $($args -join ' ')" -ForegroundColor Yellow }
function Write-Err     { Write-Host "[ERROR] $($args -join ' ')" -ForegroundColor Red }

Write-Host ""
Write-Host "==========================================" -ForegroundColor White
Write-Host "SMART PARKING SYSTEM — AUTO RUN" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor White
Write-Host ""

# Ensure Node.js path is loaded (fix npm not found)
$env:Path += ";$env:ProgramFiles"
$env:Path += ";$env:ProgramFiles(x86)"

# ============================================================
# SETUP
# ============================================================

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogsDir = Join-Path $RootDir "logs"

# Create logs directory
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir | Out-Null
}

# Track PIDs for cleanup
$BackendProcess = $null
$FrontendProcess = $null

# Cleanup on exit
function Cleanup {
    Write-Host ""
    Write-Warn "Shutting down all services..."

    if ($BackendProcess -and -not $BackendProcess.HasExited) {
        Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
        Write-Info "Backend stopped."
    }

    if ($FrontendProcess -and -not $FrontendProcess.HasExited) {
        Stop-Process -Id $FrontendProcess.Id -Force -ErrorAction SilentlyContinue
        Write-Info "Frontend stopped."
    }

    Write-Info "All services stopped. Goodbye!"
    exit 0
}

Register-EngineEvent PowerShell.Exiting -Action { Cleanup } | Out-Null

# ============================================================
# STEP 1 — BACKEND SETUP
# ============================================================
Write-Host ""
Write-Info "[1/6] Setting up backend..."

$BackendDir = Join-Path $RootDir "backend"
Set-Location $BackendDir

# Check node_modules
if (-not (Test-Path "node_modules")) {
    Write-Info "Installing backend dependencies..."
    if (-not (npm install)) {
        Write-Err "Failed to install backend dependencies."
        Write-Err "[FIX]   Run manually: cd backend; npm install"
        pause
        exit 1
    }
    Write-Ok "Backend dependencies installed."
} else {
    Write-Ok "Backend dependencies already exist."
}

# Check .env file
if (-not (Test-Path ".env")) {
    Write-Info ".env file not found. Generating from .env.example..."
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Ok ".env file created. Please edit it with your actual credentials."
    } else {
        Write-Warn ".env.example not found. Creating default .env..."
        @"
DATABASE_URL=postgresql://username:password@host:6543/postgres
MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/SmartParking
REDIS_URL=redis://default:password@host:6379
PORT=8000
JWT_SECRET=your_secret_here
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
"@ | Out-File -FilePath ".env" -Encoding UTF8
        Write-Warn "Default .env created. Edit it with your credentials."
    }
} else {
    Write-Ok ".env file exists."
}

# ============================================================
# STEP 2 — DATABASE MIGRATIONS
# ============================================================
Write-Host ""
Write-Info "[2/6] Running database migrations..."

try {
    $null = npx drizzle-kit push 2>> (Join-Path $LogsDir "backend.log")
    Write-Ok "Database migrations completed."
} catch {
    Write-Warn "Migration failed. This is normal if DB is not configured yet."
    Write-Warn "The backend will still start, but database features won't work."
}

# ============================================================
# STEP 3 — TEST DATABASE CONNECTIONS
# ============================================================
Write-Host ""
Write-Info "[3/6] Testing database connections..."

# Test PostgreSQL
Write-Host "      Testing PostgreSQL..."
try {
    $null = node "src/db/test-postgres.js" 2>> (Join-Path $LogsDir "backend.log")
    $PgStatus = "CONNECTED"
    Write-Ok "PostgreSQL connected."
} catch {
    $PgStatus = "DISCONNECTED"
    Write-Warn "PostgreSQL not connected. Check .env credentials."
}

# Test MongoDB
Write-Host "      Testing MongoDB..."
try {
    $null = node "src/db/test-mongo.js" 2>> (Join-Path $LogsDir "backend.log")
    $MongoStatus = "CONNECTED"
    Write-Ok "MongoDB connected."
} catch {
    $MongoStatus = "DISCONNECTED"
    Write-Warn "MongoDB not connected. Check .env credentials."
}

# Test Redis
Write-Host "      Testing Redis..."
try {
    $null = node "src/db/test-redis.js" 2>> (Join-Path $LogsDir "backend.log")
    $RedisStatus = "CONNECTED"
    Write-Ok "Redis connected."
} catch {
    $RedisStatus = "DISCONNECTED (optional)"
    Write-Warn "Redis not connected. This is optional."
}

# ============================================================
# STEP 4 — START BACKEND
# ============================================================
Write-Host ""
Write-Info "[4/6] Starting backend server..."

$BackendLog = Join-Path $LogsDir "backend.log"
$BackendProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" `
    -WorkingDirectory $BackendDir `
    -WindowStyle Normal `
    -PassThru

Start-Sleep -Seconds 3

if ($BackendProcess -and -not $BackendProcess.HasExited) {
    Write-Ok "Backend server running (PID: $($BackendProcess.Id), port: 8000)"
} else {
    Write-Err "Backend failed to start!"
    Write-Err "Check logs: Get-Content $BackendLog"
    Write-Err "[FIX] Possible issues:"
    Write-Err "  1. Port 8000 is already in use"
    Write-Err "  2. Missing dependencies — run: cd backend; npm install"
    Write-Err "  3. Invalid .env configuration"
    pause
    exit 1
}

# ============================================================
# STEP 5 — FRONTEND SETUP
# ============================================================
Write-Host ""
Write-Info "[5/6] Setting up frontend..."

$FrontendDir = Join-Path $RootDir "frontend"
Set-Location $FrontendDir

# Check node_modules
if (-not (Test-Path "node_modules")) {
    Write-Info "Installing frontend dependencies..."
    if (-not (npm install)) {
        Write-Err "Failed to install frontend dependencies."
        Write-Err "[FIX]   Run manually: cd frontend; npm install"
        if ($BackendProcess -and -not $BackendProcess.HasExited) {
            Stop-Process -Id $BackendProcess.Id -Force
        }
        pause
        exit 1
    }
    Write-Ok "Frontend dependencies installed."
} else {
    Write-Ok "Frontend dependencies already exist."
}

# ============================================================
# STEP 6 — START FRONTEND
# ============================================================
Write-Host ""
Write-Info "[6/6] Starting frontend dev server..."

$FrontendLog = Join-Path $LogsDir "frontend.log"
$FrontendProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" `
    -WorkingDirectory $FrontendDir `
    -WindowStyle Normal `
    -PassThru

Start-Sleep -Seconds 3

if ($FrontendProcess -and -not $FrontendProcess.HasExited) {
    Write-Ok "Frontend server running (PID: $($FrontendProcess.Id), port: 5173)"
} else {
    Write-Err "Frontend failed to start!"
    Write-Err "Check logs: Get-Content $FrontendLog"
    Write-Err "[FIX] Possible issues:"
    Write-Err "  1. Port 5173 is already in use"
    Write-Err "  2. Missing dependencies — run: cd frontend; npm install"
    if ($BackendProcess -and -not $BackendProcess.HasExited) {
        Stop-Process -Id $BackendProcess.Id -Force
    }
    pause
    exit 1
}

# ============================================================
# STATUS REPORT
# ============================================================
Write-Host ""
Write-Host "==========================================" -ForegroundColor White
Write-Host "SMART PARKING SYSTEM — AUTO RUN STATUS" -ForegroundColor White
Write-Host "------------------------------------------" -ForegroundColor White
Write-Host "Backend:    RUNNING (port 8000)" -ForegroundColor Green
Write-Host "Frontend:  RUNNING (port 5173)" -ForegroundColor Green
Write-Host "PostgreSQL: $PgStatus" -ForegroundColor $(if ($PgStatus -eq "CONNECTED") { "Green" } else { "Yellow" })
Write-Host "MongoDB:    $MongoStatus" -ForegroundColor $(if ($MongoStatus -eq "CONNECTED") { "Green" } else { "Yellow" })
Write-Host "Redis:      $RedisStatus" -ForegroundColor $(if ($RedisStatus -eq "CONNECTED") { "Green" } else { "Yellow" })
Write-Host "Logs saved in: $LogsDir" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor White
Write-Host ""
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Blue
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Blue
Write-Host ""
Write-Host "Close the two opened terminal windows to stop the servers."
Write-Host ""
pause
