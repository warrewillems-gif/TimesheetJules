#!/bin/bash
cd "$(dirname "$0")"

echo "Checking dependencies..."

if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

if [ ! -d "node_modules" ]; then
    echo "Installing root dependencies..."
    npm install
fi

echo "Starting Timesheet Tool..."
sleep 2 && open http://localhost:5173 &
npm run dev
