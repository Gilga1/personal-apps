@echo off
setlocal
cd /d "%~dp0..\backend"
if not exist .venv\Scripts\activate.bat (
  echo Creating venv...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
echo Starting API on 0.0.0.0:8000 ...
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
