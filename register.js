/**
 * register.js — list this API on 402 Index so agents can discover it.
 *
 * 402 Index is a public x402 registry that, unlike Coinbase's Bazaar, does
 * not require settling through any particular facilitator. One POST, no
 * auth, no fee.
 *
 * Deliberately two-step: running it plain only PRINTS what would be sent.
 * Nothing is submitted until you add --submit. A public listing is hard to
 * unsend, so it should take a decision rather than a typo.
 *
 *   node register.js            show the listing, send nothing
 *   node register.js --submit   actually register
 */

const REGISTRY = 'https://402index.io/api/v1/register';

const LISTING = {
  url: 'https://token-scam-detector-80cff4df0237.herokuapp.com/scan',
  name: 'Token Contract Risk Scanner',
  protocol: 'x402',
  http_method: 'POST',

  description:
    'Reads deployed contract bytecode and reports what the owner is actually ' +
    'able to do: mint new supply, freeze or blacklist wallets, pause all ' +
    'transfers, change fees, or replace the contract code. Works on ' +
    'UNVERIFIED contracts, because it analyzes bytecode rather than published ' +
    'source - which is where most scam tokens live. Detects EIP-1967 ' +
    'upgradeable proxies and calls owner() to check whether ownership is ' +
    'genuinely renounced. Returns capabilities as verifiable facts with an ' +
    'auditable score breakdown, not a scam / not-scam verdict. Supports ' +
    'Ethereum, Base, BSC, Polygon and Arbitrum. Free demo, no key required: ' +
    'GET /demo/scan?address=0x...&chain=base',

  price_usd: 0.01,
  payment_asset: 'USDC',
  payment_network: 'base',
  category: 'security',

  // The endpoint issues its 402 challenge before reading the body, but a
  // probe body is supplied anyway so verification cannot fail on a technicality.
  probe_body: JSON.stringify({
    contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    chain: 'base'
  })
};

const RULE = '='.repeat(70);
const submit = process.argv.includes('--submit');

function show() {
  console.log('');
  console.log(RULE);
  console.log('  LISTING TO BE SUBMITTED TO 402 INDEX');
  console.log(RULE);
  console.log('');
  console.log(`  Registry     ${REGISTRY}`);
  console.log(`  Endpoint     ${LISTING.url}`);
  console.log(`  Name         ${LISTING.name}`);
  console.log(`  Protocol     ${LISTING.protocol}  (${LISTING.http_method})`);
  console.log(`  Price        $${LISTING.price_usd} ${LISTING.payment_asset} on ${LISTING.payment_network}`);
  console.log(`  Category     ${LISTING.category}`);
  console.log('');
  console.log('  Description');
  const words = LISTING.description.split(' ');
  let line = '   ';
  for (const w of words) {
    if ((line + ' ' + w).length > 66) { console.log(line); line = '   '; }
    line += ' ' + w;
  }
  if (line.trim()) console.log(line);
  console.log('');
  console.log(RULE);
  console.log('');
  console.log('  NOT submitted. No contact email or personal details are included.');
  console.log('  To actually register, run:   node register.js --submit');
  console.log('');
}

async function register() {
  console.log('');
  console.log('  Submitting to 402 Index...');
  console.log('');

  const res = await fetch(REGISTRY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LISTING),
    signal: AbortSignal.timeout(30000)
  });

  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }

  if (res.status === 201) {
    console.log('  REGISTERED. The listing is pending review.');
    console.log('');
    console.log('  Check for it at https://402index.io  (search "token risk" or');
    console.log('  your endpoint URL). Indexing is not always instant.');
  } else if (res.status === 422) {
    console.log('  VERIFICATION FAILED (422). 402 Index probed the endpoint and');
    console.log('  did not get a valid x402 challenge back. Details:');
    console.log('');
    console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  } else if (res.status === 429) {
    console.log('  RATE LIMITED (429). 10 registrations per hour per IP. Try later.');
  } else {
    console.log(`  Unexpected response: HTTP ${res.status}`);
    console.log(typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body, null, 2));
  }
  console.log('');
}

if (!submit) {
  show();
} else {
  register().catch(err => {
    console.error('');
    console.error(`  Could not reach the registry: ${err.message}`);
    console.error('');
    process.exit(1);
  });
}
