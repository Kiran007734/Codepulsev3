# CodePulse Startup Script

Write-Host "Initializing CodePulse Platform..." -ForegroundColor Cyan

# 1. Environment Check
if (-not (Test-Path "backend\.env")) {
    Write-Host "backend/.env not found! Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "Please update backend/.env with your GITHUB_TOKEN and Database credentials." -ForegroundColor Red
}

# 2. Start Backend
Write-Host "Starting Backend API (FastAPI)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -Command cd backend; pip install -r requirements.txt; uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

# 3. Start Frontend
Write-Host "Starting Frontend Dashboard (Vite)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -Command npm install; npm run dev"

Write-Host "Services are launching in separate windows." -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Blue
Write-Host "Backend API: http://localhost:8000/docs" -ForegroundColor Blue
Write-Host "n8n Dashboard: http://localhost:5678" -ForegroundColor Blue
