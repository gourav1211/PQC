# H2A-PQC Experiments

## Overview

This directory contains benchmark experiments for comparing the H2A-PQC framework against baseline (no aggregation) operation.

## Directory Structure

```
experiments/
├── scenarios/           # Experiment configuration files
│   ├── no_aggregation.json    # Baseline scenario
│   ├── llas_enabled.json      # H2A with LLAS aggregation
│   └── high_load.json         # Stress test scenario
├── benchmarks/          # Benchmark results and expected outcomes
│   ├── baseline_metrics.csv
│   ├── h2a_pqc_metrics.csv
│   └── expected_results.md
├── analysis/            # Analysis scripts
│   └── compare.py       # Comparison and chart generation
├── runner.py            # Main benchmark orchestrator
├── quickstart.py        # Quick start helper script
└── requirements.txt     # Python dependencies
```

## Quick Start

### 1. Install Dependencies

```bash
cd experiments
pip install -r requirements.txt
```

### 2. Run Benchmarks

```bash
# Run all benchmarks (baseline + H2A)
python runner.py --scenario all

# Run specific scenario
python runner.py --scenario baseline
python runner.py --scenario h2a

# Skip Docker management (containers already running)
python runner.py --scenario all --skip-docker
```

### 3. Analyze Results

```bash
# Auto-detect latest results and generate report
python analysis/compare.py --auto

# Generate report without charts
python analysis/compare.py --auto --no-charts

# Specify files manually
python analysis/compare.py -b benchmarks/baseline_metrics.csv -h2a benchmarks/h2a_pqc_metrics.csv
```

## Scenarios

### Baseline (No Aggregation)
- Mode: `baseline`
- Each message transmitted individually
- 1 DB write per message
- Expected: High bandwidth, high DB writes

### H2A with LLAS
- Mode: `h2a`
- 50 messages aggregated into Merkle tree batches
- 1 DB write per batch
- Expected: ~90% bandwidth reduction, ~98% DB write reduction

### High Load Stress Test
- Mode: `h2a`
- 12 devices at 500ms intervals
- 100 messages per batch
- Tests gateway capacity under load

## Expected Results

See [benchmarks/expected_results.md](benchmarks/expected_results.md) for detailed expected outcomes.

### Key Metrics

| Metric | Baseline | H2A | Improvement |
|--------|----------|-----|-------------|
| Bandwidth | 100% | ~10% | 90% reduction |
| DB Writes | N | N/50 | 98% reduction |
| Energy | 100% | ~40% | 60% savings |

## Output

The analysis generates:
- `comparison_report_YYYYMMDD_HHMMSS.txt` - Text report
- `bandwidth_comparison.png` - Bandwidth over time
- `verifications_batches.png` - Verification counts
- `latency_comparison.png` - Latency comparison
- `summary_comparison.png` - Bar chart summary
- `savings_pie.png` - Savings visualization

## Troubleshooting

### Gateway not responding
Ensure Docker containers are running:
```bash
cd infra
docker-compose up -d
```

### Missing matplotlib
Charts are optional. Install with:
```bash
pip install matplotlib
```

### Permission errors
Ensure you have write access to the benchmarks and analysis/output directories.
