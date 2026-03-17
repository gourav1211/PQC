/**
 * PL-PKI Device Registrar
 * =======================
 * Phased Lifecycle PKI - Handles device registration with tier-based
 * authentication mechanisms.
 */

import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
import { randomBytes } from 'crypto';
import pino from 'pino';
import { trustStore, addDevice, getDevice } from './trust-store.js';
import { Device } from '../models/Device.js';
import { isRevoked } from './revocation.js';
import { encapsulate, createChallenge } from '../crypto/kem-auth.js';
import { verifySignature } from '../crypto/verifier.js';
import { TIER_PROFILES, getTierCapabilities } from '../config/tier-profiles.js';

const logger = pino({ name: 'pl-pki-registrar' });

/**
 * Registration state machine states
 */
const RegistrationState = {
  PENDING: 'pending',
  CHALLENGE_SENT: 'challenge_sent',
  VERIFIED: 'verified',
  REGISTERED: 'registered',
  REJECTED: 'rejected',
};

/**
 * Pending registrations store
 */
const pendingRegistrations = new Map();

/**
 * Registration metrics
 */
const metrics = {
  totalRegistrations: 0,
  successfulRegistrations: 0,
  failedRegistrations: 0,
  tier1Registrations: 0,
  tier2Registrations: 0,
  tier3Registrations: 0,
};

/**
 * Validate device registration request
 * @param {Object} request - Registration request
 * @returns {{valid: boolean, errors: Array<string>}}
 */
function validateRegistrationRequest(request) {
  const errors = [];

  if (!request.deviceId) {
    errors.push('deviceId is required');
  }
  if (!request.tier || !['tier1', 'tier2', 'tier3'].includes(request.tier)) {
    errors.push('tier must be one of: tier1, tier2, tier3');
  }
  if (!request.publicKey && request.tier !== 'tier1') {
    errors.push('publicKey is required for tier2 and tier3 devices');
  }
  if (request.tier === 'tier1' && !request.kemPublicKey) {
    errors.push('kemPublicKey is required for tier1 devices (KEM-Trick auth)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Initiate device registration
 * @param {Object} request - Registration request
 * @returns {Object} Registration response
 */
export async function initiateRegistration(request) {
  const startTime = performance.now();
  metrics.totalRegistrations++;

  logger.info(`Registration initiated: deviceId=${request.deviceId}, tier=${request.tier}`);

  // Validate request
  const validation = validateRegistrationRequest(request);
  if (!validation.valid) {
    metrics.failedRegistrations++;
    logger.warn(`Registration validation failed: ${validation.errors.join(', ')}`);
    return {
      success: false,
      state: RegistrationState.REJECTED,
      errors: validation.errors,
    };
  }

  // Check if already registered in trust store (memory)
  const existingDevice = getDevice(request.deviceId);
  if (existingDevice) {
    logger.warn(`Device already registered in trust store: ${request.deviceId}`);
    // Allow re-registration - device will be updated
  }

  // Also check the database for devices from previous server sessions
  const existingDbDevice = await Device.findOne({ deviceId: request.deviceId });
  if (existingDbDevice) {
    logger.info(`Re-registering existing device from database: ${request.deviceId}`);
    // Allow re-registration - device credentials will be updated
  }

  // Check if revoked
  if (isRevoked(request.deviceId)) {
    metrics.failedRegistrations++;
    logger.warn(`Device is revoked: ${request.deviceId}`);
    return {
      success: false,
      state: RegistrationState.REJECTED,
      error: 'Device has been revoked',
    };
  }

  // Generate registration token
  const registrationId = randomBytes(16).toString('hex');
  const tierProfile = TIER_PROFILES[request.tier.toUpperCase().replace('TIER', 'TIER_')];

  // Handle based on tier
  let challenge = null;
  if (request.tier === 'tier1') {
    // Tier 1: KEM-Trick authentication
    challenge = createChallenge(
      request.deviceId,
      new Uint8Array(request.kemPublicKey),
      tierProfile?.kemAlgorithm || 'kyber512'
    );
  }

  // Store pending registration
  pendingRegistrations.set(registrationId, {
    ...request,
    registrationId,
    state: challenge ? RegistrationState.CHALLENGE_SENT : RegistrationState.PENDING,
    challenge,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 300000), // 5 minutes
  });

  const duration = performance.now() - startTime;
  logger.debug(`Registration initiated: regId=${registrationId}, time=${duration.toFixed(2)}ms`);

  return {
    success: true,
    registrationId,
    state: challenge ? RegistrationState.CHALLENGE_SENT : RegistrationState.PENDING,
    challenge: challenge ? {
      challengeId: challenge.challengeId,
      ciphertext: Array.from(challenge.ciphertext),
      expiresAt: challenge.expiresAt,
    } : null,
    expiresAt: pendingRegistrations.get(registrationId).expiresAt,
  };
}

/**
 * Complete device registration with verification
 * @param {string} registrationId - Registration ID
 * @param {Object} proof - Proof of identity (signature or KEM response)
 * @returns {Object} Registration result
 */
export async function completeRegistration(registrationId, proof) {
  const pending = pendingRegistrations.get(registrationId);

  if (!pending) {
    logger.warn(`Registration not found: ${registrationId}`);
    return { success: false, error: 'Registration not found or expired' };
  }

  // Check expiration
  if (new Date() > pending.expiresAt) {
    pendingRegistrations.delete(registrationId);
    metrics.failedRegistrations++;
    logger.warn(`Registration expired: ${registrationId}`);
    return { success: false, error: 'Registration expired' };
  }

  let verified = false;
  const tierKey = pending.tier.toUpperCase().replace('TIER', 'TIER_');
  const tierProfile = TIER_PROFILES[tierKey];

  try {
    if (pending.tier === 'tier1') {
      // Tier 1: Verify KEM challenge response
      if (!proof.sharedSecret) {
        return { success: false, error: 'sharedSecret required for tier1 verification' };
      }
      // In real implementation, verify the shared secret matches
      verified = true; // Simplified for demo
    } else {
      // Tier 2/3: Verify signature
      if (!proof.signature || !proof.message) {
        return { success: false, error: 'signature and message required for verification' };
      }
      
      // Decode base64 public key and signature
      const publicKeyBytes = Buffer.from(pending.publicKey, 'base64');
      const signatureBytes = Buffer.from(proof.signature, 'base64');
      const messageBytes = Buffer.from(proof.message, 'utf-8');
      
      // Use the algorithm declared by the device during registration, fallback to tier default
      const algorithm = pending.algorithm || tierProfile?.signatureAlgorithm || 'dilithium2';
      
      const result = await verifySignature(
        publicKeyBytes,
        messageBytes,
        signatureBytes,
        algorithm
      );
      verified = result.valid;
    }
  } catch (error) {
    logger.error(`Verification failed: ${error.message}`);
    metrics.failedRegistrations++;
    return { success: false, error: 'Verification failed' };
  }

  if (!verified) {
    metrics.failedRegistrations++;
    pendingRegistrations.delete(registrationId);
    logger.warn(`Registration verification failed: ${registrationId}`);
    return { success: false, error: 'Verification failed' };
  }

  // Create device entry
  const device = {
    deviceId: pending.deviceId,
    tier: pending.tier,
    publicKey: pending.publicKey || null,
    kemPublicKey: pending.kemPublicKey || null,
    algorithm: pending.algorithm || null,
    capabilities: getTierCapabilities(pending.tier),
    registeredAt: new Date(),
    lastSeen: new Date(),
    status: 'active',
    metadata: pending.metadata || {},
  };

  // Add to trust store
  addDevice(device);

  // Clean up
  pendingRegistrations.delete(registrationId);

  // Update metrics
  metrics.successfulRegistrations++;
  if (pending.tier === 'tier1') metrics.tier1Registrations++;
  else if (pending.tier === 'tier2') metrics.tier2Registrations++;
  else metrics.tier3Registrations++;

  logger.info(`Device registered: deviceId=${device.deviceId}, tier=${device.tier}`);

  return {
    success: true,
    state: RegistrationState.REGISTERED,
    device: {
      deviceId: device.deviceId,
      tier: device.tier,
      algorithm: device.algorithm,
      capabilities: device.capabilities,
      registeredAt: device.registeredAt,
    },
  };
}

/**
 * Get registration status
 * @param {string} registrationId - Registration ID
 */
export function getRegistrationStatus(registrationId) {
  const pending = pendingRegistrations.get(registrationId);
  if (!pending) {
    return { found: false };
  }
  return {
    found: true,
    state: pending.state,
    deviceId: pending.deviceId,
    tier: pending.tier,
    expiresAt: pending.expiresAt,
  };
}

/**
 * Get registrar metrics
 */
export function getRegistrarMetrics() {
  return {
    ...metrics,
    pendingRegistrations: pendingRegistrations.size,
    successRate: metrics.totalRegistrations > 0
      ? ((metrics.successfulRegistrations / metrics.totalRegistrations) * 100).toFixed(2)
      : 0,
  };
}

/**
 * Clean up expired registrations
 */
export function cleanupExpiredRegistrations() {
  const now = new Date();
  let cleaned = 0;

  for (const [id, reg] of pendingRegistrations.entries()) {
    if (now > reg.expiresAt) {
      pendingRegistrations.delete(id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug(`Cleaned ${cleaned} expired registrations`);
  }

  return cleaned;
}

/**
 * Legacy function for backwards compatibility
 */
export function registerDevice() {
  return { status: "registered" };
}

export default {
  initiateRegistration,
  completeRegistration,
  getRegistrationStatus,
  getRegistrarMetrics,
  cleanupExpiredRegistrations,
  registerDevice,
  RegistrationState,
};
