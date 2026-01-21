#!/usr/bin/env python3
"""
H2A-PQC Benchmark Runner
========================

Orchestrates benchmark experiments for comparing Baseline vs H2A modes.
Manages Docker containers, collects metrics, and exports results.

Usage:
    python runner.py --scenario baseline
    python runner.py --scenario h2a
    python runner.py --scenario all
"""

import argparse
import asyncio
import json
import logging
import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import aiohttp
import csv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('benchmark_run.log')
    ]
)
logger = logging.getLogger(__name__)

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
SCENARIOS_DIR = Path(__file__).parent / 'scenarios'
BENCHMARKS_DIR = Path(__file__).parent / 'benchmarks'
INFRA_DIR = PROJECT_ROOT / 'infra'


@dataclass
class ExperimentConfig:
    """Experiment configuration from JSON scenario file."""
    name: str
    mode: str
    devices: Dict
    telemetry: Dict
    experiment: Dict
    metrics_collection: Dict
    aggregation: Optional[Dict] = None
    description: str = ""
    expected_results: Optional[Dict] = None


@dataclass
class MetricsSnapshot:
    """Single metrics snapshot during experiment."""
    timestamp: float
    verifications: int
    bytes_received: int
    bytes_to_db: int
    batches: int
    avg_latency_ms: float
    active_devices: int
    mode: str


@dataclass
class ExperimentResult:
    """Complete experiment results."""
    scenario_name: str
    mode: str
    start_time: datetime
    end_time: datetime
    duration_seconds: float
    snapshots: List[MetricsSnapshot] = field(default_factory=list)
    
    # Aggregated metrics
    total_verifications: int = 0
    total_bytes_received: int = 0
    total_bytes_to_db: int = 0
    total_batches: int = 0
    avg_latency_ms: float = 0.0
    bandwidth_reduction_percent: float = 0.0
    db_write_reduction_percent: float = 0.0


class BenchmarkRunner:
    """
    Orchestrates H2A-PQC benchmark experiments.
    """
    
    def __init__(self, gateway_url: str = 'http://localhost:4000'):
        self.gateway_url = gateway_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.running = False
        self.current_result: Optional[ExperimentResult] = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    def load_scenario(self, scenario_name: str) -> ExperimentConfig:
        """Load scenario configuration from JSON file."""
        # Map scenario names to files
        scenario_files = {
            'baseline': 'no_aggregation.json',
            'no_aggregation': 'no_aggregation.json',
            'h2a': 'llas_enabled.json',
            'llas_enabled': 'llas_enabled.json',
            'high_load': 'high_load.json',
        }
        
        filename = scenario_files.get(scenario_name, f'{scenario_name}.json')
        filepath = SCENARIOS_DIR / filename
        
        if not filepath.exists():
            raise FileNotFoundError(f"Scenario file not found: {filepath}")
            
        with open(filepath, 'r') as f:
            data = json.load(f)
            
        logger.info(f"Loaded scenario: {data.get('name', scenario_name)}")
        return ExperimentConfig(**data)
    
    async def wait_for_gateway(self, timeout: int = 60) -> bool:
        """Wait for gateway to be ready."""
        logger.info("Waiting for gateway to be ready...")
        start = time.time()
        
        while time.time() - start < timeout:
            try:
                async with self.session.get(f"{self.gateway_url}/health") as resp:
                    if resp.status == 200:
                        logger.info("Gateway is ready")
                        return True
            except aiohttp.ClientError:
                pass
            await asyncio.sleep(1)
            
        logger.error("Gateway did not become ready in time")
        return False
    
    async def set_mode(self, mode: str) -> bool:
        """Set gateway operation mode (baseline/h2a)."""
        try:
            async with self.session.post(
                f"{self.gateway_url}/api/mode",
                json={"mode": mode}
            ) as resp:
                if resp.status == 200:
                    logger.info(f"Set mode to: {mode}")
                    return True
                else:
                    logger.error(f"Failed to set mode: {await resp.text()}")
                    return False
        except aiohttp.ClientError as e:
            logger.error(f"Error setting mode: {e}")
            return False
    
    async def collect_metrics(self) -> Optional[MetricsSnapshot]:
        """Collect current metrics from gateway."""
        try:
            async with self.session.get(f"{self.gateway_url}/api/metrics/throughput") as resp:
                if resp.status != 200:
                    return None
                throughput = await resp.json()
                
            async with self.session.get(f"{self.gateway_url}/api/metrics/bandwidth") as resp:
                if resp.status != 200:
                    return None
                bandwidth = await resp.json()
                
            async with self.session.get(f"{self.gateway_url}/api/metrics/aggregation") as resp:
                if resp.status != 200:
                    return None
                aggregation = await resp.json()
                
            async with self.session.get(f"{self.gateway_url}/api/devices") as resp:
                if resp.status != 200:
                    devices = []
                else:
                    devices = await resp.json()
                    
            async with self.session.get(f"{self.gateway_url}/api/mode") as resp:
                if resp.status != 200:
                    mode = "unknown"
                else:
                    mode_data = await resp.json()
                    mode = mode_data.get('mode', 'unknown')
                
            return MetricsSnapshot(
                timestamp=time.time(),
                verifications=throughput.get('totals', {}).get('verifications', 0),
                bytes_received=bandwidth.get('modeComparison', {}).get(mode, {}).get('bytes', 0),
                bytes_to_db=aggregation.get('totalBytesToDb', 0),
                batches=aggregation.get('batchCount', 0),
                avg_latency_ms=float(throughput.get('latency', {}).get('avg', 0)),
                active_devices=len([d for d in devices if d.get('status') == 'active']),
                mode=mode
            )
        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")
            return None
    
    async def reset_metrics(self) -> bool:
        """Reset gateway metrics for fresh experiment."""
        try:
            async with self.session.post(f"{self.gateway_url}/api/metrics/reset") as resp:
                if resp.status == 200:
                    logger.info("Metrics reset successfully")
                    return True
                # If endpoint doesn't exist, that's okay
                return True
        except aiohttp.ClientError:
            # Reset endpoint may not exist
            return True
    
    def start_containers(self, config: ExperimentConfig) -> bool:
        """Start Docker containers for experiment."""
        logger.info("Starting Docker containers...")
        
        # Set environment variables for device count
        env = os.environ.copy()
        env['TIER1_DEVICES'] = str(config.devices.get('tier1', {}).get('count', 4))
        env['TIER2_DEVICES'] = str(config.devices.get('tier2', {}).get('count', 2))
        env['MODE'] = config.mode
        
        if config.aggregation:
            env['AGGREGATION_ENABLED'] = 'true'
            env['BATCH_SIZE'] = str(config.aggregation.get('batch_size', 50))
            env['BATCH_TIMEOUT_MS'] = str(config.aggregation.get('timeout_ms', 5000))
        else:
            env['AGGREGATION_ENABLED'] = 'false'
        
        try:
            result = subprocess.run(
                ['docker-compose', 'up', '-d'],
                cwd=INFRA_DIR,
                env=env,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode != 0:
                logger.error(f"Docker compose failed: {result.stderr}")
                return False
                
            logger.info("Containers started successfully")
            return True
        except subprocess.TimeoutExpired:
            logger.error("Docker compose timed out")
            return False
        except Exception as e:
            logger.error(f"Error starting containers: {e}")
            return False
    
    def stop_containers(self) -> bool:
        """Stop Docker containers."""
        logger.info("Stopping Docker containers...")
        
        try:
            result = subprocess.run(
                ['docker-compose', 'down'],
                cwd=INFRA_DIR,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                logger.warning(f"Docker compose down warning: {result.stderr}")
                
            logger.info("Containers stopped")
            return True
        except Exception as e:
            logger.error(f"Error stopping containers: {e}")
            return False
    
    async def run_experiment(self, config: ExperimentConfig) -> ExperimentResult:
        """Run a complete benchmark experiment."""
        logger.info(f"Starting experiment: {config.name}")
        logger.info(f"Mode: {config.mode}")
        logger.info(f"Duration: {config.experiment['duration_seconds']}s")
        
        result = ExperimentResult(
            scenario_name=config.name,
            mode=config.mode,
            start_time=datetime.now(),
            end_time=datetime.now(),
            duration_seconds=config.experiment['duration_seconds']
        )
        self.current_result = result
        self.running = True
        
        try:
            # Wait for gateway
            if not await self.wait_for_gateway():
                raise RuntimeError("Gateway not available")
            
            # Set mode
            if not await self.set_mode(config.mode):
                raise RuntimeError("Failed to set mode")
            
            # Reset metrics
            await self.reset_metrics()
            
            # Warmup period
            warmup = config.experiment.get('warmup_seconds', 30)
            logger.info(f"Warmup period: {warmup}s")
            await asyncio.sleep(warmup)
            
            # Main experiment loop
            duration = config.experiment['duration_seconds']
            sample_rate = config.metrics_collection.get('sample_rate_ms', 100) / 1000
            start_time = time.time()
            
            logger.info(f"Running experiment for {duration}s...")
            
            while self.running and (time.time() - start_time) < duration:
                snapshot = await self.collect_metrics()
                if snapshot:
                    result.snapshots.append(snapshot)
                    
                    # Progress log every 30 seconds
                    elapsed = int(time.time() - start_time)
                    if elapsed % 30 == 0 and elapsed > 0:
                        logger.info(f"Progress: {elapsed}/{duration}s - "
                                  f"Verifications: {snapshot.verifications}, "
                                  f"Batches: {snapshot.batches}")
                
                await asyncio.sleep(sample_rate)
            
            # Cooldown period
            cooldown = config.experiment.get('cooldown_seconds', 10)
            logger.info(f"Cooldown period: {cooldown}s")
            await asyncio.sleep(cooldown)
            
            # Final metrics collection
            final_snapshot = await self.collect_metrics()
            if final_snapshot:
                result.snapshots.append(final_snapshot)
                result.total_verifications = final_snapshot.verifications
                result.total_bytes_received = final_snapshot.bytes_received
                result.total_bytes_to_db = final_snapshot.bytes_to_db
                result.total_batches = final_snapshot.batches
                result.avg_latency_ms = final_snapshot.avg_latency_ms
            
            result.end_time = datetime.now()
            
            # Calculate reductions
            if result.total_bytes_received > 0:
                result.bandwidth_reduction_percent = (
                    (result.total_bytes_received - result.total_bytes_to_db) 
                    / result.total_bytes_received * 100
                )
            
            if result.total_verifications > 0 and result.total_batches > 0:
                result.db_write_reduction_percent = (
                    (result.total_verifications - result.total_batches)
                    / result.total_verifications * 100
                )
            
            logger.info(f"Experiment completed: {config.name}")
            logger.info(f"Total verifications: {result.total_verifications}")
            logger.info(f"Bandwidth reduction: {result.bandwidth_reduction_percent:.1f}%")
            
            return result
            
        except Exception as e:
            logger.error(f"Experiment failed: {e}")
            raise
        finally:
            self.running = False
    
    def export_results(self, result: ExperimentResult, filename: Optional[str] = None):
        """Export experiment results to CSV."""
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"{result.mode}_metrics_{timestamp}.csv"
            
        filepath = BENCHMARKS_DIR / filename
        BENCHMARKS_DIR.mkdir(exist_ok=True)
        
        # Export snapshots
        with open(filepath, 'w', newline='') as f:
            writer = csv.writer(f)
            
            # Header
            writer.writerow([
                'timestamp', 'elapsed_seconds', 'verifications', 'bytes_received',
                'bytes_to_db', 'batches', 'avg_latency_ms', 'active_devices', 'mode'
            ])
            
            # Data rows
            if result.snapshots:
                start_ts = result.snapshots[0].timestamp
                for snapshot in result.snapshots:
                    writer.writerow([
                        snapshot.timestamp,
                        snapshot.timestamp - start_ts,
                        snapshot.verifications,
                        snapshot.bytes_received,
                        snapshot.bytes_to_db,
                        snapshot.batches,
                        snapshot.avg_latency_ms,
                        snapshot.active_devices,
                        snapshot.mode
                    ])
        
        logger.info(f"Results exported to: {filepath}")
        
        # Also export summary
        summary_file = BENCHMARKS_DIR / f"{result.mode}_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        summary = {
            'scenario_name': result.scenario_name,
            'mode': result.mode,
            'start_time': result.start_time.isoformat(),
            'end_time': result.end_time.isoformat(),
            'duration_seconds': result.duration_seconds,
            'total_verifications': result.total_verifications,
            'total_bytes_received': result.total_bytes_received,
            'total_bytes_to_db': result.total_bytes_to_db,
            'total_batches': result.total_batches,
            'avg_latency_ms': result.avg_latency_ms,
            'bandwidth_reduction_percent': result.bandwidth_reduction_percent,
            'db_write_reduction_percent': result.db_write_reduction_percent,
            'snapshot_count': len(result.snapshots)
        }
        
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
            
        logger.info(f"Summary exported to: {summary_file}")
        
        return filepath


async def run_benchmark(scenario: str, skip_docker: bool = False):
    """Run a single benchmark scenario."""
    async with BenchmarkRunner() as runner:
        config = runner.load_scenario(scenario)
        
        if not skip_docker:
            if not runner.start_containers(config):
                logger.error("Failed to start containers")
                return None
            
            # Wait for containers to initialize
            await asyncio.sleep(10)
        
        try:
            result = await runner.run_experiment(config)
            runner.export_results(result)
            return result
        finally:
            if not skip_docker:
                runner.stop_containers()


async def run_all_benchmarks(skip_docker: bool = False):
    """Run baseline and H2A benchmarks for comparison."""
    results = {}
    
    # Run baseline first
    logger.info("=" * 60)
    logger.info("Running BASELINE experiment")
    logger.info("=" * 60)
    results['baseline'] = await run_benchmark('baseline', skip_docker)
    
    # Brief pause between experiments
    await asyncio.sleep(5)
    
    # Run H2A
    logger.info("=" * 60)
    logger.info("Running H2A experiment")
    logger.info("=" * 60)
    results['h2a'] = await run_benchmark('h2a', skip_docker)
    
    # Print comparison
    if results['baseline'] and results['h2a']:
        print("\n" + "=" * 60)
        print("BENCHMARK COMPARISON")
        print("=" * 60)
        print(f"{'Metric':<30} {'Baseline':>15} {'H2A':>15}")
        print("-" * 60)
        print(f"{'Total Verifications':<30} {results['baseline'].total_verifications:>15} {results['h2a'].total_verifications:>15}")
        print(f"{'Total Batches':<30} {results['baseline'].total_batches:>15} {results['h2a'].total_batches:>15}")
        print(f"{'Bytes Received':<30} {results['baseline'].total_bytes_received:>15} {results['h2a'].total_bytes_received:>15}")
        print(f"{'Bytes to DB':<30} {results['baseline'].total_bytes_to_db:>15} {results['h2a'].total_bytes_to_db:>15}")
        print(f"{'Avg Latency (ms)':<30} {results['baseline'].avg_latency_ms:>15.2f} {results['h2a'].avg_latency_ms:>15.2f}")
        print(f"{'Bandwidth Reduction %':<30} {results['baseline'].bandwidth_reduction_percent:>14.1f}% {results['h2a'].bandwidth_reduction_percent:>14.1f}%")
        print("=" * 60)
    
    return results


def main():
    parser = argparse.ArgumentParser(description='H2A-PQC Benchmark Runner')
    parser.add_argument(
        '--scenario', '-s',
        choices=['baseline', 'h2a', 'high_load', 'all'],
        default='all',
        help='Benchmark scenario to run'
    )
    parser.add_argument(
        '--skip-docker',
        action='store_true',
        help='Skip Docker container management (assume already running)'
    )
    parser.add_argument(
        '--gateway-url',
        default='http://localhost:4000',
        help='Gateway URL'
    )
    
    args = parser.parse_args()
    
    # Handle signals
    def signal_handler(sig, frame):
        logger.info("Received interrupt signal, stopping...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run benchmark
    if args.scenario == 'all':
        asyncio.run(run_all_benchmarks(args.skip_docker))
    else:
        asyncio.run(run_benchmark(args.scenario, args.skip_docker))


if __name__ == '__main__':
    main()
