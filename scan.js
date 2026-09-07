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

const { ChainError, RPC_URLS } = require('./chain');
const { runScan } = require('./scan-core');

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
  const r = await runScan(address, chain);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log('');
  console.log('  CONTRACT');
  console.log(`    bytecode size    ${r.contract.bytecodeSize.toLocaleString()} bytes`);
  console.log(`    upgradeable      ${r.contract.isUpgradeableProxy ? 'YES - code can be replaced' : 'no'}`);
  if (r.contract.isUpgradeableProxy) {
    console.log(`    implementation   ${r.contract.implementation}`);
  }
  console.log(`    has owner()      ${r.contract.hasOwner ? 'yes' : 'no'}`);
  if (r.contract.hasOwner) {
    console.log(`    ownership        ${r.contract.ownershipRenounced ? 'RENOUNCED' : r.contract.owner}`);
  }
  console.log(`    total supply     ${money(r.contract.totalSupply)}`);
  if (r.knownIssuer) {
    console.log(`    known issuer     ${r.knownIssuer.name} - ${r.knownIssuer.issuer}`);
  }

  console.log('');
  if (r.ownerPrivileges.length === 0) {
    console.log('  OWNER PRIVILEGES');
    console.log('    none of the recognised kinds were found');
  } else {
    console.log(`  OWNER PRIVILEGES  (${r.ownerPrivileges.length})`);
    for (const p of r.ownerPrivileges) {
      console.log(`    [${p.severity.toUpperCase().padEnd(8)}] ${p.capability}`);
      console.log(`               via ${p.sig || p.signature}  ${p.selector}`);
    }
  }

  console.log('');
  console.log('  HOW THE SCORE WAS REACHED');
  for (const s of r.scoring) {
    const sign = s.delta >= 0 ? '+' : '';
    console.log(`    ${(sign + s.delta).padStart(5)}  ${s.reason}`);
  }

  console.log('');
  console.log(RULE);
  console.log(`  RISK SCORE  ${r.riskScore}/100   ${r.severity}`);
  console.log(RULE);
  if (r.notes.length) {
    console.log('');
    for (const n of r.notes) console.log(`  note: ${n}`);
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
