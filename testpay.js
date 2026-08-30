/**
 * testpay.js — make one real x402 payment to your own endpoint.
 *
 * Why this exists: the Bazaar only indexes an endpoint after it has seen one
 * successful verify+settle. This script is that first payment. You pay
 * yourself $0.01 in TEST USDC on Base Sepolia, and that transaction is what
 * puts your API on the map.
 *
 * SAFETY: this needs a wallet private key to sign the payment. Use a
 * THROWAWAY wallet funded only from a testnet faucet — never your main one.
 * The key is read from an environment variable and is never written to disk
 * or committed. Your real wallet stays the recipient and needs no key.
 *
 * Run it with:
 *   node testpay.js
 */

const { wrapFetchWithPaymentFromConfig } = require('@x402/fetch');
const { ExactEvmScheme } = require('@x402/evm/exact/client');
const { privateKeyToAccount } = require('viem/accounts');

const API_URL =
  process.env.TEST_API_URL ||
  'https://token-scam-detector-80cff4df0237.herokuapp.com/analyze';

const NETWORK = process.env.X402_NETWORK || 'eip155:84532'; // Base Sepolia
const RAW_KEY = process.env.TEST_PAYER_KEY;

function fail(message, hint) {
  console.error(`\n❌ ${message}`);
  if (hint) console.error(`   ${hint}`);
  process.exit(1);
}

if (!RAW_KEY) {
  fail(
    'TEST_PAYER_KEY is not set.',
    'Set it to your THROWAWAY test wallet private key, not your main wallet.'
  );
}

// viem wants the 0x prefix; accept a key pasted either way.
const PRIVATE_KEY = RAW_KEY.trim().startsWith('0x')
  ? RAW_KEY.trim()
  : `0x${RAW_KEY.trim()}`;

if (!/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
  fail(
    'TEST_PAYER_KEY does not look like a private key.',
    'Expected 64 hex characters, optionally prefixed with 0x.'
  );
}

// A contract with obvious scam markers, so a successful call returns a
// high-risk result and we can see real analysis came back.
const TEST_CONTRACT = {
  contractAddress: '0x1234567890123456789012345678901234567890',
  contractCode: `pragma solidity ^0.8.0;
contract SuspiciousToken {
  uint256 public sellLimit = 1;
  mapping(address => bool) public blacklist;
  function mint(address to, uint256 amount) public { }
  function rugPull() public { }
  uint256 public sellFee = 99;
}`,
  chain: 'ethereum'
};

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);

  console.log('x402 test payment');
  console.log('─'.repeat(52));
  console.log(`Endpoint : ${API_URL}`);
  console.log(`Network  : ${NETWORK}`);
  console.log(`Paying as: ${account.address}`);
  console.log('─'.repeat(52));

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }]
  });

  console.log('\nCalling the endpoint (expect 402, then automatic payment)...\n');

  const started = Date.now();
  const response = await fetchWithPayment(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_CONTRACT)
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const body = await response.text();

  console.log(`HTTP ${response.status} (${elapsed}s)\n`);

  if (response.status === 200) {
    console.log('✅ PAID AND SERVED — the payment settled.\n');
    try {
      console.log(JSON.stringify(JSON.parse(body), null, 2));
    } catch {
      console.log(body);
    }
    console.log(
      '\nYour endpoint should appear in the Bazaar within a few minutes.'
    );
    return;
  }

  if (response.status === 402) {
    fail(
      'Still 402 — the payment was not completed.',
      'Usually means the payer wallet has no test USDC on Base Sepolia. ' +
        'Fund ' + account.address + ' from a Base Sepolia USDC faucet.'
    );
  }

  fail(`Unexpected status ${response.status}`, body.slice(0, 400));
}

main().catch(err => {
  fail(err.message, err.cause ? String(err.cause).slice(0, 300) : undefined);
});
