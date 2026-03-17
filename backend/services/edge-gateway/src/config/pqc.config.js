/**
 * H2A-PQC Configuration
 * =====================
 * Post-Quantum Cryptography settings for the Edge Gateway.
 */

import dotenv from 'dotenv';
dotenv.config();

/**
 * PQC Algorithm configurations
 */
export const algorithms = {
  signature: {
    dilithium2: {
      name: 'Dilithium2',
      securityLevel: 2,
      publicKeySize: 1312,
      secretKeySize: 2528,
      signatureSize: 2420,
    },
    dilithium3: {
      name: 'Dilithium3',
      securityLevel: 3,
      publicKeySize: 1952,
      secretKeySize: 4000,
      signatureSize: 3293,
    },
    dilithium5: {
      name: 'Dilithium5',
      securityLevel: 5,
      publicKeySize: 2592,
      secretKeySize: 4864,
      signatureSize: 4595,
    },
  },
  kem: {
    kyber512: {
      name: 'Kyber512',
      securityLevel: 1,
      publicKeySize: 800,
      secretKeySize: 1632,
      ciphertextSize: 768,
      sharedSecretSize: 32,
    },
    kyber768: {
      name: 'Kyber768',
      securityLevel: 3,
      publicKeySize: 1184,
      secretKeySize: 2400,
      ciphertextSize: 1088,
      sharedSecretSize: 32,
    },
    kyber1024: {
      name: 'Kyber1024',
      securityLevel: 5,
      publicKeySize: 1568,
      secretKeySize: 3168,
      ciphertextSize: 1568,
      sharedSecretSize: 32,
    },
  },
};

/**
 * Gateway operational mode
 * - 'baseline': No aggregation, each message stored individually
 * - 'h2a': Full H2A-PQC with LLAS aggregation
 */
export const mode = process.env.MODE || 'h2a';

/**
 * LLAS Aggregation settings
 */
export const aggregation = {
  batchSize: parseInt(process.env.AGGREGATION_BATCH_SIZE, 10) || 50,
  timeoutMs: parseInt(process.env.AGGREGATION_TIMEOUT_MS, 10) || 5000,
  enabled: mode === 'h2a',
};

/**
 * Default algorithm preferences
 */
export const defaults = {
  signatureAlgorithm: process.env.DEFAULT_SIGNATURE_ALGORITHM || 'dilithium2',
  kemAlgorithm: process.env.DEFAULT_KEM_ALGORITHM || 'kyber512',
};

/**
 * Get algorithm info by name
 */
export function getAlgorithmInfo(algorithmName) {
  const name = algorithmName.toLowerCase();
  
  if (algorithms.signature[name]) {
    return { type: 'signature', ...algorithms.signature[name] };
  }
  
  if (algorithms.kem[name]) {
    return { type: 'kem', ...algorithms.kem[name] };
  }
  
  return null;
}

/**
 * Check if algorithm is supported
 */
export function isAlgorithmSupported(algorithmName) {
  return getAlgorithmInfo(algorithmName) !== null;
}

export default {
  algorithms,
  mode,
  aggregation,
  defaults,
  getAlgorithmInfo,
  isAlgorithmSupported,
};
