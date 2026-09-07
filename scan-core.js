/**
 * scan-core.js — the scoring logic, in one place.
 *
 * Used by the paid /scan route, the free /demo/scan route, and scan.js.
 * Keeping it here means those three can never drift apart and start giving
 * different answers for the same contract, which would be worse than any of
 * them being slightly wrong.
 */

const { fetchContract } = require('./chain');
const { analyzeBytecode } = require('./bytecode-analyzer');

let KNOWN = { contracts: {}, owners: {} };
try {
  KNOWN = require('./known-issuers.json');
} catch {
  // Optional file. Without it every contract is simply treated as unknown,
  // which is the safe direction to fail in.
}

const KNOWN_ISSUER_DISCOUNT = 50;

function lookupKnown(address, chain) {
  if (!address) return null;
  const key = address.toLowerCase();
  const c = String(chain || '').toLowerCase();

  const byContract = KNOWN.contracts?.[c]?.[key];
  if (byContract) return { ...byContract, matchedOn: 'contract' };

  const byOwner = KNOWN.owners?.[c]?.[key];
  if (byOwner) return { ...byOwner, matchedOn: 'owner' };

  return null;
}

function severityFor(score) {
  if (score >= 70) return 'CRITICAL';
  if (score >= 45) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  if (score >= 10) return 'LOW';
  return 'MINIMAL';
}

async function runScan(contractAddress, chain = 'ethereum') {
  const contract = await fetchContract(contractAddress, chain);
  const analysis = analyzeBytecode(contract.bytecode);

  const notes = [];
  const scoring = [];
  let score = analysis.riskScore;
  scoring.push({ reason: 'Owner privileges found in bytecode', delta: analysis.riskScore });

  // An upgradeable proxy means today's bytecode is not a promise about
  // tomorrow's. That outranks anything found inside the current code.
  if (contract.proxy.isProxy) {
    score += 25;
    scoring.push({ reason: 'Upgradeable proxy - code can be replaced', delta: +25 });
    notes.push(
      'This is an upgradeable proxy. The code behind it can be replaced, so ' +
      'these findings describe the implementation deployed right now and ' +
      'nothing more.'
    );
  }

  // If owner() is genuinely the zero address, an owner cannot use the
  // privileges below. Worth a lot - but not everything, because privileges
  // can also live in roles that bytecode alone does not reveal.
  if (contract.owner.renounced && analysis.privileges.length > 0) {
    const before = score;
    score = Math.round(score * 0.3);
    scoring.push({ reason: 'Ownership renounced - privileges unreachable by an owner', delta: score - before });
    notes.push(
      'Ownership is renounced (owner() returns the zero address), so the ' +
      'privileges listed cannot be used by an owner. This does not rule out ' +
      'other privileged roles.'
    );
  }

  // Known, accountable issuer. The powers still exist and are still listed;
  // what changes is who holds them, and whether they can be held to account.
  const known =
    lookupKnown(contract.address, chain) ||
    lookupKnown(contract.owner.owner, chain);

  if (known) {
    score -= KNOWN_ISSUER_DISCOUNT;
    scoring.push({
      reason: `Known issuer: ${known.issuer} (matched on ${known.matchedOn})`,
      delta: -KNOWN_ISSUER_DISCOUNT
    });
    notes.push(
      `Identified as ${known.name}, issued by ${known.issuer}. The privileges ` +
      'above are real and unchanged - what differs is that they are held by a ' +
      'named, accountable party rather than an anonymous one.'
    );
    if (known.note) notes.push(known.note);
  }

  if (contract.owner.hasOwner && !contract.owner.renounced && !known) {
    notes.push(`Ownership is active. Owner: ${contract.owner.owner}`);
  }

  if (analysis.privileges.length === 0 && !contract.proxy.isProxy) {
    notes.push('No owner privileges of the kinds this scanner recognises were found.');
  }

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  return {
    contractAddress: contract.address,
    chain: contract.chain,
    analysisMethod: 'bytecode',
    contract: {
      bytecodeSize: contract.bytecodeSize,
      analyzedCodeAt: contract.bytecodeSource,
      isUpgradeableProxy: contract.proxy.isProxy,
      implementation: contract.proxy.implementation,
      hasOwner: contract.owner.hasOwner,
      owner: contract.owner.owner,
      ownershipRenounced: contract.owner.renounced,
      totalSupply: contract.totalSupply
    },
    knownIssuer: known
      ? { name: known.name, issuer: known.issuer, matchedOn: known.matchedOn }
      : null,
    ownerPrivileges: analysis.privileges,
    riskScore: score,
    severity: severityFor(score),
    scoring,
    notes,
    disclaimer:
      'This reports capabilities found in deployed bytecode. It is not a ' +
      'verdict on intent, and cannot see off-chain factors such as who holds ' +
      'the supply or whether liquidity is locked. Do your own research.',
    timestamp: new Date().toISOString()
  };
}

module.exports = { runScan, lookupKnown, KNOWN_ISSUER_DISCOUNT };
