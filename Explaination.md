# PQC Fullstack Project – Simple Explaination

## 1. Overall Architecture

This project is a three‑tier IoT security testbed that uses post‑quantum cryptography and a live dashboard. At the bottom, many simulated IoT devices run in Python and act like small sensors. They create telemetry data and secure it using post‑quantum methods. This is the device simulator in [backend/services/device-simulator/src/device.py](backend/services/device-simulator/src/device.py) with support from [backend/services/device-simulator/src/crypto/pqc_engine.py](backend/services/device-simulator/src/crypto/pqc_engine.py) and [backend/services/device-simulator/src/telemetry/sensor_mock.py](backend/services/device-simulator/src/telemetry/sensor_mock.py). In the middle, the Edge Gateway is a Node.js server that receives device data, verifies it, aggregates it, and exposes APIs. This layer is implemented in [backend/services/edge-gateway/src/app.js](backend/services/edge-gateway/src/app.js), [backend/services/edge-gateway/src/routes.js](backend/services/edge-gateway/src/routes.js), and [backend/services/edge-gateway/src/server.js](backend/services/edge-gateway/src/server.js). At the top, MongoDB stores devices and aggregated batches using schemas in [backend/services/edge-gateway/src/models/Device.js](backend/services/edge-gateway/src/models/Device.js) and [backend/services/edge-gateway/src/models/AggregatedLog.js](backend/services/edge-gateway/src/models/AggregatedLog.js).

For visualization, a React dashboard shows live metrics and traffic. It pulls data via REST APIs and real‑time WebSocket events. The dashboard code is in [frontend/dashboard/src/pages/Dashboard.jsx](frontend/dashboard/src/pages/Dashboard.jsx), the API client is in [frontend/dashboard/src/services/api.js](frontend/dashboard/src/services/api.js), and the WebSocket hook is in [frontend/dashboard/src/hooks/useWebSocket.js](frontend/dashboard/src/hooks/useWebSocket.js). The whole system can be started with Docker Compose, defined in [infra/docker-compose.yml](infra/docker-compose.yml). This architecture is chosen because it cleanly mirrors a real IoT system: devices → gateway → cloud database → dashboard, and it is easy to test with containers.

## 2. Module Breakdown

**Device Simulator (Python)**
- [backend/services/device-simulator/src/device.py](backend/services/device-simulator/src/device.py): Main loop for each device. Generates data, signs or KEM‑authenticates it, and sends it to the gateway.
- [backend/services/device-simulator/src/crypto/pqc_engine.py](backend/services/device-simulator/src/crypto/pqc_engine.py): `PQCEngine` handles key generation, signatures, and KEM operations, plus timing metrics.
- [backend/services/device-simulator/src/telemetry/sensor_mock.py](backend/services/device-simulator/src/telemetry/sensor_mock.py): `SensorMock` creates realistic sensor readings and anomalies.
- [backend/services/device-simulator/src/metrics/collector.py](backend/services/device-simulator/src/metrics/collector.py): `MetricsCollector` records crypto time, sizes, and energy estimation.
- [backend/services/device-simulator/src/config.py](backend/services/device-simulator/src/config.py): Config for device tier, algorithms, intervals, and energy model.

**Edge Gateway (Node.js)**
- [backend/services/edge-gateway/src/app.js](backend/services/edge-gateway/src/app.js): Express app, middleware, and gateway initialization.
- [backend/services/edge-gateway/src/routes.js](backend/services/edge-gateway/src/routes.js): All REST APIs for registration, telemetry, and metrics.
- [backend/services/edge-gateway/src/websocket.js](backend/services/edge-gateway/src/websocket.js): Live metrics and event stream to the UI.
- [backend/services/edge-gateway/src/modules/aggregation/llas.js](backend/services/edge-gateway/src/modules/aggregation/llas.js): `LLAS` aggregation creates Merkle‑tree batches to reduce bandwidth and DB writes.
- [backend/services/edge-gateway/src/crypto/verifier.js](backend/services/edge-gateway/src/crypto/verifier.js): `verifySignature()` for PQC signature checks.
- [backend/services/edge-gateway/src/crypto/kem-auth.js](backend/services/edge-gateway/src/crypto/kem-auth.js): KEM “challenge/response” for Tier‑1 device authentication.
- [backend/services/edge-gateway/src/pki/registrar.js](backend/services/edge-gateway/src/pki/registrar.js): Registration flow and proof checks.
- [backend/services/edge-gateway/src/pki/trust-store.js](backend/services/edge-gateway/src/pki/trust-store.js): In‑memory trust store for device keys.
- [backend/services/edge-gateway/src/pki/revocation.js](backend/services/edge-gateway/src/pki/revocation.js): Revocation list and checks.
- Metrics modules: [backend/services/edge-gateway/src/metrics/throughput.metrics.js](backend/services/edge-gateway/src/metrics/throughput.metrics.js), [backend/services/edge-gateway/src/metrics/aggregation.metrics.js](backend/services/edge-gateway/src/metrics/aggregation.metrics.js), [backend/services/edge-gateway/src/metrics/verifier.metrics.js](backend/services/edge-gateway/src/metrics/verifier.metrics.js).
- Data models: [backend/services/edge-gateway/src/models/Device.js](backend/services/edge-gateway/src/models/Device.js), [backend/services/edge-gateway/src/models/AggregatedLog.js](backend/services/edge-gateway/src/models/AggregatedLog.js), [backend/services/edge-gateway/src/models/Metric.js](backend/services/edge-gateway/src/models/Metric.js).

**Dashboard (React)**
- Pages: [frontend/dashboard/src/pages/Dashboard.jsx](frontend/dashboard/src/pages/Dashboard.jsx), [frontend/dashboard/src/pages/Settings.jsx](frontend/dashboard/src/pages/Settings.jsx).
- UI components: [frontend/dashboard/src/components/MetricsSummary.jsx](frontend/dashboard/src/components/MetricsSummary.jsx), [frontend/dashboard/src/components/LiveTraffic.jsx](frontend/dashboard/src/components/LiveTraffic.jsx), [frontend/dashboard/src/components/BandwidthChart.jsx](frontend/dashboard/src/components/BandwidthChart.jsx), [frontend/dashboard/src/components/LatencyChart.jsx](frontend/dashboard/src/components/LatencyChart.jsx).
- Data access: [frontend/dashboard/src/services/api.js](frontend/dashboard/src/services/api.js).
- Realtime: [frontend/dashboard/src/hooks/useWebSocket.js](frontend/dashboard/src/hooks/useWebSocket.js).

**Benchmarks & Experiments**
- Orchestration: [experiments/runner.py](experiments/runner.py) runs scenarios and collects metrics.
- Analysis: [experiments/analysis/compare.py](experiments/analysis/compare.py) compares baseline vs H2A and generates charts.
- Scenarios: [experiments/scenarios](experiments/scenarios) define device counts, intervals, and batch sizes.
- Data: [experiments/benchmarks](experiments/benchmarks) stores CSV results.

**Infrastructure**
- [infra/docker-compose.yml](infra/docker-compose.yml) defines MongoDB, gateway, and device containers (some are commented, but intended).

## 3. Data Flow

1. A device starts and generates keys using `PQCEngine` in [backend/services/device-simulator/src/crypto/pqc_engine.py](backend/services/device-simulator/src/crypto/pqc_engine.py).
2. The device registers with the gateway using the two‑step API in [backend/services/edge-gateway/src/routes.js](backend/services/edge-gateway/src/routes.js). Registration is handled by `initiateRegistration()` and `completeRegistration()` in [backend/services/edge-gateway/src/pki/registrar.js](backend/services/edge-gateway/src/pki/registrar.js).
3. The device generates sensor readings in `SensorMock`, builds a payload, then either:
   - signs it (Tier‑2) using `sign()` in `PQCEngine`, or
   - uses KEM‑based authentication (Tier‑1) with `kem_encapsulate()`.
4. The device sends telemetry to the gateway endpoint `/api/v1/telemetry` in [backend/services/edge-gateway/src/routes.js](backend/services/edge-gateway/src/routes.js).
5. The gateway verifies signatures using `verifySignature()` in [backend/services/edge-gateway/src/crypto/verifier.js](backend/services/edge-gateway/src/crypto/verifier.js) and checks revocation with [backend/services/edge-gateway/src/pki/revocation.js](backend/services/edge-gateway/src/pki/revocation.js).
6. The gateway records throughput and latency in [backend/services/edge-gateway/src/metrics/throughput.metrics.js](backend/services/edge-gateway/src/metrics/throughput.metrics.js).
7. In H2A mode, logs are aggregated into a Merkle batch by `LLAS` in [backend/services/edge-gateway/src/modules/aggregation/llas.js](backend/services/edge-gateway/src/modules/aggregation/llas.js). This batch is saved to MongoDB using [backend/services/edge-gateway/src/models/AggregatedLog.js](backend/services/edge-gateway/src/models/AggregatedLog.js). In baseline mode, logs are handled individually.
8. The gateway broadcasts live updates using WebSockets from [backend/services/edge-gateway/src/websocket.js](backend/services/edge-gateway/src/websocket.js).
9. The dashboard listens to WebSockets via `useWebSocket()` in [frontend/dashboard/src/hooks/useWebSocket.js](frontend/dashboard/src/hooks/useWebSocket.js) and also pulls summary metrics through REST using [frontend/dashboard/src/services/api.js](frontend/dashboard/src/services/api.js).
10. The user sees charts and live traffic cards update in real time on the dashboard.

## 4. Core Logic & Important Flows

- **Registration flow:** A device calls `/register/initiate` then `/register/complete`. Tier‑1 devices use KEM proof (simplified in this demo). Tier‑2 devices sign a proof message. This is handled in [backend/services/edge-gateway/src/pki/registrar.js](backend/services/edge-gateway/src/pki/registrar.js).
- **Telemetry verification:** Each telemetry packet is verified. Signatures are checked in [backend/services/edge-gateway/src/crypto/verifier.js](backend/services/edge-gateway/src/crypto/verifier.js), and revoked devices are blocked via [backend/services/edge-gateway/src/pki/revocation.js](backend/services/edge-gateway/src/pki/revocation.js).
- **LLAS aggregation:** In H2A mode, many logs become one Merkle batch. This reduces data size and DB writes. The logic is in [backend/services/edge-gateway/src/modules/aggregation/llas.js](backend/services/edge-gateway/src/modules/aggregation/llas.js).
- **Metrics collection:** Every step records throughput, latency, aggregation efficiency, and verification cost using files in [backend/services/edge-gateway/src/metrics](backend/services/edge-gateway/src/metrics).
- **Realtime dashboard:** WebSocket events for metrics and traffic allow the UI to feel live, using [backend/services/edge-gateway/src/websocket.js](backend/services/edge-gateway/src/websocket.js) and [frontend/dashboard/src/hooks/useWebSocket.js](frontend/dashboard/src/hooks/useWebSocket.js).
- **Benchmarking:** The experiments runner in [experiments/runner.py](experiments/runner.py) starts scenarios, collects metrics, and exports CSV. The analyzer in [experiments/analysis/compare.py](experiments/analysis/compare.py) produces charts and comparison reports.

## 5. Design Decisions & Strategy

- **Three‑tier architecture:** It mirrors real IoT systems and is easy to explain and scale. Devices are separated from the gateway, and storage is centralized.
- **MERN‑style stack:** React for the UI, Node.js for the gateway, and MongoDB for storage. This is widely used and fast to prototype.
- **Python device simulator:** Python is ideal for simulation and easy math/metrics. The `PQCEngine` can use liboqs, with a mock fallback for simple testing.
- **Post‑quantum algorithms:** Dilithium (signatures) and Kyber (KEM) represent future‑ready crypto for IoT.
- **Merkle aggregation (LLAS):** It reduces bandwidth and DB writes without losing integrity. This is a good fit for many small IoT messages.
- **REST + WebSocket:** REST is simple for control and queries; WebSocket gives real‑time updates for the dashboard.
- **Docker testbed:** [infra/docker-compose.yml](infra/docker-compose.yml) makes the whole system reproducible and easy to run in a lab.

## 6. Benchmarks & Evaluation

Benchmarks are driven by scenarios in [experiments/scenarios](experiments/scenarios). The runner in [experiments/runner.py](experiments/runner.py) starts devices and the gateway, samples metrics repeatedly, and writes CSV files to [experiments/benchmarks](experiments/benchmarks). The analysis tool in [experiments/analysis/compare.py](experiments/analysis/compare.py) reads those CSVs and generates text reports and charts.

**What is measured now:**
- **Bandwidth:** total bytes received and bytes written to DB.
- **DB writes proxy:** number of verifications vs number of batches.
- **Latency:** average crypto verification latency.
- **Throughput:** messages per second from [backend/services/edge-gateway/src/metrics/throughput.metrics.js](backend/services/edge-gateway/src/metrics/throughput.metrics.js).
- **Aggregation efficiency:** compression ratio and bandwidth saved from [backend/services/edge-gateway/src/metrics/aggregation.metrics.js](backend/services/edge-gateway/src/metrics/aggregation.metrics.js).
- **Verification cost:** timing and success rate from [backend/services/edge-gateway/src/metrics/verifier.metrics.js](backend/services/edge-gateway/src/metrics/verifier.metrics.js).
- **Energy estimation on devices:** based on CPU time in [backend/services/device-simulator/src/metrics/collector.py](backend/services/device-simulator/src/metrics/collector.py).

**Tools used:** Python (aiohttp, csv, numpy, matplotlib), Docker Compose, and the built‑in metrics in the gateway.

**How to interpret results:**
- In baseline, every message goes to DB: high bandwidth and high DB writes.
- In H2A, many messages are merged into one batch: large bandwidth reduction and fewer DB writes.
- The report highlights the percentage savings and shows charts over time.

**If more benchmarks are needed:**
- CPU and memory of the gateway process over time.
- MongoDB write latency and storage size growth.
- End‑to‑end time from device send to dashboard update.
- Error rate under high load and device churn.

## 7. Security, Performance & Scalability

- **Security:** Device identity is validated via PQC signatures and KEM challenges. Revoked devices are blocked using [backend/services/edge-gateway/src/pki/revocation.js](backend/services/edge-gateway/src/pki/revocation.js). Basic HTTP hardening is enabled by Helmet in [backend/services/edge-gateway/src/app.js](backend/services/edge-gateway/src/app.js). The trust store is in memory, so it is secure for a demo but not production.
- **Performance:** LLAS aggregation reduces bandwidth and database writes. Metrics collection and batch flushing keep the gateway responsive even with many devices.
- **Scalability:** The gateway is mostly stateless and can be scaled out if the trust store and session store are moved to a shared service (e.g., Redis). MongoDB schemas include indexes and TTL fields for cleanup.

## 8. How to Explain This to a Professor (Short Viva Summary)

“This project is a full IoT security testbed that shows how post‑quantum cryptography can protect sensor data. Python devices generate telemetry and either sign it with Dilithium or authenticate with Kyber. A Node.js edge gateway verifies data, aggregates logs into Merkle batches to save bandwidth, stores results in MongoDB, and streams live metrics to a React dashboard. We compare baseline vs H2A mode using automated benchmarks and show big reductions in bandwidth and database writes, while still keeping strong security. It is a realistic, scalable design that matches how modern IoT systems are built.”
