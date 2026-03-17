/**
 * H2A-PQC Tier Profiles
 * =====================
 * Device capability tier definitions for the hierarchical security model.
 */

/**
 * Tier 1: Constrained IoT Devices
 * - Ultra-low power devices (ESP32, STM32, 8-bit MCUs)
 * - Use KEM-based authentication (Kyber) instead of signatures
 * - The "KEM-Trick": successful decapsulation proves identity
 */
export const TIER_1 = {
  id: 1,
  name: 'Constrained',
  description: 'Ultra-low power devices using KEM-based authentication',
  authMethod: 'kem',
  algorithms: ['kyber512', 'kyber768'],
  kemAlgorithm: 'kyber512',
  signatureAlgorithm: null,
  expectedLatencyMs: {
    min: 50,
    max: 200,
    target: 100,
  },
  resourceLimits: {
    cpuLimit: 0.1,
    memoryMb: 64,
  },
  capabilities: {
    canSign: false,
    canVerify: false,
    canEncapsulate: true,
    canDecapsulate: true,
  },
};

/**
 * Tier 2: Capable IoT Devices
 * - Moderate capability devices (Raspberry Pi, ARM Cortex-M4+)
 * - Full PQC signature generation (Dilithium)
 * - Can perform cryptographic operations locally
 */
export const TIER_2 = {
  id: 2,
  name: 'Capable',
  description: 'Moderate capability devices with full signature support',
  authMethod: 'signature',
  algorithms: ['dilithium2', 'dilithium3'],
  signatureAlgorithm: 'dilithium2',
  kemAlgorithm: null,
  expectedLatencyMs: {
    min: 20,
    max: 100,
    target: 50,
  },
  resourceLimits: {
    cpuLimit: 0.3,
    memoryMb: 128,
  },
  capabilities: {
    canSign: true,
    canVerify: false, // Verification done at gateway
    canEncapsulate: true,
    canDecapsulate: true,
  },
};

/**
 * Tier 3: Gateway/Edge
 * - Full computational capability
 * - Performs verification and aggregation
 * - Acts as trust anchor for Tier 1 & 2 devices
 */
export const TIER_3 = {
  id: 3,
  name: 'Gateway',
  description: 'Edge gateway with full cryptographic capabilities',
  authMethod: 'both',
  algorithms: ['dilithium2', 'dilithium3', 'dilithium5', 'kyber512', 'kyber768', 'kyber1024'],
  signatureAlgorithm: 'dilithium3',
  kemAlgorithm: 'kyber768',
  expectedLatencyMs: {
    min: 1,
    max: 20,
    target: 5,
  },
  resourceLimits: {
    cpuLimit: 1.0,
    memoryMb: 512,
  },
  capabilities: {
    canSign: true,
    canVerify: true,
    canEncapsulate: true,
    canDecapsulate: true,
    canAggregate: true,
  },
};

/**
 * All tier profiles indexed by tier ID
 */
export const tierProfiles = {
  1: TIER_1,
  2: TIER_2,
  3: TIER_3,
  tier1: TIER_1,
  tier2: TIER_2,
  tier3: TIER_3,
};

/**
 * Tier profiles indexed by uppercase key (TIER_1, TIER_2, TIER_3)
 */
export const TIER_PROFILES = {
  TIER_1: TIER_1,
  TIER_2: TIER_2,
  TIER_3: TIER_3,
};

/**
 * Get capabilities for a specific tier
 * @param {string|number} tier - Tier identifier (e.g., 'tier1', 1, 'TIER_1')
 * @returns {object|null} Capabilities object or null if tier not found
 */
export function getTierCapabilities(tier) {
  const profile = getTierProfile(tier);
  return profile ? profile.capabilities : null;
}

/**
 * Get tier profile by ID or name
 */
export function getTierProfile(tierIdOrName) {
  if (typeof tierIdOrName === 'number') {
    return tierProfiles[tierIdOrName] || null;
  }
  
  const key = String(tierIdOrName).toLowerCase();
  return tierProfiles[key] || null;
}

/**
 * Validate if a device's auth method matches its tier
 */
export function validateAuthMethod(tier, authMethod) {
  const profile = getTierProfile(tier);
  if (!profile) return false;
  
  if (profile.authMethod === 'both') return true;
  return profile.authMethod === authMethod;
}

/**
 * Get expected latency range for a tier
 */
export function getExpectedLatency(tier) {
  const profile = getTierProfile(tier);
  return profile ? profile.expectedLatencyMs : null;
}

export default {
  TIER_1,
  TIER_2,
  TIER_3,
  tierProfiles,
  TIER_PROFILES,
  getTierProfile,
  getTierCapabilities,
  validateAuthMethod,
  getExpectedLatency,
};
