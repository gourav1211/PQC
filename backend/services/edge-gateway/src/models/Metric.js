/**
 * Metric Model
 * ============
 * MongoDB schema for storing system metrics for H2A-PQC analysis.
 */

import mongoose from 'mongoose';

/**
 * Metric schema for time-series data
 */
const metricSchema = new mongoose.Schema({
  // Metric type
  type: {
    type: String,
    enum: [
      'throughput',
      'latency',
      'bandwidth',
      'aggregation',
      'verification',
      'kem',
      'signature',
      'device',
      'system',
    ],
    required: true,
    index: true,
  },

  // Mode (h2a or baseline)
  mode: {
    type: String,
    enum: ['h2a', 'baseline'],
    required: true,
    index: true,
  },

  // Metric name
  name: {
    type: String,
    required: true,
    index: true,
  },

  // Metric value
  value: {
    type: Number,
    required: true,
  },

  // Unit of measurement
  unit: {
    type: String,
    enum: ['count', 'bytes', 'ms', 'percent', 'ratio', 'per_second'],
    default: 'count',
  },

  // Associated device or batch
  deviceId: {
    type: String,
    index: true,
  },
  batchId: {
    type: String,
  },

  // Algorithm used (if applicable)
  algorithm: {
    type: String,
  },

  // Device tier
  tier: {
    type: String,
    enum: ['tier1', 'tier2', 'tier3', 'gateway'],
  },

  // Tags for filtering
  tags: {
    type: Map,
    of: String,
    default: {},
  },

  // Timestamp for the metric
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },

  // TTL for automatic cleanup
  expiresAt: {
    type: Date,
    index: { expires: 0 },
  },

}, {
  timestamps: false,
  collection: 'metrics',
});

// Compound indexes for common queries
metricSchema.index({ type: 1, mode: 1, timestamp: -1 });
metricSchema.index({ name: 1, timestamp: -1 });
metricSchema.index({ deviceId: 1, type: 1, timestamp: -1 });

// Statics for metric aggregations
metricSchema.statics.getAverageByType = async function(type, mode, startTime, endTime) {
  const result = await this.aggregate([
    {
      $match: {
        type,
        mode,
        timestamp: { $gte: startTime, $lte: endTime },
      },
    },
    {
      $group: {
        _id: '$name',
        avg: { $avg: '$value' },
        min: { $min: '$value' },
        max: { $max: '$value' },
        count: { $sum: 1 },
      },
    },
  ]);
  return result;
};

metricSchema.statics.getTimeSeries = async function(type, name, mode, startTime, endTime, interval = 60000) {
  const result = await this.aggregate([
    {
      $match: {
        type,
        name,
        mode,
        timestamp: { $gte: startTime, $lte: endTime },
      },
    },
    {
      $group: {
        _id: {
          $subtract: [
            { $toLong: '$timestamp' },
            { $mod: [{ $toLong: '$timestamp' }, interval] },
          ],
        },
        avg: { $avg: '$value' },
        min: { $min: '$value' },
        max: { $max: '$value' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return result;
};

metricSchema.statics.getModeComparison = async function(startTime, endTime) {
  const result = await this.aggregate([
    {
      $match: {
        timestamp: { $gte: startTime, $lte: endTime },
      },
    },
    {
      $group: {
        _id: { mode: '$mode', type: '$type', name: '$name' },
        avgValue: { $avg: '$value' },
        totalCount: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: { type: '$_id.type', name: '$_id.name' },
        modes: {
          $push: {
            mode: '$_id.mode',
            avgValue: '$avgValue',
            count: '$totalCount',
          },
        },
      },
    },
  ]);
  return result;
};

metricSchema.statics.getAlgorithmPerformance = async function(startTime, endTime) {
  const result = await this.aggregate([
    {
      $match: {
        algorithm: { $exists: true, $ne: null },
        type: { $in: ['verification', 'kem', 'signature'] },
        timestamp: { $gte: startTime, $lte: endTime },
      },
    },
    {
      $group: {
        _id: { algorithm: '$algorithm', name: '$name' },
        avgValue: { $avg: '$value' },
        minValue: { $min: '$value' },
        maxValue: { $max: '$value' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.algorithm': 1 } },
  ]);
  return result;
};

metricSchema.statics.getTierMetrics = async function(startTime, endTime) {
  const result = await this.aggregate([
    {
      $match: {
        tier: { $exists: true, $ne: null },
        timestamp: { $gte: startTime, $lte: endTime },
      },
    },
    {
      $group: {
        _id: { tier: '$tier', type: '$type' },
        avgValue: { $avg: '$value' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.tier': 1 } },
  ]);
  return result;
};

// Bulk insert helper
metricSchema.statics.recordBulk = async function(metrics) {
  const docs = metrics.map(m => ({
    ...m,
    timestamp: m.timestamp || new Date(),
    expiresAt: m.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
  }));
  return this.insertMany(docs, { ordered: false });
};

// Single metric record helper
metricSchema.statics.record = async function(type, name, value, options = {}) {
  const metric = new this({
    type,
    name,
    value,
    mode: options.mode || process.env.H2A_MODE || 'h2a',
    unit: options.unit || 'count',
    deviceId: options.deviceId,
    batchId: options.batchId,
    algorithm: options.algorithm,
    tier: options.tier,
    tags: options.tags,
    timestamp: options.timestamp || new Date(),
    expiresAt: options.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  return metric.save();
};

export const Metric = mongoose.model('Metric', metricSchema);

export default Metric;
