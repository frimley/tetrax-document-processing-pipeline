#!/bin/bash

# Test Health Endpoints Script
# Tests all health check endpoints with proper dependency verification

echo "🏥 Testing Health Check Endpoints..."
echo "================================================"

BASE_URL="http://localhost:3002"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
    local endpoint=$1
    local name=$2
    
    echo -e "\n${YELLOW}Testing $name...${NC}"
    echo "URL: $BASE_URL$endpoint"
    
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL$endpoint")
    http_code=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS/d')
    
    echo "Status Code: $http_code"
    echo "Response:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ $name - PASS${NC}"
    else
        echo -e "${RED}❌ $name - FAIL (HTTP $http_code)${NC}"
    fi
}

# Test all health endpoints
test_endpoint "/health/ping" "Basic Ping (Public)"
test_endpoint "/health/live" "Liveness Check (Rate Limited)"  
test_endpoint "/health/ready" "Readiness Check (IP + Rate Limited)"
test_endpoint "/health" "Full Health Check (IP + Rate Limited)"

echo -e "\n${YELLOW}================================================${NC}"
echo -e "${YELLOW}Health Check Test Complete!${NC}"
echo ""
echo "📝 Expected Results:"
echo "  - /health/ping: ✅ Should always return 200 (public endpoint)"
echo "  - /health/live: ⚠️ May return 403/429 (rate limited)"
echo "  - /health/ready: ⚠️ May return 403 (IP restricted + rate limited)"
echo "  - /health: ⚠️ May return 403 (IP restricted + rate limited)"
echo ""
echo "🔒 Security Features:"
echo "  - IP Whitelist: localhost, private networks only"
echo "  - Rate Limiting: 30 requests/minute per IP"
echo "  - Multi-tier: Different endpoints for different needs"
echo ""
echo "🐳 Make sure Docker services are running:"
echo "  docker compose up -d"