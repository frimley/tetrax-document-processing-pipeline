#!/bin/bash

# Comprehensive test runner for TetraxAI API

echo "🧪 TetraxAI API Test Suite"
echo "=========================="
echo ""

# Check if API is running
echo "🔍 Checking if API is running..."
if curl -s http://localhost:3002/health > /dev/null; then
    echo "✅ API is running on http://localhost:3002"
else
    echo "❌ API is not running!"
    echo "   Please start the API with: npm run start:dev"
    echo "   And ensure Docker services are running: docker-compose up -d"
    exit 1
fi
echo ""

# Function to run test and show results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo "🧪 Running: $test_name"
    echo "----------------------------------------"
    
    if eval "$test_command"; then
        echo "✅ $test_name: PASSED"
    else
        echo "❌ $test_name: FAILED"
    fi
    echo ""
}

# Run different types of tests
while true; do
    echo "Select test to run:"
    echo "1. Health Check Tests (Quick)"
    echo "2. Upload Flow Tests (Manual - cURL)"
    echo "3. Upload Flow Tests (Node.js)"
    echo "4. E2E Tests (Jest)"
    echo "5. All Tests"
    echo "6. Create Test Files"
    echo "7. Exit"
    echo ""
    read -p "Enter your choice (1-7): " choice

    case $choice in
        1)
            run_test "Health Check Tests" "./test-scripts/test-health.sh"
            ;;
        2)
            run_test "Upload Flow Tests (cURL)" "./test-scripts/test-upload.sh"
            ;;
        3)
            run_test "Upload Flow Tests (Node.js)" "node ./test-scripts/upload-test.js"
            ;;
        4)
            run_test "E2E Tests (Jest)" "npm run test:e2e"
            ;;
        5)
            echo "🚀 Running all tests..."
            echo ""
            run_test "Health Check Tests" "./test-scripts/test-health.sh"
            run_test "Upload Flow Tests (cURL)" "./test-scripts/test-upload.sh"
            run_test "Upload Flow Tests (Node.js)" "node ./test-scripts/upload-test.js"
            run_test "E2E Tests (Jest)" "npm run test:e2e"
            echo "🏁 All tests completed!"
            ;;
        6)
            echo "📁 Creating test files..."
            cd test-files && ./create-test-files.sh && cd ..
            ;;
        7)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid choice. Please enter 1-7."
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    echo ""
done
