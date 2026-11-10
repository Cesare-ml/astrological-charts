@echo off
setlocal
cd /d "%~dp0"
echo Astrological Charts - local demo (synthetic assets)
echo No production credentials or real VirgoStars artwork needed.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is missing. Install Node.js 22 LTS from https://nodejs.org/
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm is missing. Reinstall Node.js and open this file again.
  pause
  exit /b 1
)
if not exist "node_modules\@angular\cli\bin\ng.js" (
  echo Installing dependencies once...
  call npm ci
  if errorlevel 1 goto fail
)
if not exist ".local\demo-pack\manifests\approved-assets.json" (
  echo Creating a safe synthetic image pack...
  call npm run demo:pack
  if errorlevel 1 goto fail
)
echo Opening two local servers in separate windows...
start "Astrological Charts - Assets" cmd /k "cd /d ""%~dp0"" && npm run demo:assets"
start "Astrological Charts - Demo" cmd /k "cd /d ""%~dp0"" && npm run demo"
echo If the page is not ready yet, refresh in a moment:
echo http://127.0.0.1:4200/
start "" "http://127.0.0.1:4200/"
exit /b 0
:fail
echo Setup failed. Copy the error and ask your AI assistant for help.
pause
exit /b 1
