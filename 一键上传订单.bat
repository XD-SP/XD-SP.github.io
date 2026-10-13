@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe" set "NODE_EXE=C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe"
if not defined NODE_EXE if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"

if not defined NODE_EXE (
  echo.
  echo    没有找到 Node.js，请先安装： https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo.
echo    ============================================
echo       一键上传订单 ^| GitHub Pages
echo    ============================================
echo.

set "SRC="
if exist "sync-source.txt" set /p SRC=<sync-source.txt

if defined SRC (
  if exist "%SRC%" (
    echo    [1/2] 从同步盘导入订单： %SRC%
    echo.
    "%NODE_EXE%" scripts\sync-local.js "%SRC%"
    if errorlevel 1 goto fail
  ) else (
    echo    跳过导入：配置的源目录不存在  %SRC%
  )
) else (
  echo    跳过导入：没有配置 sync-source.txt
)

echo.
echo    [2/2] 上传到 GitHub ...
echo.
"%NODE_EXE%" scripts\publish.js
if errorlevel 1 goto fail

echo.
echo    完成。站点约 1 分钟后更新。
echo    https://xd-sp.github.io/
echo.
pause
exit /b 0

:fail
echo.
echo    未能完成，请查看上方错误信息。
echo.
pause
exit /b 1
