@echo off
setlocal
cd /d "%~dp0"
if exist "%TEMP%\mandolin-runtime\node-v22.16.0-win-x64\node.exe" set "PATH=%TEMP%\mandolin-runtime\node-v22.16.0-win-x64;%PATH%"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 22.13 or later, then reopen this file.
  pause
  exit /b 1
)
echo Starting Stringshift. Open the Local URL printed below in your browser.
echo Keep this window open while using the page. Press Ctrl+C to stop.
call npm.cmd run dev
pause
