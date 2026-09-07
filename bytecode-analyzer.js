/**
 * bytecode-analyzer.js — judge a contract from its compiled bytecode.
 *
 * Why this exists: the source-code analyzer can only look at contracts whose
 * Solidity has been published. Most scam tokens never publish theirs, so that
 * analyzer is blind to exactly the cases that matter.
 *
 * Bytecode is always available on-chain. Every public function is identified
 * by a 4-byte selector — the first four bytes of keccak256("name(argTypes)")
 * — and the compiler emits those selectors as PUSH4 instructions so the
 * contract can route incoming calls. Read the PUSH4 operands and you learn
 * which functions exist, with no source required.
 *
 * What this deliberately does NOT do: shout "SCAM". Plenty of legitimate
 * tokens can mint (USDC does). What it reports is what the owner is *able*
 * to do. That is a verifiable fact; "this is a scam" is a guess.
 */

/**
 * Selectors are precomputed constants - the first 4 bytes of
 * keccak256("signature"). They never change, so there is no reason to hash
 * them at every boot, and this keeps the analyzer free of any crypto
 * dependency. `npm run verify-selectors` re-derives them to prove they match.
 *
 * Severity reflects what a holder stands to lose if the privilege is used
 * against them, not how unusual the function is:
 *
 *   critical - funds can be taken or frozen, or the code replaced
 *   high     - holder can be blocked from selling, or diluted
 *   medium   - holder's economics can change after they buy
 *   info     - worth knowing, not inherently adverse
 */
const CAPABILITIES = [
  { selector: '0x3659cfe6', sig: 'upgradeTo(address)', capability: 'Contract code can be replaced by the owner', severity: 'critical', points: 40 },
  { selector: '0x4f1ef286', sig: 'upgradeToAndCall(address,bytes)', capability: 'Contract code can be replaced by the owner', severity: 'critical', points: 40 },
  { selector: '0x404e5129', sig: 'blacklist(address,bool)', capability: 'Owner can blacklist wallets', severity: 'critical', points: 30 },
  { selector: '0x153b0d1e', sig: 'setBlacklist(address,bool)', capability: 'Owner can blacklist wallets', severity: 'critical', points: 30 },
  { selector: '0x44337ea1', sig: 'addToBlacklist(address)', capability: 'Owner can blacklist wallets', severity: 'critical', points: 30 },
  { selector: '0x0ecb93c0', sig: 'addBlackList(address)', capability: 'Owner can blacklist wallets', severity: 'critical', points: 30 },
  { selector: '0x5cd8c072', sig: 'setBlackListed(address,bool)', capability: 'Owner can blacklist wallets', severity: 'critical', points: 30 },
  { selector: '0x8d1fdf2f', sig: 'freeze(address)', capability: 'Owner can freeze wallets', severity: 'critical', points: 30 },
  { selector: '0xac869cd8', sig: 'setFrozen(address,bool)', capability: 'Owner can freeze wallets', severity: 'critical', points: 30 },
  { selector: '0xb2a02ff1', sig: 'seize(address,address,uint256)', capability: 'Owner can seize holder tokens', severity: 'critical', points: 45 },
  { selector: '0x79cc6790', sig: 'burnFrom(address,uint256)', capability: 'Tokens can be burned from a wallet by an approved party', severity: 'medium', points: 8 },
  { selector: '0x8456cb59', sig: 'pause()', capability: 'Owner can pause all transfers', severity: 'critical', points: 25 },
  { selector: '0x16c38b3c', sig: 'setPaused(bool)', capability: 'Owner can pause all transfers', severity: 'critical', points: 25 },
  { selector: '0xc2e5ec04', sig: 'setTradingEnabled(bool)', capability: 'Owner controls whether trading is enabled', severity: 'high', points: 20 },
  { selector: '0x8a8c523c', sig: 'enableTrading()', capability: 'Owner controls whether trading is enabled', severity: 'high', points: 20 },
  { selector: '0x379ba1d9', sig: 'setTradingStatus(bool)', capability: 'Owner controls whether trading is enabled', severity: 'high', points: 20 },
  { selector: '0x40c10f19', sig: 'mint(address,uint256)', capability: 'New tokens can be minted', severity: 'high', points: 18 },
  { selector: '0xa0712d68', sig: 'mint(uint256)', capability: 'New tokens can be minted', severity: 'high', points: 18 },
  { selector: '0x4e6ec247', sig: '_mint(address,uint256)', capability: 'New tokens can be minted', severity: 'high', points: 18 },
  { selector: '0x0b78f9c0', sig: 'setFees(uint256,uint256)', capability: 'Owner can change buy/sell fees', severity: 'medium', points: 12 },
  { selector: '0x69fe0e2d', sig: 'setFee(uint256)', capability: 'Owner can change fees', severity: 'medium', points: 12 },
  { selector: '0xc647b20e', sig: 'setTaxes(uint256,uint256)', capability: 'Owner can change taxes', severity: 'medium', points: 12 },
  { selector: '0xdc1052e2', sig: 'setBuyTax(uint256)', capability: 'Owner can change buy tax', severity: 'medium', points: 12 },
  { selector: '0x8cd09d50', sig: 'setSellTax(uint256)', capability: 'Owner can change sell tax', severity: 'medium', points: 15 },
  { selector: '0xec28438a', sig: 'setMaxTxAmount(uint256)', capability: 'Owner can cap transaction size', severity: 'high', points: 18 },
  { selector: '0x27a14fc2', sig: 'setMaxWalletAmount(uint256)', capability: 'Owner can cap wallet size', severity: 'medium', points: 12 },
  { selector: '0x5d0044ca', sig: 'setMaxWallet(uint256)', capability: 'Owner can cap wallet size', severity: 'medium', points: 12 },
  { selector: '0xdb2e21bc', sig: 'emergencyWithdraw()', capability: 'Owner can withdraw contract balance', severity: 'high', points: 20 },
  { selector: '0x3ccfd60b', sig: 'withdraw()', capability: 'Owner can withdraw contract balance', severity: 'medium', points: 10 },
  { selector: '0x57376198', sig: 'rescueTokens(address,uint256)', capability: 'Owner can remove tokens held by the contract', severity: 'medium', points: 10 },
  { selector: '0x9e281a98', sig: 'withdrawToken(address,uint256)', capability: 'Owner can remove tokens held by the contract', severity: 'medium', points: 10 },
  { selector: '0x8da5cb5b', sig: 'owner()', capability: 'Contract has an owner', severity: 'info', points: 0 },
  { selector: '0xf2fde38b', sig: 'transferOwnership(address)', capability: 'Ownership can be transferred', severity: 'info', points: 0 },
  { selector: '0x715018a6', sig: 'renounceOwnership()', capability: 'Ownership can be renounced', severity: 'info', points: 0 },
  { selector: '0x18160ddd', sig: 'totalSupply()', capability: 'Standard ERC-20 interface', severity: 'info', points: 0 },
  { selector: '0x70a08231', sig: 'balanceOf(address)', capability: 'Standard ERC-20 interface', severity: 'info', points: 0 },
  { selector: '0xa9059cbb', sig: 'transfer(address,uint256)', capability: 'Standard ERC-20 interface', severity: 'info', points: 0 },
  { selector: '0x095ea7b3', sig: 'approve(address,uint256)', capability: 'Standard ERC-20 interface', severity: 'info', points: 0 },
  { selector: '0x23b872dd', sig: 'transferFrom(address,address,uint256)', capability: 'Standard ERC-20 interface', severity: 'info', points: 0 }
];


// selector -> entry, built once at load
const SELECTOR_MAP = new Map();
for (const entry of CAPABILITIES) {
  SELECTOR_MAP.set(entry.selector, entry);
}

/**
 * Pull every PUSH4 operand out of the bytecode.
 *
 * The EVM encodes PUSH4 as opcode 0x63 followed by its 4-byte operand. We
 * walk the instruction stream rather than scanning blindly, because PUSH
 * operands can contain any byte value and a naive scan would read data as
 * if it were code and invent selectors that are not there.
 */
function extractSelectors(bytecode) {
  const hex = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
  const bytes = Buffer.from(hex, 'hex');
  const found = new Set();

  for (let i = 0; i < bytes.length; i++) {
    const op = bytes[i];

    if (op === 0x63 && i + 4 < bytes.length) { // PUSH4
      found.add('0x' + bytes.subarray(i + 1, i + 5).toString('hex'));
      i += 4;
      continue;
    }

    // Skip the operand of any other PUSH so we never read data as opcodes.
    if (op >= 0x60 && op <= 0x7f) {
      i += op - 0x5f;
    }
  }

  return found;
}

function severityFromScore(score) {
  if (score >= 70) return 'CRITICAL';
  if (score >= 45) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  if (score >= 10) return 'LOW';
  return 'MINIMAL';
}

/**
 * @param {string} bytecode - runtime bytecode from eth_getCode
 * @returns {{privileges: Array, standardInterface: Array, riskScore: number,
 *            severity: string, selectorsFound: number, unknownSelectors: number}}
 */
function analyzeBytecode(bytecode) {
  const selectors = extractSelectors(bytecode);

  const privileges = [];
  const standardInterface = [];
  const seenCapabilities = new Set();
  let score = 0;

  for (const selector of selectors) {
    const entry = SELECTOR_MAP.get(selector);
    if (!entry) continue;

    if (entry.severity === 'info') {
      standardInterface.push({ selector, signature: entry.sig, note: entry.capability });
      continue;
    }

    // Several signatures map to the same capability (projects spell things
    // differently). Count each capability once so a contract with three
    // blacklist variants is not scored three times.
    if (seenCapabilities.has(entry.capability)) continue;
    seenCapabilities.add(entry.capability);

    privileges.push({
      capability: entry.capability,
      severity: entry.severity,
      signature: entry.sig,
      selector
    });
    score += entry.points;
  }

  const order = { critical: 0, high: 1, medium: 2 };
  privileges.sort((a, b) => order[a.severity] - order[b.severity]);

  if (score > 100) score = 100;

  return {
    privileges,
    standardInterface,
    riskScore: score,
    severity: severityFromScore(score),
    selectorsFound: selectors.size,
    recognizedSelectors: privileges.length + standardInterface.length
  };
}

module.exports = { analyzeBytecode, extractSelectors, CAPABILITIES };
