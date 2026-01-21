/**
 * H2A-PQC API Service
 * ===================
 * API client for Edge Gateway communication.
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ============================================================================
// Health & Status
// ============================================================================

export const getHealth = () => api.get('/health');

export const getStatus = () => api.get('/status');

// ============================================================================
// Metrics
// ============================================================================

export const getMetrics = () => api.get('/metrics');

export const getThroughputMetrics = () => api.get('/metrics/throughput');

export const getAggregationMetrics = () => api.get('/metrics/aggregation');

export const getVerificationMetrics = () => api.get('/metrics/verification');

export const getMetricsComparison = (hours = 24) => 
  api.get('/metrics/comparison', { params: { hours } });

// ============================================================================
// Devices
// ============================================================================

export const getDevices = (params = {}) => 
  api.get('/devices', { params });

export const getDevice = (deviceId) => 
  api.get(`/devices/${deviceId}`);

export const revokeDevice = (deviceId, reason) => 
  api.post(`/devices/${deviceId}/revoke`, { reason });

// ============================================================================
// Aggregation / Batches
// ============================================================================

export const getBatches = (limit = 50) => 
  api.get('/batches', { params: { limit } });

export const getBatch = (batchId) => 
  api.get(`/batches/${batchId}`);

export const flushAggregation = () => 
  api.post('/aggregation/flush');

export const getAggregationConfig = () => 
  api.get('/aggregation/config');

export const updateAggregationConfig = (config) => 
  api.put('/aggregation/config', config);

// ============================================================================
// Mode Control
// ============================================================================

export const getMode = () => api.get('/mode');

export const setMode = (mode) => api.post('/mode', { mode });

// ============================================================================
// Revocation
// ============================================================================

export const getRevocationList = () => api.get('/revocation/list');

export const getCRL = () => api.get('/revocation/crl');

export default {
  getHealth,
  getStatus,
  getMetrics,
  getThroughputMetrics,
  getAggregationMetrics,
  getVerificationMetrics,
  getMetricsComparison,
  getDevices,
  getDevice,
  revokeDevice,
  getBatches,
  getBatch,
  flushAggregation,
  getAggregationConfig,
  updateAggregationConfig,
  getMode,
  setMode,
  getRevocationList,
  getCRL,
};
