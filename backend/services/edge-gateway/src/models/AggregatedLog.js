/**
 * AggregatedLog Model
 * ===================
 * MongoDB schema for LLAS aggregated log batches.
 */

import mongoose from 'mongoose';

/**
 * Individual log entry within a batch
 */
const logEntrySchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    required: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  signature: {
    type: String, // Base64 encoded signature
  },
  signatureAlgorithm: {
    type: String,
  },
  merkleIndex: {
    type: Number,
  },
  merkleProof: [{
    hash: String,
    position: { type: String, enum: ['left', 'right'] },
  }],
  verified: {
    type: Boolean,
    default: false,
  },
  verifiedAt: {
    type: Date,
  },
}, { _id: false });

/**
 * Aggregated batch schema
 */
const aggregatedLogSchema = new mongoose.Schema({
  // Batch identifier
  batchId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Merkle root hash
  merkleRoot: {
    type: String,
    required: true,
    index: true,
  },

  // Tree depth
  treeDepth: {
    type: Number,
    required: true,
  },

  // Mode (h2a or baseline)
  mode: {
    type: String,
    enum: ['h2a', 'baseline'],
    default: 'h2a',
    index: true,
  },

  // Number of logs in batch
  logCount: {
    type: Number,
    required: true,
  },

  // Device IDs included in batch
  deviceIds: [{
    type: String,
  }],

  // Time range
  timestampStart: {
    type: Date,
    required: true,
  },
  timestampEnd: {
    type: Date,
    required: true,
  },

  // Size metrics
  originalSizeBytes: {
    type: Number,
    required: true,
  },
  aggregatedSizeBytes: {
    type: Number,
    required: true,
  },
  compressionRatio: {
    type: Number,
  },

  // Gateway signature on the batch
  gatewaySignature: {
    type: String, // Base64 encoded
  },
  gatewayId: {
    type: String,
  },

  // Individual log entries
  logs: [logEntrySchema],

  // Complete Merkle tree (for verification)
  merkleTree: {
    type: [[String]], // Array of levels, each level is array of hashes
  },

  // Processing metrics
  processingTimeMs: {
    type: Number,
  },

  // Verification status
  verification: {
    allVerified: { type: Boolean, default: false },
    verifiedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    verificationTimeMs: { type: Number },
    verifiedAt: { type: Date },
  },

  // Forwarding status (to cloud)
  forwarding: {
    forwarded: { type: Boolean, default: false },
    forwardedAt: { type: Date },
    destination: { type: String },
    acknowledgmentReceived: { type: Boolean, default: false },
  },

  // Retention
  expiresAt: {
    type: Date,
    index: { expires: 0 }, // TTL index
  },

  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },

}, {
  timestamps: true,
  collection: 'aggregated_logs',
});

// Indexes
aggregatedLogSchema.index({ createdAt: -1 });
aggregatedLogSchema.index({ deviceIds: 1 });
aggregatedLogSchema.index({ timestampStart: 1, timestampEnd: 1 });
aggregatedLogSchema.index({ 'verification.allVerified': 1 });

// Virtual for bandwidth savings
aggregatedLogSchema.virtual('bandwidthSaved').get(function() {
  return this.originalSizeBytes - this.aggregatedSizeBytes;
});

// Virtual for batch age
aggregatedLogSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Methods
aggregatedLogSchema.methods.markVerified = function(verificationTimeMs) {
  const verifiedLogs = this.logs.filter(l => l.verified);
  this.verification = {
    allVerified: verifiedLogs.length === this.logs.length,
    verifiedCount: verifiedLogs.length,
    failedCount: this.logs.length - verifiedLogs.length,
    verificationTimeMs,
    verifiedAt: new Date(),
  };
  return this.save();
};

aggregatedLogSchema.methods.markForwarded = function(destination) {
  this.forwarding = {
    forwarded: true,
    forwardedAt: new Date(),
    destination,
    acknowledgmentReceived: false,
  };
  return this.save();
};

// Statics
aggregatedLogSchema.statics.findByDevice = function(deviceId) {
  return this.find({ deviceIds: deviceId }).sort({ createdAt: -1 });
};

aggregatedLogSchema.statics.findUnverified = function() {
  return this.find({ 'verification.allVerified': false });
};

aggregatedLogSchema.statics.findUnforwarded = function() {
  return this.find({ 'forwarding.forwarded': false });
};

aggregatedLogSchema.statics.getCompressionStats = async function() {
  const result = await this.aggregate([
    {
      $group: {
        _id: '$mode',
        totalOriginalBytes: { $sum: '$originalSizeBytes' },
        totalAggregatedBytes: { $sum: '$aggregatedSizeBytes' },
        batchCount: { $sum: 1 },
        totalLogs: { $sum: '$logCount' },
        avgCompressionRatio: { $avg: '$compressionRatio' },
      },
    },
  ]);
  return result;
};

aggregatedLogSchema.statics.getRecentBatches = function(limit = 100) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-logs -merkleTree');
};

export const AggregatedLog = mongoose.model('AggregatedLog', aggregatedLogSchema);

// Legacy class export for backwards compatibility
export class AggregatedLogLegacy {
  constructor(entries = []) {
    this.entries = entries;
  }
}

export default AggregatedLog;
