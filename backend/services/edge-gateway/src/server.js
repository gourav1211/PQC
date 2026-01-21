/**
 * H2A-PQC Edge Gateway Server
 * ===========================
 * Main entry point for the Edge Gateway service.
 */

import { createServer } from 'http';
import pino from 'pino';

import app, { initializeGateway } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initWebSocketServer, shutdown as shutdownWebSocket } from './websocket.js';
import { cleanupExpired as cleanupKemSessions } from './crypto/kem-auth.js';
import { cleanupExpiredRegistrations } from './pki/registrar.js';

const logger = pino({ 
  name: 'edge-gateway-server',
  level: process.env.LOG_LEVEL || 'info',
});

const port = parseInt(process.env.PORT || '4000', 10);
const host = process.env.HOST || '0.0.0.0';

/**
 * Start the server
 */
async function start() {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await connectDatabase();
    logger.info('MongoDB connected');

    // Initialize gateway
    await initializeGateway();

    // Create HTTP server
    const server = createServer(app);

    // Initialize WebSocket server
    initWebSocketServer(server, {
      path: '/ws',
      metricsIntervalMs: parseInt(process.env.WS_METRICS_INTERVAL || '1000', 10),
    });
    logger.info('WebSocket server initialized');

    // Start periodic cleanup tasks
    startCleanupTasks();

    // Start listening
    server.listen(port, host, () => {
      logger.info(`H2A-PQC Edge Gateway listening on http://${host}:${port}`);
      logger.info(`Mode: ${process.env.H2A_MODE || 'h2a'}`);
      logger.info(`WebSocket: ws://${host}:${port}/ws`);
      logger.info(`API: http://${host}:${port}/api/v1`);
    });

    // Graceful shutdown handlers
    setupShutdownHandlers(server);

  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Start periodic cleanup tasks
 */
function startCleanupTasks() {
  // Clean up expired KEM sessions every minute
  setInterval(() => {
    try {
      cleanupKemSessions();
      cleanupExpiredRegistrations();
    } catch (error) {
      logger.error(`Cleanup task failed: ${error.message}`);
    }
  }, 60000);

  logger.info('Cleanup tasks scheduled');
}

/**
 * Set up graceful shutdown handlers
 * @param {object} server - HTTP server instance
 */
function setupShutdownHandlers(server) {
  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Shutdown WebSocket
        shutdownWebSocket();
        logger.info('WebSocket server closed');

        // Disconnect from MongoDB
        await disconnectDatabase();
        logger.info('MongoDB disconnected');

        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error(`Shutdown error: ${error.message}`);
        process.exit(1);
      }
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  });
}

// Start the server
start();
