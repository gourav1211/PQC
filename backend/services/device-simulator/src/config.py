"""
H2A-PQC Device Simulator Configuration
=======================================
Configuration management using Pydantic for type validation and environment variable loading.
"""

import os
import logging
from enum import Enum
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings

# Setup logger
logger = logging.getLogger(__name__)


class DeviceTier(str, Enum):
    """Device capability tiers"""
    TIER_1_CONSTRAINED = "tier1"  # KEM-only authentication (ultra-low power)
    TIER_2_CAPABLE = "tier2"      # Full signature generation


class PQCAlgorithm(str, Enum):
    """Supported Post-Quantum Cryptography algorithms"""
    # Digital Signatures (Tier 2)
    DILITHIUM2 = "Dilithium2"
    DILITHIUM3 = "Dilithium3"
    DILITHIUM5 = "Dilithium5"
    
    # Key Encapsulation Mechanisms (Tier 1)
    KYBER512 = "Kyber512"
    KYBER768 = "Kyber768"
    KYBER1024 = "Kyber1024"


class SensorType(str, Enum):
    """Available sensor types for simulation"""
    TEMPERATURE = "temperature"
    HUMIDITY = "humidity"
    PRESSURE = "pressure"
    MOTION = "motion"
    LIGHT = "light"


class DeviceConfig(BaseSettings):
    """
    Device Simulator Configuration
    
    All settings can be overridden via environment variables.
    """
    
    # Device Identity
    device_id: str = Field(
        default="device-001",
        description="Unique identifier for this device"
    )
    device_tier: DeviceTier = Field(
        default=DeviceTier.TIER_2_CAPABLE,
        description="Device capability tier (1=constrained, 2=capable)"
    )
    
    # Gateway Connection
    gateway_url: str = Field(
        default="http://localhost:4000",
        description="Edge gateway URL for telemetry submission"
    )
    gateway_timeout_seconds: int = Field(
        default=30,
        description="HTTP request timeout in seconds"
    )
    
    # Telemetry Settings
    telemetry_interval_ms: int = Field(
        default=1000,
        description="Interval between telemetry transmissions in milliseconds"
    )
    batch_size: int = Field(
        default=1,
        description="Number of readings to batch before sending"
    )
    
    # PQC Configuration
    pqc_algorithm: str = Field(
        default="Dilithium2",
        description="Post-quantum algorithm to use"
    )
    
    # Metrics & Debugging
    enable_metrics: bool = Field(
        default=True,
        description="Enable performance metrics collection"
    )
    log_level: str = Field(
        default="INFO",
        description="Logging level (DEBUG, INFO, WARNING, ERROR)"
    )
    
    # Sensor Simulation
    sensor_types: str = Field(
        default="temperature,humidity",
        description="Comma-separated list of sensor types to simulate"
    )
    anomaly_rate: float = Field(
        default=0.05,
        description="Probability of generating anomalous readings (0.0-1.0)"
    )
    
    # Energy Estimation Constants (for simulated battery drain)
    voltage_v: float = Field(
        default=3.3,
        description="Simulated device operating voltage"
    )
    current_ma: float = Field(
        default=50.0,
        description="Simulated device current draw during crypto operations"
    )
    
    class Config:
        env_prefix = ""  # No prefix, use exact env var names
        case_sensitive = False
        
    def get_sensor_type_list(self) -> list[str]:
        """Parse sensor types from comma-separated string"""
        return [s.strip() for s in self.sensor_types.split(",")]
    
    def get_algorithm_for_tier(self) -> str:
        """Get appropriate algorithm based on device tier"""
        if self.device_tier == DeviceTier.TIER_1_CONSTRAINED:
            # Tier 1 uses KEM for authentication
            if self.pqc_algorithm.startswith("Kyber"):
                return self.pqc_algorithm
            return PQCAlgorithm.KYBER512.value
        else:
            # Tier 2 uses digital signatures
            if self.pqc_algorithm.startswith("Dilithium"):
                return self.pqc_algorithm
            return PQCAlgorithm.DILITHIUM2.value
    
    def is_signature_mode(self) -> bool:
        """Check if device uses signature-based authentication"""
        return self.device_tier == DeviceTier.TIER_2_CAPABLE
    
    def is_kem_mode(self) -> bool:
        """Check if device uses KEM-based authentication"""
        return self.device_tier == DeviceTier.TIER_1_CONSTRAINED


# Global configuration instance
config = DeviceConfig()


def get_config() -> DeviceConfig:
    """Get the global configuration instance"""
    return config


def reload_config() -> DeviceConfig:
    """Reload configuration from environment variables"""
    global config
    config = DeviceConfig()
    logger.info(f"Config reloaded: device_id={config.device_id}, tier={config.device_tier.value}")
    return config

