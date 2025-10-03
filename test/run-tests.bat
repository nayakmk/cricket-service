@echo off
REM Cricket App API Test Runner (Windows)
REM This script runs automated API tests

echo 🚀 Starting Cricket App API Tests
echo ==================================================

REM Check if node is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js and try again
    pause
    exit /b 1
)

REM Run the test suite
echo Running automated API tests...
node test-runner.js

REM Keep window open to see results
echo.
echo Press any key to exit...
pause >nul