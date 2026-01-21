/**
 * PL-PKI Revocation Service
 * =========================
 * Handles device certificate/key revocation for compromised or
 * decommissioned devices.
 */

import pino from 'pino';
import { trustStore, updateDevice, getDevice } from './trust-store.js';

const logger = pino({ name: 'pl-pki-revocation' });

/**
 * Revocation reasons
 */
export const RevocationReason = {
  COMPROMISED: 'compromised',
  DECOMMISSIONED: 'decommissioned',
  SUPERSEDED: 'superseded',
  ADMINISTRATIVE: 'administrative',
  EXPIRED: 'expired',
};

/**
 * Revocation list (in production, use CRL or OCSP)
 */
const revocationList = new Map();

/**
 * Revocation metrics
 */
const metrics = {
  totalRevocations: 0,
  revocationsByReason: {
    compromised: 0,
    decommissioned: 0,
    superseded: 0,
    administrative: 0,
    expired: 0,
  },
  revocationChecks: 0,
};

/**
 * Revoke a device
 * @param {string} deviceId - Device identifier
 * @param {string} reason - Revocation reason
 * @param {string} revokedBy - Who revoked the device
 * @returns {Object} Revocation result
 */
export function revokeDevice(deviceId, reason = RevocationReason.ADMINISTRATIVE, revokedBy = 'system') {
  if (!Object.values(RevocationReason).includes(reason)) {
    return { success: false, error: 'Invalid revocation reason' };
  }

  const device = getDevice(deviceId);

  // Add to revocation list
  revocationList.set(deviceId, {
    deviceId,
    reason,
    revokedBy,
    revokedAt: new Date(),
    previousStatus: device?.status || 'unknown',
    tier: device?.tier || 'unknown',
  });

  // Update device status in trust store if exists
  if (device) {
    updateDevice(deviceId, {
      status: 'revoked',
      revokedAt: new Date(),
      revokedReason: reason,
    });
  }

  // Update metrics
  metrics.totalRevocations++;
  if (metrics.revocationsByReason[reason] !== undefined) {
    metrics.revocationsByReason[reason]++;
  }

  logger.warn(`Device revoked: deviceId=${deviceId}, reason=${reason}, by=${revokedBy}`);

  return {
    success: true,
    status: 'revoked',
    deviceId,
    reason,
    revokedAt: new Date(),
  };
}

/**
 * Check if a device is revoked
 * @param {string} deviceId - Device identifier
 * @returns {boolean}
 */
export function isRevoked(deviceId) {
  metrics.revocationChecks++;
  return revocationList.has(deviceId);
}

/**
 * Get revocation details for a device
 * @param {string} deviceId - Device identifier
 * @returns {Object|null}
 */
export function getRevocationDetails(deviceId) {
  return revocationList.get(deviceId) || null;
}

/**
 * Unrevoke a device (reinstate)
 * @param {string} deviceId - Device identifier
 * @param {string} reinstatedBy - Who reinstated the device
 * @returns {Object}
 */
export function unrevokeDevice(deviceId, reinstatedBy = 'system') {
  const revocation = revocationList.get(deviceId);

  if (!revocation) {
    return { success: false, error: 'Device not found in revocation list' };
  }

  // Remove from revocation list
  revocationList.delete(deviceId);

  // Update device status if exists in trust store
  const device = getDevice(deviceId);
  if (device) {
    updateDevice(deviceId, {
      status: 'active',
      reinstatedAt: new Date(),
      reinstatedBy,
    });
  }

  logger.info(`Device unrevoked: deviceId=${deviceId}, by=${reinstatedBy}`);

  return {
    success: true,
    deviceId,
    previousRevocation: revocation,
    reinstatedAt: new Date(),
    reinstatedBy,
  };
}

/**
 * Get all revoked devices
 * @returns {Array}
 */
export function getRevocationList() {
  return Array.from(revocationList.values());
}

/**
 * Get revoked devices by reason
 * @param {string} reason - Revocation reason
 * @returns {Array}
 */
export function getRevocationsByReason(reason) {
  return Array.from(revocationList.values())
    .filter(r => r.reason === reason);
}

/**
 * Get revocation count
 */
export function getRevocationCount() {
  return revocationList.size;
}

/**
 * Batch revoke multiple devices
 * @param {Array<string>} deviceIds - Device identifiers
 * @param {string} reason - Revocation reason
 * @param {string} revokedBy - Who revoked
 * @returns {Object}
 */
export function batchRevoke(deviceIds, reason = RevocationReason.ADMINISTRATIVE, revokedBy = 'system') {
  const results = {
    success: [],
    failed: [],
    total: deviceIds.length,
  };

  for (const deviceId of deviceIds) {
    const result = revokeDevice(deviceId, reason, revokedBy);
    if (result.success) {
      results.success.push(deviceId);
    } else {
      results.failed.push({ deviceId, error: result.error });
    }
  }

  logger.info(`Batch revocation: success=${results.success.length}, failed=${results.failed.length}`);

  return results;
}

/**
 * Export CRL (Certificate Revocation List) format
 * @returns {Object}
 */
export function exportCRL() {
  const crl = {
    version: 1,
    issuer: 'H2A-PQC Gateway',
    thisUpdate: new Date().toISOString(),
    nextUpdate: new Date(Date.now() + 86400000).toISOString(), // 24 hours
    revokedCertificates: Array.from(revocationList.values()).map(r => ({
      serialNumber: r.deviceId,
      revocationDate: r.revokedAt.toISOString(),
      reason: r.reason,
    })),
  };

  return crl;
}

/**
 * Get revocation metrics
 */
export function getRevocationMetrics() {
  return {
    ...metrics,
    currentRevocations: revocationList.size,
  };
}

/**
 * Clear revocation list (for testing)
 */
export function clearRevocationList() {
  revocationList.clear();
  logger.warn('Revocation list cleared');
}

export default {
  RevocationReason,
  revokeDevice,
  isRevoked,
  getRevocationDetails,
  unrevokeDevice,
  getRevocationList,
  getRevocationsByReason,
  getRevocationCount,
  batchRevoke,
  exportCRL,
  getRevocationMetrics,
  clearRevocationList,
};
