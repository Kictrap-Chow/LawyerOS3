@echo off
cd /d "%~dp0"
echo Starting LawyerOS...

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js first: https://nodejs.org/
    pause
    exit /b
)

REM Check if dependencies are valid for Windows
if exist "node_modules" (
    if not exist "node_modules\.bin\vite.cmd" (
        echo Dependencies seem to be from another computer - OS mismatch.
        echo Cleaning up and reinstalling...
        rmdir /s /q "node_modules"
    )
)

REM Install dependencies if node_modules is missing
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Start the application
echo Opening application...
call npm run dev
pause