/**
 * Throughput Metrics Collection
 * =============================
 * Tracks message throughput, latency, and bandwidth usage for H2A-PQC comparison.
 */

import pino from 'pino';

const logger = pino({ name: 'throughput-metrics' });

/**
 * Rolling window for metrics (last N seconds)
 */
const WINDOW_SIZE_MS = 60000; // 1 minute

/**
 * Metrics storage with timestamps
 */
export const throughputMetrics = [];

/**
 * Real-time counters
 */
const counters = {
  messagesReceived: 0,
  messagesSent: 0,
  bytesReceived: 0,
  bytesSent: 0,
  errors: 0,
  startTime: Date.now(),
};

/**
 * Latency measurements
 */
const latencyBuckets = [];
const LATENCY_WINDOW = 1000; // Last 1000 measurements

/**
 * Record an incoming message
 * @param {Object} message - Message data
 * @param {number} sizeBytes - Message size in bytes
 */
export function recordMessageReceived(message, sizeBytes) {
  counters.messagesReceived++;
  counters.bytesReceived += sizeBytes;

  throughputMetrics.push({
    type: 'received',
    timestamp: Date.now(),
    deviceId: message.deviceId,
    sizeBytes,
    tier: message.tier || 'unknown',
  });

  // Trim old entries
  trimMetrics();
  logger.debug(`Message received: size=${sizeBytes}B, total=${counters.messagesReceived}`);
}

/**
 * Record an outgoing message
 * @param {Object} message - Message data
 * @param {number} sizeBytes - Message size in bytes
 */
export function recordMessageSent(message, sizeBytes) {
  counters.messagesSent++;
  counters.bytesSent += sizeBytes;

  throughputMetrics.push({
    type: 'sent',
    timestamp: Date.now(),
    destination: message.destination,
    sizeBytes,
  });

  trimMetrics();
}

/**
 * Record latency measurement
 * @param {number} latencyMs - Latency in milliseconds
 * @param {string} operation - Operation type
 */
export function recordLatency(latencyMs, operation = 'general') {
  latencyBuckets.push({
    timestamp: Date.now(),
    latencyMs,
    operation,
  });

  // Keep only last N measurements
  while (latencyBuckets.length > LATENCY_WINDOW) {
    latencyBuckets.shift();
  }
}

/**
 * Record an error
 * @param {string} errorType - Type of error
 */
export function recordError(errorType) {
  counters.errors++;
  logger.debug(`Error recorded: type=${errorType}`);
}

/**
 * Get current throughput rate (messages per second)
 */
export function getThroughputRate() {
  const now = Date.now();
  const windowStart = now - WINDOW_SIZE_MS;
  
  const recentMessages = throughputMetrics.filter(
    m => m.timestamp >= windowStart && m.type === 'received'
  );

  const rate = recentMessages.length / (WINDOW_SIZE_MS / 1000);
  
  return {
    messagesPerSecond: rate.toFixed(2),
    bytesPerSecond: (recentMessages.reduce((sum, m) => sum + m.sizeBytes, 0) / (WINDOW_SIZE_MS / 1000)).toFixed(2),
    windowSizeMs: WINDOW_SIZE_MS,
    sampleCount: recentMessages.length,
  };
}

/**
 * Get latency statistics
 */
export function getLatencyStats() {
  if (latencyBuckets.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const latencies = latencyBuckets.map(b => b.latencyMs).sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);

  return {
    min: latencies[0],
    max: latencies[latencies.length - 1],
    avg: (sum / latencies.length).toFixed(2),
    p50: latencies[Math.floor(latencies.length * 0.5)],
    p95: latencies[Math.floor(latencies.length * 0.95)],
    p99: latencies[Math.floor(latencies.length * 0.99)],
    sampleCount: latencies.length,
  };
}

/**
 * Get bandwidth usage statistics
 */
export function getBandwidthStats() {
  const uptimeSeconds = (Date.now() - counters.startTime) / 1000;

  return {
    totalBytesReceived: counters.bytesReceived,
    totalBytesSent: counters.bytesSent,
    totalBytes: counters.bytesReceived + counters.bytesSent,
    avgBytesPerSecond: ((counters.bytesReceived + counters.bytesSent) / uptimeSeconds).toFixed(2),
    receivedKB: (counters.bytesReceived / 1024).toFixed(2),
    sentKB: (counters.bytesSent / 1024).toFixed(2),
    uptimeSeconds: uptimeSeconds.toFixed(0),
  };
}

/**
 * Get comprehensive throughput metrics
 */
export function getMetrics() {
  return {
    counters: {
      messagesReceived: counters.messagesReceived,
      messagesSent: counters.messagesSent,
      errors: counters.errors,
    },
    throughput: getThroughputRate(),
    latency: getLatencyStats(),
    bandwidth: getBandwidthStats(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get metrics by device tier
 */
export function getMetricsByTier() {
  const now = Date.now();
  const windowStart = now - WINDOW_SIZE_MS;
  
  const recentMessages = throughputMetrics.filter(
    m => m.timestamp >= windowStart && m.type === 'received'
  );

  const byTier = {
    tier1: { count: 0, bytes: 0 },
    tier2: { count: 0, bytes: 0 },
    tier3: { count: 0, bytes: 0 },
    unknown: { count: 0, bytes: 0 },
  };

  for (const msg of recentMessages) {
    const tier = msg.tier || 'unknown';
    if (byTier[tier]) {
      byTier[tier].count++;
      byTier[tier].bytes += msg.sizeBytes;
    }
  }

  return byTier;
}

/**
 * Trim old metrics from the rolling window
 */
function trimMetrics() {
  const cutoff = Date.now() - WINDOW_SIZE_MS * 2;
  while (throughputMetrics.length > 0 && throughputMetrics[0].timestamp < cutoff) {
    throughputMetrics.shift();
  }
}

/**
 * Reset counters (for testing)
 */
export function resetMetrics() {
  counters.messagesReceived = 0;
  counters.messagesSent = 0;
  counters.bytesReceived = 0;
  counters.bytesSent = 0;
  counters.errors = 0;
  counters.startTime = Date.now();
  throughputMetrics.length = 0;
  latencyBuckets.length = 0;
  logger.info('Throughput metrics reset');
}

export default {
  throughputMetrics,
  recordMessageReceived,
  recordMessageSent,
  recordLatency,
  recordError,
  getThroughputRate,
  getLatencyStats,
  getBandwidthStats,
  getMetrics,
  getMetricsByTier,
  resetMetrics,
};
