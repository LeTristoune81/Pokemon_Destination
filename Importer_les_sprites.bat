@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\import_sprites.ps1"
pause
