/**
 * Device Model
 * ============
 * MongoDB schema for registered IoT devices with PQC credentials.
 */

import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  // Device identifier
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Device tier (tier1, tier2, tier3)
  tier: {
    type: String,
    enum: ['tier1', 'tier2', 'tier3'],
    required: true,
    index: true,
  },

  // Device status
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'revoked', 'maintenance'],
    default: 'pending',
    index: true,
  },

  // PQC public key (Dilithium) - stored as base64
  publicKey: {
    type: String,
    required: function() { return this.tier !== 'tier1'; },
  },

  // PQC algorithm used for signing
  signatureAlgorithm: {
    type: String,
    enum: ['dilithium2', 'dilithium3', 'dilithium5', 'ml-dsa-44', 'ml-dsa-65', 'ml-dsa-87', 'ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    default: 'dilithium3',
    set: (v) => v ? v.toLowerCase() : v, // Normalize to lowercase
  },

  // KEM public key (Kyber) for Tier 1 devices
  kemPublicKey: {
    type: String,
    required: function() { return this.tier === 'tier1'; },
  },

  // KEM algorithm used
  kemAlgorithm: {
    type: String,
    enum: ['kyber512', 'kyber768', 'kyber1024', 'ml-kem-512', 'ml-kem-768', 'ml-kem-1024'],
    default: 'kyber512',
  },

  // Device capabilities
  capabilities: {
    canSign: { type: Boolean, default: false },
    canVerify: { type: Boolean, default: false },
    supportsKem: { type: Boolean, default: false },
    maxPayloadSize: { type: Number, default: 256 },
    supportedSensors: [{ type: String }],
  },

  // Hardware specifications
  hardware: {
    cpuMhz: { type: Number },
    ramMb: { type: Number },
    flashMb: { type: Number },
    hasSecureElement: { type: Boolean, default: false },
    platform: { type: String },
  },

  // Network information
  network: {
    ipAddress: { type: String },
    macAddress: { type: String },
    gatewayId: { type: String },
    rssi: { type: Number },
    protocol: { type: String, enum: ['mqtt', 'http', 'coap', 'websocket'], default: 'http' },
  },

  // Location
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
    building: { type: String },
    floor: { type: Number },
    room: { type: String },
  },

  // Telemetry statistics
  telemetry: {
    totalMessagesCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date },
    avgMessageIntervalMs: { type: Number },
    lastPayloadHash: { type: String },
  },

  // Revocation info
  revocation: {
    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date },
    revokedReason: { type: String },
    revokedBy: { type: String },
  },

  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // Firmware version
  firmwareVersion: { type: String },

  // Registration timestamps
  registeredAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  
}, {
  timestamps: true,
  collection: 'devices',
});

// Indexes for common queries
deviceSchema.index({ tier: 1, status: 1 });
deviceSchema.index({ 'network.gatewayId': 1 });
deviceSchema.index({ lastSeen: -1 });
deviceSchema.index({ 'location': '2dsphere' });

// Virtual for device age
deviceSchema.virtual('age').get(function() {
  return Date.now() - this.registeredAt.getTime();
});

// Methods
deviceSchema.methods.touch = function() {
  this.lastSeen = new Date();
  return this.save();
};

deviceSchema.methods.incrementMessageCount = function() {
  this.telemetry.totalMessagesCount++;
  this.telemetry.lastMessageAt = new Date();
  return this.save();
};

deviceSchema.methods.revoke = function(reason, revokedBy = 'system') {
  this.status = 'revoked';
  this.revocation = {
    isRevoked: true,
    revokedAt: new Date(),
    revokedReason: reason,
    revokedBy,
  };
  return this.save();
};

// Statics
deviceSchema.statics.findByTier = function(tier) {
  return this.find({ tier, status: 'active' });
};

deviceSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

deviceSchema.statics.findByGateway = function(gatewayId) {
  return this.find({ 'network.gatewayId': gatewayId, status: 'active' });
};

// Pre-save hook
deviceSchema.pre('save', function(next) {
  if (this.isNew) {
    // Set default capabilities based on tier
    if (!this.capabilities.canSign && this.tier !== 'tier1') {
      this.capabilities.canSign = true;
      this.capabilities.canVerify = true;
    }
    if (this.tier === 'tier1') {
      this.capabilities.supportsKem = true;
    }
  }
  next();
});

export const Device = mongoose.model('Device', deviceSchema);

// Legacy class export for backwards compatibility
export class DeviceLegacy {
  constructor(id) {
    this.id = id;
  }
}

export default Device;
