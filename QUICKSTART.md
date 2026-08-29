# Quick Start Guide (2 minutes)

## 1. Install
```bash
npm install
```

## 2. Run
```bash
npm start
```

You should see:
```
🚀 Token Scam Detector API running on http://localhost:3001
📚 Docs available at http://localhost:3001/docs
```

## 3. Test (in another terminal)
```bash
# Test health
curl http://localhost:3001/health

# Get docs
curl http://localhost:3001/docs

# Analyze a token (paste contract code)
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "contractAddress": "0x...",
    "contractCode": "pragma solidity...",
    "chain": "ethereum"
  }'
```

## 4. Understanding the Response

**Risk Scores:**
- 0-19: ✅ MINIMAL - Safe
- 20-39: ✅ LOW - Probably safe
- 40-59: ⚠️ MEDIUM - Caution
- 60-79: ⛔ HIGH - High risk
- 80-100: ⛔ CRITICAL - Likely scam

**Example Response:**
```json
{
  "contractAddress": "0x1234...",
  "isLikely_Scam": false,
  "riskScore": 25,
  "severity": "LOW",
  "riskFactors": [
    "Ownership not renounced"
  ],
  "recommendation": "✅ LOW RISK: Appears safe"
}
```

## 5. Deploy (Choose One)

### Heroku (Easiest)
```bash
heroku create your-app-name
git push heroku main
heroku open
```

### DigitalOcean
- Create $5/month droplet
- SSH in
- Clone repo, `npm install`
- Use PM2 to run: `pm2 start server.js`

### Docker
```bash
docker build -t token-detector .
docker run -p 3001:3001 token-detector
```

## 6. List on Agentic Market

1. Deploy your API
2. Create Agentic Market account
3. Go to "Sell" or "List API"
4. Add your API endpoint: `https://your-api.com`
5. Set price: `$0.01 per check`
6. Agents discover and pay 💰

## 7. Example: Real Honeypot Detection

Get a real honeypot contract code from:
- Etherscan: https://etherscan.io
- Search "honeypot" in contract

Paste the code:
```bash
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "contractAddress": "0x...",
    "contractCode": "[PASTE FULL CODE HERE]",
    "chain": "ethereum"
  }'
```

The API will return: `"isLikely_Scam": true`

## Troubleshooting

**Port 3001 in use?**
```bash
lsof -i :3001
kill -9 <PID>
npm start
```

**Contract code not parsing?**
- Make sure it's the full source code (not bytecode)
- Starts with `pragma solidity`
- Paste the exact code from Etherscan

**Getting 400 errors?**
- Include header: `Content-Type: application/json`
- Check required fields are present

## Next Steps

1. ✅ Run locally (`npm start`)
2. ✅ Test with example tokens
3. ✅ Deploy to server
4. ✅ List on Agentic Market
5. ✅ Agents start paying $0.01 per check
6. ✅ Earn passive income!

## Need Help?

- Read full docs: `/docs` endpoint
- Check DEPLOYMENT.md for detailed setup
- See example-usage.js for code examples
- Test with test-curl.sh script

---

**Ready?** Run `npm start` and analyze your first token! 🚀
