@echo off
setlocal enabledelayedexpansion

:: ============================================================
:: SMART PARKING SYSTEM — AUTO RUN SCRIPT (Windows)
:: ============================================================

echo.
echo ==========================================
echo SMART PARKING SYSTEM — AUTO RUN
echo ==========================================
echo.

:: Set root directory
set "ROOT_DIR=%~dp0"
set "ROOT_DIR=%ROOT_DIR:~0,-1%"

:: Create logs directory
if not exist "%ROOT_DIR%\logs" mkdir "%ROOT_DIR%\logs"

:: ============================================================
:: STEP 1 — BACKEND SETUP
:: ============================================================
echo [1/6] Setting up backend...

cd /d "%ROOT_DIR%\backend"

:: Check node_modules
if not exist "node_modules" (
    echo       Installing backend dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo    [ERROR] Failed to install backend dependencies.
        echo    [FIX]   Run manually: cd backend ^&^& npm install
        pause
        exit /b 1
    )
    echo       Backend dependencies installed.
) else (
    echo       Backend dependencies already exist.
)

:: Check .env file
if not exist ".env" (
    echo       .env file not found. Generating from .env.example...
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo       .env file created. Please edit it with your actual credentials.
    ) else (
        echo       [WARNING] .env.example not found. Creating default .env...
        (
            echo DATABASE_URL=postgresql://username:password@host:6543/postgres
            echo MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/SmartParking
            echo REDIS_URL=redis://default:password@host:6379
            echo PORT=8000
            echo JWT_SECRET=your_secret_here
            echo NODE_ENV=development
            echo CORS_ORIGIN=http://localhost:5173
        ) > .env
        echo       Default .env created. Edit it with your credentials.
    )
) else (
    echo       .env file exists.
)

:: ============================================================
:: STEP 2 — DATABASE MIGRATIONS
:: ============================================================
echo.
echo [2/6] Running database migrations...

call npx drizzle-kit push 2>> "%ROOT_DIR%\logs\backend.log"
if errorlevel 1 (
    echo       [WARNING] Migration failed. This is normal if DB is not configured yet.
    echo       The backend will still start, but database features won't work.
) else (
    echo       Database migrations completed.
)

:: ============================================================
:: STEP 3 — TEST DATABASE CONNECTIONS
:: ============================================================
echo.
echo [3/6] Testing database connections...

echo       Testing PostgreSQL...
node src\db\test-postgres.js >> "%ROOT_DIR%\logs\backend.log" 2>&1
if errorlevel 1 (
    set "PG_STATUS=DISCONNECTED"
    echo       [WARN] PostgreSQL not connected. Check .env credentials.
) else (
    set "PG_STATUS=CONNECTED"
    echo       [OK]   PostgreSQL connected.
)

echo       Testing MongoDB...
node src\db\test-mongo.js >> "%ROOT_DIR%\logs\backend.log" 2>&1
if errorlevel 1 (
    set "MONGO_STATUS=DISCONNECTED"
    echo       [WARN] MongoDB not connected. Check .env credentials.
) else (
    set "MONGO_STATUS=CONNECTED"
    echo       [OK]   MongoDB connected.
)

echo       Testing Redis...
node src\db\test-redis.js >> "%ROOT_DIR%\logs\backend.log" 2>&1
if errorlevel 1 (
    set "REDIS_STATUS=DISCONNECTED (optional)"
    echo       [WARN] Redis not connected. This is optional.
) else (
    set "REDIS_STATUS=CONNECTED"
    echo       [OK]   Redis connected.
)

:: ============================================================
:: STEP 4 — START BACKEND
:: ============================================================
echo.
echo [4/6] Starting backend server...

start "Smart-Parking Backend" cmd /k "cd /d %ROOT_DIR%\backend && npm run dev 2>&1 | tee %ROOT_DIR%\logs\backend.log"

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

echo       Backend server starting... (check new window)

:: ============================================================
:: STEP 5 — FRONTEND SETUP
:: ============================================================
echo.
echo [5/6] Setting up frontend...

cd /d "%ROOT_DIR%\frontend"

:: Check node_modules
if not exist "node_modules" (
    echo       Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo    [ERROR] Failed to install frontend dependencies.
        echo    [FIX]   Run manually: cd frontend ^&^& npm install
        taskkill /FI "WINDOWTITLE eq Smart-Parking Backend*" /T /F >nul 2>&1
        pause
        exit /b 1
    )
    echo       Frontend dependencies installed.
) else (
    echo       Frontend dependencies already exist.
)

:: ============================================================
:: STEP 6 — START FRONTEND
:: ============================================================
echo.
echo [6/6] Starting frontend dev server...

start "Smart-Parking Frontend" cmd /k "cd /d %ROOT_DIR%\frontend && npm run dev 2>&1 | tee %ROOT_DIR%\logs\frontend.log"

:: Wait a moment for frontend to start
timeout /t 3 /nobreak >nul

echo       Frontend server starting... (check new window)

:: ============================================================
:: STATUS REPORT
:: ============================================================
echo.
echo ==========================================
echo SMART PARKING SYSTEM — AUTO RUN STATUS
echo ------------------------------------------
echo Backend:    RUNNING (port 8000)
echo Frontend:  RUNNING (port 5173)
echo PostgreSQL: %PG_STATUS%
echo MongoDB:    %MONGO_STATUS%
echo Redis:      %REDIS_STATUS%
echo Logs saved in: %ROOT_DIR%\logs\
echo ==========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo To stop all servers, close the two opened terminal windows.
echo.
pause
