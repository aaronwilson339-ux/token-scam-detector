/**
 * testwallet.js — derives the throwaway testnet payer wallet.
 *
 * Why derive instead of generate: the Heroku console blocks copy/paste, so
 * moving a freshly generated key out of it is painful. Instead we derive the
 * same key every time from a secret the app already has. Nothing to copy,
 * nothing to store, and genkey.js and testpay.js always agree on the wallet.
 *
 * TESTNET ONLY. This wallet's key is a function of API_KEY, so anyone who
 * ever learned API_KEY could compute it. That is fine for faucet tokens and
 * completely unacceptable for real funds — never send real money here.
 *
 * Set TEST_PAYER_KEY to override with an explicit key if you prefer.
 */

const { keccak256, toHex } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const DERIVATION_LABEL = 'x402-testnet-payer-v1';

function getTestWallet() {
  const override = process.env.TEST_PAYER_KEY;

  if (override) {
    const key = override.trim().startsWith('0x')
      ? override.trim()
      : `0x${override.trim()}`;
    if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
      throw new Error(
        'TEST_PAYER_KEY is set but is not a valid private key ' +
          '(expected 64 hex characters).'
      );
    }
    return { key, account: privateKeyToAccount(key), source: 'TEST_PAYER_KEY' };
  }

  const seed = process.env.API_KEY;
  if (!seed) {
    throw new Error(
      'Cannot derive a test wallet: API_KEY is not set, and no ' +
        'TEST_PAYER_KEY was provided.'
    );
  }

  const key = keccak256(toHex(`${DERIVATION_LABEL}:${seed}`));
  return { key, account: privateKeyToAccount(key), source: 'derived' };
}

module.exports = { getTestWallet };
