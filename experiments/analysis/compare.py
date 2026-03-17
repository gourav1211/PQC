#!/usr/bin/env python3
"""
H2A-PQC Benchmark Analysis
==========================

Analyzes and compares benchmark results between Baseline and H2A modes.
Generates comparison charts and reports.

Usage:
    python compare.py --baseline baseline_metrics.csv --h2a h2a_metrics.csv
    python compare.py --auto  # Auto-detect latest results
"""

import argparse
import csv
import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Try to import optional dependencies
try:
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False
    print("Warning: matplotlib not available. Charts will not be generated.")

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False


BENCHMARKS_DIR = Path(__file__).parent.parent / 'benchmarks'
OUTPUT_DIR = Path(__file__).parent / 'output'


@dataclass
class MetricsSeries:
    """Time series of metrics from a benchmark run."""
    name: str
    mode: str
    timestamps: List[float]
    elapsed: List[float]
    verifications: List[int]
    bytes_received: List[int]
    bytes_to_db: List[int]
    batches: List[int]
    avg_latency: List[float]
    active_devices: List[int]


@dataclass
class ComparisonResult:
    """Comparison between baseline and H2A results."""
    baseline: MetricsSeries
    h2a: MetricsSeries
    
    # Calculated improvements
    bandwidth_saved_bytes: int = 0
    bandwidth_reduction_percent: float = 0.0
    db_write_reduction_percent: float = 0.0
    latency_improvement_percent: float = 0.0
    energy_savings_percent: float = 0.0


def load_metrics_csv(filepath: Path) -> MetricsSeries:
    """Load metrics from CSV file."""
    timestamps = []
    elapsed = []
    verifications = []
    bytes_received = []
    bytes_to_db = []
    batches = []
    avg_latency = []
    active_devices = []
    mode = "unknown"
    
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            timestamps.append(float(row['timestamp']))
            elapsed.append(float(row['elapsed_seconds']))
            verifications.append(int(row['verifications']))
            bytes_received.append(int(row['bytes_received']))
            bytes_to_db.append(int(row['bytes_to_db']))
            batches.append(int(row['batches']))
            avg_latency.append(float(row['avg_latency_ms']))
            active_devices.append(int(row['active_devices']))
            mode = row['mode']
    
    return MetricsSeries(
        name=filepath.stem,
        mode=mode,
        timestamps=timestamps,
        elapsed=elapsed,
        verifications=verifications,
        bytes_received=bytes_received,
        bytes_to_db=bytes_to_db,
        batches=batches,
        avg_latency=avg_latency,
        active_devices=active_devices
    )


def load_summary_json(filepath: Path) -> Dict:
    """Load summary JSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)


def find_latest_results() -> Tuple[Optional[Path], Optional[Path]]:
    """Find the most recent baseline and H2A results."""
    baseline_files = sorted(BENCHMARKS_DIR.glob('baseline_*.csv'), reverse=True)
    h2a_files = sorted(BENCHMARKS_DIR.glob('h2a_*.csv'), reverse=True)
    
    baseline = baseline_files[0] if baseline_files else None
    h2a = h2a_files[0] if h2a_files else None
    
    return baseline, h2a


def compare_results(baseline: MetricsSeries, h2a: MetricsSeries) -> ComparisonResult:
    """Calculate comparison metrics between baseline and H2A."""
    result = ComparisonResult(baseline=baseline, h2a=h2a)
    
    # Use final values for comparison
    baseline_bytes = baseline.bytes_received[-1] if baseline.bytes_received else 0
    h2a_bytes = h2a.bytes_received[-1] if h2a.bytes_received else 0
    h2a_to_db = h2a.bytes_to_db[-1] if h2a.bytes_to_db else 0
    
    baseline_verifications = baseline.verifications[-1] if baseline.verifications else 0
    h2a_batches = h2a.batches[-1] if h2a.batches else 0
    
    baseline_latency = sum(baseline.avg_latency) / len(baseline.avg_latency) if baseline.avg_latency else 0
    h2a_latency = sum(h2a.avg_latency) / len(h2a.avg_latency) if h2a.avg_latency else 0
    
    # Calculate improvements
    result.bandwidth_saved_bytes = baseline_bytes - h2a_to_db
    
    if baseline_bytes > 0:
        result.bandwidth_reduction_percent = (
            (baseline_bytes - h2a_to_db) / baseline_bytes * 100
        )
    
    if baseline_verifications > 0 and h2a_batches > 0:
        result.db_write_reduction_percent = (
            (baseline_verifications - h2a_batches) / baseline_verifications * 100
        )
    
    if baseline_latency > 0:
        result.latency_improvement_percent = (
            (baseline_latency - h2a_latency) / baseline_latency * 100
        )
    
    # Energy savings estimation (based on bandwidth + crypto operations)
    # Simplified model: energy ∝ bandwidth + crypto_ops
    if baseline_bytes > 0:
        baseline_energy_proxy = baseline_bytes + baseline_verifications * 100
        h2a_energy_proxy = h2a_to_db + h2a_batches * 100
        result.energy_savings_percent = (
            (baseline_energy_proxy - h2a_energy_proxy) / baseline_energy_proxy * 100
        )
    
    return result


def generate_text_report(comparison: ComparisonResult) -> str:
    """Generate text comparison report."""
    lines = [
        "=" * 70,
        "H2A-PQC BENCHMARK COMPARISON REPORT",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * 70,
        "",
        "SUMMARY",
        "-" * 70,
        "",
        f"{'Metric':<40} {'Baseline':>15} {'H2A':>15}",
        "-" * 70,
    ]
    
    baseline = comparison.baseline
    h2a = comparison.h2a
    
    # Final values
    b_verif = baseline.verifications[-1] if baseline.verifications else 0
    h_verif = h2a.verifications[-1] if h2a.verifications else 0
    
    b_bytes = baseline.bytes_received[-1] if baseline.bytes_received else 0
    h_bytes = h2a.bytes_received[-1] if h2a.bytes_received else 0
    h_to_db = h2a.bytes_to_db[-1] if h2a.bytes_to_db else 0
    
    b_batches = baseline.batches[-1] if baseline.batches else b_verif
    h_batches = h2a.batches[-1] if h2a.batches else 0
    
    b_latency = sum(baseline.avg_latency) / len(baseline.avg_latency) if baseline.avg_latency else 0
    h_latency = sum(h2a.avg_latency) / len(h2a.avg_latency) if h2a.avg_latency else 0
    
    lines.extend([
        f"{'Total Verifications':<40} {b_verif:>15} {h_verif:>15}",
        f"{'Total Batches':<40} {b_batches:>15} {h_batches:>15}",
        f"{'Bytes Received':<40} {b_bytes:>15} {h_bytes:>15}",
        f"{'Bytes to Database':<40} {b_bytes:>15} {h_to_db:>15}",
        f"{'Avg Latency (ms)':<40} {b_latency:>15.2f} {h_latency:>15.2f}",
        "",
        "-" * 70,
        "KEY IMPROVEMENTS (H2A vs Baseline)",
        "-" * 70,
        "",
        f"Bandwidth Reduction:     {comparison.bandwidth_reduction_percent:>6.1f}%",
        f"DB Write Reduction:      {comparison.db_write_reduction_percent:>6.1f}%",
        f"Latency Improvement:     {comparison.latency_improvement_percent:>6.1f}%",
        f"Est. Energy Savings:     {comparison.energy_savings_percent:>6.1f}%",
        f"Bandwidth Saved:         {comparison.bandwidth_saved_bytes / 1024:>6.1f} KB",
        "",
        "-" * 70,
        "AGGREGATION EFFICIENCY",
        "-" * 70,
        "",
    ])
    
    if h_batches > 0 and h_verif > 0:
        msgs_per_batch = h_verif / h_batches
        lines.append(f"Messages per Batch:      {msgs_per_batch:>6.1f}")
        lines.append(f"Compression Ratio:       {1 / (h_to_db / b_bytes) if b_bytes > 0 else 0:>6.1f}x")
    
    lines.extend([
        "",
        "=" * 70,
        "CONCLUSION",
        "=" * 70,
        "",
    ])
    
    if comparison.bandwidth_reduction_percent >= 80:
        lines.append("✅ H2A-PQC achieves significant bandwidth reduction (>80%)")
    elif comparison.bandwidth_reduction_percent >= 50:
        lines.append("⚠️ H2A-PQC achieves moderate bandwidth reduction (50-80%)")
    else:
        lines.append("❌ H2A-PQC bandwidth reduction below expected (<50%)")
    
    if comparison.db_write_reduction_percent >= 90:
        lines.append("✅ LLAS aggregation dramatically reduces DB writes (>90%)")
    elif comparison.db_write_reduction_percent >= 70:
        lines.append("⚠️ LLAS aggregation moderately reduces DB writes (70-90%)")
    else:
        lines.append("❌ LLAS aggregation below expected reduction (<70%)")
    
    lines.extend(["", "=" * 70])
    
    return "\n".join(lines)


def generate_charts(comparison: ComparisonResult, output_dir: Path):
    """Generate comparison charts using matplotlib."""
    if not MATPLOTLIB_AVAILABLE:
        print("Skipping chart generation (matplotlib not available)")
        return
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Set style
    plt.style.use('seaborn-v0_8-darkgrid' if 'seaborn-v0_8-darkgrid' in plt.style.available else 'default')
    
    baseline = comparison.baseline
    h2a = comparison.h2a
    
    # Chart 1: Bandwidth Over Time
    fig, ax = plt.subplots(figsize=(12, 6))
    
    ax.plot(baseline.elapsed, [b/1024 for b in baseline.bytes_received], 
            label='Baseline (Received)', color='red', linewidth=2)
    ax.plot(h2a.elapsed, [b/1024 for b in h2a.bytes_received], 
            label='H2A (Received)', color='blue', linewidth=2, alpha=0.7)
    ax.plot(h2a.elapsed, [b/1024 for b in h2a.bytes_to_db], 
            label='H2A (To DB)', color='green', linewidth=2)
    
    ax.set_xlabel('Time (seconds)', fontsize=12)
    ax.set_ylabel('Bandwidth (KB)', fontsize=12)
    ax.set_title('Bandwidth Comparison: Baseline vs H2A-PQC', fontsize=14)
    ax.legend(loc='upper left')
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(output_dir / 'bandwidth_comparison.png', dpi=150)
    plt.close()
    
    # Chart 2: Verifications and Batches
    fig, ax = plt.subplots(figsize=(12, 6))
    
    ax.plot(baseline.elapsed, baseline.verifications, 
            label='Baseline Verifications', color='red', linewidth=2)
    ax.plot(h2a.elapsed, h2a.verifications, 
            label='H2A Verifications', color='blue', linewidth=2)
    ax.plot(h2a.elapsed, h2a.batches, 
            label='H2A Batches', color='green', linewidth=2, linestyle='--')
    
    ax.set_xlabel('Time (seconds)', fontsize=12)
    ax.set_ylabel('Count', fontsize=12)
    ax.set_title('Verification & Batch Count Over Time', fontsize=14)
    ax.legend(loc='upper left')
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(output_dir / 'verifications_batches.png', dpi=150)
    plt.close()
    
    # Chart 3: Latency Comparison
    fig, ax = plt.subplots(figsize=(10, 6))
    
    ax.plot(baseline.elapsed, baseline.avg_latency, 
            label='Baseline', color='red', linewidth=2, alpha=0.7)
    ax.plot(h2a.elapsed, h2a.avg_latency, 
            label='H2A', color='green', linewidth=2)
    
    ax.set_xlabel('Time (seconds)', fontsize=12)
    ax.set_ylabel('Average Latency (ms)', fontsize=12)
    ax.set_title('Verification Latency Over Time', fontsize=14)
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(output_dir / 'latency_comparison.png', dpi=150)
    plt.close()
    
    # Chart 4: Summary Bar Chart
    fig, ax = plt.subplots(figsize=(10, 8))
    
    metrics = ['Bandwidth\n(KB)', 'DB Writes', 'Avg Latency\n(ms)']
    
    baseline_values = [
        baseline.bytes_received[-1] / 1024 if baseline.bytes_received else 0,
        baseline.verifications[-1] if baseline.verifications else 0,
        sum(baseline.avg_latency) / len(baseline.avg_latency) if baseline.avg_latency else 0,
    ]
    
    h2a_values = [
        h2a.bytes_to_db[-1] / 1024 if h2a.bytes_to_db else 0,
        h2a.batches[-1] if h2a.batches else 0,
        sum(h2a.avg_latency) / len(h2a.avg_latency) if h2a.avg_latency else 0,
    ]
    
    x = range(len(metrics))
    width = 0.35
    
    bars1 = ax.bar([i - width/2 for i in x], baseline_values, width, 
                   label='Baseline', color='#ef4444')
    bars2 = ax.bar([i + width/2 for i in x], h2a_values, width, 
                   label='H2A', color='#22c55e')
    
    ax.set_ylabel('Value', fontsize=12)
    ax.set_title('H2A-PQC vs Baseline Comparison', fontsize=14)
    ax.set_xticks(x)
    ax.set_xticklabels(metrics)
    ax.legend()
    
    # Add value labels on bars
    for bar, val in zip(bars1, baseline_values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                f'{val:.1f}', ha='center', va='bottom', fontsize=9)
    for bar, val in zip(bars2, h2a_values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                f'{val:.1f}', ha='center', va='bottom', fontsize=9)
    
    plt.tight_layout()
    plt.savefig(output_dir / 'summary_comparison.png', dpi=150)
    plt.close()
    
    # Chart 5: Savings Pie Chart
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    
    # Bandwidth savings
    if comparison.bandwidth_reduction_percent > 0:
        sizes = [100 - comparison.bandwidth_reduction_percent, comparison.bandwidth_reduction_percent]
        colors = ['#ef4444', '#22c55e']
        labels = ['Transmitted', 'Saved']
        axes[0].pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%',
                   startangle=90, explode=(0, 0.05))
        axes[0].set_title('Bandwidth Savings')
    
    # DB Write savings
    if comparison.db_write_reduction_percent > 0:
        sizes = [100 - comparison.db_write_reduction_percent, comparison.db_write_reduction_percent]
        colors = ['#ef4444', '#22c55e']
        labels = ['Writes', 'Saved']
        axes[1].pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%',
                   startangle=90, explode=(0, 0.05))
        axes[1].set_title('Database Write Reduction')
    
    plt.tight_layout()
    plt.savefig(output_dir / 'savings_pie.png', dpi=150)
    plt.close()
    
    print(f"Charts saved to: {output_dir}")


def main():
    parser = argparse.ArgumentParser(description='H2A-PQC Benchmark Analysis')
    parser.add_argument('--baseline', '-b', type=Path, help='Baseline metrics CSV file')
    parser.add_argument('--h2a', '-h2a', type=Path, help='H2A metrics CSV file')
    parser.add_argument('--auto', action='store_true', help='Auto-detect latest results')
    parser.add_argument('--output', '-o', type=Path, default=OUTPUT_DIR, help='Output directory')
    parser.add_argument('--no-charts', action='store_true', help='Skip chart generation')
    
    args = parser.parse_args()
    
    # Find files
    if args.auto:
        baseline_file, h2a_file = find_latest_results()
        if not baseline_file or not h2a_file:
            print("Could not find both baseline and H2A result files")
            print(f"Looking in: {BENCHMARKS_DIR}")
            return
    else:
        baseline_file = args.baseline or BENCHMARKS_DIR / 'baseline_metrics.csv'
        h2a_file = args.h2a or BENCHMARKS_DIR / 'h2a_pqc_metrics.csv'
    
    if not baseline_file.exists():
        print(f"Baseline file not found: {baseline_file}")
        return
    if not h2a_file.exists():
        print(f"H2A file not found: {h2a_file}")
        return
    
    print(f"Loading baseline: {baseline_file}")
    print(f"Loading H2A: {h2a_file}")
    
    # Load data
    baseline = load_metrics_csv(baseline_file)
    h2a = load_metrics_csv(h2a_file)
    
    # Compare
    comparison = compare_results(baseline, h2a)
    
    # Generate report
    report = generate_text_report(comparison)
    print(report)
    
    # Save report
    args.output.mkdir(parents=True, exist_ok=True)
    report_file = args.output / f'comparison_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
    with open(report_file, 'w') as f:
        f.write(report)
    print(f"\nReport saved to: {report_file}")
    
    # Generate charts
    if not args.no_charts:
        generate_charts(comparison, args.output)


if __name__ == '__main__':
    main()
