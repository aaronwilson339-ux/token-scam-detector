// ============================================
// EXAMPLE USAGE - Token Scam Detector API
// ============================================

const axios = require('axios');

const API_BASE = 'http://localhost:3001';

// ============ EXAMPLE 1: Analyze a Normal Token ============
async function analyzeNormalToken() {
  console.log('\n=== Analyzing Normal Token ===\n');

  // Example of a legitimate-looking contract
  const legitimateCode = `
    pragma solidity ^0.8.0;

    contract LegitToken {
      string public name = "Legit Token";
      string public symbol = "LEGIT";
      uint8 public decimals = 18;
      uint256 public totalSupply;
      address public owner;

      constructor() {
        owner = msg.sender;
        totalSupply = 1000000 * 10 ** 18;
      }

      function transfer(address to, uint256 amount) public returns (bool) {
        require(balanceOf[msg.sender] >= amount);
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
      }

      function renounceOwnership() public {
        require(msg.sender == owner);
        owner = address(0);
      }
    }
  `;

  try {
    const response = await axios.post(`${API_BASE}/analyze`, {
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractCode: legitimateCode,
      chain: 'ethereum'
    });

    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============ EXAMPLE 2: Analyze a Honeypot Token ============
async function analyzeHoneypotToken() {
  console.log('\n=== Analyzing Honeypot Token ===\n');

  // Example of a honeypot contract
  const honeypotCode = `
    pragma solidity ^0.8.0;

    contract HoneypotToken {
      mapping(address => uint256) public balanceOf;
      address public owner = msg.sender;
      uint256 public buyFee = 5;
      uint256 public sellFee = 99; // Extremely high sell fee!

      function transfer(address to, uint256 value) public {
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value * (100 - buyFee) / 100;
      }

      function sell(uint256 amount) public {
        // This function makes selling extremely expensive
        require(msg.sender != owner);
        uint256 tax = amount * (sellFee) / 100;
        require(false); // Sell always fails!
      }

      function emergencyWithdraw() public {
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success);
      }
    }
  `;

  try {
    const response = await axios.post(`${API_BASE}/analyze`, {
      contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      contractCode: honeypotCode,
      chain: 'ethereum'
    });

    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============ EXAMPLE 3: Quick Check ============
async function quickCheck() {
  console.log('\n=== Quick Check (Simple Response) ===\n');

  const scamCode = `
    pragma solidity ^0.8.0;
    contract Scam {
      function stealTokens() public { }
      function rugPull() public { }
      uint256 sellFee = 100; // 100% fee = honeypot
    }
  `;

  try {
    const response = await axios.post(`${API_BASE}/quick-check`, {
      contractAddress: '0xscamscamscamscamscamscamscamscamscamscam',
      contractCode: scamCode
    });

    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============ EXAMPLE 4: Batch Analysis ============
async function batchAnalysis() {
  console.log('\n=== Batch Analysis (Multiple Tokens) ===\n');

  const tokens = [
    {
      address: '0xtoken1token1token1token1token1token1token1',
      code: `
        pragma solidity ^0.8.0;
        contract Token1 {
          function transfer(address to, uint256 amount) public returns (bool) {
            return true;
          }
        }
      `,
      chain: 'ethereum'
    },
    {
      address: '0xtoken2token2token2token2token2token2token2',
      code: `
        pragma solidity ^0.8.0;
        contract Token2 {
          function rugPull() public {
            // Obvious scam
          }
        }
      `,
      chain: 'bsc'
    }
  ];

  try {
    const response = await axios.post(`${API_BASE}/batch-analyze`, {
      tokens
    });

    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============ EXAMPLE 5: API Documentation ============
async function getDocs() {
  console.log('\n=== API Documentation ===\n');

  try {
    const response = await axios.get(`${API_BASE}/docs`);
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============ RUN EXAMPLES ============
async function runAllExamples() {
  console.log('🚀 Token Scam Detector - Example Usage\n');
  console.log('Make sure the API is running: npm start\n');

  // Wait for each example
  await analyzeNormalToken();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await analyzeHoneypotToken();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await quickCheck();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await batchAnalysis();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await getDocs();
}

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

module.exports = {
  analyzeNormalToken,
  analyzeHoneypotToken,
  quickCheck,
  batchAnalysis,
  getDocs
};
