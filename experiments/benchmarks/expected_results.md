# H2A-PQC Expected Benchmark Results

## Overview

This document outlines the expected performance improvements when using the H2A-PQC framework compared to a baseline (no aggregation) approach.

## Test Configuration

### Device Setup
| Tier | Count | CPU Limit | Memory | Crypto Mode |
|------|-------|-----------|--------|-------------|
| Tier 1 | 4 | 0.1 cores | 64 MB | KEM-Only |
| Tier 2 | 2 | 0.3 cores | 128 MB | Full Signing |

### Experiment Parameters
- **Duration:** 300 seconds (5 minutes)
- **Warmup:** 30 seconds
- **Telemetry Interval:** 1000ms (1 message/second/device)
- **Payload Size:** 256 bytes
- **LLAS Batch Size:** 50 messages
- **Batch Timeout:** 5000ms

## Expected Results

### 1. Cryptographic Latency

| Operation | Tier 1 | Tier 2 | Notes |
|-----------|--------|--------|-------|
| Dilithium Sign | N/A | ~50ms | Full signing on capable devices |
| Dilithium Verify | N/A | ~30ms | Verification at gateway |
| Kyber Encapsulate | ~5ms | ~5ms | Key encapsulation |
| Kyber Decapsulate | ~5ms | ~5ms | Key decapsulation |
| KEM-Trick Auth | ~10ms | ~10ms | Symmetric auth after KEM |

**Key Insight:** Tier 1 devices using KEM-Trick avoid expensive asymmetric signing operations, reducing crypto overhead by 80-90%.

### 2. Bandwidth Metrics

| Metric | Baseline | H2A | Improvement |
|--------|----------|-----|-------------|
| Messages Transmitted | 1800 | 1800 | 0% (same) |
| Signatures Transmitted | 1800 | 36 | 98% reduction |
| Data to Cloud/DB | ~450 KB | ~45 KB | 90% reduction |
| Signature Overhead | ~290 KB | ~29 KB | 90% reduction |

**Signature Size Reference:**
- Dilithium3 Signature: ~3.3 KB
- Kyber768 Ciphertext: ~1.1 KB
- Merkle Root + Proof: ~1 KB per batch

### 3. Database Write Reduction

| Scenario | DB Writes | Notes |
|----------|-----------|-------|
| Baseline | 1800 | One write per message |
| H2A | 36 | One write per batch (50 messages) |
| **Reduction** | **98%** | N → N/batch_size |

### 4. Estimated Energy Savings

Based on crypto operation energy costs:

| Operation | Energy (µJ) | Baseline Total | H2A Total |
|-----------|-------------|----------------|-----------|
| Sign (per msg) | 150 | 270,000 µJ | 0 µJ (Tier 1) |
| Verify (per msg) | 50 | 90,000 µJ | 1,800 µJ (per batch) |
| Transmit (per KB) | 200 | 90,000 µJ | 9,000 µJ |
| **Total** | - | **450 mJ** | **~50 mJ** |
| **Savings** | - | - | **~89%** |

### 5. Aggregation Efficiency

| Metric | Value |
|--------|-------|
| Messages per Batch | 50 |
| Merkle Tree Depth | ~6 levels |
| Aggregation Ratio | 50:1 |
| Proof Size | ~200 bytes |

## Performance Formulas

### Bandwidth Reduction
```
Reduction % = ((baseline_bytes - h2a_bytes) / baseline_bytes) × 100
Expected: ≥ 90%
```

### DB Write Reduction
```
Reduction % = ((total_messages - total_batches) / total_messages) × 100
Expected: ≥ 98% (with batch_size = 50)
```

### Energy Savings
```
Savings % = (1 - (h2a_energy / baseline_energy)) × 100
Expected: 40-60% (conservative), up to 89% (optimal)
```

## Success Criteria

A successful H2A-PQC implementation should achieve:

| Metric | Minimum | Target | Excellent |
|--------|---------|--------|-----------|
| Bandwidth Reduction | 70% | 90% | 95% |
| DB Write Reduction | 90% | 98% | 99% |
| Energy Savings | 30% | 50% | 70% |
| Latency Impact | <20% increase | <10% increase | No increase |

## Visualization

The analysis scripts generate the following charts:

1. **bandwidth_comparison.png** - Line chart showing bandwidth over time
2. **verifications_batches.png** - Verification and batch count over time
3. **latency_comparison.png** - Latency comparison between modes
4. **summary_comparison.png** - Bar chart summary of key metrics
5. **savings_pie.png** - Pie charts showing bandwidth and DB write savings

## Running Benchmarks

```bash
# Run both baseline and H2A experiments
python experiments/runner.py --scenario all

# Analyze results
python experiments/analysis/compare.py --auto

# Generate report only (no charts)
python experiments/analysis/compare.py --auto --no-charts
```

## References

- NIST PQC Standards (FIPS 203, 204)
- Dilithium (ML-DSA) specification
- Kyber (ML-KEM) specification
- Merkle Tree authentication papers
