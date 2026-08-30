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
const { getTestWallet } = require('./testwallet');

const API_URL =
  process.env.TEST_API_URL ||
  'https://token-scam-detector-80cff4df0237.herokuapp.com/analyze';

const NETWORK = process.env.X402_NETWORK || 'eip155:84532'; // Base Sepolia

function fail(message, hint) {
  console.error(`\n\u274c ${message}`);
  if (hint) console.error(`   ${hint}`);
  process.exit(1);
}

let wallet;
try {
  wallet = getTestWallet();
} catch (err) {
  fail(err.message, 'Run "node genkey.js" first to see the wallet address.');
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
  const account = wallet.account;

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
