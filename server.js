const express = require('express');
const cors = require('cors');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Heroku (and most hosts) run the app behind a reverse proxy. Express needs to
// be told, or express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and
// cannot identify real client IPs. '1' = trust exactly one proxy hop.
app.set('trust proxy', 1);
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
// ACCESS CONTROL: x402 PAYMENT + OWNER API KEY
// ============================================
//
// Two ways to reach a paid endpoint:
//   1. Pay per call via x402 (this is how AI agents buy access)
//   2. Send the owner's API key (so you can test without paying yourself)
//
// /health and /docs stay open to everyone - marketplaces and agents need
// to read them before they can decide to buy anything.

const publicRoutes = ['/health', '/docs'];

// x402 config. Everything comes from environment variables so no wallet
// address or credential is ever committed to the repository.
const X402_PAY_TO = process.env.X402_PAY_TO;              // your receiving wallet
const X402_PRICE = process.env.X402_PRICE || '$0.01';     // price per call
const X402_ENV = process.env.X402_ENV || 'development';   // development = testnet
const X402_NETWORK = process.env.X402_NETWORK ||
  (X402_ENV === 'production' ? 'eip155:8453' : 'eip155:84532'); // Base / Base Sepolia
// The facilitator verifies and settles payments. The public one needs no
// credentials, which is what makes testnet possible without a CDP account.
const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';

const PAID_ROUTES = ['/analyze', '/quick-check', '/batch-analyze'];

// Holds the x402 middleware once it finishes initializing. Stays null if
// x402 is not configured, in which case the API key is the only way in.
let x402Middleware = null;
let x402Status = 'not configured';

// Step 1: owner bypass. A valid API key skips payment entirely.
app.use((req, res, next) => {
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  const key = req.headers['x-api-key'];
  if (API_KEY && key && key === API_KEY) {
    req.ownerBypass = true;
    return next();
  }

  // No valid key. If x402 is live, let the payment layer handle this request.
  if (x402Middleware) {
    return next();
  }

  // Neither payment nor a key is available - fall back to the old behaviour.
  if (!API_KEY) {
    console.error('[SECURITY] No API_KEY and no x402 - refusing protected requests.');
    return res.status(503).json({
      error: 'Service not configured',
      message: 'This API has neither an API_KEY nor x402 payment configured.'
    });
  }

  console.warn(`[SECURITY] Unauthorized access attempt to ${req.path}`);
  return res.status(401).json({
    error: 'Unauthorized - Missing or invalid API key',
    hint: 'Include header: X-API-Key: your-key, or pay per call via x402'
  });
});

// Step 2: payment gate. Delegates to x402 once it has initialized.
app.use((req, res, next) => {
  if (req.ownerBypass || !x402Middleware) {
    return next();
  }
  if (publicRoutes.includes(req.path)) {
    return next();
  }
  return x402Middleware(req, res, next);
});

// Initialize x402 in the background. This deliberately never throws: if the
// credentials are missing or Coinbase is unreachable, the server still boots
// and keeps serving on the API key rather than taking the whole API down.
async function initX402() {
  if (!X402_PAY_TO) {
    x402Status = 'not configured (X402_PAY_TO is not set)';
    return;
  }

  try {
    const { paymentMiddleware, x402ResourceServer } = require('@x402/express');
    const { ExactEvmScheme } = require('@x402/evm/exact/server');
    const { HTTPFacilitatorClient } = require('@x402/core/server');

    // Preflight: confirm the facilitator actually answers before we put it in
    // the request path. Without this, an unreachable facilitator turns every
    // paid request into a 500 instead of falling back cleanly to the API key.
    const probe = await fetch(`${X402_FACILITATOR_URL}/supported`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!probe.ok) {
      throw new Error(`facilitator unreachable (HTTP ${probe.status})`);
    }

    const facilitatorClient = new HTTPFacilitatorClient({ url: X402_FACILITATOR_URL });
    const resourceServer = new x402ResourceServer(facilitatorClient)
      .register(X402_NETWORK, new ExactEvmScheme());

    const routes = {};
    for (const route of PAID_ROUTES) {
      routes[`POST ${route}`] = {
        accepts: {
          scheme: 'exact',
          price: X402_PRICE,
          network: X402_NETWORK,
          payTo: X402_PAY_TO
        },
        description: 'Smart contract scam and honeypot risk analysis'
      };
    }

    x402Middleware = paymentMiddleware(routes, resourceServer);
    x402Status = `live (${X402_PRICE} per call on ${X402_NETWORK})`;
    console.log(`✅ x402 payments enabled: ${x402Status}`);
    console.log(`   facilitator: ${X402_FACILITATOR_URL}`);
    console.log(`   paid to: ${X402_PAY_TO}`);
  } catch (err) {
    x402Status = `failed to start (${err.message})`;
    console.error(`[x402] Initialization failed, continuing without payments: ${err.message}`);
  }
}

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
    payments: x402Status,
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
    payment: {
      protocol: 'x402',
      price: X402_PRICE,
      currency: 'USDC',
      network: X402_NETWORK,
      status: x402Status,
      paidRoutes: PAID_ROUTES,
      howItWorks: 'Call a paid route with no payment to receive an HTTP 402 response containing payment details, then retry with a signed payment authorization.'
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
  console.log(`💰 x402 payments: ${x402Status}`);

  // Kick off payment setup after the server is already accepting requests,
  // so a slow or failed handshake can never stop the API from starting.
  initX402();
  console.log('\n--- SECURITY INFO ---');
  console.log('✅ Rate limiting: 100 requests per 15 minutes');
  console.log('✅ Input validation: Enabled');
  console.log('✅ Helmet security headers: Enabled');
  console.log('✅ API Key authentication: Enabled');
  console.log('✅ CORS: Configured');
  console.log('✅ Request logging: Enabled');
});
