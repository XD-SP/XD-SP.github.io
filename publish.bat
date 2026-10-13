@echo off
chcp 65001 >nul
cd /d "%~dp0.."

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe" set "NODE_EXE=C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe"
if not defined NODE_EXE if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"

if not defined NODE_EXE (
  echo.
  echo   没有找到 Node.js，请先安装： https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo.
echo   ============================================
echo      订单数据一键上传到 GitHub Pages
echo   ============================================
echo.

"%NODE_EXE%" scripts\publish.js

echo.
pause
