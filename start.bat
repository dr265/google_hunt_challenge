@echo off
REM ============================================================
REM  NEXUS AI Campus - start backend + frontend together
REM  Backend : FastAPI  -> http://localhost:8010  (CleanApis Gemini-flash LLM)
REM  Frontend: Vite dev -> http://localhost:5173  (proxies /api -> :8010)
REM ============================================================
title NEXUS AI Campus
cd /d "%~dp0"

echo.
echo  [NEXUS] Starting unified backend + frontend...
echo.

REM ---- 1. Backend deps (first run only) ----
python -c "import fastapi, uvicorn, bs4, requests, jwt, dotenv" >nul 2>&1
if errorlevel 1 (
  echo  [NEXUS] Installing backend dependencies...
  pip install -q -r backend\requirements.txt
)

REM ---- 2. Frontend deps (first run only) ----
if not exist "node_modules" (
  echo  [NEXUS] Installing frontend dependencies...
  call npm install
)

REM ---- 3. Launch backend (skip if already running on :8010) ----
curl -s -m 3 http://localhost:8010/api/health >nul 2>&1
if not errorlevel 1 (
  echo  [NEXUS] Backend is ALREADY RUNNING on http://localhost:8010 - reusing it.
  goto backend_ready
)
echo  [NEXUS] Launching backend on http://localhost:8010 ...
start "NEXUS Backend (FastAPI :8010)" cmd /k "cd /d %~dp0backend && python main.py"

REM ---- 4. Wait for the backend health endpoint ----
set /a tries=0
:wait_backend
timeout /t 2 /nobreak >nul
curl -s -m 3 http://localhost:8010/api/health >nul 2>&1
if errorlevel 1 (
  set /a tries+=1
  if %tries% lss 15 goto wait_backend
  echo  [NEXUS] WARNING: backend did not respond yet - check the backend window.
  goto backend_ready
)
echo  [NEXUS] Backend is ONLINE.
:backend_ready

REM ---- 5. Launch frontend in its own window (proxy target :8010) ----
set NEXUS_API_URL=http://localhost:8010
echo  [NEXUS] Launching frontend on http://localhost:5173 ...
start "NEXUS Frontend (Vite :5173)" cmd /k "cd /d %~dp0 && set NEXUS_API_URL=http://localhost:8010&& npm run dev"

REM ---- 6. Open the app in the browser ----
timeout /t 5 /nobreak >nul
start http://localhost:5173

echo.
echo  ============================================================
echo   NEXUS AI Campus is running:
echo     Frontend : http://localhost:5173
echo     Backend  : http://localhost:8010  (docs: /docs)
echo   LLM       : CleanApis https://cleanapis.com/v1 (gemini-3.7-flash)
echo   Close the two NEXUS windows to stop.
echo  ============================================================
echo.
pause
