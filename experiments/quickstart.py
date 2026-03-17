#!/usr/bin/env python3
"""
Quick Start Script for H2A-PQC Benchmarks
=========================================

This script provides a simple way to run benchmarks and generate reports.
"""

import subprocess
import sys
from pathlib import Path

EXPERIMENTS_DIR = Path(__file__).parent


def install_dependencies():
    """Install required Python packages."""
    print("Installing dependencies...")
    subprocess.run([
        sys.executable, '-m', 'pip', 'install', '-r',
        str(EXPERIMENTS_DIR / 'requirements.txt')
    ], check=True)


def run_benchmarks(scenario='all', skip_docker=False):
    """Run benchmark experiments."""
    print(f"\n{'='*60}")
    print(f"Running benchmarks: {scenario}")
    print(f"{'='*60}\n")
    
    cmd = [sys.executable, str(EXPERIMENTS_DIR / 'runner.py'), '--scenario', scenario]
    if skip_docker:
        cmd.append('--skip-docker')
    
    subprocess.run(cmd)


def analyze_results():
    """Analyze and compare benchmark results."""
    print(f"\n{'='*60}")
    print("Analyzing results...")
    print(f"{'='*60}\n")
    
    subprocess.run([
        sys.executable,
        str(EXPERIMENTS_DIR / 'analysis' / 'compare.py'),
        '--auto'
    ])


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='H2A-PQC Quick Start')
    parser.add_argument('command', choices=['install', 'run', 'analyze', 'full'],
                       help='Command to execute')
    parser.add_argument('--scenario', '-s', default='all',
                       choices=['baseline', 'h2a', 'high_load', 'all'],
                       help='Benchmark scenario')
    parser.add_argument('--skip-docker', action='store_true',
                       help='Skip Docker management')
    
    args = parser.parse_args()
    
    if args.command == 'install':
        install_dependencies()
    elif args.command == 'run':
        run_benchmarks(args.scenario, args.skip_docker)
    elif args.command == 'analyze':
        analyze_results()
    elif args.command == 'full':
        install_dependencies()
        run_benchmarks(args.scenario, args.skip_docker)
        analyze_results()


if __name__ == '__main__':
    main()
