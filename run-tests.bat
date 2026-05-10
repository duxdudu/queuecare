@echo off
echo QueueCare API Test Runner
echo ========================
echo.

echo Starting MongoDB...
echo Make sure MongoDB is running on localhost:27017
echo.

echo Starting Backend Server...
cd Backend
start "Backend Server" cmd /k "npm run dev"

echo Waiting for server to start...
timeout /t 5 /nobreak >nul

echo.
echo Running Newman Tests...
echo =========================
cd ..
newman run tests/api/QueueCare.postman_collection.json -e tests/api/QueueCare.postman_environment.json --reporters cli,html --reporter-html-export reports/test-report.html

echo.
echo Tests completed! Check reports/test-report.html for detailed results.
echo.
echo Press any key to close...
pause >nul
