/**
 * testwallet.js — works out which wallet sends the test payment.
 *
 * Three ways to supply it, in priority order:
 *
 *   1. TEST_PAYER_KEY     — an explicit private key. Most direct.
 *   2. X402_WALLET_SEED   — a passphrase you choose. The wallet is derived
 *                           from it, so there is no key to copy anywhere.
 *                           This is the easy path for a real payment.
 *   3. API_KEY            — last-resort derivation so testnet works with no
 *                           setup at all. TESTNET ONLY, and enforced below.
 *
 * Why option 3 is fenced off: anyone who ever learned API_KEY could compute
 * that wallet's private key. Harmless for faucet tokens, unacceptable for
 * real funds — so on mainnet this module refuses to use it.
 */

const { keccak256, toHex } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const MAINNET_NETWORKS = ['eip155:8453']; // Base mainnet
const MIN_SEED_LENGTH = 12;

function normalizeKey(raw, label) {
  const key = raw.trim().startsWith('0x') ? raw.trim() : `0x${raw.trim()}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      `${label} is set but is not a valid private key (expected 64 hex characters).`
    );
  }
  return key;
}

function isMainnet(network) {
  return MAINNET_NETWORKS.includes(network);
}

/**
 * @param {string} network - CAIP-2 network id, e.g. 'eip155:84532'
 */
function getTestWallet(network) {
  // 1. Explicit private key
  if (process.env.TEST_PAYER_KEY) {
    const key = normalizeKey(process.env.TEST_PAYER_KEY, 'TEST_PAYER_KEY');
    return {
      key,
      account: privateKeyToAccount(key),
      source: 'TEST_PAYER_KEY (explicit key)',
      safeForMainnet: true
    };
  }

  // 2. Passphrase you chose — safe for real payments, nothing to copy
  if (process.env.X402_WALLET_SEED) {
    const seed = process.env.X402_WALLET_SEED.trim();
    if (seed.length < MIN_SEED_LENGTH) {
      throw new Error(
        `X402_WALLET_SEED is too short (${seed.length} characters). ` +
          `Use at least ${MIN_SEED_LENGTH}, and make it hard to guess — ` +
          'it is the only thing protecting this wallet.'
      );
    }
    const key = keccak256(toHex(`x402-wallet-seed-v1:${seed}`));
    return {
      key,
      account: privateKeyToAccount(key),
      source: 'X402_WALLET_SEED (derived from your passphrase)',
      safeForMainnet: true
    };
  }

  // 3. Last resort: derived from API_KEY. Testnet only.
  if (process.env.API_KEY) {
    if (isMainnet(network)) {
      throw new Error(
        'Refusing to use the API_KEY-derived wallet on mainnet.\n' +
          '   That wallet is only as secret as API_KEY, so real funds in it ' +
          'would be at risk.\n' +
          '   Set X402_WALLET_SEED to a passphrase of your choosing, then ' +
          'run "node genkey.js" again.'
      );
    }
    const key = keccak256(toHex(`x402-testnet-payer-v1:${process.env.API_KEY}`));
    return {
      key,
      account: privateKeyToAccount(key),
      source: 'derived from API_KEY (testnet only)',
      safeForMainnet: false
    };
  }

  throw new Error(
    'No wallet available. Set X402_WALLET_SEED to a passphrase you choose, ' +
      'or TEST_PAYER_KEY to a private key.'
  );
}

module.exports = { getTestWallet, isMainnet };
