@echo off
echo ========================================
echo Cleaning up and restarting servers
echo ========================================
echo.

echo [1/4] Killing existing Node processes...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo Successfully killed existing Node processes
) else (
    echo No existing Node processes found
)
echo.

timeout /t 2 /nobreak >nul

echo [2/4] Checking environment...
if not exist ".env" (
    echo ERROR: .env file not found!
    echo Please copy .env.example to .env and configure your API keys.
    pause
    exit /b 1
)
echo Environment file found
echo.

echo [3/4] Starting backend server on port 3003...
echo.
echo Watch for these messages in the Backend Server window:
echo  - "Server running on port 3003"
echo  - "Starting embeddings generation for X chunks..."
echo  - "Embeddings generation progress updated: X%%"
echo  - "Successfully generated embeddings for X chunks"
echo.

start "Backend Server - Port 3003" cmd /k "npm start"

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo [4/4] Starting frontend on port 3002...
echo.

start "Frontend Dev Server - Port 3002" cmd /k "npm run dev"

echo.
echo ========================================
echo Both servers are starting!
echo ========================================
echo.
echo Backend: http://localhost:3003
echo Frontend: http://localhost:3002
echo.
echo Check the "Backend Server - Port 3003" window for:
echo  - Server startup confirmation
echo  - Embeddings generation progress
echo  - Any error messages
echo.
echo Once you see "Successfully generated embeddings", 
echo advanced search will be enabled!
echo.
echo ========================================
echo.
pause
