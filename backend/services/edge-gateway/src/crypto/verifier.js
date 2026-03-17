/**
 * H2A-PQC Signature Verifier
 * ==========================
 * Post-Quantum signature verification using @noble/post-quantum.
 */

import { ml_dsa44, ml_dsa65, ml_dsa87 } from '@noble/post-quantum/ml-dsa';
import pino from 'pino';

const logger = pino({ name: 'verifier' });

/**
 * Algorithm mapping to noble implementations
 */
const ALGORITHMS = {
  dilithium2: ml_dsa44,
  dilithium3: ml_dsa65,
  dilithium5: ml_dsa87,
  'ml-dsa-44': ml_dsa44,
  'ml-dsa-65': ml_dsa65,
  'ml-dsa-87': ml_dsa87,
};

/**
 * Verification metrics tracking
 */
const metrics = {
  totalVerifications: 0,
  successfulVerifications: 0,
  failedVerifications: 0,
  totalTimeMs: 0,
  minTimeMs: Infinity,
  maxTimeMs: 0,
  byAlgorithm: {},
};

/**
 * Verify a PQC signature
 * @param {Uint8Array|Buffer} publicKey - The signer's public key
 * @param {Uint8Array|Buffer} message - The original message
 * @param {Uint8Array|Buffer} signature - The signature to verify
 * @param {string} algorithm - Algorithm name (e.g., 'dilithium2')
 * @returns {Promise<{valid: boolean, metrics: object}>}
 */
export async function verifySignature(publicKey, message, signature, algorithm = 'dilithium2') {
  const startTime = performance.now();
  const algKey = algorithm.toLowerCase();
  
  // Initialize algorithm metrics if needed
  if (!metrics.byAlgorithm[algKey]) {
    metrics.byAlgorithm[algKey] = {
      count: 0,
      success: 0,
      failed: 0,
      totalTimeMs: 0,
    };
  }
  
  try {
    const impl = ALGORITHMS[algKey];
    if (!impl) {
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
    
    // Ensure inputs are Uint8Array
    const pk = publicKey instanceof Uint8Array ? publicKey : new Uint8Array(publicKey);
    const msg = message instanceof Uint8Array ? message : new Uint8Array(message);
    const sig = signature instanceof Uint8Array ? signature : new Uint8Array(signature);
    
    // Verify signature
    const valid = impl.verify(pk, msg, sig);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Update metrics
    metrics.totalVerifications++;
    metrics.totalTimeMs += duration;
    metrics.minTimeMs = Math.min(metrics.minTimeMs, duration);
    metrics.maxTimeMs = Math.max(metrics.maxTimeMs, duration);
    metrics.byAlgorithm[algKey].count++;
    metrics.byAlgorithm[algKey].totalTimeMs += duration;
    
    if (valid) {
      metrics.successfulVerifications++;
      metrics.byAlgorithm[algKey].success++;
      logger.debug(`Signature verified: algorithm=${algorithm}, time=${duration.toFixed(2)}ms`);
    } else {
      metrics.failedVerifications++;
      metrics.byAlgorithm[algKey].failed++;
      logger.warn(`Signature verification failed: algorithm=${algorithm}`);
    }
    
    return {
      valid,
      metrics: {
        algorithm,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    metrics.totalVerifications++;
    metrics.failedVerifications++;
    metrics.byAlgorithm[algKey].count++;
    metrics.byAlgorithm[algKey].failed++;
    
    logger.error(`Verification error: ${error.message}`);
    
    return {
      valid: false,
      error: error.message,
      metrics: {
        algorithm,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Verify a batch of payloads
 * @param {Array} payloads - Array of {publicKey, message, signature, algorithm}
 * @returns {Promise<{results: Array, summary: object}>}
 */
export async function verifyBatch(payloads) {
  const startTime = performance.now();
  const results = [];
  let successCount = 0;
  let failCount = 0;
  
  for (const payload of payloads) {
    const result = await verifySignature(
      payload.publicKey,
      payload.message,
      payload.signature,
      payload.algorithm || 'dilithium2'
    );
    
    results.push({
      deviceId: payload.deviceId,
      valid: result.valid,
      metrics: result.metrics,
    });
    
    if (result.valid) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  const endTime = performance.now();
  const totalDuration = endTime - startTime;
  
  logger.info(`Batch verification complete: ${successCount}/${payloads.length} valid, time=${totalDuration.toFixed(2)}ms`);
  
  return {
    results,
    summary: {
      total: payloads.length,
      valid: successCount,
      invalid: failCount,
      totalDurationMs: totalDuration,
      avgDurationMs: totalDuration / payloads.length,
    },
  };
}

/**
 * Get verification metrics
 * @returns {object} Current verification statistics
 */
export function getVerificationMetrics() {
  const avgTime = metrics.totalVerifications > 0
    ? metrics.totalTimeMs / metrics.totalVerifications
    : 0;
  
  return {
    totalVerifications: metrics.totalVerifications,
    successfulVerifications: metrics.successfulVerifications,
    failedVerifications: metrics.failedVerifications,
    successRate: metrics.totalVerifications > 0
      ? (metrics.successfulVerifications / metrics.totalVerifications * 100).toFixed(2)
      : 0,
    timing: {
      totalTimeMs: metrics.totalTimeMs,
      avgTimeMs: avgTime.toFixed(3),
      minTimeMs: metrics.minTimeMs === Infinity ? 0 : metrics.minTimeMs.toFixed(3),
      maxTimeMs: metrics.maxTimeMs.toFixed(3),
    },
    byAlgorithm: metrics.byAlgorithm,
  };
}

/**
 * Reset verification metrics
 */
export function resetMetrics() {
  metrics.totalVerifications = 0;
  metrics.successfulVerifications = 0;
  metrics.failedVerifications = 0;
  metrics.totalTimeMs = 0;
  metrics.minTimeMs = Infinity;
  metrics.maxTimeMs = 0;
  metrics.byAlgorithm = {};
  logger.info('Verification metrics reset');
}

/**
 * Check if algorithm is supported
 */
export function isAlgorithmSupported(algorithm) {
  return algorithm.toLowerCase() in ALGORITHMS;
}

/**
 * Get supported algorithms
 */
export function getSupportedAlgorithms() {
  return Object.keys(ALGORITHMS);
}

export default {
  verifySignature,
  verifyBatch,
  getVerificationMetrics,
  resetMetrics,
  isAlgorithmSupported,
  getSupportedAlgorithms,
};
