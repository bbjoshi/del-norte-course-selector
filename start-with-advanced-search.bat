@echo off
echo ========================================
echo Del Norte Course Selector
echo Starting with Advanced Search Feature
echo ========================================
echo.

echo [1/3] Checking environment...
if not exist ".env" (
    echo ERROR: .env file not found!
    echo Please copy .env.example to .env and configure your API keys.
    pause
    exit /b 1
)

echo [2/3] Starting backend server...
echo.
echo The server will:
echo  - Load the course catalog PDF
echo  - Generate AI embeddings (first time: 2-5 minutes)
echo  - Enable advanced vector search
echo.
echo Watch for these messages:
echo  - "Starting embeddings generation for X chunks..."
echo  - "Embeddings generation progress updated: X%%"
echo  - "Successfully generated embeddings for X chunks"
echo.
echo Once embeddings are complete, advanced search will be enabled!
echo.
echo ========================================
echo.

start "Backend Server" cmd /k "npm start"

timeout /t 3 /nobreak >nul

echo [3/3] Starting frontend...
echo.
echo Opening application in your browser...
echo Navigate to: http://localhost:3002
echo.
echo ========================================
echo.
echo TIPS:
echo  - Check the Backend Server window for embeddings progress
echo  - The chat interface will show a progress bar
echo  - Once complete, try semantic queries like:
echo    * "What courses prepare me for computer science?"
echo    * "Show me engineering pathways"
echo    * "Courses for pre-med students"
echo.
echo ========================================
echo.

start "Frontend Dev Server" cmd /k "npm run dev"

echo.
echo Both servers are starting in separate windows.
echo Close this window or press any key to exit this launcher.
echo.
pause
