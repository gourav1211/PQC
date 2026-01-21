/**
 * H2A-PQC Edge Gateway API Routes
 * ================================
 * RESTful API endpoints for device registration, telemetry, and metrics.
 */

import { Router } from 'express';
import pino from 'pino';

// Import modules
import { initiateRegistration, completeRegistration, getRegistrarMetrics } from './pki/registrar.js';
import { getDevice, getAllDevices, getTrustStoreMetrics, touchDevice } from './pki/trust-store.js';
import { revokeDevice, isRevoked, getRevocationList, getRevocationMetrics, exportCRL } from './pki/revocation.js';
import { verifySignature, getVerificationMetrics } from './crypto/verifier.js';
import { getKemMetrics, validateSession } from './crypto/kem-auth.js';
import { addLog, flush, getMetrics as getLlasMetrics, getConfig, setConfig } from './modules/aggregation/llas.js';
import { getMetrics as getThroughputMetrics, recordMessageReceived, recordLatency } from './metrics/throughput.metrics.js';
import { getMetrics as getAggregationMetrics, recordBatch } from './metrics/aggregation.metrics.js';
import { getMetrics as getVerifierMetrics } from './metrics/verifier.metrics.js';
import { Device } from './models/Device.js';
import { AggregatedLog } from './models/AggregatedLog.js';
import { Metric } from './models/Metric.js';

const logger = pino({ name: 'api-routes' });
const router = Router();

// ============================================================================
// Health & Status
// ============================================================================

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mode: process.env.H2A_MODE || 'h2a',
    version: process.env.npm_package_version || '1.0.0',
  });
});

router.get('/status', async (req, res) => {
  try {
    const [deviceCount, batchCount] = await Promise.all([
      Device.countDocuments({ status: 'active' }),
      AggregatedLog.countDocuments(),
    ]);

    res.json({
      status: 'operational',
      mode: process.env.H2A_MODE || 'h2a',
      devices: {
        active: deviceCount,
      },
      batches: {
        total: batchCount,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Status check failed: ${error.message}`);
    res.status(500).json({ error: 'Status check failed' });
  }
});

// ============================================================================
// Device Registration
// ============================================================================

router.post('/register/initiate', async (req, res) => {
  try {
    const startTime = performance.now();
    const result = await initiateRegistration(req.body);
    
    recordLatency(performance.now() - startTime, 'registration');
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error(`Registration initiation failed: ${error.message}`);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  }
});

router.post('/register/complete', async (req, res) => {
  try {
    const { registrationId, proof } = req.body;
    const result = await completeRegistration(registrationId, proof);

    if (result.success) {
      // Create device in database
      const device = new Device({
        deviceId: result.device.deviceId,
        tier: result.device.tier,
        status: 'active',
        capabilities: result.device.capabilities,
        registeredAt: result.device.registeredAt,
        publicKey: req.body.publicKey,
        kemPublicKey: req.body.kemPublicKey,
      });
      await device.save();
      
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error(`Registration completion failed: ${error.message}`);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  }
});

// ============================================================================
// Telemetry Ingestion
// ============================================================================

router.post('/telemetry', async (req, res) => {
  try {
    const startTime = performance.now();
    const { deviceId, payload, signature, timestamp } = req.body;

    // Validate device exists
    const device = await Device.findOne({ deviceId, status: 'active' });
    if (!device) {
      return res.status(404).json({ error: 'Device not found or inactive' });
    }

    // Check revocation
    if (isRevoked(deviceId)) {
      return res.status(403).json({ error: 'Device is revoked' });
    }

    // Verify signature if provided
    let verified = false;
    if (signature && device.publicKey) {
      const verifyResult = verifySignature(
        device.publicKey,
        signature,
        JSON.stringify(payload),
        device.signatureAlgorithm || 'dilithium3'
      );
      verified = verifyResult.valid;
      
      if (!verified) {
        logger.warn(`Signature verification failed: ${deviceId}`);
        return res.status(401).json({ error: 'Signature verification failed' });
      }
    }

    // Record metrics
    const messageSize = JSON.stringify(req.body).length;
    recordMessageReceived({ deviceId, tier: device.tier }, messageSize);

    // Add to LLAS aggregation
    addLog({
      deviceId,
      timestamp: timestamp || new Date().toISOString(),
      payload,
      signature,
      tier: device.tier,
      verified,
    });

    // Update device last seen
    await device.incrementMessageCount();
    touchDevice(deviceId);

    const processingTime = performance.now() - startTime;
    recordLatency(processingTime, 'telemetry');

    res.status(202).json({
      accepted: true,
      deviceId,
      processingTimeMs: processingTime.toFixed(2),
      mode: process.env.H2A_MODE || 'h2a',
    });
  } catch (error) {
    logger.error(`Telemetry ingestion failed: ${error.message}`);
    res.status(500).json({ error: 'Telemetry ingestion failed' });
  }
});

router.post('/telemetry/batch', async (req, res) => {
  try {
    const { logs } = req.body;
    
    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ error: 'logs array is required' });
    }

    const results = { accepted: 0, rejected: 0, errors: [] };

    for (const log of logs) {
      try {
        addLog(log);
        results.accepted++;
      } catch (error) {
        results.rejected++;
        results.errors.push({ deviceId: log.deviceId, error: error.message });
      }
    }

    res.status(202).json({
      ...results,
      mode: process.env.H2A_MODE || 'h2a',
    });
  } catch (error) {
    logger.error(`Batch telemetry failed: ${error.message}`);
    res.status(500).json({ error: 'Batch telemetry failed' });
  }
});

// ============================================================================
// Aggregation Control
// ============================================================================

router.post('/aggregation/flush', async (req, res) => {
  try {
    const batch = flush();
    
    if (batch) {
      // Save to database
      const aggregatedLog = new AggregatedLog(batch);
      await aggregatedLog.save();
      
      // Record metrics
      recordBatch(batch);
      
      res.json({ flushed: true, batch });
    } else {
      res.json({ flushed: false, message: 'No pending logs to flush' });
    }
  } catch (error) {
    logger.error(`Flush failed: ${error.message}`);
    res.status(500).json({ error: 'Flush failed' });
  }
});

router.get('/aggregation/config', (req, res) => {
  res.json(getConfig());
});

router.put('/aggregation/config', (req, res) => {
  try {
    setConfig(req.body);
    res.json({ updated: true, config: getConfig() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// Device Management
// ============================================================================

router.get('/devices', async (req, res) => {
  try {
    const { tier, status, limit = 100 } = req.query;
    const query = {};
    if (tier) query.tier = tier;
    if (status) query.status = status;

    const devices = await Device.find(query)
      .limit(parseInt(limit))
      .select('-publicKey -kemPublicKey')
      .sort({ lastSeen: -1 });

    res.json({ devices, count: devices.length });
  } catch (error) {
    logger.error(`Device list failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to list devices' });
  }
});

router.get('/devices/:deviceId', async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get device' });
  }
});

router.post('/devices/:deviceId/revoke', async (req, res) => {
  try {
    const { reason, revokedBy } = req.body;
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await device.revoke(reason || 'administrative', revokedBy || 'api');
    revokeDevice(req.params.deviceId, reason, revokedBy);

    res.json({ revoked: true, deviceId: req.params.deviceId });
  } catch (error) {
    logger.error(`Revocation failed: ${error.message}`);
    res.status(500).json({ error: 'Revocation failed' });
  }
});

// ============================================================================
// Metrics Endpoints
// ============================================================================

router.get('/metrics', (req, res) => {
  res.json({
    throughput: getThroughputMetrics(),
    aggregation: getAggregationMetrics(),
    verification: getVerifierMetrics(),
    llas: getLlasMetrics(),
    kem: getKemMetrics(),
    registrar: getRegistrarMetrics(),
    trustStore: getTrustStoreMetrics(),
    revocation: getRevocationMetrics(),
    mode: process.env.H2A_MODE || 'h2a',
    timestamp: new Date().toISOString(),
  });
});

router.get('/metrics/throughput', (req, res) => {
  res.json(getThroughputMetrics());
});

router.get('/metrics/aggregation', (req, res) => {
  res.json(getAggregationMetrics());
});

router.get('/metrics/verification', (req, res) => {
  res.json(getVerifierMetrics());
});

router.get('/metrics/comparison', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    const comparison = await Metric.getModeComparison(startTime, endTime);
    const compressionStats = await AggregatedLog.getCompressionStats();

    res.json({
      timeRange: { start: startTime, end: endTime },
      metricComparison: comparison,
      compressionStats,
    });
  } catch (error) {
    logger.error(`Comparison metrics failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get comparison metrics' });
  }
});

// ============================================================================
// Aggregated Logs
// ============================================================================

router.get('/batches', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const batches = await AggregatedLog.getRecentBatches(parseInt(limit));
    res.json({ batches, count: batches.length });
  } catch (error) {
    logger.error(`Batch list failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to list batches' });
  }
});

router.get('/batches/:batchId', async (req, res) => {
  try {
    const batch = await AggregatedLog.findOne({ batchId: req.params.batchId });
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get batch' });
  }
});

// ============================================================================
// Revocation
// ============================================================================

router.get('/revocation/list', (req, res) => {
  res.json({ revocations: getRevocationList() });
});

router.get('/revocation/crl', (req, res) => {
  res.json(exportCRL());
});

// ============================================================================
// Mode Control
// ============================================================================

router.get('/mode', (req, res) => {
  res.json({
    mode: process.env.H2A_MODE || 'h2a',
    description: process.env.H2A_MODE === 'baseline' 
      ? 'Baseline mode - no aggregation' 
      : 'H2A mode - LLAS aggregation enabled',
  });
});

router.post('/mode', (req, res) => {
  const { mode } = req.body;
  if (!['h2a', 'baseline'].includes(mode)) {
    return res.status(400).json({ error: 'Mode must be "h2a" or "baseline"' });
  }
  
  process.env.H2A_MODE = mode;
  setConfig({ mode });
  
  logger.info(`Mode changed to: ${mode}`);
  res.json({ mode, updated: true });
});

export default router;
