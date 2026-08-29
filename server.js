const express = require('express');
const cors = require('cors');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet - Add security headers
app.use(helmet());

// CORS - Control who can access
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || '*',
  methods: ['GET', 'POST'],
  credentials: true
}));

// Body size limit - Prevent large uploads
app.use(express.json({ limit: '1mb' }));

// Rate Limiting - Prevent DDoS attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(limiter);

// Request Logging - Monitor API usage
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip}`);
  next();
});

// ============================================
// API KEY AUTHENTICATION
// ============================================

// Public endpoints that don't need API key
const publicRoutes = ['/health', '/docs'];

app.use((req, res, next) => {
  // Skip authentication for public routes
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  // Refuse to serve protected routes if no key was ever configured.
  // This is deliberate: an unset key would otherwise leave the API wide open.
  if (!API_KEY) {
    console.error('[SECURITY] API_KEY is not set - refusing protected requests.');
    return res.status(503).json({
      error: 'Service not configured',
      message: 'This API has no API_KEY set. The owner must add an API_KEY config var.'
    });
  }

  // Check API key for protected routes
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    console.warn(`[SECURITY] Unauthorized access attempt to ${req.path}`);
    return res.status(401).json({
      error: 'Unauthorized - Missing or invalid API key',
      hint: 'Include header: X-API-Key: your-key'
    });
  }
  next();
});

// ============================================
// SCAM DETECTION LOGIC
// ============================================

class TokenScamDetector {
  constructor() {
    this.riskFactors = [];
    this.riskScore = 0;
    this.maxScore = 100;
  }

  // Validate input before processing
  validateInput(contractCode) {
    if (!contractCode || typeof contractCode !== 'string') {
      throw new Error('Invalid contract code format');
    }

    // Size checks
    if (contractCode.length < 50) {
      throw new Error('Contract code too short (minimum 50 characters)');
    }

    if (contractCode.length > 1000000) {
      throw new Error('Contract code too large (maximum 1MB)');
    }

    // Check for suspicious SQL patterns
    if (contractCode.match(/DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO/i)) {
      throw new Error('Suspicious patterns detected in input');
    }

    return true;
  }

  // Main analysis function
  async analyzeToken(contractAddress, contractCode, chain = 'ethereum') {
    try {
      // Validate input
      this.validateInput(contractCode);

      // Validate address format
      if (!contractAddress || contractAddress.length < 10) {
        throw new Error('Invalid contract address');
      }

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
        disclaimer: "This analysis detects common scam patterns. Always do your own research.",
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[ERROR] Analysis failed: ${error.message}`);
      throw error;
    }
  }

  // ============ DETECTION METHODS ============

  checkSupplyIssues(code) {
    if (code.includes('function mint') && !code.includes('onlyOwner')) {
      this.addRisk('Uncontrolled mint function detected', 25);
    }

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

    if (code.includes('_sellAmount') || code.includes('sellLimit')) {
      this.addRisk('Sell amount restrictions detected (honeypot indicator)', 35);
    }
  }

  checkOwnershipRisks(code) {
    if (code.includes('function setMaxTxAmount') && !code.includes('timelock')) {
      this.addRisk('Owner can change transaction limits without timelock', 20);
    }

    if (code.includes('function emergencyWithdraw') || code.includes('function withdraw()')) {
      if (!code.includes('require(msg.sender == owner)')) {
        this.addRisk('Vulnerable withdrawal function', 30);
      }
    }

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

    if (code.includes('buyFee') && code.includes('sellFee')) {
      if (code.includes('setBuyFee') || code.includes('setSellFee')) {
        this.addRisk('Tax fees can be changed by owner', 15);
      }
    }
  }

  checkLiquidityLocking(code) {
    if (!code.includes('LiquidityLocked') && !code.includes('timelock')) {
      if (code.includes('addLiquidity') || code.includes('sync')) {
        this.addRisk('No liquidity locking mechanism detected', 20);
      }
    }
  }

  checkMintFunction(code) {
    if (code.includes('function mint(') && code.includes('msg.sender') &&
        !code.includes('maxSupply') && !code.includes('onlyOwner')) {
      this.addRisk('Uncontrolled mint with no supply cap', 35);
    }
  }

  checkBlacklistFunction(code) {
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
  res.json({
    status: 'API is running',
    version: '1.0.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Main analysis endpoint
app.post('/analyze', async (req, res) => {
  try {
    const { contractAddress, contractCode, chain = 'ethereum' } = req.body;

    // Validation
    if (!contractAddress || !contractCode) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['contractAddress', 'contractCode']
      });
    }

    // Analyze
    const detector = new TokenScamDetector();
    const result = await detector.analyzeToken(contractAddress, contractCode, chain);

    res.json(result);
  } catch (error) {
    console.error(`[ERROR] Analysis endpoint: ${error.message}`);
    res.status(400).json({
      error: 'Analysis failed',
      message: NODE_ENV === 'development' ? error.message : 'Invalid input'
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
      price: '$0.01'
    });
  } catch (error) {
    console.error(`[ERROR] Quick check endpoint: ${error.message}`);
    res.status(400).json({
      error: 'Check failed',
      message: NODE_ENV === 'development' ? error.message : 'Invalid input'
    });
  }
});

// Batch analysis endpoint
app.post('/batch-analyze', async (req, res) => {
  try {
    const { tokens } = req.body;

    if (!Array.isArray(tokens)) {
      return res.status(400).json({ error: 'tokens must be an array' });
    }

    if (tokens.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 tokens per request' });
    }

    const results = [];
    for (const token of tokens) {
      try {
        const detector = new TokenScamDetector();
        const result = await detector.analyzeToken(
          token.address,
          token.code,
          token.chain || 'ethereum'
        );
        results.push(result);
      } catch (error) {
        results.push({
          address: token.address,
          error: error.message
        });
      }
    }

    res.json({
      total: results.length,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[ERROR] Batch analysis endpoint: ${error.message}`);
    res.status(400).json({
      error: 'Batch analysis failed',
      message: NODE_ENV === 'development' ? error.message : 'Invalid input'
    });
  }
});

// Documentation endpoint
app.get('/docs', (req, res) => {
  const docs = {
    name: 'Token Scam Detector API',
    version: '1.0.0',
    description: 'Analyzes smart contracts for scam/honeypot indicators',
    security: {
      authentication: 'API Key (X-API-Key header)',
      rateLimit: '100 requests per 15 minutes per IP',
      encryption: 'HTTPS recommended',
      inputValidation: 'All inputs validated and sanitized'
    },
    endpoints: {
      '/health': {
        method: 'GET',
        description: 'Check if API is running',
        requiresAuth: false
      },
      '/analyze': {
        method: 'POST',
        description: 'Detailed token analysis',
        requiresAuth: true,
        body: {
          contractAddress: 'string (required)',
          contractCode: 'string - full contract source (required)',
          chain: 'string - ethereum/bsc/solana (optional, default: ethereum)'
        }
      },
      '/quick-check': {
        method: 'POST',
        description: 'Fast yes/no scam check',
        requiresAuth: true,
        body: {
          contractAddress: 'string',
          contractCode: 'string'
        }
      },
      '/batch-analyze': {
        method: 'POST',
        description: 'Analyze multiple tokens at once (max 50)',
        requiresAuth: true,
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    docs: 'Visit /docs for available endpoints'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'An error occurred',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Token Scam Detector API running on http://localhost:${PORT}`);
  console.log(`📚 Docs available at http://localhost:${PORT}/docs`);
  console.log(`🔒 Environment: ${NODE_ENV}`);
  console.log(`⚠️  API Key Authentication: ${API_KEY ? 'Enabled' : 'NOT CONFIGURED - set the API_KEY config var!'}`);
  console.log('\n--- SECURITY INFO ---');
  console.log('✅ Rate limiting: 100 requests per 15 minutes');
  console.log('✅ Input validation: Enabled');
  console.log('✅ Helmet security headers: Enabled');
  console.log('✅ API Key authentication: Enabled');
  console.log('✅ CORS: Configured');
  console.log('✅ Request logging: Enabled');
});
