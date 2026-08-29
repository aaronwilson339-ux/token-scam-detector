# Token Scam Detector API

A production-ready API for analyzing smart contracts and detecting scams, honeypots, and rugpulls. Perfect for integrating into agents on **Agentic Market**.

## Features

✅ **Honeypot Detection** - Identifies tokens where you can buy but can't sell  
✅ **Rugpull Detection** - Detects common rugpull patterns  
✅ **Mint/Supply Issues** - Flags uncontrolled supply functions  
✅ **Ownership Risks** - Identifies centralized control risks  
✅ **Tax Analysis** - Detects excessive/suspicious fees  
✅ **Liquidity Checking** - Checks for proper locking mechanisms  
✅ **Multi-Chain Support** - Works with Ethereum, BSC, Solana, etc.  

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Server
```bash
npm start
```

Server will start on `http://localhost:3001`

### 3. Test the API
```bash
# Quick health check
curl http://localhost:3001/health

# Get full documentation
curl http://localhost:3001/docs

# Analyze a token
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "contractAddress": "0x1234...",
    "contractCode": "pragma solidity...",
    "chain": "ethereum"
  }'
```

## API Endpoints

### GET `/health`
Check if API is running
```bash
curl http://localhost:3001/health
```

### POST `/analyze`
Comprehensive token analysis

**Request:**
```json
{
  "contractAddress": "0x1234567890123456789012345678901234567890",
  "contractCode": "pragma solidity ^0.8.0; contract MyToken { ... }",
  "chain": "ethereum"
}
```

**Response:**
```json
{
  "contractAddress": "0x1234567890123456789012345678901234567890",
  "chain": "ethereum",
  "isLikely_Scam": false,
  "riskScore": 25,
  "severity": "LOW",
  "riskFactors": [
    "Ownership not renounced",
    "No liquidity locking mechanism detected"
  ],
  "recommendation": "✅ LOW RISK: Appears relatively safe, but always DYOR.",
  "disclaimer": "This analysis detects common scam patterns. Always do your own research."
}
```

### POST `/quick-check`
Fast yes/no scam detection (for agents)

**Request:**
```json
{
  "contractAddress": "0x1234...",
  "contractCode": "pragma solidity..."
}
```

**Response:**
```json
{
  "address": "0x1234...",
  "isScam": false,
  "riskLevel": "LOW",
  "price": "$0.01"
}
```

### POST `/batch-analyze`
Analyze multiple tokens at once

**Request:**
```json
{
  "tokens": [
    {
      "address": "0xtoken1...",
      "code": "pragma solidity...",
      "chain": "ethereum"
    },
    {
      "address": "0xtoken2...",
      "code": "pragma solidity...",
      "chain": "bsc"
    }
  ]
}
```

### GET `/docs`
Get full API documentation

## What It Detects

### 🚨 Critical Issues (35-40 points)
- Honeypot patterns (can't sell)
- Uncontrolled mint functions
- Vulnerable withdrawal functions
- Sell restrictions
- Suspicious function names (stealTokens, rugPull, etc.)

### ⚠️ High Risk (20-30 points)
- Blacklist functions
- Ownership not renounced
- Excessive taxes (>50%)
- Owner can change transaction limits
- Hidden functions

### ⚠️ Medium Risk (15-20 points)
- Moderately high taxes (20-50%)
- No liquidity locking
- Uncontrolled supply

## Risk Score Breakdown

| Score | Severity | Action |
|-------|----------|--------|
| 0-19 | MINIMAL | ✅ Safe to trade |
| 20-39 | LOW | ✅ Probably safe, DYOR |
| 40-59 | MEDIUM | ⚠️ Caution, check community |
| 60-79 | HIGH | ⛔ High risk, don't trade |
| 80-100 | CRITICAL | ⛔ Almost certainly a scam |

## How to Get Contract Source Code

### From Etherscan (Ethereum)
1. Go to etherscan.io
2. Search contract address
3. Click "Contract" tab
4. Copy code under "Contract Source Code"

### From BscScan (Binance Smart Chain)
1. Go to bscscan.com
2. Search contract address
3. Click "Contract" tab
4. Copy source code

### From Solscan (Solana)
1. Go to solscan.io
2. Search contract address
3. Click "Source" tab

## Integration with Agentic Market

### For Agents
```javascript
// Pseudo-code for agents using this API
agent.skill('agentic.market/SKILL.md');

// Agent discovers this API
discoverAPI('token-scam-detector');

// Agent uses it
result = callAPI('/quick-check', {
  contractAddress: userInput.tokenAddress,
  contractCode: await fetchFromBlockchain(userInput.tokenAddress)
});

// Agent pays $0.01 USDC per check
pay_for_service('token-scam-detector', 0.01);

// Return result to user
console.log(`Is this token a scam? ${result.isScam}`);
```

### For Your App
1. Deploy this API to a server (Heroku, AWS, DigitalOcean, etc.)
2. List on Agentic Market
3. Agents discover and pay per use
4. You receive USDC in your wallet

## Deployment Options

### Option 1: Heroku (Free/Cheap)
```bash
# Install Heroku CLI
brew install heroku/brew/heroku

# Login
heroku login

# Create app
heroku create your-token-detector

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Option 2: DigitalOcean
```bash
# 1. Create a Droplet ($5/month)
# 2. SSH into it
# 3. Clone your repo
# 4. Run: npm install && npm start
# 5. Use PM2 to keep it running
npm install -g pm2
pm2 start server.js --name token-detector
pm2 startup
pm2 save
```

### Option 3: AWS Lambda + API Gateway
```bash
# Serverless option for minimal costs
npm install -g serverless
serverless deploy
```

### Option 4: Docker
```bash
# Create Dockerfile
docker build -t token-detector .
docker run -p 3001:3001 token-detector
```

## Example Docker Setup

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## Security Considerations

⚠️ **Important:**
- This API analyzes contract code patterns only
- It's NOT 100% accurate - scammers can hide malicious code
- Always combine with community research
- Users should verify via multiple sources

## Pricing Model

```
Standard Pricing:
- Per analysis: $0.01 USDC
- Per batch (10 tokens): $0.08 USDC (20% discount)
- Enterprise: Contact for custom pricing

Payment:
- Instant USDC settlement on Agentic Market
- No monthly subscriptions
- No hidden fees
```

## Testing

Run the example usage:
```bash
node example-usage.js
```

This will run through all examples:
1. Normal token analysis
2. Honeypot detection
3. Quick check
4. Batch analysis
5. Documentation

## Troubleshooting

**API won't start?**
```bash
# Check if port 3001 is in use
lsof -i :3001
# Kill the process
kill -9 <PID>
# Try again
npm start
```

**Contract code not being analyzed?**
- Make sure you're pasting the full source code
- Not the bytecode (hex)
- Verify it starts with `pragma solidity`

**Getting 400 errors?**
- Check that you're sending JSON
- Include `Content-Type: application/json` header
- Verify required fields are present

## API Limits

Current limits (can increase with deployment):
- Max contract code size: 1 MB
- Max batch size: 50 tokens
- Rate limit: 60 requests/minute

## Contributing

Have ideas for better scam detection? PRs welcome!

Possible improvements:
- Integration with external audit APIs (Certik, etc.)
- Machine learning model for pattern detection
- Gas price optimization detection
- Cross-contract dependency analysis

## Disclaimer

```
This Smart Contract Risk API analyzes contract source code for 
common vulnerabilities, suspicious patterns, and known scam indicators. 

This analysis is for informational purposes only and does NOT guarantee 
contract safety or legitimacy. 

Use at your own risk. Always conduct thorough due diligence and research
before interacting with any smart contract or trading any token.

The developers assume no liability for losses incurred using this API.
```

## License

MIT

## Support

For questions or issues:
- Email: support@token-detector.com
- GitHub Issues: [token-detector/issues]
- Discord: [link to discord]

---

**Ready to monetize this?**
1. Deploy to your server
2. Create an account on Agentic Market
3. List this API
4. Agents start paying $0.01 per check
5. Passive income! 💰
