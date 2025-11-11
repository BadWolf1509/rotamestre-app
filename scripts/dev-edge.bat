@echo off
echo ========================================
echo   RotaMestre Development with Edge
echo ========================================
echo.
echo Starting development server on port 8081...
echo.

REM Kill any existing process on port 8081
echo Stopping any existing processes on port 8081...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8081') do taskkill /F /PID %%a 2>nul

echo.
echo Starting Expo with web support...
cd /d "%~dp0\.."

REM Set environment to development
set NODE_ENV=development
set DEBUG=*

REM Start Expo
echo.
echo Server starting at http://localhost:8081
echo.
echo DevTools shortcuts:
echo   - F12: Open Edge DevTools
echo   - Ctrl+Shift+D: Toggle Debug Panel
echo   - Ctrl+R: Reload page
echo.
echo Starting in 3 seconds...
timeout /t 3 /nobreak >nul

REM Start Edge browser automatically
start msedge "http://localhost:8081" --auto-open-devtools-for-tabs

REM Start Expo
npm run web -- --port 8081

pause