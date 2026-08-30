/**
 * genkey.js — show the address of the wallet that sends the test payment.
 *
 * The wallet is derived rather than generated, so it prints the same address
 * every time and you never have to copy a private key out of the console.
 *
 * Run:  node genkey.js
 */

const { getTestWallet, isMainnet } = require('./testwallet');

const NETWORK = process.env.X402_NETWORK ||
  (process.env.X402_ENV === 'production' ? 'eip155:8453' : 'eip155:84532');

const line = '='.repeat(66);

try {
  const { account, source } = getTestWallet(NETWORK);

  console.log('');
  console.log(line);
  console.log(isMainnet(NETWORK)
    ? '  PAYER WALLET - BASE MAINNET (REAL FUNDS)'
    : '  PAYER WALLET - BASE SEPOLIA TESTNET (PLAY MONEY)');
  console.log(line);
  console.log('');
  console.log('  FUND THIS ADDRESS:');
  console.log('');
  console.log(`     ${account.address}`);
  console.log('');
  console.log(line);
  console.log('');
  if (isMainnet(NETWORK)) {
    console.log('  NETWORK: Base MAINNET - this wallet handles REAL money.');
    console.log('');
    console.log('  1. Send about $1 of USDC on BASE to the address above.');
    console.log('     Check the network is Base, not Ethereum.');
    console.log('  2. Come back here and run:   node testpay.js');
    console.log('');
    console.log('  Keep only a dollar or two here. It exists to send one');
    console.log('  small payment, not to hold funds.');
  } else {
    console.log('  NETWORK: Base Sepolia TESTNET - play money only.');
    console.log('');
    console.log('  1. Go to https://faucet.circle.com');
    console.log('  2. Choose network: Base Sepolia');
    console.log('  3. Paste the address above, request test USDC');
    console.log('  4. Come back here and run:   node testpay.js');
    console.log('');
    console.log('  TESTNET ONLY - never send real funds to this address.');
  }
  console.log('');
  console.log(`  Wallet source: ${source}`);
  console.log('');
  console.log('  You do NOT need to copy a private key anywhere.');
  console.log('  testpay.js works out the same wallet by itself.');
  console.log('');
} catch (err) {
  console.error('');
  console.error(`ERROR: ${err.message}`);
  console.error('');
  process.exit(1);
}
