/**
 * genkey.js — show the address of your throwaway testnet payer wallet.
 *
 * The wallet is derived, not generated, so this prints the same address every
 * time and you never have to copy a private key out of the Heroku console.
 *
 * Run:  node genkey.js
 */

const { getTestWallet } = require('./testwallet');

const line = '='.repeat(66);

try {
  const { account, source } = getTestWallet();

  console.log('');
  console.log(line);
  console.log('  THROWAWAY TESTNET WALLET');
  console.log(line);
  console.log('');
  console.log('  FUND THIS ADDRESS:');
  console.log('');
  console.log(`     ${account.address}`);
  console.log('');
  console.log(line);
  console.log('');
  console.log('  1. Go to https://faucet.circle.com');
  console.log('  2. Choose network: Base Sepolia');
  console.log('  3. Paste the address above, request test USDC');
  console.log('  4. Come back here and run:   node testpay.js');
  console.log('');
  console.log(`  Key source: ${source}`);
  console.log('');
  console.log('  You do NOT need to copy a private key. testpay.js works out');
  console.log('  the same wallet by itself.');
  console.log('');
  console.log('  TESTNET ONLY - never send real funds to this address.');
  console.log('');
} catch (err) {
  console.error('');
  console.error(`ERROR: ${err.message}`);
  console.error('');
  process.exit(1);
}
