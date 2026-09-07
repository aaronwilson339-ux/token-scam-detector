/**
 * chain.js — read facts about a deployed contract straight from the chain.
 *
 * Everything here needs only a public RPC endpoint: no API key, no account,
 * no rate-limited explorer. And it works whether or not the project ever
 * published their Solidity.
 */

const RPC_URLS = {
  ethereum: process.env.RPC_ETHEREUM || 'https://eth.llamarpc.com',
  base: process.env.RPC_BASE || 'https://mainnet.base.org',
  bsc: process.env.RPC_BSC || 'https://bsc-dataseed.binance.org',
  polygon: process.env.RPC_POLYGON || 'https://polygon-rpc.com',
  arbitrum: process.env.RPC_ARBITRUM || 'https://arb1.arbitrum.io/rpc'
};

// EIP-1967 storage slots. A proxy keeps the address of its real code here,
// which is how you spot an upgradeable contract without any source.
const SLOT_IMPLEMENTATION =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const SLOT_ADMIN =
  '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
// Older OpenZeppelin proxies used this unstructured slot instead.
const SLOT_LEGACY_IMPL =
  '0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

class ChainError extends Error {}

function rpcUrlFor(chain) {
  const url = RPC_URLS[String(chain || 'ethereum').toLowerCase()];
  if (!url) {
    throw new ChainError(
      `Unsupported chain "${chain}". Supported: ${Object.keys(RPC_URLS).join(', ')}`
    );
  }
  return url;
}

async function rpc(chain, method, params, timeoutMs = 12000) {
  const res = await fetch(rpcUrlFor(chain), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!res.ok) {
    throw new ChainError(`RPC returned HTTP ${res.status} for ${method}`);
  }

  const body = await res.json();
  if (body.error) {
    throw new ChainError(`RPC error on ${method}: ${body.error.message}`);
  }
  return body.result;
}

/** Last 20 bytes of a 32-byte storage word, as an address. */
function slotToAddress(word) {
  if (!word || word === '0x' || /^0x0+$/.test(word)) return null;
  const addr = '0x' + word.slice(-40);
  return addr === ZERO_ADDRESS ? null : addr;
}

/**
 * Is this an upgradeable proxy? If so the owner can swap the code entirely,
 * which makes any analysis of today's bytecode provisional.
 */
async function detectProxy(address, chain) {
  const [impl, legacy, admin] = await Promise.all([
    rpc(chain, 'eth_getStorageAt', [address, SLOT_IMPLEMENTATION, 'latest']).catch(() => null),
    rpc(chain, 'eth_getStorageAt', [address, SLOT_LEGACY_IMPL, 'latest']).catch(() => null),
    rpc(chain, 'eth_getStorageAt', [address, SLOT_ADMIN, 'latest']).catch(() => null)
  ]);

  const implementation = slotToAddress(impl) || slotToAddress(legacy);
  return {
    isProxy: Boolean(implementation),
    implementation,
    proxyAdmin: slotToAddress(admin)
  };
}

/** Call owner() and report whether ownership has actually been renounced. */
async function readOwner(address, chain) {
  try {
    const result = await rpc(chain, 'eth_call', [
      { to: address, data: '0x8da5cb5b' }, // owner()
      'latest'
    ]);
    if (!result || result === '0x') return { hasOwner: false, owner: null, renounced: null };
    const owner = '0x' + result.slice(-40);
    return {
      hasOwner: true,
      owner: owner === ZERO_ADDRESS ? null : owner,
      renounced: owner === ZERO_ADDRESS
    };
  } catch {
    // No owner() function, or it reverted. Not an error - many tokens have none.
    return { hasOwner: false, owner: null, renounced: null };
  }
}

async function readTotalSupply(address, chain) {
  try {
    const result = await rpc(chain, 'eth_call', [
      { to: address, data: '0x18160ddd' }, // totalSupply()
      'latest'
    ]);
    if (!result || result === '0x') return null;
    return BigInt(result).toString();
  } catch {
    return null;
  }
}

/**
 * Fetch everything we need in one go.
 * If the contract is a proxy, we analyze the implementation's bytecode,
 * because the proxy itself contains almost no logic.
 */
async function fetchContract(address, chain = 'ethereum') {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new ChainError('Invalid contract address (expected 0x + 40 hex characters)');
  }

  const bytecode = await rpc(chain, 'eth_getCode', [address, 'latest']);
  if (!bytecode || bytecode === '0x') {
    throw new ChainError(
      'No contract found at that address on this chain. It may be a wallet ' +
        'address, or deployed on a different chain.'
    );
  }

  const [proxy, owner, totalSupply] = await Promise.all([
    detectProxy(address, chain),
    readOwner(address, chain),
    readTotalSupply(address, chain)
  ]);

  let analyzedBytecode = bytecode;
  let analyzedAddress = address;

  if (proxy.isProxy && proxy.implementation) {
    const implCode = await rpc(chain, 'eth_getCode', [proxy.implementation, 'latest'])
      .catch(() => null);
    if (implCode && implCode !== '0x') {
      analyzedBytecode = implCode;
      analyzedAddress = proxy.implementation;
    }
  }

  return {
    address,
    chain,
    bytecode: analyzedBytecode,
    bytecodeSource: analyzedAddress,
    bytecodeSize: (analyzedBytecode.length - 2) / 2,
    proxy,
    owner,
    totalSupply
  };
}

module.exports = { fetchContract, detectProxy, readOwner, rpc, ChainError, RPC_URLS };
