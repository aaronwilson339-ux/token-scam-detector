/**
 * genkey.js — create a throwaway wallet for the one-off x402 test payment.
 *
 * This wallet exists only to send a single test-USDC payment to your own
 * endpoint, which is what triggers Bazaar indexing. It is NOT your real
 * wallet: fund it only from a testnet faucet, and delete it afterwards.
 *
 * Run:  node genkey.js
 */

const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');

const key = generatePrivateKey();
const account = privateKeyToAccount(key);

const line = '─'.repeat(64);

console.log('');
console.log(line);
console.log('  THROWAWAY TEST WALLET — testnet only, never send real funds');
console.log(line);
console.log('');
console.log('  ADDRESS  (fund this at faucet.circle.com, Base Sepolia)');
console.log(`  ${account.address}`);
console.log('');
console.log('  PRIVATE KEY  (paste into Heroku config var TEST_PAYER_KEY)');
console.log(`  ${key}`);
console.log('');
console.log(line);
console.log('');
console.log('  Next steps:');
console.log('   1. Copy the ADDRESS -> https://faucet.circle.com');
console.log('      Choose "Base Sepolia" and request test USDC.');
console.log('   2. Copy the PRIVATE KEY -> Heroku Settings -> Config Vars');
console.log('      Name it exactly: TEST_PAYER_KEY');
console.log('   3. Back here, run:  node testpay.js');
console.log('   4. When it succeeds, DELETE the TEST_PAYER_KEY config var.');
console.log('');
console.log('  This key controls nothing but faucet tokens. Do not reuse it,');
console.log('  and do not send real money to this address.');
console.log('');
