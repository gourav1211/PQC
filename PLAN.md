# H2A-PQC Framework Implementation Plan
## Comprehensive Step-by-Step Development Guide

**Project:** Post-Quantum Cryptography Integration in IoT Devices  
**Framework:** Hybrid, Hierarchical, and Aggregated PQC (H2A-PQC)  
**Last Updated:** January 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [Current State Analysis](#3-current-state-analysis)
4. [Implementation Phases](#4-implementation-phases)
   - [Phase 1: Foundation & Infrastructure](#phase-1-foundation--infrastructure)
   - [Phase 2: Device Simulator (Tier 1 & 2)](#phase-2-device-simulator-tier-1--2)
   - [Phase 3: Edge Gateway (Tier 2)](#phase-3-edge-gateway-tier-2)
   - [Phase 4: Cloud & Database Layer](#phase-4-cloud--database-layer)
   - [Phase 5: Frontend Dashboard](#phase-5-frontend-dashboard)
   - [Phase 6: Benchmarking & Experimentation](#phase-6-benchmarking--experimentation)
5. [Metrics Collection Strategy](#5-metrics-collection-strategy)
6. [Testing Strategy](#6-testing-strategy)
7. [File Structure Changes](#7-file-structure-changes)
8. [Dependency Requirements](#8-dependency-requirements)

---

## 1. Project Overview

### 1.1 Objective

Build a working virtual testbed that demonstrates the **H2A-PQC Framework's effectiveness** by:

1. **Measuring cryptographic latency** on resource-constrained vs capable devices
2. **Demonstrating the "Signature Storm" problem** and its mitigation via LLAS
3. **Comparing baseline (no aggregation) vs H2A (with aggregation)** performance
4. **Visualizing real-time metrics** on a dashboard

### 1.2 Key Metrics to Showcase

| Metric | Baseline | H2A Expected | Measurement Method |
|--------|----------|--------------|-------------------|
| Cryptographic Latency (Tier 1) | High (>50ms) | Reduced via KEM-Trick | `time.process_time()` |
| Bandwidth to Cloud | 100% | <10% | Byte-size comparison |
| DB Writes | N writes | 1 write per batch | Count comparison |
| Simulated Energy | High | ~40-60% reduction | CPU-time proxy |

---

## 2. Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           H2A-PQC VIRTUAL TESTBED                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TIER 1 & 2: DEVICE SIMULATORS (Docker + Python + liboqs)            │   │
│  │                                                                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │   │
│  │  │ Device-001   │ │ Device-002   │ │ Device-00N   │                 │   │
│  │  │ (Tier 1)     │ │ (Tier 2)     │ │ ...          │                 │   │
│  │  │ KEM-Only     │ │ Full Signing │ │              │                 │   │
│  │  │ CPU: 0.1     │ │ CPU: 0.3     │ │              │                 │   │
│  │  │ MEM: 64MB    │ │ MEM: 128MB   │ │              │                 │   │
│  │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘                 │   │
│  │         │                │                │                          │   │
│  └─────────┼────────────────┼────────────────┼──────────────────────────┘   │
│            │                │                │                              │
│            │   HTTP/MQTT    │                │                              │
│            ▼                ▼                ▼                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TIER 2: EDGE GATEWAY (Node.js)                                       │   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │ PQC Verify  │  │ LLAS Agg.   │  │ PL-PKI      │  │ Metrics    │  │   │
│  │  │ (Dilithium) │  │ (Merkle)    │  │ Registrar   │  │ Collector  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  │                                                                      │   │
│  └───────────────────────────────┬──────────────────────────────────────┘   │
│                                  │                                          │
│                                  │ Aggregated Proof (1 per batch)           │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TIER 3: CLOUD & VISUALIZATION                                        │   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │   │
│  │  │ MongoDB     │  │ Express API │  │ React Dashboard              │  │   │
│  │  │             │  │             │  │ - Live Traffic Monitor       │  │   │
│  │  │             │  │             │  │ - Latency Charts             │  │   │
│  │  │             │◄─┤             │◄─┤ - Bandwidth Comparison       │  │   │
│  │  │             │  │             │  │ - Energy Estimation          │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Current State Analysis

### 3.1 Existing Structure ✓

| Component | Status | Notes |
|-----------|--------|-------|
| Project Layout | ✅ Good | Proper separation of concerns |
| Device Simulator Structure | ✅ Exists | Placeholder files need implementation |
| Edge Gateway Structure | ✅ Exists | Skeleton with config/modules |
| Frontend Dashboard | ✅ Exists | Basic React setup |
| Docker Infrastructure | ✅ Complete | docker-compose.yml configured |

### 3.2 Required Changes

| Change | Priority | Description |
|--------|----------|-------------|
| Add `liboqs-python` to requirements | ✅ Done | Core PQC library |
| Add `@noble/post-quantum` to gateway | ✅ Done | JS PQC library |
| Implement docker-compose.yml | ✅ Done | Multi-container orchestration |
| Add MongoDB service | ✅ Done | Data persistence |
| Add WebSocket support | 🟡 Medium | Real-time dashboard updates |
| Add network simulation tools | 🟡 Medium | Latency/jitter injection |

---

## 4. Implementation Phases

---

### Phase 1: Foundation & Infrastructure ✅ COMPLETED
**Duration:** 1-2 days  
**Priority:** 🔴 Critical  
**Status:** ✅ Complete

#### 1.1 Docker Infrastructure Setup

**File:** `infra/docker-compose.yml` ✅

```yaml
# Services configured:
# - device-tier1-1, device-tier1-2, device-tier1-3 (CPU: 0.1, MEM: 64MB)
# - device-tier2-1, device-tier2-2, device-tier2-3 (CPU: 0.3, MEM: 128MB)
# - edge-gateway (CPU: 1.0, MEM: 512MB)
# - mongodb (with health checks)
# - mongo-express (for debugging)
```

**Tasks:**
- [x] 1.1.1 Define base Docker network `h2a-pqc-net`
- [x] 1.1.2 Configure MongoDB service with volume persistence
- [x] 1.1.3 Configure device simulator containers with resource limits
- [x] 1.1.4 Configure edge gateway container
- [x] 1.1.5 Add environment variable files in `infra/env/`

#### 1.2 Device Simulator Dockerfile ✅

**File:** `backend/services/device-simulator/Dockerfile`

**Tasks:**
- [x] 1.2.1 Use `python:3.11-slim` base image
- [x] 1.2.2 Install `liboqs` system dependencies
- [x] 1.2.3 Install `liboqs-python` via pip
- [x] 1.2.4 Set up proper entrypoint

#### 1.3 Edge Gateway Dockerfile ✅

**File:** `backend/services/edge-gateway/Dockerfile`

**Tasks:**
- [x] 1.3.1 Use `node:20-alpine` base image
- [x] 1.3.2 Install dependencies
- [x] 1.3.3 Configure proper production build

#### 1.4 Environment Configuration ✅

**Files created:**
- `infra/env/.env.dev` ✅
- `infra/env/.env.gateway` ✅
- `infra/env/.env.device` ✅

---

### Phase 2: Device Simulator (Tier 1 & 2) ✅ COMPLETED
**Duration:** 3-4 days  
**Priority:** 🔴 Critical  
**Status:** ✅ Complete

#### 2.1 Core Configuration ✅

**File:** `backend/services/device-simulator/src/config.py`

**Tasks:**
- [x] 2.1.1 Define device configuration schema with Pydantic
  - DeviceConfig class with all parameters
  - DeviceTier enum (TIER_1_CONSTRAINED, TIER_2_CAPABLE)
  - PQCAlgorithm enum (Dilithium2/3/5, Kyber512/768/1024)
  - Environment variable loading
  - Helper methods for tier-based algorithm selection

#### 2.2 PQC Crypto Engine ✅

**File:** `backend/services/device-simulator/src/crypto/pqc_engine.py`

**Tasks:**
- [x] 2.2.1 Implement `PQCEngine` class with liboqs
- [x] 2.2.2 Implement key generation (Dilithium-2/3/5, Kyber-512/768/1024)
- [x] 2.2.3 Implement signing function with timing metrics
- [x] 2.2.4 Implement KEM encapsulation (for Tier 1 KEM-Trick)
- [x] 2.2.5 Add metric collection hooks via CryptoMetrics dataclass

#### 2.3 Sensor Telemetry Mock ✅

**File:** `backend/services/device-simulator/src/telemetry/sensor_mock.py`

**Tasks:**
- [x] 2.3.1 Implement realistic sensor data generation
- [x] 2.3.2 Add temperature, humidity, pressure, motion, light, CO2, voltage sensors
- [x] 2.3.3 Add anomaly injection for testing
- [x] 2.3.4 Add timestamp and sequence numbers
- [x] 2.3.5 Add TelemetryPayload class for complete payloads

#### 2.4 Main Device Logic ✅

**File:** `backend/services/device-simulator/src/device.py`

**Tasks:**
- [x] 2.4.1 Implement device initialization and registration
- [x] 2.4.2 Implement main telemetry loop (async)
- [x] 2.4.3 Implement payload signing (Tier 2) or KEM auth (Tier 1)
- [x] 2.4.4 Implement HTTP client for gateway communication (aiohttp)
- [x] 2.4.5 Implement metrics collection and reporting
- [x] 2.4.6 Add graceful shutdown handling (signal handlers)

#### 2.5 Device Metrics Collection ✅

**File:** `backend/services/device-simulator/src/metrics/collector.py`

**Tasks:**
- [x] 2.5.1 Create metrics data structures (DeviceMetrics, AggregatedMetrics)
- [x] 2.5.2 Implement timing collection with rolling window
- [x] 2.5.3 Implement CPU-time based energy estimation
- [x] 2.5.4 Implement metrics serialization for transmission
- [x] 2.5.5 Add session summary and statistics

#### 2.6 Requirements & Module Structure ✅

**Files created/updated:**
- `backend/services/device-simulator/requirements.txt` ✅
- `backend/services/device-simulator/src/__init__.py` ✅
- `backend/services/device-simulator/src/crypto/__init__.py` ✅
- `backend/services/device-simulator/src/telemetry/__init__.py` ✅
- `backend/services/device-simulator/src/metrics/__init__.py` ✅

---

### Phase 3: Edge Gateway (Tier 2)
**Duration:** 4-5 days  
**Priority:** 🔴 Critical

#### 3.1 Package Dependencies

**File:** `backend/services/edge-gateway/package.json`

**Tasks:**
- [ ] 3.1.1 Add required dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.0",
    "@noble/post-quantum": "^0.2.0",
    "@noble/hashes": "^1.3.0",
    "ws": "^8.16.0",
    "dotenv": "^16.3.0",
    "pino": "^8.17.0",
    "pino-pretty": "^10.3.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

#### 3.2 PQC Configuration

**File:** `backend/services/edge-gateway/src/config/pqc.config.js`

**Tasks:**
- [ ] 3.2.1 Define supported PQC algorithms
- [ ] 3.2.2 Configure algorithm parameters
- [ ] 3.2.3 Add mode switching (baseline vs H2A)

```javascript
export default {
  algorithms: {
    signature: {
      dilithium2: { ... },
      dilithium3: { ... }
    },
    kem: {
      kyber512: { ... },
      kyber768: { ... }
    }
  },
  mode: process.env.MODE || 'h2a', // 'baseline' | 'h2a'
  aggregation: {
    batchSize: 50,
    timeoutMs: 5000
  }
};
```

#### 3.3 Tier Profiles Configuration

**File:** `backend/services/edge-gateway/src/config/tier-profiles.js`

**Tasks:**
- [ ] 3.3.1 Define Tier 1 constraints (KEM-only)
- [ ] 3.3.2 Define Tier 2 constraints (full signing)
- [ ] 3.3.3 Add authentication requirements per tier

```javascript
export const tierProfiles = {
  tier1: {
    name: 'Constrained',
    authMethod: 'kem',
    expectedLatencyMs: 100,
    cpuLimit: 0.1,
    memoryMb: 64
  },
  tier2: {
    name: 'Capable',
    authMethod: 'signature',
    expectedLatencyMs: 50,
    cpuLimit: 0.3,
    memoryMb: 128
  }
};
```

#### 3.4 PQC Signature Verifier

**File:** `backend/services/edge-gateway/src/crypto/verifier.js`

**Tasks:**
- [ ] 3.4.1 Implement Dilithium signature verification using `@noble/post-quantum`
- [ ] 3.4.2 Add verification timing metrics
- [ ] 3.4.3 Implement batch verification support
- [ ] 3.4.4 Add error handling for invalid signatures

```javascript
// Function signatures:
export async function verifySignature(publicKey, message, signature) {}
export async function verifyBatch(payloads) {}
export function getVerificationMetrics() {}
```

#### 3.5 KEM Verifier (for Tier 1)

**File:** `backend/services/edge-gateway/src/crypto/kem-auth.js` (NEW)

**Tasks:**
- [ ] 3.5.1 Implement Kyber decapsulation
- [ ] 3.5.2 Implement challenge-response verification
- [ ] 3.5.3 Add session key management

#### 3.6 LLAS Aggregation Module

**File:** `backend/services/edge-gateway/src/modules/aggregation/llas.js`

**Tasks:**
- [ ] 3.6.1 Implement message buffer with configurable batch size
- [ ] 3.6.2 Implement Merkle tree construction for aggregation
- [ ] 3.6.3 Implement aggregate proof generation
- [ ] 3.6.4 Add timeout-based flushing
- [ ] 3.6.5 Add metrics for aggregation efficiency

```javascript
// Class structure:
class LLASAggregator {
  constructor(batchSize, timeoutMs)
  addMessage(deviceId, payload, signature)  // Returns: aggregated | pending
  flush()  // Force aggregation
  getAggregateProof()  // Returns Merkle root + metadata
  getMetrics()  // Aggregation stats
}
```

#### 3.7 PL-PKI Module

**File:** `backend/services/edge-gateway/src/pki/registrar.js`

**Tasks:**
- [ ] 3.7.1 Implement device registration with PQC public keys
- [ ] 3.7.2 Create lightweight identity bindings (not full X.509)
- [ ] 3.7.3 Store device metadata (tier, public key, registration time)

**File:** `backend/services/edge-gateway/src/pki/trust-store.js`

**Tasks:**
- [ ] 3.7.4 Implement in-memory trust store
- [ ] 3.7.5 Add public key lookup by device ID
- [ ] 3.7.6 Add cache invalidation

**File:** `backend/services/edge-gateway/src/pki/revocation.js`

**Tasks:**
- [ ] 3.7.7 Implement simple revocation list
- [ ] 3.7.8 Add revocation check on verification

#### 3.8 Metrics Collection

**File:** `backend/services/edge-gateway/src/metrics/throughput.metrics.js`

**Tasks:**
- [ ] 3.8.1 Track messages received per second
- [ ] 3.8.2 Track verification success/failure rates
- [ ] 3.8.3 Track aggregation batch statistics

**File:** `backend/services/edge-gateway/src/metrics/aggregation.metrics.js`

**Tasks:**
- [ ] 3.8.4 Track bytes saved via aggregation
- [ ] 3.8.5 Track DB writes saved
- [ ] 3.8.6 Compare baseline vs H2A mode

**File:** `backend/services/edge-gateway/src/metrics/verifier.metrics.js`

**Tasks:**
- [ ] 3.8.7 Track verification latency distribution
- [ ] 3.8.8 Track KEM vs signature verification times

#### 3.9 MongoDB Models

**File:** `backend/services/edge-gateway/src/models/Device.js`

**Tasks:**
- [ ] 3.9.1 Define Mongoose schema for device registration
- [ ] 3.9.2 Add indexes for efficient lookup

```javascript
const deviceSchema = {
  deviceId: String,
  tier: Number,
  publicKey: Buffer,
  algorithm: String,
  registeredAt: Date,
  lastSeen: Date,
  status: String // 'active' | 'revoked'
};
```

**File:** `backend/services/edge-gateway/src/models/AggregatedLog.js`

**Tasks:**
- [ ] 3.9.3 Define schema for aggregated batch logs
- [ ] 3.9.4 Store Merkle root, device IDs, timestamp

```javascript
const aggregatedLogSchema = {
  batchId: String,
  merkleRoot: Buffer,
  deviceIds: [String],
  messageCount: Number,
  totalBytes: Number,
  aggregatedBytes: Number,
  createdAt: Date
};
```

**File:** `backend/services/edge-gateway/src/models/Metric.js` (NEW)

**Tasks:**
- [ ] 3.9.5 Define schema for time-series metrics storage

#### 3.10 API Routes

**File:** `backend/services/edge-gateway/src/routes.js`

**Tasks:**
- [ ] 3.10.1 `POST /api/devices/register` - Device registration
- [ ] 3.10.2 `POST /api/telemetry` - Receive signed telemetry
- [ ] 3.10.3 `POST /api/telemetry/batch` - Receive batch telemetry
- [ ] 3.10.4 `GET /api/metrics` - Get current metrics
- [ ] 3.10.5 `GET /api/metrics/comparison` - Baseline vs H2A comparison
- [ ] 3.10.6 `GET /api/devices` - List registered devices
- [ ] 3.10.7 `POST /api/mode` - Switch between baseline/H2A modes
- [ ] 3.10.8 `GET /api/aggregation/status` - Current aggregation buffer status

#### 3.11 WebSocket Server

**File:** `backend/services/edge-gateway/src/ws/realtime.js` (NEW)

**Tasks:**
- [ ] 3.11.1 Set up WebSocket server for real-time dashboard updates
- [ ] 3.11.2 Broadcast metrics updates
- [ ] 3.11.3 Broadcast device status changes
- [ ] 3.11.4 Broadcast aggregation events

#### 3.12 Main Application

**File:** `backend/services/edge-gateway/src/app.js`

**Tasks:**
- [ ] 3.12.1 Configure Express middleware (JSON, CORS)
- [ ] 3.12.2 Mount API routes
- [ ] 3.12.3 Initialize PQC verifier
- [ ] 3.12.4 Initialize LLAS aggregator
- [ ] 3.12.5 Initialize metrics collectors
- [ ] 3.12.6 Set up error handling

**File:** `backend/services/edge-gateway/src/server.js`

**Tasks:**
- [ ] 3.12.7 Connect to MongoDB
- [ ] 3.12.8 Start HTTP server
- [ ] 3.12.9 Start WebSocket server
- [ ] 3.12.10 Handle graceful shutdown

---

### Phase 4: Cloud & Database Layer
**Duration:** 1-2 days  
**Priority:** 🟡 Medium

#### 4.1 Database Configuration

**File:** `backend/services/edge-gateway/src/config/database.js`

**Tasks:**
- [ ] 4.1.1 Configure MongoDB connection with retry logic
- [ ] 4.1.2 Set up connection pooling
- [ ] 4.1.3 Add connection event handlers

#### 4.2 Aggregated Proof Storage

**Tasks:**
- [ ] 4.2.1 Implement efficient batch insertion
- [ ] 4.2.2 Add TTL indexes for automatic cleanup
- [ ] 4.2.3 Add query methods for dashboard

---

### Phase 5: Frontend Dashboard
**Duration:** 3-4 days  
**Priority:** 🟡 Medium

#### 5.1 Dashboard Layout

**File:** `frontend/dashboard/src/pages/Dashboard.jsx`

**Tasks:**
- [ ] 5.1.1 Create responsive grid layout
- [ ] 5.1.2 Add header with mode toggle (Baseline/H2A)
- [ ] 5.1.3 Add device status panel
- [ ] 5.1.4 Add metrics visualization panels

#### 5.2 Components to Create

**Directory:** `frontend/dashboard/src/components/`

- [ ] 5.2.1 `DeviceList.jsx` - List of active devices with status
- [ ] 5.2.2 `LatencyChart.jsx` - Bar chart comparing Tier 1 vs Tier 2 latency
- [ ] 5.2.3 `BandwidthChart.jsx` - Line chart showing Baseline vs H2A bandwidth
- [ ] 5.2.4 `AggregationStats.jsx` - Real-time aggregation statistics
- [ ] 5.2.5 `EnergyEstimation.jsx` - Energy consumption comparison
- [ ] 5.2.6 `LiveTraffic.jsx` - Real-time packet visualization
- [ ] 5.2.7 `ModeToggle.jsx` - Switch between Baseline and H2A modes

#### 5.3 WebSocket Integration

**File:** `frontend/dashboard/src/hooks/useWebSocket.js` (NEW)

**Tasks:**
- [ ] 5.3.1 Create WebSocket connection hook
- [ ] 5.3.2 Handle reconnection logic
- [ ] 5.3.3 Parse and distribute incoming metrics

#### 5.4 API Integration

**File:** `frontend/dashboard/src/services/api.js` (NEW)

**Tasks:**
- [ ] 5.4.1 Create API client
- [ ] 5.4.2 Add endpoints for metrics, devices, mode switching

#### 5.5 Charting Library

**Tasks:**
- [ ] 5.5.1 Install `recharts` or `chart.js`
- [ ] 5.5.2 Create reusable chart components

---

### Phase 6: Benchmarking & Experimentation
**Duration:** 2-3 days  
**Priority:** 🔴 Critical

#### 6.1 Experiment Scenarios

**File:** `experiments/scenarios/baseline.json` (UPDATE)

```json
{
  "name": "Baseline (No Aggregation)",
  "mode": "baseline",
  "devices": {
    "tier1": 5,
    "tier2": 5
  },
  "duration_seconds": 300,
  "telemetry_interval_ms": 1000
}
```

**File:** `experiments/scenarios/h2a_enabled.json` (NEW)

```json
{
  "name": "H2A with LLAS",
  "mode": "h2a",
  "devices": {
    "tier1": 5,
    "tier2": 5
  },
  "aggregation": {
    "batch_size": 50,
    "timeout_ms": 5000
  },
  "duration_seconds": 300,
  "telemetry_interval_ms": 1000
}
```

#### 6.2 Benchmark Runner

**File:** `experiments/runner.py` (NEW)

**Tasks:**
- [ ] 6.2.1 Load scenario configurations
- [ ] 6.2.2 Orchestrate Docker containers
- [ ] 6.2.3 Collect metrics during experiment
- [ ] 6.2.4 Export results to CSV

#### 6.3 Analysis Scripts

**File:** `experiments/analysis/compare.py` (NEW)

**Tasks:**
- [ ] 6.3.1 Load baseline and H2A results
- [ ] 6.3.2 Calculate bandwidth savings percentage
- [ ] 6.3.3 Calculate latency improvements
- [ ] 6.3.4 Generate comparison charts

#### 6.4 Expected Results Documentation

**File:** `experiments/benchmarks/expected_results.md` (NEW)

Document expected outcomes:
- Cryptographic latency: Tier 1 (>100ms) vs Tier 2 (~50ms)
- Bandwidth reduction: >90% with LLAS
- DB write reduction: N → 1
- KEM-Trick speedup: 40-60%

---

## 5. Metrics Collection Strategy

### 5.1 Device-Side Metrics

| Metric | Collection Point | Unit | Storage |
|--------|------------------|------|---------|
| Sign Time | `pqc_engine.sign()` | ms | Local buffer → Gateway |
| KEM Time | `pqc_engine.kem_encapsulate()` | ms | Local buffer → Gateway |
| Payload Size | Before transmission | bytes | Per message |
| Signature Size | After signing | bytes | Per message |
| CPU Time | `time.process_time()` | ms | Per operation |
| Est. Energy | Calculated from CPU time | mJ | Per operation |

### 5.2 Gateway-Side Metrics

| Metric | Collection Point | Unit | Storage |
|--------|------------------|------|---------|
| Verify Time | `verifier.verify()` | ms | MongoDB |
| Messages/sec | Route handler | count/s | In-memory → WS |
| Batch Size | LLAS aggregator | count | Per batch |
| Bytes Received | Route handler | bytes | Per second |
| Bytes to DB | After aggregation | bytes | Per batch |
| Aggregation Ratio | Calculated | % | Per batch |

### 5.3 Comparison Metrics

| Comparison | Baseline | H2A | Formula |
|------------|----------|-----|---------|
| Bandwidth to Cloud | Sum(all signatures) | 1 aggregate proof | `(1 - H2A/Baseline) × 100` |
| DB Writes | N | 1 | `(1 - 1/N) × 100` |
| Verification Load | All at cloud | Distributed | Qualitative |

---

## 6. Testing Strategy

### 6.1 Unit Tests

| Component | Test File | Coverage Target |
|-----------|-----------|-----------------|
| PQC Engine | `tests/crypto/test_pqc_engine.py` | Key gen, sign, verify |
| LLAS Aggregator | `tests/modules/test_llas.js` | Batching, Merkle tree |
| Verifier | `tests/crypto/test_verifier.js` | All algorithms |

### 6.2 Integration Tests

| Scenario | Description |
|----------|-------------|
| Device → Gateway | Single device registration and telemetry |
| Multi-Device Aggregation | 10 devices, verify aggregation |
| Mode Switching | Toggle baseline ↔ H2A during operation |

### 6.3 Load Tests

| Test | Devices | Duration | Expected Outcome |
|------|---------|----------|------------------|
| Baseline Stress | 50 | 5 min | High bandwidth, many DB writes |
| H2A Stress | 50 | 5 min | Low bandwidth, batched DB writes |

---

## 7. File Structure Changes

### New Files to Create

```
backend/services/device-simulator/src/
├── metrics/
│   └── collector.py         # NEW
└── utils/
    └── http_client.py       # NEW

backend/services/edge-gateway/src/
├── crypto/
│   └── kem-auth.js          # NEW
├── ws/
│   └── realtime.js          # NEW
├── models/
│   └── Metric.js            # NEW
└── utils/
    └── merkle.js            # NEW

frontend/dashboard/src/
├── components/
│   ├── DeviceList.jsx       # NEW
│   ├── LatencyChart.jsx     # NEW
│   ├── BandwidthChart.jsx   # NEW
│   ├── AggregationStats.jsx # NEW
│   ├── EnergyEstimation.jsx # NEW
│   ├── LiveTraffic.jsx      # NEW
│   └── ModeToggle.jsx       # NEW
├── hooks/
│   └── useWebSocket.js      # NEW
└── services/
    └── api.js               # NEW

experiments/
├── runner.py                # NEW
└── analysis/
    └── compare.py           # NEW

infra/env/
├── .env.dev                 # NEW
├── .env.gateway             # NEW
└── .env.device              # NEW
```

---

## 8. Dependency Requirements

### 8.1 Python (Device Simulator)

```
liboqs-python>=0.9.0
aiohttp>=3.9.0
python-dotenv>=1.0.0
pydantic>=2.5.0
structlog>=24.1.0
pytest>=7.4.0
pytest-asyncio>=0.21.0
```

### 8.2 Node.js (Edge Gateway)

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.0",
    "@noble/post-quantum": "^0.2.0",
    "@noble/hashes": "^1.3.0",
    "ws": "^8.16.0",
    "dotenv": "^16.3.0",
    "pino": "^8.17.0",
    "pino-pretty": "^10.3.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.0",
    "jest": "^29.7.0"
  }
}
```

### 8.3 React (Dashboard)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "recharts": "^2.10.0",
    "axios": "^1.6.0",
    "@tanstack/react-query": "^5.17.0"
  }
}
```

---

## Implementation Checklist

### Week 1: Foundation + Device Simulator

- [x] Day 1-2: Phase 1 (Docker infrastructure) ✅ COMPLETE
- [x] Day 3-5: Phase 2 (Device simulator with PQC) ✅ COMPLETE

### Week 2: Edge Gateway

- [ ] Day 6-8: Phase 3.1-3.6 (Gateway core + LLAS) ⏳ IN PROGRESS
- [ ] Day 9-10: Phase 3.7-3.12 (PKI, Metrics, Routes)

### Week 3: Integration + Dashboard

- [ ] Day 11: Phase 4 (Database layer)
- [ ] Day 12-14: Phase 5 (Dashboard)

### Week 4: Benchmarking + Polish

- [ ] Day 15-17: Phase 6 (Experiments)
- [ ] Day 18-20: Final testing, documentation, paper data collection

---

## Success Criteria

The implementation is complete when:

1. ⏳ Device simulators successfully generate PQC signatures
2. ⏳ Gateway verifies signatures and aggregates using LLAS
3. ⏳ Dashboard shows real-time comparison between Baseline and H2A
4. ⏳ Metrics demonstrate:
   - >90% bandwidth reduction with LLAS
   - Clear latency difference between Tier 1 and Tier 2
   - Measurable DB write reduction
5. ⏳ All experiment scenarios can be run and produce CSV output
6. ⏳ Results are reproducible and suitable for research paper

---

*This plan will be updated as implementation progresses. Check items off as they are completed.*
