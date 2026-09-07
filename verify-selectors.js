/**
 * verify-selectors.js — prove the hardcoded selectors are correct.
 *
 * bytecode-analyzer.js stores selectors as literals so it needs no crypto
 * library at runtime. The risk of literals is that someone edits a signature
 * and forgets the selector, or vice versa, and the analyzer then silently
 * looks for a function that does not exist. This re-derives every one and
 * fails loudly on any mismatch.
 *
 * Run:  npm run verify-selectors
 */

const { keccak256, toHex } = require('viem');
const { CAPABILITIES } = require('./bytecode-analyzer');

let failures = 0;

for (const entry of CAPABILITIES) {
  const derived = keccak256(toHex(entry.sig)).slice(0, 10);
  if (derived !== entry.selector) {
    failures++;
    console.error(
      `MISMATCH  ${entry.sig}\n` +
      `          stored:  ${entry.selector}\n` +
      `          derived: ${derived}`
    );
  }
}

const duplicates = new Set();
const seen = new Set();
for (const entry of CAPABILITIES) {
  if (seen.has(entry.selector)) duplicates.add(entry.selector);
  seen.add(entry.selector);
}
if (duplicates.size > 0) {
  failures++;
  console.error(`DUPLICATE selectors: ${[...duplicates].join(', ')}`);
}

if (failures > 0) {
  console.error(`\n${failures} problem(s) found.`);
  process.exit(1);
}

console.log(`All ${CAPABILITIES.length} selectors verified against keccak256.`);
