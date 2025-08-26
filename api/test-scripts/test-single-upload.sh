#!/bin/bash

# Test Single File Upload Endpoint
BASE_URL="http://localhost:3002"
AUTH_TOKEN="test-token-123"  # Any token works with mock auth
PROJECT_ID='123e4567-e89b-12d3-a456-426614174001'  # Use existing project from DB

echo "📁 Testing Single File Upload..."
echo ""

# Create a test file
echo "Creating test file..."
echo "This is a test file for single upload testing $(date)" > single-test-file.txt

echo "Testing uploadFile endpoint:"
curl -s -X POST "$BASE_URL/uploads/uploadFile" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -F "file=@single-test-file.txt" \
  -F "filePath=test/single-test-file.txt" \
  -F "mime=text/plain" \
  -F "projectId=$PROJECT_ID" \
  -F "originalName=single-test-file.txt" | jq '.'

echo ""
echo "Testing with duplicate file (should return Duplicate status):"
curl -s -X POST "$BASE_URL/uploads/uploadFile" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -F "file=@single-test-file.txt" \
  -F "filePath=test/duplicate-file.txt" \
  -F "mime=text/plain" \
  -F "projectId=$PROJECT_ID" \
  -F "originalName=duplicate-file.txt" | jq '.'

echo ""
echo "🧹 Cleaning up..."
rm -f single-test-file.txt

echo "✅ Single file upload tests complete!"
