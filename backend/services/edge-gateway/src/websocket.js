/**
 * H2A-PQC WebSocket Server
 * ========================
 * Real-time metrics streaming for dashboard visualization.
 */

import { WebSocketServer } from 'ws';
import pino from 'pino';

// Import metrics
import { getMetrics as getThroughputMetrics } from './metrics/throughput.metrics.js';
import { getMetrics as getAggregationMetrics } from './metrics/aggregation.metrics.js';
import { getMetrics as getVerifierMetrics } from './metrics/verifier.metrics.js';
import { getMetrics as getLlasMetrics } from './modules/aggregation/llas.js';
import { getTrustStoreMetrics } from './pki/trust-store.js';

const logger = pino({ name: 'websocket-server' });

let wss = null;
let metricsInterval = null;
const clients = new Set();

/**
 * Initialize WebSocket server
 * @param {object} server - HTTP server instance
 * @param {object} options - WebSocket options
 */
export function initWebSocketServer(server, options = {}) {
  const {
    path = '/ws',
    metricsIntervalMs = 1000,
  } = options;

  wss = new WebSocketServer({ 
    server,
    path,
  });

  wss.on('connection', (ws, req) => {
    const clientId = `${req.socket.remoteAddress}:${Date.now()}`;
    logger.info(`WebSocket client connected: ${clientId}`);
    
    clients.add(ws);

    // Send initial state
    ws.send(JSON.stringify({
      type: 'connected',
      clientId,
      mode: process.env.H2A_MODE || 'h2a',
      timestamp: new Date().toISOString(),
    }));

    // Handle messages from client
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(ws, message);
      } catch (error) {
        logger.error(`Invalid WebSocket message: ${error.message}`);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info(`WebSocket client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error: ${error.message}`);
      clients.delete(ws);
    });
  });

  // Start metrics broadcast
  startMetricsBroadcast(metricsIntervalMs);

  logger.info(`WebSocket server initialized on path: ${path}`);
  return wss;
}

/**
 * Handle incoming client messages
 * @param {WebSocket} ws - Client WebSocket
 * @param {object} message - Parsed message
 */
function handleClientMessage(ws, message) {
  switch (message.type) {
    case 'subscribe':
      // Subscribe to specific metric types
      ws.subscriptions = message.metrics || ['all'];
      ws.send(JSON.stringify({ 
        type: 'subscribed', 
        metrics: ws.subscriptions,
      }));
      break;

    case 'unsubscribe':
      ws.subscriptions = [];
      ws.send(JSON.stringify({ type: 'unsubscribed' }));
      break;

    case 'get-metrics':
      // Send immediate metrics snapshot
      ws.send(JSON.stringify({
        type: 'metrics',
        data: getAllMetrics(),
        timestamp: new Date().toISOString(),
      }));
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;

    case 'set-mode':
      if (['h2a', 'baseline'].includes(message.mode)) {
        process.env.H2A_MODE = message.mode;
        broadcast({
          type: 'mode-changed',
          mode: message.mode,
          timestamp: new Date().toISOString(),
        });
      }
      break;

    default:
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: `Unknown message type: ${message.type}`,
      }));
  }
}

/**
 * Get all metrics for broadcast
 */
function getAllMetrics() {
  return {
    throughput: getThroughputMetrics(),
    aggregation: getAggregationMetrics(),
    verification: getVerifierMetrics(),
    llas: getLlasMetrics(),
    trustStore: getTrustStoreMetrics(),
    mode: process.env.H2A_MODE || 'h2a',
  };
}

/**
 * Start periodic metrics broadcast
 * @param {number} intervalMs - Broadcast interval
 */
function startMetricsBroadcast(intervalMs) {
  if (metricsInterval) {
    clearInterval(metricsInterval);
  }

  metricsInterval = setInterval(() => {
    if (clients.size === 0) return;

    const metrics = getAllMetrics();
    broadcast({
      type: 'metrics-update',
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  }, intervalMs);
}

/**
 * Broadcast message to all connected clients
 * @param {object} message - Message to broadcast
 */
export function broadcast(message) {
  const data = JSON.stringify(message);
  
  for (const client of clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      // Check subscriptions if set
      if (client.subscriptions && !client.subscriptions.includes('all')) {
        if (message.type === 'metrics-update') {
          // Filter metrics based on subscription
          const filteredData = {};
          for (const key of client.subscriptions) {
            if (message.data[key]) {
              filteredData[key] = message.data[key];
            }
          }
          client.send(JSON.stringify({ ...message, data: filteredData }));
          continue;
        }
      }
      client.send(data);
    }
  }
}

/**
 * Broadcast a batch event
 * @param {object} batch - Aggregated batch
 */
export function broadcastBatch(batch) {
  broadcast({
    type: 'batch-created',
    data: {
      batchId: batch.batchId,
      logCount: batch.logCount,
      compressionRatio: batch.compressionRatio,
      deviceIds: batch.deviceIds,
      merkleRoot: batch.merkleRoot,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast a device event
 * @param {string} event - Event type
 * @param {object} device - Device data
 */
export function broadcastDevice(event, device) {
  broadcast({
    type: `device-${event}`,
    data: {
      deviceId: device.deviceId,
      tier: device.tier,
      status: device.status,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast a telemetry event
 * @param {object} telemetry - Telemetry data
 */
export function broadcastTelemetry(telemetry) {
  broadcast({
    type: 'telemetry-received',
    data: {
      deviceId: telemetry.deviceId,
      tier: telemetry.tier,
      payloadSize: JSON.stringify(telemetry.payload).length,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get connected client count
 */
export function getClientCount() {
  return clients.size;
}

/**
 * Shutdown WebSocket server
 */
export function shutdown() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }

  if (wss) {
    for (const client of clients) {
      client.close(1000, 'Server shutting down');
    }
    clients.clear();
    wss.close();
    wss = null;
  }

  logger.info('WebSocket server shut down');
}

export default {
  initWebSocketServer,
  broadcast,
  broadcastBatch,
  broadcastDevice,
  broadcastTelemetry,
  getClientCount,
  shutdown,
};
