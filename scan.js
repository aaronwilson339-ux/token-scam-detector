/**
 * scan.js — run the bytecode scanner on a real contract, from the console.
 *
 * This calls the analysis modules directly rather than going through the
 * paid API, so there is no payment and no API key involved. It exists so you
 * can see what your own product actually says about real tokens.
 *
 * Usage:
 *   node scan.js <address> [chain]
 *
 * Examples:
 *   node scan.js 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 base    (USDC)
 *   node scan.js 0x4200000000000000000000000000000000000006 base    (WETH)
 */

const { fetchContract, ChainError, RPC_URLS } = require('./chain');
const { analyzeBytecode } = require('./bytecode-analyzer');

const address = process.argv[2];
const chain = process.argv[3] || 'base';

const RULE = '='.repeat(68);

if (!address) {
  console.log('');
  console.log('Usage: node scan.js <contractAddress> [chain]');
  console.log(`Chains: ${Object.keys(RPC_URLS).join(', ')}   (default: base)`);
  console.log('');
  console.log('Try these:');
  console.log('  node scan.js 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 base   # USDC');
  console.log('  node scan.js 0x4200000000000000000000000000000000000006 base   # WETH');
  console.log('');
  process.exit(1);
}

function money(n) {
  if (n === null || n === undefined) return 'unknown';
  const s = String(n);
  return s.length > 24 ? s.slice(0, 6) + '...(' + s.length + ' digits)' : s;
}

async function main() {
  console.log('');
  console.log(RULE);
  console.log(`  SCANNING  ${address}`);
  console.log(`  CHAIN     ${chain}`);
  console.log(RULE);

  const started = Date.now();
  const contract = await fetchContract(address, chain);
  const analysis = analyzeBytecode(contract.bytecode);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log('');
  console.log('  CONTRACT');
  console.log(`    bytecode size    ${contract.bytecodeSize.toLocaleString()} bytes`);
  console.log(`    upgradeable      ${contract.proxy.isProxy ? 'YES - code can be replaced' : 'no'}`);
  if (contract.proxy.isProxy) {
    console.log(`    implementation   ${contract.proxy.implementation}`);
  }
  console.log(`    has owner()      ${contract.owner.hasOwner ? 'yes' : 'no'}`);
  if (contract.owner.hasOwner) {
    console.log(`    ownership        ${contract.owner.renounced ? 'RENOUNCED' : contract.owner.owner}`);
  }
  console.log(`    total supply     ${money(contract.totalSupply)}`);
  console.log(`    selectors seen   ${analysis.selectorsFound} (${analysis.recognizedSelectors} recognised)`);

  console.log('');
  if (analysis.privileges.length === 0) {
    console.log('  OWNER PRIVILEGES');
    console.log('    none of the recognised kinds were found');
  } else {
    console.log(`  OWNER PRIVILEGES  (${analysis.privileges.length})`);
    for (const p of analysis.privileges) {
      console.log(`    [${p.severity.toUpperCase().padEnd(8)}] ${p.capability}`);
      console.log(`               via ${p.sig || p.signature}  ${p.selector}`);
    }
  }

  let score = analysis.riskScore;
  const notes = [];
  if (contract.proxy.isProxy) {
    score += 25;
    notes.push('Upgradeable: these findings describe only the code deployed right now.');
  }
  if (contract.owner.renounced && analysis.privileges.length > 0) {
    score = Math.round(score * 0.3);
    notes.push('Ownership renounced, so an owner cannot use the privileges above.');
    notes.push('Other privileged roles may still exist; bytecode alone cannot rule them out.');
  }
  if (score > 100) score = 100;

  const severity =
    score >= 70 ? 'CRITICAL' :
    score >= 45 ? 'HIGH' :
    score >= 25 ? 'MEDIUM' :
    score >= 10 ? 'LOW' : 'MINIMAL';

  console.log('');
  console.log(RULE);
  console.log(`  RISK SCORE  ${score}/100   ${severity}`);
  console.log(RULE);
  if (notes.length) {
    console.log('');
    for (const n of notes) console.log(`  note: ${n}`);
  }
  console.log('');
  console.log(`  scanned in ${elapsed}s`);
  console.log('');
}

main().catch(err => {
  console.error('');
  if (err instanceof ChainError) {
    console.error(`  Could not scan: ${err.message}`);
  } else {
    console.error(`  Unexpected error: ${err.message}`);
  }
  console.error('');
  process.exit(1);
});
