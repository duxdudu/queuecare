#!/bin/bash

echo "QueueCare API Test Runner"
echo "========================"
echo

echo "Starting MongoDB..."
echo "Make sure MongoDB is running on localhost:27017"
echo

echo "Starting Backend Server..."
cd Backend
npm run dev &
BACKEND_PID=$!

echo "Waiting for server to start..."
sleep 5

echo
echo "Running Newman Tests..."
echo "========================"
cd ..
newman run tests/api/QueueCare.postman_collection.json -e tests/api/QueueCare.postman_environment.json --reporters cli,html --reporter-html-export reports/test-report.html

echo
echo "Tests completed! Check reports/test-report.html for detailed results."
echo

# Clean up - kill the backend server
kill $BACKEND_PID 2>/dev/null

echo "Backend server stopped."
echo "Press Enter to exit..."
read
