/**
 * Aggregation Metrics Collection
 * ==============================
 * Tracks LLAS aggregation performance for H2A vs Baseline comparison.
 */

import pino from 'pino';

const logger = pino({ name: 'aggregation-metrics' });

/**
 * Historical metrics storage
 */
export const aggregationMetrics = [];

/**
 * Current session counters
 */
const counters = {
  totalLogsProcessed: 0,
  totalBatchesCreated: 0,
  totalMerkleRoots: 0,
  originalBytesTotal: 0,
  aggregatedBytesTotal: 0,
  startTime: Date.now(),
};

/**
 * Mode comparison data
 */
const modeComparison = {
  baseline: {
    logs: 0,
    bytes: 0,
    transmissions: 0,
  },
  h2a: {
    logs: 0,
    bytes: 0,
    transmissions: 0,
    batches: 0,
  },
};

/**
 * Batch size distribution
 */
const batchSizeDistribution = [];

/**
 * Record a batch creation event
 * @param {Object} batch - Batch data from LLAS
 */
export function recordBatch(batch) {
  const timestamp = Date.now();

  counters.totalLogsProcessed += batch.logCount || 0;
  counters.totalBatchesCreated++;
  counters.totalMerkleRoots++;
  counters.originalBytesTotal += batch.originalSizeBytes || 0;
  counters.aggregatedBytesTotal += batch.aggregatedSizeBytes || 0;

  // Update H2A mode stats
  modeComparison.h2a.logs += batch.logCount || 0;
  modeComparison.h2a.bytes += batch.aggregatedSizeBytes || 0;
  modeComparison.h2a.transmissions++;
  modeComparison.h2a.batches++;

  // Record batch size
  batchSizeDistribution.push({
    timestamp,
    batchSize: batch.logCount,
    compressionRatio: parseFloat(batch.compressionRatio) || 1,
  });

  // Keep distribution manageable
  while (batchSizeDistribution.length > 1000) {
    batchSizeDistribution.shift();
  }

  // Store metric snapshot
  aggregationMetrics.push({
    timestamp,
    type: 'batch',
    batchId: batch.batchId,
    logCount: batch.logCount,
    originalSize: batch.originalSizeBytes,
    aggregatedSize: batch.aggregatedSizeBytes,
    compressionRatio: batch.compressionRatio,
    deviceCount: batch.deviceIds?.length || 0,
  });

  // Trim old metrics
  trimMetrics();

  logger.debug(`Batch recorded: id=${batch.batchId}, logs=${batch.logCount}, compression=${batch.compressionRatio}x`);
}

/**
 * Record baseline mode transmission
 * @param {Object} log - Single log entry
 */
export function recordBaselineTransmission(log) {
  const sizeBytes = JSON.stringify(log).length;
  
  modeComparison.baseline.logs++;
  modeComparison.baseline.bytes += sizeBytes;
  modeComparison.baseline.transmissions++;

  aggregationMetrics.push({
    timestamp: Date.now(),
    type: 'baseline',
    deviceId: log.deviceId,
    sizeBytes,
  });

  trimMetrics();
}

/**
 * Get aggregation efficiency metrics
 */
export function getEfficiencyMetrics() {
  const bandwidthSaved = counters.originalBytesTotal - counters.aggregatedBytesTotal;
  const compressionRatio = counters.aggregatedBytesTotal > 0
    ? (counters.originalBytesTotal / counters.aggregatedBytesTotal).toFixed(2)
    : 0;

  return {
    totalLogsProcessed: counters.totalLogsProcessed,
    totalBatchesCreated: counters.totalBatchesCreated,
    avgLogsPerBatch: counters.totalBatchesCreated > 0
      ? (counters.totalLogsProcessed / counters.totalBatchesCreated).toFixed(2)
      : 0,
    originalBytesTotal: counters.originalBytesTotal,
    aggregatedBytesTotal: counters.aggregatedBytesTotal,
    bandwidthSavedBytes: bandwidthSaved,
    bandwidthSavedKB: (bandwidthSaved / 1024).toFixed(2),
    compressionRatio,
    bandwidthReductionPercent: counters.originalBytesTotal > 0
      ? ((bandwidthSaved / counters.originalBytesTotal) * 100).toFixed(2)
      : 0,
  };
}

/**
 * Get mode comparison metrics
 */
export function getModeComparison() {
  const baselineAvgBytes = modeComparison.baseline.transmissions > 0
    ? modeComparison.baseline.bytes / modeComparison.baseline.transmissions
    : 0;
  
  const h2aAvgBytes = modeComparison.h2a.transmissions > 0
    ? modeComparison.h2a.bytes / modeComparison.h2a.transmissions
    : 0;

  return {
    baseline: {
      ...modeComparison.baseline,
      avgBytesPerTransmission: baselineAvgBytes.toFixed(2),
    },
    h2a: {
      ...modeComparison.h2a,
      avgBytesPerTransmission: h2aAvgBytes.toFixed(2),
      avgLogsPerBatch: modeComparison.h2a.batches > 0
        ? (modeComparison.h2a.logs / modeComparison.h2a.batches).toFixed(2)
        : 0,
    },
    comparison: {
      bytesRatio: baselineAvgBytes > 0
        ? (h2aAvgBytes / baselineAvgBytes).toFixed(4)
        : 0,
      transmissionReduction: modeComparison.baseline.transmissions > 0
        ? ((1 - modeComparison.h2a.transmissions / modeComparison.baseline.logs) * 100).toFixed(2)
        : 0,
    },
  };
}

/**
 * Get batch size distribution statistics
 */
export function getBatchDistribution() {
  if (batchSizeDistribution.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0 };
  }

  const sizes = batchSizeDistribution.map(b => b.batchSize).sort((a, b) => a - b);
  const sum = sizes.reduce((a, b) => a + b, 0);

  return {
    min: sizes[0],
    max: sizes[sizes.length - 1],
    avg: (sum / sizes.length).toFixed(2),
    median: sizes[Math.floor(sizes.length / 2)],
    samples: sizes.length,
  };
}

/**
 * Get comprehensive aggregation metrics
 */
export function getMetrics() {
  return {
    efficiency: getEfficiencyMetrics(),
    modeComparison: getModeComparison(),
    batchDistribution: getBatchDistribution(),
    uptime: ((Date.now() - counters.startTime) / 1000).toFixed(0),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Trim old metrics from storage
 */
function trimMetrics() {
  const cutoff = Date.now() - 3600000; // Keep 1 hour
  while (aggregationMetrics.length > 0 && aggregationMetrics[0].timestamp < cutoff) {
    aggregationMetrics.shift();
  }
}

/**
 * Reset all aggregation metrics
 */
export function resetMetrics() {
  counters.totalLogsProcessed = 0;
  counters.totalBatchesCreated = 0;
  counters.totalMerkleRoots = 0;
  counters.originalBytesTotal = 0;
  counters.aggregatedBytesTotal = 0;
  counters.startTime = Date.now();

  modeComparison.baseline = { logs: 0, bytes: 0, transmissions: 0 };
  modeComparison.h2a = { logs: 0, bytes: 0, transmissions: 0, batches: 0 };

  aggregationMetrics.length = 0;
  batchSizeDistribution.length = 0;

  logger.info('Aggregation metrics reset');
}

export default {
  aggregationMetrics,
  recordBatch,
  recordBaselineTransmission,
  getEfficiencyMetrics,
  getModeComparison,
  getBatchDistribution,
  getMetrics,
  resetMetrics,
};
