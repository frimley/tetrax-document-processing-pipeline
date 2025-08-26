#!/bin/bash

# Test Upload Endpoints
BASE_URL="http://localhost:3002"
AUTH_TOKEN="test-token-123"  # Any token works with mock auth
PROJECT_ID='123e4567-e89b-12d3-a456-426614174001'

echo "📁 Testing Upload Endpoints..."
echo ""

# Create a test file
echo "Creating test file..."
echo "This is a test file for upload testing $(date)" > test-file.txt

echo "1. Testing startMultiPartUpload:"
START_RESPONSE=$(curl -s -X POST "$BASE_URL/uploads/startMultiPartUpload" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"filePath\": \"test/test-file.txt\",
    \"size\": 1024,
    \"mime\": \"text/plain\",
    \"projectId\": \"$PROJECT_ID\"
  }")

echo "$START_RESPONSE" | jq '.'

# Extract fileId from response
FILE_ID=$(echo "$START_RESPONSE" | jq -r '.fileId')
CHUNK_SIZE=$(echo "$START_RESPONSE" | jq -r '.chunkSize')
TOTAL_CHUNKS=$(echo "$START_RESPONSE" | jq -r '.totalChunks')

echo ""
echo "2. Testing uploadPart:"
if [ "$FILE_ID" != "null" ] && [ "$FILE_ID" != "" ]; then
  echo "Using fileId: $FILE_ID"
  
  # Upload the test file as part 1
  curl -s -X PUT "$BASE_URL/uploads/uploadPart" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "X-File-Id: $FILE_ID" \
    -H "X-Part-Number: 1" \
    -H "X-Total-Chunks: 1" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @test-file.txt | jq '.'
  
  echo ""
  echo "3. Testing fileStatus:"
  curl -s "$BASE_URL/uploads/fileStatus?fileId=$FILE_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'
  
  echo ""
  echo "4. Testing endMultiPartUpload:"
  curl -s -X POST "$BASE_URL/uploads/endMultiPartUpload" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"fileId\": \"$FILE_ID\"}" | jq '.'
else
  echo "❌ Failed to get fileId from start upload"
fi

echo ""
echo "🧹 Cleaning up..."
rm -f test-file.txt

echo "✅ Upload tests complete!"
