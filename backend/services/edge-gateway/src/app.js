/**
 * H2A-PQC Edge Gateway Application
 * =================================
 * Express application setup with middleware and routes.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';

// Import routes
import routes from './routes.js';

// Import modules for initialization
import { onFlush } from './modules/aggregation/llas.js';
import { setGatewaySigningKey, setGatewayKemKey } from './pki/trust-store.js';
import { generateGatewayKeypair } from './crypto/kem-auth.js';
import { recordBatch } from './metrics/aggregation.metrics.js';
import { AggregatedLog } from './models/AggregatedLog.js';

const logger = pino({ 
  name: 'edge-gateway',
  level: process.env.LOG_LEVEL || 'info',
});

const app = express();

// ============================================================================
// Middleware
// ============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'X-Session-Id'],
}));

// Request logging
app.use(pinoHttp({ logger }));

// JSON body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request timing middleware
app.use((req, res, next) => {
  req.startTime = performance.now();
  res.on('finish', () => {
    const duration = performance.now() - req.startTime;
    if (duration > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.path} took ${duration.toFixed(2)}ms`);
    }
  });
  next();
});

// Mode indicator middleware
app.use((req, res, next) => {
  res.setHeader('X-H2A-Mode', process.env.H2A_MODE || 'h2a');
  next();
});

// ============================================================================
// API Routes
// ============================================================================

// Mount API routes
app.use('/api/v1', routes);

// Legacy health endpoint (for backwards compatibility)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
  });
});

// Global error handler
app.use((err, req, res, _next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize gateway crypto keys and handlers
 */
export async function initializeGateway() {
  logger.info('Initializing H2A-PQC Edge Gateway...');
  
  // Generate gateway keypairs
  try {
    // Generate KEM keypair for Tier 1 device authentication
    const kemKeypair = generateGatewayKeypair('kyber768');
    setGatewayKemKey(kemKeypair);
    logger.info('Gateway KEM keypair generated');

    // Note: Signing keypair would need liboqs on Node.js
    // For now, we'll skip this as @noble/post-quantum handles verification
    logger.info('Gateway signing key setup skipped (handled by device signatures)');
  } catch (error) {
    logger.error(`Failed to generate gateway keys: ${error.message}`);
  }

  // Set up LLAS flush handler
  onFlush(async ({ mode, batch, logs }) => {
    if (mode === 'h2a' && batch) {
      try {
        // Save batch to database
        const aggregatedLog = new AggregatedLog(batch);
        await aggregatedLog.save();
        
        // Record metrics
        recordBatch(batch);
        
        logger.debug(`Batch saved: ${batch.batchId}, logs=${batch.logCount}`);
      } catch (error) {
        logger.error(`Failed to save batch: ${error.message}`);
      }
    } else if (mode === 'baseline' && logs) {
      // In baseline mode, log each entry individually
      logger.debug(`Baseline mode: ${logs.length} logs passed through`);
    }
  });

  logger.info(`H2A-PQC Edge Gateway initialized in ${process.env.H2A_MODE || 'h2a'} mode`);
}

export default app;
