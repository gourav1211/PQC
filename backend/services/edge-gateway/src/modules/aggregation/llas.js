/**
 * LLAS - Lightweight Large-Scale Aggregation System
 * =================================================
 * Core aggregation module implementing Merkle tree-based log aggregation
 * for bandwidth reduction in H2A-PQC framework.
 */

import { sha256 } from '@noble/hashes/sha256';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
import pino from 'pino';

const logger = pino({ name: 'llas-aggregation' });

/**
 * Configuration for LLAS
 */
const config = {
  batchSize: parseInt(process.env.AGGREGATION_BATCH_SIZE || '50', 10),
  timeoutMs: parseInt(process.env.AGGREGATION_TIMEOUT_MS || '5000', 10),
  maxTreeDepth: 16,
  mode: process.env.H2A_MODE || 'h2a', // 'h2a' or 'baseline'
};

/**
 * Aggregation metrics
 */
const metrics = {
  totalLogs: 0,
  aggregatedBatches: 0,
  merkleRoots: 0,
  bandwidthSaved: 0,
  avgBatchSize: 0,
  totalProcessingTimeMs: 0,
};

/**
 * Pending log buffer for batch aggregation
 */
let pendingLogs = [];
let flushTimer = null;

/**
 * Callback for flushed batches
 */
let onFlushCallback = null;

/**
 * Compute SHA-256 hash of data
 * @param {string|Uint8Array} data - Data to hash
 * @returns {Uint8Array}
 */
function hash(data) {
  if (typeof data === 'string') {
    return sha256(new TextEncoder().encode(data));
  }
  return sha256(data);
}

/**
 * Convert hash to hex string
 * @param {Uint8Array} hashBytes - Hash bytes
 * @returns {string}
 */
function hashToHex(hashBytes) {
  return Array.from(hashBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Combine two hashes for Merkle tree
 * @param {Uint8Array} left - Left child hash
 * @param {Uint8Array} right - Right child hash
 * @returns {Uint8Array}
 */
function combineHashes(left, right) {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return hash(combined);
}

/**
 * Build a Merkle tree from log entries
 * @param {Array<Object>} logs - Array of log entries
 * @returns {{root: string, tree: Array, leaves: Array<string>}}
 */
export function buildMerkleTree(logs) {
  if (logs.length === 0) {
    return { root: null, tree: [], leaves: [] };
  }

  const startTime = performance.now();

  // Create leaf hashes from logs
  const leaves = logs.map(log => {
    const logStr = JSON.stringify({
      deviceId: log.deviceId,
      timestamp: log.timestamp,
      payload: log.payload,
      signature: log.signature ? hashToHex(hash(log.signature)) : null,
    });
    return hash(logStr);
  });

  // Build tree bottom-up
  const tree = [leaves];
  let currentLevel = leaves;

  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        nextLevel.push(combineHashes(currentLevel[i], currentLevel[i + 1]));
      } else {
        // Odd number - promote the last one
        nextLevel.push(currentLevel[i]);
      }
    }
    tree.push(nextLevel);
    currentLevel = nextLevel;
  }

  const root = hashToHex(currentLevel[0]);
  const processingTime = performance.now() - startTime;

  logger.debug(`Merkle tree built: leaves=${logs.length}, depth=${tree.length}, time=${processingTime.toFixed(2)}ms`);

  return {
    root,
    tree: tree.map(level => level.map(hashToHex)),
    leaves: leaves.map(hashToHex),
    depth: tree.length,
    processingTimeMs: processingTime,
  };
}

/**
 * Generate a Merkle proof for a specific log index
 * @param {Array} tree - The Merkle tree
 * @param {number} index - Leaf index
 * @returns {Array<{hash: string, position: 'left'|'right'}>}
 */
export function generateMerkleProof(tree, index) {
  const proof = [];
  let currentIndex = index;

  for (let level = 0; level < tree.length - 1; level++) {
    const levelData = tree[level];
    const isRightNode = currentIndex % 2 === 1;
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

    if (siblingIndex < levelData.length) {
      proof.push({
        hash: levelData[siblingIndex],
        position: isRightNode ? 'left' : 'right',
      });
    }

    currentIndex = Math.floor(currentIndex / 2);
  }

  return proof;
}

/**
 * Verify a Merkle proof
 * @param {string} leafHash - The leaf hash to verify
 * @param {Array} proof - The Merkle proof
 * @param {string} root - Expected Merkle root
 * @returns {boolean}
 */
export function verifyMerkleProof(leafHash, proof, root) {
  let currentHash = hash(
    typeof leafHash === 'string' && leafHash.length === 64
      ? new Uint8Array(leafHash.match(/.{2}/g).map(h => parseInt(h, 16)))
      : leafHash
  );

  for (const { hash: siblingHash, position } of proof) {
    const sibling = new Uint8Array(siblingHash.match(/.{2}/g).map(h => parseInt(h, 16)));
    
    if (position === 'left') {
      currentHash = combineHashes(sibling, currentHash);
    } else {
      currentHash = combineHashes(currentHash, sibling);
    }
  }

  return hashToHex(currentHash) === root;
}

/**
 * Create an aggregated batch from pending logs
 * @param {Array<Object>} logs - Logs to aggregate
 * @param {Uint8Array} gatewaySecretKey - Gateway's signing key (optional)
 * @returns {Object} Aggregated batch
 */
export function createAggregatedBatch(logs, gatewaySecretKey = null) {
  const startTime = performance.now();
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Build Merkle tree
  const merkleResult = buildMerkleTree(logs);

  // Calculate original vs aggregated size
  const originalSize = logs.reduce((sum, log) => sum + JSON.stringify(log).length, 0);
  const aggregatedSize = JSON.stringify({
    batchId,
    merkleRoot: merkleResult.root,
    logCount: logs.length,
    timestamp: new Date().toISOString(),
  }).length;

  const batch = {
    batchId,
    merkleRoot: merkleResult.root,
    treeDepth: merkleResult.depth,
    logCount: logs.length,
    deviceIds: [...new Set(logs.map(l => l.deviceId))],
    timestampStart: logs[0]?.timestamp,
    timestampEnd: logs[logs.length - 1]?.timestamp,
    createdAt: new Date().toISOString(),
    originalSizeBytes: originalSize,
    aggregatedSizeBytes: aggregatedSize,
    compressionRatio: (originalSize / aggregatedSize).toFixed(2),
    // Include tree for verification if needed
    merkleTree: merkleResult.tree,
    // Include logs for persistence
    logs: logs.map((log, idx) => ({
      ...log,
      merkleIndex: idx,
      merkleProof: generateMerkleProof(merkleResult.tree, idx),
    })),
  };

  // Sign the batch with gateway key if provided
  if (gatewaySecretKey) {
    const batchData = new TextEncoder().encode(JSON.stringify({
      batchId: batch.batchId,
      merkleRoot: batch.merkleRoot,
      logCount: batch.logCount,
      createdAt: batch.createdAt,
    }));
    batch.gatewaySignature = Array.from(ml_dsa65.sign(gatewaySecretKey, batchData));
  }

  const processingTime = performance.now() - startTime;

  // Update metrics
  metrics.totalLogs += logs.length;
  metrics.aggregatedBatches++;
  metrics.merkleRoots++;
  metrics.bandwidthSaved += originalSize - aggregatedSize;
  metrics.avgBatchSize = metrics.totalLogs / metrics.aggregatedBatches;
  metrics.totalProcessingTimeMs += processingTime;

  logger.info(`Batch created: id=${batchId}, logs=${logs.length}, compression=${batch.compressionRatio}x, time=${processingTime.toFixed(2)}ms`);

  return batch;
}

/**
 * Add a log to the pending buffer
 * @param {Object} log - Log entry
 */
export function addLog(log) {
  // In baseline mode, don't aggregate
  if (config.mode === 'baseline') {
    logger.debug(`Baseline mode: log passed through without aggregation`);
    if (onFlushCallback) {
      onFlushCallback({ mode: 'baseline', logs: [log] });
    }
    return;
  }

  pendingLogs.push({
    ...log,
    receivedAt: new Date().toISOString(),
  });

  logger.debug(`Log added to buffer: deviceId=${log.deviceId}, pending=${pendingLogs.length}`);

  // Check if batch size reached
  if (pendingLogs.length >= config.batchSize) {
    flush();
  } else if (!flushTimer) {
    // Start timeout timer
    flushTimer = setTimeout(() => flush(), config.timeoutMs);
  }
}

/**
 * Flush pending logs as an aggregated batch
 * @param {Uint8Array} gatewaySecretKey - Optional signing key
 * @returns {Object|null} The created batch or null if empty
 */
export function flush(gatewaySecretKey = null) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (pendingLogs.length === 0) {
    return null;
  }

  const logsToAggregate = [...pendingLogs];
  pendingLogs = [];

  const batch = createAggregatedBatch(logsToAggregate, gatewaySecretKey);

  if (onFlushCallback) {
    onFlushCallback({ mode: 'h2a', batch });
  }

  return batch;
}

/**
 * Set callback for when batches are flushed
 * @param {Function} callback - Callback function
 */
export function onFlush(callback) {
  onFlushCallback = callback;
}

/**
 * Get current LLAS configuration
 */
export function getConfig() {
  return { ...config };
}

/**
 * Update LLAS configuration
 * @param {Object} newConfig - New configuration values
 */
export function setConfig(newConfig) {
  Object.assign(config, newConfig);
  logger.info(`LLAS config updated: ${JSON.stringify(config)}`);
}

/**
 * Get aggregation metrics
 */
export function getMetrics() {
  return {
    ...metrics,
    pendingLogs: pendingLogs.length,
    avgProcessingTimeMs: metrics.aggregatedBatches > 0
      ? (metrics.totalProcessingTimeMs / metrics.aggregatedBatches).toFixed(3)
      : 0,
    bandwidthSavedKB: (metrics.bandwidthSaved / 1024).toFixed(2),
    mode: config.mode,
  };
}

/**
 * Reset metrics
 */
export function resetMetrics() {
  Object.assign(metrics, {
    totalLogs: 0,
    aggregatedBatches: 0,
    merkleRoots: 0,
    bandwidthSaved: 0,
    avgBatchSize: 0,
    totalProcessingTimeMs: 0,
  });
}

/**
 * Legacy function for backwards compatibility
 * @param {Array} logs - Logs to aggregate
 * @returns {Object} Aggregated batch
 */
export function aggregateLogs(logs) {
  if (config.mode === 'baseline') {
    return {
      mode: 'baseline',
      logs,
      aggregated: false,
    };
  }
  return createAggregatedBatch(logs);
}

export default {
  buildMerkleTree,
  generateMerkleProof,
  verifyMerkleProof,
  createAggregatedBatch,
  addLog,
  flush,
  onFlush,
  getConfig,
  setConfig,
  getMetrics,
  resetMetrics,
  aggregateLogs,
};
