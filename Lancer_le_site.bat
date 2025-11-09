@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >NUL
set PORT=5500

python -m http.server %PORT% >NUL 2>&1 &
if errorlevel 1 (
  echo [!] Python introuvable. Tentative avec "py"...
  py -m http.server %PORT%
) else (
  start "" "http://127.0.0.1:%PORT%/index.html"
)

pause
