@echo off
cd /d "%~dp0"

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe" set "NODE_EXE=C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe"
if not defined NODE_EXE if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"

if not defined NODE_EXE (
  echo.
  echo    ?????? Node.js?????????? https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo.
echo    ============================================
echo       ?????????? ^| GitHub Pages
echo    ============================================
echo.

set "SRC="
if exist "sync-source.txt" set /p SRC=<sync-source.txt

if defined SRC (
  if exist "%SRC%" (
    echo    [1/2] ?????????????? %SRC%
    echo.
    "%NODE_EXE%" scripts\sync-local.js "%SRC%"
    if errorlevel 1 goto fail
  ) else (
    echo    ??????????????????????  %SRC%
  )
) else (
  echo    ??????????????? sync-source.txt
)

echo.
echo    [2/2] ????? GitHub ...
echo.
"%NODE_EXE%" scripts\publish.js
if errorlevel 1 goto fail

echo.
echo    ??¨À????? 1 ?????????
echo    https://xd-sp.github.io/
echo.
pause
exit /b 0

:fail
echo.
echo    ¦Ä?????????????????????
echo.
pause
exit /b 1
