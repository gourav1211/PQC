/**
 * PL-PKI Trust Store
 * ==================
 * In-memory trust store for device public keys and certificates.
 * In production, this would be backed by HSM or secure key storage.
 */

import pino from 'pino';

const logger = pino({ name: 'pl-pki-trust-store' });

/**
 * Device trust store - maps deviceId to device info
 */
export const trustStore = new Map();

/**
 * Gateway keypairs storage
 */
const gatewayKeys = {
  signingKey: null,
  kemKey: null,
  certificate: null,
};

/**
 * Trust store metrics
 */
const metrics = {
  totalDevices: 0,
  activeDevices: 0,
  tier1Devices: 0,
  tier2Devices: 0,
  tier3Devices: 0,
  lookups: 0,
  hits: 0,
  misses: 0,
};

/**
 * Add a device to the trust store
 * @param {Object} device - Device info with publicKey
 */
export function addDevice(device) {
  if (!device.deviceId) {
    throw new Error('deviceId is required');
  }

  trustStore.set(device.deviceId, {
    ...device,
    addedAt: device.addedAt || new Date(),
    lastUpdated: new Date(),
  });

  metrics.totalDevices = trustStore.size;
  updateTierCounts();

  logger.info(`Device added to trust store: ${device.deviceId}`);
}

/**
 * Get a device from the trust store
 * @param {string} deviceId - Device identifier
 * @returns {Object|null}
 */
export function getDevice(deviceId) {
  metrics.lookups++;
  const device = trustStore.get(deviceId);

  if (device) {
    metrics.hits++;
    logger.debug(`Trust store hit: ${deviceId}`);
    return device;
  }

  metrics.misses++;
  logger.debug(`Trust store miss: ${deviceId}`);
  return null;
}

/**
 * Update device in trust store
 * @param {string} deviceId - Device identifier
 * @param {Object} updates - Fields to update
 */
export function updateDevice(deviceId, updates) {
  const device = trustStore.get(deviceId);
  if (!device) {
    logger.warn(`Device not found for update: ${deviceId}`);
    return false;
  }

  trustStore.set(deviceId, {
    ...device,
    ...updates,
    lastUpdated: new Date(),
  });

  updateTierCounts();
  logger.debug(`Device updated: ${deviceId}`);
  return true;
}

/**
 * Remove a device from the trust store
 * @param {string} deviceId - Device identifier
 */
export function removeDevice(deviceId) {
  const removed = trustStore.delete(deviceId);
  if (removed) {
    metrics.totalDevices = trustStore.size;
    updateTierCounts();
    logger.info(`Device removed from trust store: ${deviceId}`);
  }
  return removed;
}

/**
 * Check if a device exists in the trust store
 * @param {string} deviceId - Device identifier
 */
export function hasDevice(deviceId) {
  return trustStore.has(deviceId);
}

/**
 * Get device's public key
 * @param {string} deviceId - Device identifier
 * @returns {Uint8Array|null}
 */
export function getPublicKey(deviceId) {
  const device = getDevice(deviceId);
  return device?.publicKey || null;
}

/**
 * Get device's KEM public key
 * @param {string} deviceId - Device identifier
 * @returns {Uint8Array|null}
 */
export function getKemPublicKey(deviceId) {
  const device = getDevice(deviceId);
  return device?.kemPublicKey || null;
}

/**
 * Update device's last seen timestamp
 * @param {string} deviceId - Device identifier
 */
export function touchDevice(deviceId) {
  return updateDevice(deviceId, { lastSeen: new Date() });
}

/**
 * Get all devices by tier
 * @param {string} tier - Tier name
 */
export function getDevicesByTier(tier) {
  return Array.from(trustStore.values())
    .filter(d => d.tier === tier);
}

/**
 * Get all active devices
 */
export function getActiveDevices() {
  return Array.from(trustStore.values())
    .filter(d => d.status === 'active');
}

/**
 * Get all devices
 */
export function getAllDevices() {
  return Array.from(trustStore.values());
}

/**
 * Set gateway signing keypair
 * @param {Object} keypair - {publicKey, secretKey}
 */
export function setGatewaySigningKey(keypair) {
  gatewayKeys.signingKey = keypair;
  logger.info('Gateway signing key set');
}

/**
 * Get gateway signing keypair
 */
export function getGatewaySigningKey() {
  return gatewayKeys.signingKey;
}

/**
 * Set gateway KEM keypair
 * @param {Object} keypair - {publicKey, secretKey}
 */
export function setGatewayKemKey(keypair) {
  gatewayKeys.kemKey = keypair;
  logger.info('Gateway KEM key set');
}

/**
 * Get gateway KEM keypair
 */
export function getGatewayKemKey() {
  return gatewayKeys.kemKey;
}

/**
 * Get gateway public keys for device registration
 */
export function getGatewayPublicKeys() {
  return {
    signingPublicKey: gatewayKeys.signingKey?.publicKey || null,
    kemPublicKey: gatewayKeys.kemKey?.publicKey || null,
  };
}

/**
 * Update tier counts in metrics
 */
function updateTierCounts() {
  const devices = Array.from(trustStore.values());
  metrics.tier1Devices = devices.filter(d => d.tier === 'tier1').length;
  metrics.tier2Devices = devices.filter(d => d.tier === 'tier2').length;
  metrics.tier3Devices = devices.filter(d => d.tier === 'tier3').length;
  metrics.activeDevices = devices.filter(d => d.status === 'active').length;
}

/**
 * Get trust store metrics
 */
export function getTrustStoreMetrics() {
  return {
    ...metrics,
    hitRate: metrics.lookups > 0
      ? ((metrics.hits / metrics.lookups) * 100).toFixed(2)
      : 0,
  };
}

/**
 * Clear the trust store (for testing)
 */
export function clearTrustStore() {
  trustStore.clear();
  metrics.totalDevices = 0;
  metrics.tier1Devices = 0;
  metrics.tier2Devices = 0;
  metrics.tier3Devices = 0;
  metrics.activeDevices = 0;
  logger.warn('Trust store cleared');
}

export default {
  trustStore,
  addDevice,
  getDevice,
  updateDevice,
  removeDevice,
  hasDevice,
  getPublicKey,
  getKemPublicKey,
  touchDevice,
  getDevicesByTier,
  getActiveDevices,
  getAllDevices,
  setGatewaySigningKey,
  getGatewaySigningKey,
  setGatewayKemKey,
  getGatewayKemKey,
  getGatewayPublicKeys,
  getTrustStoreMetrics,
  clearTrustStore,
};
