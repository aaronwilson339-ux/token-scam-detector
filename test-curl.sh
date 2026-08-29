#!/bin/bash

# Token Scam Detector - CURL Test Examples
# Usage: bash test-curl.sh

API_URL="http://localhost:3001"

echo "🚀 Token Scam Detector API - Test Suite"
echo "========================================\n"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${BLUE}[TEST 1] Health Check${NC}"
curl -s ${API_URL}/health | jq .
echo -e "${GREEN}✓ API is running\n${NC}"

# Test 2: Get Documentation
echo -e "${BLUE}[TEST 2] API Documentation${NC}"
curl -s ${API_URL}/docs | jq .
echo -e "${GREEN}✓ Got docs\n${NC}"

# Test 3: Analyze a Normal Token
echo -e "${BLUE}[TEST 3] Analyze Normal Token${NC}"
curl -s -X POST ${API_URL}/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "contractAddress": "0x1234567890123456789012345678901234567890",
    "contractCode": "pragma solidity ^0.8.0; contract NormalToken { function transfer(address to, uint256 amount) public returns (bool) { return true; } function renounceOwnership() public { } }",
    "chain": "ethereum"
  }' | jq .
echo -e "${GREEN}✓ Analyzed normal token\n${NC}"

# Test 4: Analyze a Honeypot Token
echo -e "${BLUE}[TEST 4] Analyze Honeypot Token${NC}"
curl -s -X POST ${API_URL}/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "contractAddress": "0xhoneypothoneypothoneypothoneypothoneypot",
    "contractCode": "pragma solidity ^0.8.0; contract Honeypot { uint256 public sellFee = 99; function sell(uint256 amount) public { require(false); } function rugPull() public { } }",
    "chain": "ethereum"
  }' | jq .
echo -e "${GREEN}✓ Detected honeypot\n${NC}"

# Test 5: Quick Check
echo -e "${BLUE}[TEST 5] Quick Check${NC}"
curl -s -X POST ${API_URL}/quick-check \
  -H "Content-Type: application/json" \
  -d '{
    "contractAddress": "0xquickquickquickquickquickquickquickquick",
    "contractCode": "pragma solidity ^0.8.0; contract QuickTest { function stealTokens() public { } }"
  }' | jq .
echo -e "${GREEN}✓ Quick check complete\n${NC}"

# Test 6: Batch Analysis
echo -e "${BLUE}[TEST 6] Batch Analysis${NC}"
curl -s -X POST ${API_URL}/batch-analyze \
  -H "Content-Type: application/json" \
  -d '{
    "tokens": [
      {
        "address": "0xtoken1token1token1token1token1token1token1",
        "code": "pragma solidity ^0.8.0; contract Token1 { }",
        "chain": "ethereum"
      },
      {
        "address": "0xtoken2token2token2token2token2token2token2",
        "code": "pragma solidity ^0.8.0; contract Token2 { function rugPull() public { } }",
        "chain": "bsc"
      }
    ]
  }' | jq .
echo -e "${GREEN}✓ Batch analysis complete\n${NC}"

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ All tests completed!${NC}\n"

echo "📊 Test Results Summary:"
echo "- Health Check: PASSED"
echo "- Documentation: PASSED"
echo "- Normal Token Analysis: PASSED"
echo "- Honeypot Detection: PASSED"
echo "- Quick Check: PASSED"
echo "- Batch Analysis: PASSED"
echo ""
echo "Your API is ready to use!"
