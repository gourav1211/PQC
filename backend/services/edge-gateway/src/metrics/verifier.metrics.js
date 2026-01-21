/**
 * Verifier Metrics Collection
 * ===========================
 * Tracks PQC signature and KEM verification performance.
 */

import pino from 'pino';

const logger = pino({ name: 'verifier-metrics' });

/**
 * Historical metrics storage
 */
export const verifierMetrics = [];

/**
 * Algorithm-specific counters
 */
const algorithmStats = {
  dilithium2: { operations: 0, totalTimeMs: 0, successes: 0, failures: 0 },
  dilithium3: { operations: 0, totalTimeMs: 0, successes: 0, failures: 0 },
  dilithium5: { operations: 0, totalTimeMs: 0, successes: 0, failures: 0 },
  kyber512: { operations: 0, totalTimeMs: 0, successes: 0, failures: 0 },
  kyber768: { operations: 0, totalTimeMs: 0, successes: 0, failures: 0 },
  kyber1024: { operations: 0, totalTimeMs: 0, successes: 0, failures: 0 },
};

/**
 * Overall counters
 */
const counters = {
  totalVerifications: 0,
  successfulVerifications: 0,
  failedVerifications: 0,
  totalKemOperations: 0,
  totalSignatureOps: 0,
  startTime: Date.now(),
};

/**
 * Latency buckets for percentile calculations
 */
const latencyBuckets = [];
const LATENCY_WINDOW = 1000;

/**
 * Record a signature verification
 * @param {Object} result - Verification result
 */
export function recordSignatureVerification(result) {
  const timestamp = Date.now();
  counters.totalVerifications++;
  counters.totalSignatureOps++;

  const algKey = normalizeAlgorithm(result.algorithm);
  
  if (algorithmStats[algKey]) {
    algorithmStats[algKey].operations++;
    algorithmStats[algKey].totalTimeMs += result.durationMs || 0;
    
    if (result.valid) {
      algorithmStats[algKey].successes++;
      counters.successfulVerifications++;
    } else {
      algorithmStats[algKey].failures++;
      counters.failedVerifications++;
    }
  }

  // Record latency
  if (result.durationMs) {
    recordLatency(result.durationMs, 'signature');
  }

  // Store metric
  verifierMetrics.push({
    timestamp,
    type: 'signature',
    algorithm: result.algorithm,
    valid: result.valid,
    durationMs: result.durationMs,
    deviceId: result.deviceId,
  });

  trimMetrics();
  logger.debug(`Signature verification recorded: alg=${result.algorithm}, valid=${result.valid}, time=${result.durationMs}ms`);
}

/**
 * Record a KEM operation
 * @param {Object} result - KEM operation result
 */
export function recordKemOperation(result) {
  const timestamp = Date.now();
  counters.totalVerifications++;
  counters.totalKemOperations++;

  const algKey = normalizeAlgorithm(result.algorithm);
  
  if (algorithmStats[algKey]) {
    algorithmStats[algKey].operations++;
    algorithmStats[algKey].totalTimeMs += result.durationMs || 0;
    
    if (result.success !== false) {
      algorithmStats[algKey].successes++;
      counters.successfulVerifications++;
    } else {
      algorithmStats[algKey].failures++;
      counters.failedVerifications++;
    }
  }

  if (result.durationMs) {
    recordLatency(result.durationMs, 'kem');
  }

  verifierMetrics.push({
    timestamp,
    type: 'kem',
    operation: result.operation,
    algorithm: result.algorithm,
    durationMs: result.durationMs,
    deviceId: result.deviceId,
  });

  trimMetrics();
}

/**
 * Record latency
 * @param {number} latencyMs - Latency in milliseconds
 * @param {string} operation - Operation type
 */
function recordLatency(latencyMs, operation) {
  latencyBuckets.push({
    timestamp: Date.now(),
    latencyMs,
    operation,
  });

  while (latencyBuckets.length > LATENCY_WINDOW) {
    latencyBuckets.shift();
  }
}

/**
 * Normalize algorithm name
 * @param {string} algorithm - Algorithm name
 */
function normalizeAlgorithm(algorithm) {
  if (!algorithm) return 'unknown';
  
  const alg = algorithm.toLowerCase()
    .replace('ml-dsa-44', 'dilithium2')
    .replace('ml-dsa-65', 'dilithium3')
    .replace('ml-dsa-87', 'dilithium5')
    .replace('ml-kem-512', 'kyber512')
    .replace('ml-kem-768', 'kyber768')
    .replace('ml-kem-1024', 'kyber1024')
    .replace(/-/g, '');
  
  return alg;
}

/**
 * Get algorithm performance statistics
 */
export function getAlgorithmStats() {
  const stats = {};

  for (const [alg, data] of Object.entries(algorithmStats)) {
    if (data.operations > 0) {
      stats[alg] = {
        operations: data.operations,
        avgTimeMs: (data.totalTimeMs / data.operations).toFixed(3),
        successRate: ((data.successes / data.operations) * 100).toFixed(2),
        successes: data.successes,
        failures: data.failures,
      };
    }
  }

  return stats;
}

/**
 * Get latency percentiles
 */
export function getLatencyPercentiles() {
  if (latencyBuckets.length === 0) {
    return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  }

  const latencies = latencyBuckets.map(b => b.latencyMs).sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);

  return {
    min: latencies[0].toFixed(3),
    max: latencies[latencies.length - 1].toFixed(3),
    avg: (sum / latencies.length).toFixed(3),
    p50: latencies[Math.floor(latencies.length * 0.5)].toFixed(3),
    p95: latencies[Math.floor(latencies.length * 0.95)].toFixed(3),
    p99: latencies[Math.floor(latencies.length * 0.99)].toFixed(3),
    samples: latencies.length,
  };
}

/**
 * Get verification rate
 */
export function getVerificationRate() {
  const uptimeSeconds = (Date.now() - counters.startTime) / 1000;

  return {
    verificationsPerSecond: (counters.totalVerifications / uptimeSeconds).toFixed(2),
    signatureOpsPerSecond: (counters.totalSignatureOps / uptimeSeconds).toFixed(2),
    kemOpsPerSecond: (counters.totalKemOperations / uptimeSeconds).toFixed(2),
  };
}

/**
 * Get comprehensive verifier metrics
 */
export function getMetrics() {
  return {
    counters: {
      totalVerifications: counters.totalVerifications,
      successfulVerifications: counters.successfulVerifications,
      failedVerifications: counters.failedVerifications,
      signatureOperations: counters.totalSignatureOps,
      kemOperations: counters.totalKemOperations,
      successRate: counters.totalVerifications > 0
        ? ((counters.successfulVerifications / counters.totalVerifications) * 100).toFixed(2)
        : 0,
    },
    rate: getVerificationRate(),
    latency: getLatencyPercentiles(),
    byAlgorithm: getAlgorithmStats(),
    uptime: ((Date.now() - counters.startTime) / 1000).toFixed(0),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Trim old metrics
 */
function trimMetrics() {
  const cutoff = Date.now() - 3600000;
  while (verifierMetrics.length > 0 && verifierMetrics[0].timestamp < cutoff) {
    verifierMetrics.shift();
  }
}

/**
 * Reset all verifier metrics
 */
export function resetMetrics() {
  counters.totalVerifications = 0;
  counters.successfulVerifications = 0;
  counters.failedVerifications = 0;
  counters.totalKemOperations = 0;
  counters.totalSignatureOps = 0;
  counters.startTime = Date.now();

  for (const alg of Object.keys(algorithmStats)) {
    algorithmStats[alg] = { operations: 0, totalTimeMs: 0, successes: 0, failures: 0 };
  }

  verifierMetrics.length = 0;
  latencyBuckets.length = 0;

  logger.info('Verifier metrics reset');
}

export default {
  verifierMetrics,
  recordSignatureVerification,
  recordKemOperation,
  getAlgorithmStats,
  getLatencyPercentiles,
  getVerificationRate,
  getMetrics,
  resetMetrics,
};
