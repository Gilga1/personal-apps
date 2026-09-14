@echo off
cd /d "%~dp0..\frontend"
if not exist node_modules (
  call npm install
)
echo Starting UI on 0.0.0.0:5173 ...
call npm run dev -- --host 0.0.0.0 --port 5173
