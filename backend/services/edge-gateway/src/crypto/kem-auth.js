/**
 * H2A-PQC KEM Authentication
 * ==========================
 * Kyber-based Key Encapsulation Mechanism for Tier 1 device authentication.
 * Implements the "KEM-Trick" where successful decapsulation proves identity.
 */

import { ml_kem512, ml_kem768, ml_kem1024 } from '@noble/post-quantum/ml-kem';
import { randomBytes } from 'crypto';
import pino from 'pino';

const logger = pino({ name: 'kem-auth' });

/**
 * Algorithm mapping to noble implementations
 */
const ALGORITHMS = {
  kyber512: ml_kem512,
  kyber768: ml_kem768,
  kyber1024: ml_kem1024,
  'ml-kem-512': ml_kem512,
  'ml-kem-768': ml_kem768,
  'ml-kem-1024': ml_kem1024,
};

/**
 * Session key storage (in production, use Redis or similar)
 */
const sessionStore = new Map();

/**
 * KEM metrics tracking
 */
const metrics = {
  totalOperations: 0,
  encapsulations: 0,
  decapsulations: 0,
  successfulAuths: 0,
  failedAuths: 0,
  totalTimeMs: 0,
};

/**
 * Generate gateway keypair for KEM operations
 * @param {string} algorithm - KEM algorithm name
 * @returns {{publicKey: Uint8Array, secretKey: Uint8Array}}
 */
export function generateGatewayKeypair(algorithm = 'kyber512') {
  const algKey = algorithm.toLowerCase();
  const impl = ALGORITHMS[algKey];
  
  if (!impl) {
    throw new Error(`Unsupported KEM algorithm: ${algorithm}`);
  }
  
  const keypair = impl.keygen();
  logger.info(`Gateway KEM keypair generated: algorithm=${algorithm}`);
  
  return {
    publicKey: keypair.publicKey,
    secretKey: keypair.secretKey,
  };
}

/**
 * Encapsulate a shared secret using device's public key
 * @param {Uint8Array|Buffer} devicePublicKey - Device's KEM public key
 * @param {string} algorithm - KEM algorithm name
 * @returns {{ciphertext: Uint8Array, sharedSecret: Uint8Array, metrics: object}}
 */
export function encapsulate(devicePublicKey, algorithm = 'kyber512') {
  const startTime = performance.now();
  const algKey = algorithm.toLowerCase();
  
  try {
    const impl = ALGORITHMS[algKey];
    if (!impl) {
      throw new Error(`Unsupported KEM algorithm: ${algorithm}`);
    }
    
    const pk = devicePublicKey instanceof Uint8Array 
      ? devicePublicKey 
      : new Uint8Array(devicePublicKey);
    
    const { ciphertext, sharedSecret } = impl.encapsulate(pk);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    metrics.totalOperations++;
    metrics.encapsulations++;
    metrics.totalTimeMs += duration;
    
    logger.debug(`KEM encapsulation: algorithm=${algorithm}, time=${duration.toFixed(2)}ms`);
    
    return {
      ciphertext,
      sharedSecret,
      metrics: {
        operation: 'encapsulate',
        algorithm,
        durationMs: duration,
      },
    };
  } catch (error) {
    logger.error(`KEM encapsulation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Decapsulate to recover shared secret (gateway-side)
 * @param {Uint8Array|Buffer} ciphertext - Ciphertext from device
 * @param {Uint8Array|Buffer} gatewaySecretKey - Gateway's KEM secret key
 * @param {string} algorithm - KEM algorithm name
 * @returns {{sharedSecret: Uint8Array, metrics: object}}
 */
export function decapsulate(ciphertext, gatewaySecretKey, algorithm = 'kyber512') {
  const startTime = performance.now();
  const algKey = algorithm.toLowerCase();
  
  try {
    const impl = ALGORITHMS[algKey];
    if (!impl) {
      throw new Error(`Unsupported KEM algorithm: ${algorithm}`);
    }
    
    const ct = ciphertext instanceof Uint8Array 
      ? ciphertext 
      : new Uint8Array(ciphertext);
    const sk = gatewaySecretKey instanceof Uint8Array 
      ? gatewaySecretKey 
      : new Uint8Array(gatewaySecretKey);
    
    const sharedSecret = impl.decapsulate(ct, sk);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    metrics.totalOperations++;
    metrics.decapsulations++;
    metrics.totalTimeMs += duration;
    
    logger.debug(`KEM decapsulation: algorithm=${algorithm}, time=${duration.toFixed(2)}ms`);
    
    return {
      sharedSecret,
      metrics: {
        operation: 'decapsulate',
        algorithm,
        durationMs: duration,
      },
    };
  } catch (error) {
    logger.error(`KEM decapsulation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Create a challenge for device authentication
 * @param {string} deviceId - Device identifier
 * @param {Uint8Array|Buffer} devicePublicKey - Device's KEM public key
 * @param {string} algorithm - KEM algorithm name
 * @returns {{challengeId: string, ciphertext: Uint8Array, expiresAt: Date}}
 */
export function createChallenge(deviceId, devicePublicKey, algorithm = 'kyber512') {
  const challengeId = randomBytes(16).toString('hex');
  const { ciphertext, sharedSecret } = encapsulate(devicePublicKey, algorithm);
  
  // Store challenge with expiration
  const expiresAt = new Date(Date.now() + 30000); // 30 seconds
  sessionStore.set(challengeId, {
    deviceId,
    sharedSecret,
    algorithm,
    expiresAt,
    created: new Date(),
  });
  
  logger.debug(`Challenge created: deviceId=${deviceId}, challengeId=${challengeId}`);
  
  return {
    challengeId,
    ciphertext,
    expiresAt,
  };
}

/**
 * Verify challenge response from device
 * @param {string} challengeId - The challenge identifier
 * @param {Uint8Array|Buffer} responseSecret - Device's decapsulated shared secret
 * @returns {{valid: boolean, deviceId: string|null}}
 */
export function verifyChallenge(challengeId, responseSecret) {
  const challenge = sessionStore.get(challengeId);
  
  if (!challenge) {
    logger.warn(`Challenge not found: ${challengeId}`);
    metrics.failedAuths++;
    return { valid: false, deviceId: null, error: 'Challenge not found' };
  }
  
  // Check expiration
  if (new Date() > challenge.expiresAt) {
    sessionStore.delete(challengeId);
    logger.warn(`Challenge expired: ${challengeId}`);
    metrics.failedAuths++;
    return { valid: false, deviceId: null, error: 'Challenge expired' };
  }
  
  // Compare shared secrets
  const response = responseSecret instanceof Uint8Array 
    ? responseSecret 
    : new Uint8Array(responseSecret);
  
  const expected = challenge.sharedSecret;
  
  // Constant-time comparison
  let valid = response.length === expected.length;
  for (let i = 0; i < Math.min(response.length, expected.length); i++) {
    valid = valid && (response[i] === expected[i]);
  }
  
  // Clean up challenge
  sessionStore.delete(challengeId);
  
  if (valid) {
    metrics.successfulAuths++;
    logger.debug(`Challenge verified: deviceId=${challenge.deviceId}`);
  } else {
    metrics.failedAuths++;
    logger.warn(`Challenge verification failed: deviceId=${challenge.deviceId}`);
  }
  
  return {
    valid,
    deviceId: valid ? challenge.deviceId : null,
  };
}

/**
 * Create a session key for authenticated device
 * @param {string} deviceId - Authenticated device ID
 * @returns {{sessionId: string, sessionKey: Uint8Array, expiresAt: Date}}
 */
export function createSession(deviceId) {
  const sessionId = randomBytes(16).toString('hex');
  const sessionKey = randomBytes(32);
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour
  
  sessionStore.set(`session:${sessionId}`, {
    deviceId,
    sessionKey,
    expiresAt,
    created: new Date(),
  });
  
  logger.debug(`Session created: deviceId=${deviceId}, sessionId=${sessionId}`);
  
  return {
    sessionId,
    sessionKey,
    expiresAt,
  };
}

/**
 * Validate an existing session
 * @param {string} sessionId - Session identifier
 * @returns {{valid: boolean, deviceId: string|null}}
 */
export function validateSession(sessionId) {
  const session = sessionStore.get(`session:${sessionId}`);
  
  if (!session) {
    return { valid: false, deviceId: null };
  }
  
  if (new Date() > session.expiresAt) {
    sessionStore.delete(`session:${sessionId}`);
    return { valid: false, deviceId: null };
  }
  
  return { valid: true, deviceId: session.deviceId };
}

/**
 * Get KEM authentication metrics
 */
export function getKemMetrics() {
  return {
    totalOperations: metrics.totalOperations,
    encapsulations: metrics.encapsulations,
    decapsulations: metrics.decapsulations,
    successfulAuths: metrics.successfulAuths,
    failedAuths: metrics.failedAuths,
    authSuccessRate: metrics.totalOperations > 0
      ? ((metrics.successfulAuths / (metrics.successfulAuths + metrics.failedAuths)) * 100).toFixed(2)
      : 0,
    avgTimeMs: metrics.totalOperations > 0
      ? (metrics.totalTimeMs / metrics.totalOperations).toFixed(3)
      : 0,
    activeSessions: Array.from(sessionStore.keys()).filter(k => k.startsWith('session:')).length,
    pendingChallenges: Array.from(sessionStore.keys()).filter(k => !k.startsWith('session:')).length,
  };
}

/**
 * Clean up expired sessions and challenges
 */
export function cleanupExpired() {
  const now = new Date();
  let cleaned = 0;
  
  for (const [key, value] of sessionStore.entries()) {
    if (value.expiresAt && now > value.expiresAt) {
      sessionStore.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`Cleaned up ${cleaned} expired sessions/challenges`);
  }
  
  return cleaned;
}

/**
 * Check if algorithm is supported
 */
export function isAlgorithmSupported(algorithm) {
  return algorithm.toLowerCase() in ALGORITHMS;
}

export default {
  generateGatewayKeypair,
  encapsulate,
  decapsulate,
  createChallenge,
  verifyChallenge,
  createSession,
  validateSession,
  getKemMetrics,
  cleanupExpired,
  isAlgorithmSupported,
};
