@echo off
chcp 65001 >nul
title Aeris - Weather Intelligence
set "NODEDIR=%LOCALAPPDATA%\Programs\node-portable\node-v24.20.0-win-x64"
set "PATH=%NODEDIR%;%PATH%"
cd /d "%~dp0"

if not exist node_modules (
  echo Устанавливаю зависимости, это займёт пару минут...
  call npm install --no-audit --no-fund
)

echo.
echo   Aeris запускается...
echo   Фронтенд : http://localhost:5173
echo   API      : http://localhost:4000/api/health
echo   Демо     : demo@aeris.app / demo1234
echo.

start "" http://localhost:5173
call npm run dev
pause
