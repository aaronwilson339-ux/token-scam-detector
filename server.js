const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// SCAM DETECTION LOGIC
// ============================================

class TokenScamDetector {
  constructor() {
    this.riskFactors = [];
    this.riskScore = 0;
    this.maxScore = 100;
  }

  // Main analysis function
  async analyzeToken(contractAddress, contractCode, chain = 'ethereum') {
    this.riskFactors = [];
    this.riskScore = 0;

    // Run all checks
    this.checkSupplyIssues(contractCode);
    this.checkHoneypotPatterns(contractCode);
    this.checkOwnershipRisks(contractCode);
    this.checkSuspiciousFunctions(contractCode);
    this.checkTaxPatterns(contractCode);
    this.checkLiquidityLocking(contractCode);
    this.checkMintFunction(contractCode);
    this.checkBlacklistFunction(contractCode);

    // Determine severity
    const severity = this.determineSeverity();
    const isScam = this.riskScore >= 60;

    return {
      contractAddress,
      chain,
      isLikely_Scam: isScam,
      riskScore: this.riskScore,
      severity,
      riskFactors: this.riskFactors,
      recommendation: this.getRecommendation(isScam),
      disclaimer: "This analysis detects common scam patterns. Always do your own research."
    };
  }

  // ============ DETECTION METHODS ============

  checkSupplyIssues(code) {
    // Check for mint function without proper controls
    if (code.includes('function mint') && !code.includes('onlyOwner')) {
      this.addRisk('Uncontrolled mint function detected', 25);
    }

    // Check for extremely large supply
    if (code.includes('10000000000000') || code.includes('1000000000000000000000000')) {
      this.addRisk('Extremely large token supply detected', 15);
    }
  }

  checkHoneypotPatterns(code) {
    const honeypotIndicators = [
      'honeypot',
      'noRenounce',
      'lockLiquidity',
      'swapExactTokens',
      'transfer.*require.*false'
    ];

    honeypotIndicators.forEach(indicator => {
      if (new RegExp(indicator, 'i').test(code)) {
        this.addRisk(`Honeypot pattern detected: ${indicator}`, 30);
      }
    });

    // Check for sell restrictions
    if (code.includes('_sellAmount') || code.includes('sellLimit')) {
      this.addRisk('Sell amount restrictions detected (honeypot indicator)', 35);
    }
  }

  checkOwnershipRisks(code) {
    // Check for centralized owner with dangerous powers
    if (code.includes('function setMaxTxAmount') && !code.includes('timelock')) {
      this.addRisk('Owner can change transaction limits without timelock', 20);
    }

    if (code.includes('function emergencyWithdraw') || code.includes('function withdraw()')) {
      if (!code.includes('require(msg.sender == owner)')) {
        this.addRisk('Vulnerable withdrawal function', 30);
      }
    }

    // Owner not renounced (higher risk for new tokens)
    if (!code.includes('renounceOwnership')) {
      this.addRisk('Ownership not renounced', 15);
    }
  }

  checkSuspiciousFunctions(code) {
    const suspiciousFunctions = [
      'stealTokens',
      'rugPull',
      'drainLiquidity',
      'removeLiquidity',
      'setBlackList',
      '_transfer.*require.*false',
      'function transfer.*returns.*false'
    ];

    suspiciousFunctions.forEach(func => {
      if (new RegExp(func, 'i').test(code)) {
        this.addRisk(`Suspicious function found: ${func}`, 40);
      }
    });
  }

  checkTaxPatterns(code) {
    // Check for excessive buy/sell tax
    const taxPattern = /(\d+)\s*(?:tax|fee|percent|%)/i;
    const matches = code.match(taxPattern);

    if (matches) {
      const taxAmount = parseInt(matches[1]);
      if (taxAmount > 20) {
        this.addRisk(`Excessive tax/fee detected: ${taxAmount}%`, 20);
      }
      if (taxAmount > 50) {
        this.addRisk(`Very high tax detected: ${taxAmount}% (honeypot indicator)`, 40);
      }
    }

    // Check for dynamic tax that changes
    if (code.includes('buyFee') && code.includes('sellFee')) {
      if (code.includes('setBuyFee') || code.includes('setSellFee')) {
        this.addRisk('Tax fees can be changed by owner', 15);
      }
    }
  }

  checkLiquidityLocking(code) {
    // Check if liquidity is locked
    if (!code.includes('LiquidityLocked') && !code.includes('timelock')) {
      if (code.includes('addLiquidity') || code.includes('sync')) {
        this.addRisk('No liquidity locking mechanism detected', 20);
      }
    }
  }

  checkMintFunction(code) {
    // Dangerous unlimited mint
    if (code.includes('function mint(') && code.includes('msg.sender') &&
        !code.includes('maxSupply') && !code.includes('onlyOwner')) {
      this.addRisk('Uncontrolled mint with no supply cap', 35);
    }
  }

  checkBlacklistFunction(code) {
    // Blacklist function allows owner to freeze wallets
    if (code.includes('blacklist') || code.includes('isBlacklisted')) {
      this.addRisk('Blacklist function detected - owner can freeze wallets', 25);
    }
  }

  // ============ UTILITY METHODS ============

  addRisk(factor, points) {
    this.riskFactors.push(factor);
    this.riskScore += points;
    if (this.riskScore > this.maxScore) {
      this.riskScore = this.maxScore;
    }
  }

  determineSeverity() {
    if (this.riskScore >= 80) return 'CRITICAL';
    if (this.riskScore >= 60) return 'HIGH';
    if (this.riskScore >= 40) return 'MEDIUM';
    if (this.riskScore >= 20) return 'LOW';
    return 'MINIMAL';
  }

  getRecommendation(isScam) {
    if (isScam) {
      return '⛔ HIGH RISK: This token shows multiple scam indicators. DO NOT TRADE.';
    }
    if (this.riskScore >= 40) {
      return '⚠️ MEDIUM RISK: Proceed with extreme caution. Check community feedback.';
    }
    return '✅ LOW RISK: Appears relatively safe, but always DYOR.';
  }
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'API is running', version: '1.0.0' });
});

// Main analysis endpoint
app.post('/analyze', async (req, res) => {
  try {
    const { contractAddress, contractCode, chain = 'ethereum' } = req.body;

    // Validation
    if (!contractAddress || !contractCode) {
      return res.status(400).json({
        error: 'Missing required fields: contractAddress, contractCode'
      });
    }

    if (contractCode.length < 100) {
      return res.status(400).json({
        error: 'Contract code too short. Make sure you provided the full contract source.'
      });
    }

    // Analyze
    const detector = new TokenScamDetector();
    const result = await detector.analyzeToken(contractAddress, contractCode, chain);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    });
  }
});

// Quick check endpoint (simplified)
app.post('/quick-check', async (req, res) => {
  try {
    const { contractAddress, contractCode } = req.body;

    if (!contractCode) {
      return res.status(400).json({ error: 'contractCode required' });
    }

    const detector = new TokenScamDetector();
    const result = await detector.analyzeToken(contractAddress, contractCode);

    // Simplified response
    res.json({
      address: contractAddress,
      isScam: result.isLikely_Scam,
      riskLevel: result.severity,
      price: '$0.01' // For Agentic Market pricing
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Batch analysis endpoint
app.post('/batch-analyze', async (req, res) => {
  try {
    const { tokens } = req.body;

    if (!Array.isArray(tokens)) {
      return res.status(400).json({ error: 'tokens must be an array' });
    }

    const results = [];
    for (const token of tokens) {
      const detector = new TokenScamDetector();
      const result = await detector.analyzeToken(
        token.address,
        token.code,
        token.chain || 'ethereum'
      );
      results.push(result);
    }

    res.json({
      total: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Documentation endpoint
app.get('/docs', (req, res) => {
  const docs = {
    name: 'Token Scam Detector API',
    version: '1.0.0',
    description: 'Analyzes smart contracts for scam/honeypot indicators',
    endpoints: {
      '/health': {
        method: 'GET',
        description: 'Check if API is running'
      },
      '/analyze': {
        method: 'POST',
        description: 'Detailed token analysis',
        body: {
          contractAddress: 'string (required)',
          contractCode: 'string - full contract source (required)',
          chain: 'string - ethereum/bsc/solana (optional, default: ethereum)'
        },
        response: {
          contractAddress: 'string',
          chain: 'string',
          isLikely_Scam: 'boolean',
          riskScore: 'number (0-100)',
          severity: 'string - MINIMAL/LOW/MEDIUM/HIGH/CRITICAL',
          riskFactors: 'array of detected issues',
          recommendation: 'string - action to take'
        }
      },
      '/quick-check': {
        method: 'POST',
        description: 'Fast yes/no scam check',
        body: {
          contractAddress: 'string',
          contractCode: 'string'
        }
      },
      '/batch-analyze': {
        method: 'POST',
        description: 'Analyze multiple tokens at once',
        body: {
          tokens: 'array of {address, code, chain}'
        }
      }
    },
    pricing: {
      per_analysis: '$0.01 USDC',
      model: 'Pay-per-use on Agentic Market'
    },
    disclaimer: 'This API analyzes contracts for common scam patterns. It is NOT a guarantee of safety. Always DYOR.'
  };
  res.json(docs);
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Token Scam Detector API running on http://localhost:${PORT}`);
  console.log(`📚 Docs available at http://localhost:${PORT}/docs`);
});
