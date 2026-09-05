@echo off
chcp 65001 >nul
title Wide Gamut Target Testing & Offset Analysis System

echo ==========================================================
echo  Starting Wide Gamut Target Testing & Offset Analysis...
echo ==========================================================

:: Check Python installation
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    py -3 --version >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Python 3 was not found. Please install Python 3.10+ and add it to PATH.
        pause
        exit /b 1
    )
    set PY_CMD=py -3
) else (
    set PY_CMD=python
)

:: Install / Verify dependencies
echo [INFO] Verifying required packages...
%PY_CMD% -m pip install -r requirements.txt >nul 2>&1

:: Free port 8000 if occupied
echo [INFO] Checking port 8000 status...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo [INFO] Releasing port 8000 occupied by PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

:: Launch FastAPI backend
echo [INFO] Starting backend server at http://127.0.0.1:8000 ...
start "" %PY_CMD% backend/server.py

:: Wait for initialization
timeout /t 2 /nobreak >nul

:: Open browser
echo [INFO] Launching browser console...
start http://127.0.0.1:8000

echo ----------------------------------------------------------
echo  Console URL: http://127.0.0.1:8000
echo  Target Window: http://127.0.0.1:8000/patch
echo ----------------------------------------------------------
echo Server is running. Press Ctrl+C or close this window to exit.
