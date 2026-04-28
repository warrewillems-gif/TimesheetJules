@echo off
cd /d "%~dp0"

echo Checking dependencies...

if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend && npm install && cd ..
)

if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend && npm install && cd ..
)

if not exist "node_modules" (
    echo Installing root dependencies...
    npm install
)

echo Starting Timesheet Tool...
start "" http://localhost:5173
npm run dev
