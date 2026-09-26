@echo off
cd /d "%~dp0"
title Finances Dashboard

echo ================================================================================
echo FINANCES DASHBOARD
echo ================================================================================
echo.
echo Starting server...
echo Dashboard will open in your browser automatically.
echo.
echo Drop Excel files in: vault\inbox\finances\
echo Dashboard auto-processes when you open it.
echo.
echo Press Ctrl+C to stop the server when done.
echo ================================================================================
echo.

:: Wait 2 seconds then open browser
start /B timeout /t 2 /nobreak >nul && start http://localhost:8000

:: Start the Flask server
python serve_dashboard.py

pause
