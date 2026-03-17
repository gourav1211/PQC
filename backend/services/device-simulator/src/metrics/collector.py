"""
H2A-PQC Device Metrics Collector
=================================
Collects, aggregates, and reports performance metrics from device operations.
"""

import time
import logging
import statistics
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from collections import deque

# Setup logger
logger = logging.getLogger(__name__)


@dataclass
class DeviceMetrics:
    """
    Comprehensive metrics for a single telemetry cycle.
    """
    # Timing metrics
    sign_time_ms: float = 0.0
    kem_time_ms: float = 0.0
    total_crypto_time_ms: float = 0.0
    
    # Size metrics
    payload_size_bytes: int = 0
    signature_size_bytes: int = 0
    total_transmission_bytes: int = 0
    
    # CPU and energy
    cpu_time_ms: float = 0.0
    estimated_energy_mj: float = 0.0  # millijoules
    
    # Operation info
    operation_type: str = ""  # 'sign' or 'kem'
    algorithm: str = ""
    success: bool = True
    error: Optional[str] = None
    
    # Timestamps
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    sequence: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return asdict(self)


@dataclass
class AggregatedMetrics:
    """
    Aggregated metrics over a time window.
    """
    # Time window
    window_start: str = ""
    window_end: str = ""
    sample_count: int = 0
    
    # Timing statistics (ms)
    avg_crypto_time_ms: float = 0.0
    min_crypto_time_ms: float = 0.0
    max_crypto_time_ms: float = 0.0
    std_crypto_time_ms: float = 0.0
    
    # Size statistics (bytes)
    total_payload_bytes: int = 0
    total_signature_bytes: int = 0
    avg_payload_size: float = 0.0
    
    # Energy statistics (millijoules)
    total_energy_mj: float = 0.0
    avg_energy_mj: float = 0.0
    
    # Success rate
    success_count: int = 0
    failure_count: int = 0
    success_rate: float = 0.0
    
    # Device info
    device_id: str = ""
    device_tier: int = 0
    algorithm: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return asdict(self)


class MetricsCollector:
    """
    Collects and aggregates device performance metrics.
    
    Features:
    - Rolling window for recent metrics
    - Statistical aggregation
    - Energy estimation
    - Export for transmission to gateway
    """
    
    # Energy estimation constants
    DEFAULT_VOLTAGE_V = 3.3
    DEFAULT_CURRENT_MA = 50.0
    
    def __init__(
        self,
        device_id: str,
        device_tier: int,
        max_samples: int = 1000,
        voltage_v: float = DEFAULT_VOLTAGE_V,
        current_ma: float = DEFAULT_CURRENT_MA
    ):
        """
        Initialize the metrics collector.
        
        Args:
            device_id: Device identifier
            device_tier: Device tier (1 or 2)
            max_samples: Maximum samples to retain in rolling window
            voltage_v: Operating voltage for energy estimation
            current_ma: Current draw for energy estimation
        """
        self.device_id = device_id
        self.device_tier = device_tier
        self.voltage_v = voltage_v
        self.current_ma = current_ma
        
        # Rolling window of metrics
        self._metrics: deque[DeviceMetrics] = deque(maxlen=max_samples)
        
        # Sequence counter
        self._sequence = 0
        
        # Session start time
        self._session_start = datetime.now(timezone.utc)
        
        # Cumulative counters
        self._total_success = 0
        self._total_failure = 0
        self._total_bytes_sent = 0
        self._total_energy_mj = 0.0
    
    def estimate_energy(self, cpu_time_ms: float) -> float:
        """
        Estimate energy consumption from CPU time.
        
        Formula: E = V × I × T
        
        Args:
            cpu_time_ms: CPU time in milliseconds
            
        Returns:
            Estimated energy in millijoules
        """
        time_seconds = cpu_time_ms / 1000.0
        energy_mj = self.voltage_v * self.current_ma * time_seconds
        return round(energy_mj, 4)
    
    def record_crypto_operation(
        self,
        operation_type: str,
        algorithm: str,
        duration_ms: float,
        cpu_time_ms: float,
        input_size_bytes: int,
        output_size_bytes: int,
        success: bool = True,
        error: Optional[str] = None
    ) -> DeviceMetrics:
        """
        Record a cryptographic operation.
        
        Args:
            operation_type: 'sign' or 'kem'
            algorithm: Algorithm used
            duration_ms: Wall-clock duration in ms
            cpu_time_ms: CPU time in ms
            input_size_bytes: Size of input data
            output_size_bytes: Size of output (signature/ciphertext)
            success: Whether operation succeeded
            error: Error message if failed
            
        Returns:
            The recorded DeviceMetrics
        """
        self._sequence += 1
        
        # Estimate energy
        energy_mj = self.estimate_energy(cpu_time_ms)
        
        # Create metrics record
        metrics = DeviceMetrics(
            sign_time_ms=duration_ms if operation_type == 'sign' else 0.0,
            kem_time_ms=duration_ms if operation_type == 'kem' else 0.0,
            total_crypto_time_ms=duration_ms,
            payload_size_bytes=input_size_bytes,
            signature_size_bytes=output_size_bytes,
            total_transmission_bytes=input_size_bytes + output_size_bytes,
            cpu_time_ms=cpu_time_ms,
            estimated_energy_mj=energy_mj,
            operation_type=operation_type,
            algorithm=algorithm,
            success=success,
            error=error,
            sequence=self._sequence
        )
        
        # Add to rolling window
        self._metrics.append(metrics)
        
        # Update cumulative counters
        if success:
            self._total_success += 1
        else:
            self._total_failure += 1
        
        self._total_bytes_sent += metrics.total_transmission_bytes
        self._total_energy_mj += energy_mj
        
        if not success:
            logger.warning(f"Crypto operation failed: {operation_type}, error={error}")
        
        return metrics
    
    def get_recent_metrics(self, count: int = 10) -> List[DeviceMetrics]:
        """Get the most recent metrics records"""
        return list(self._metrics)[-count:]
    
    def get_aggregated_metrics(self, last_n: Optional[int] = None) -> AggregatedMetrics:
        """
        Get aggregated statistics over recent samples.
        
        Args:
            last_n: Number of samples to aggregate (None = all)
            
        Returns:
            AggregatedMetrics with statistical summaries
        """
        if not self._metrics:
            return AggregatedMetrics(
                device_id=self.device_id,
                device_tier=self.device_tier
            )
        
        samples = list(self._metrics)
        if last_n is not None:
            samples = samples[-last_n:]
        
        if not samples:
            return AggregatedMetrics(
                device_id=self.device_id,
                device_tier=self.device_tier
            )
        
        # Extract timing data
        crypto_times = [m.total_crypto_time_ms for m in samples]
        
        # Calculate statistics
        avg_crypto = statistics.mean(crypto_times) if crypto_times else 0.0
        min_crypto = min(crypto_times) if crypto_times else 0.0
        max_crypto = max(crypto_times) if crypto_times else 0.0
        std_crypto = statistics.stdev(crypto_times) if len(crypto_times) > 1 else 0.0
        
        # Size totals
        total_payload = sum(m.payload_size_bytes for m in samples)
        total_sig = sum(m.signature_size_bytes for m in samples)
        
        # Energy totals
        total_energy = sum(m.estimated_energy_mj for m in samples)
        
        # Success/failure counts
        successes = sum(1 for m in samples if m.success)
        failures = len(samples) - successes
        
        # Get algorithm from most recent
        algorithm = samples[-1].algorithm if samples else ""
        
        return AggregatedMetrics(
            window_start=samples[0].timestamp,
            window_end=samples[-1].timestamp,
            sample_count=len(samples),
            avg_crypto_time_ms=round(avg_crypto, 3),
            min_crypto_time_ms=round(min_crypto, 3),
            max_crypto_time_ms=round(max_crypto, 3),
            std_crypto_time_ms=round(std_crypto, 3),
            total_payload_bytes=total_payload,
            total_signature_bytes=total_sig,
            avg_payload_size=round(total_payload / len(samples), 2),
            total_energy_mj=round(total_energy, 4),
            avg_energy_mj=round(total_energy / len(samples), 4),
            success_count=successes,
            failure_count=failures,
            success_rate=round(successes / len(samples) * 100, 2),
            device_id=self.device_id,
            device_tier=self.device_tier,
            algorithm=algorithm
        )
    
    def get_session_summary(self) -> Dict[str, Any]:
        """Get summary of the entire session"""
        now = datetime.now(timezone.utc)
        duration = (now - self._session_start).total_seconds()
        
        return {
            "device_id": self.device_id,
            "device_tier": self.device_tier,
            "session_start": self._session_start.isoformat(),
            "session_duration_seconds": round(duration, 2),
            "total_operations": self._total_success + self._total_failure,
            "successful_operations": self._total_success,
            "failed_operations": self._total_failure,
            "success_rate_percent": round(
                self._total_success / max(1, self._total_success + self._total_failure) * 100, 2
            ),
            "total_bytes_sent": self._total_bytes_sent,
            "total_energy_mj": round(self._total_energy_mj, 4),
            "avg_operations_per_second": round(
                (self._total_success + self._total_failure) / max(1, duration), 2
            ),
            "current_metrics": self.get_aggregated_metrics(last_n=100).to_dict()
        }
    
    def reset(self):
        """Reset all metrics and counters"""
        logger.info(f"Resetting metrics for device {self.device_id}")
        self._metrics.clear()
        self._sequence = 0
        self._session_start = datetime.now(timezone.utc)
        self._total_success = 0
        self._total_failure = 0
        self._total_bytes_sent = 0
        self._total_energy_mj = 0.0
