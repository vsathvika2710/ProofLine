# Proofline Local Development & Demo Launcher (Windows PowerShell)
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting Proofline Brand Governance & Impact Engine" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start Backend in background job
Write-Host "`n[1/2] Starting FastAPI Backend on http://localhost:8000..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PSScriptRoot\backend
    uvicorn main:app --reload --host 127.0.0.1 --port 8000
}

# 2. Wait for backend to be ready
Start-Sleep -Seconds 3

# 3. Start Frontend
Write-Host "`n[2/2] Starting React + Vite Frontend on http://localhost:5173..." -ForegroundColor Green
Write-Host "`nReady! Open your browser at: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to terminate both servers.`n" -ForegroundColor DarkGray

try {
    npm run dev
} finally {
    Write-Host "`nStopping backend server..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
}
