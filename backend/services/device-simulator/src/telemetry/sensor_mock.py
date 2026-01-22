"""
H2A-PQC Sensor Telemetry Mock
==============================
Simulates various IoT sensor readings with realistic data patterns and anomaly injection.
"""

import random
import math
import logging
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum

# Setup logger
logger = logging.getLogger(__name__)


class SensorType(str, Enum):
    """Available sensor types"""
    TEMPERATURE = "temperature"
    HUMIDITY = "humidity"
    PRESSURE = "pressure"
    MOTION = "motion"
    LIGHT = "light"
    CO2 = "co2"
    VOLTAGE = "voltage"


@dataclass
class SensorConfig:
    """Configuration for a sensor type"""
    sensor_type: SensorType
    unit: str
    min_value: float
    max_value: float
    normal_mean: float
    normal_std: float
    anomaly_multiplier: float = 2.0
    
    
# Default sensor configurations with realistic ranges
SENSOR_CONFIGS: Dict[SensorType, SensorConfig] = {
    SensorType.TEMPERATURE: SensorConfig(
        sensor_type=SensorType.TEMPERATURE,
        unit="celsius",
        min_value=-40.0,
        max_value=85.0,
        normal_mean=22.0,
        normal_std=3.0,
        anomaly_multiplier=3.0
    ),
    SensorType.HUMIDITY: SensorConfig(
        sensor_type=SensorType.HUMIDITY,
        unit="percent",
        min_value=0.0,
        max_value=100.0,
        normal_mean=45.0,
        normal_std=10.0
    ),
    SensorType.PRESSURE: SensorConfig(
        sensor_type=SensorType.PRESSURE,
        unit="hPa",
        min_value=870.0,
        max_value=1084.0,
        normal_mean=1013.25,
        normal_std=10.0
    ),
    SensorType.MOTION: SensorConfig(
        sensor_type=SensorType.MOTION,
        unit="boolean",
        min_value=0.0,
        max_value=1.0,
        normal_mean=0.1,  # 10% chance of motion
        normal_std=0.0
    ),
    SensorType.LIGHT: SensorConfig(
        sensor_type=SensorType.LIGHT,
        unit="lux",
        min_value=0.0,
        max_value=100000.0,
        normal_mean=500.0,
        normal_std=200.0
    ),
    SensorType.CO2: SensorConfig(
        sensor_type=SensorType.CO2,
        unit="ppm",
        min_value=400.0,
        max_value=5000.0,
        normal_mean=800.0,
        normal_std=100.0
    ),
    SensorType.VOLTAGE: SensorConfig(
        sensor_type=SensorType.VOLTAGE,
        unit="volts",
        min_value=0.0,
        max_value=5.0,
        normal_mean=3.3,
        normal_std=0.1
    ),
}


@dataclass
class SensorReading:
    """A single sensor reading with metadata"""
    sensor_id: str
    device_id: str
    sensor_type: str
    value: float
    unit: str
    timestamp: str
    sequence: int
    is_anomaly: bool = False
    quality: str = "good"  # good, degraded, bad
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return asdict(self)
    
    def to_bytes(self) -> bytes:
        """Convert to bytes for signing (compact JSON to match JavaScript)"""
        import json
        # Use separators=(',', ':') for compact JSON matching JavaScript's JSON.stringify
        return json.dumps(self.to_dict(), sort_keys=True, separators=(',', ':')).encode('utf-8')


class SensorMock:
    """
    Simulates IoT sensor readings with realistic patterns.
    
    Features:
    - Gaussian distribution for normal readings
    - Configurable anomaly injection
    - Time-based patterns (optional)
    - Multiple sensor types
    """
    
    def __init__(
        self,
        device_id: str,
        sensor_types: List[str],
        anomaly_rate: float = 0.05,
        seed: Optional[int] = None
    ):
        """
        Initialize the sensor mock.
        
        Args:
            device_id: The parent device identifier
            sensor_types: List of sensor types to simulate
            anomaly_rate: Probability of generating an anomaly (0.0 to 1.0)
            seed: Random seed for reproducibility
        """
        self.device_id = device_id
        self.anomaly_rate = anomaly_rate
        self._sequence = 0
        self._time_offset = 0.0
        
        if seed is not None:
            random.seed(seed)
        
        # Parse and validate sensor types
        self.sensors: Dict[str, SensorConfig] = {}
        for sensor_type_str in sensor_types:
            try:
                sensor_type = SensorType(sensor_type_str.lower())
                sensor_id = f"{sensor_type.value}-{device_id[-3:]}"
                self.sensors[sensor_id] = SENSOR_CONFIGS[sensor_type]
            except (ValueError, KeyError):
                # Skip unknown sensor types
                pass
        
        if not self.sensors:
            # Default to temperature and humidity if no valid sensors specified
            self.sensors = {
                f"temperature-{device_id[-3:]}": SENSOR_CONFIGS[SensorType.TEMPERATURE],
                f"humidity-{device_id[-3:]}": SENSOR_CONFIGS[SensorType.HUMIDITY],
            }
            logger.warning(f"No valid sensors specified for {device_id}, using defaults")
        
        logger.debug(f"SensorMock initialized: device={device_id}, sensors={list(self.sensors.keys())}")
    
    def _generate_value(self, config: SensorConfig, is_anomaly: bool) -> float:
        """Generate a sensor value based on configuration"""
        if config.sensor_type == SensorType.MOTION:
            # Motion is binary
            threshold = 0.3 if is_anomaly else config.normal_mean
            return 1.0 if random.random() < threshold else 0.0
        
        if is_anomaly:
            # Anomaly: value outside normal range
            direction = random.choice([-1, 1])
            deviation = config.normal_std * config.anomaly_multiplier
            value = config.normal_mean + (direction * deviation * (1 + random.random()))
        else:
            # Normal: Gaussian distribution
            value = random.gauss(config.normal_mean, config.normal_std)
        
        # Clamp to valid range
        return round(max(config.min_value, min(config.max_value, value)), 2)
    
    def _assess_quality(self, value: float, config: SensorConfig, is_anomaly: bool) -> str:
        """Assess the quality of a reading"""
        if is_anomaly:
            return "degraded"
        
        # Check if value is within 2 standard deviations
        deviation = abs(value - config.normal_mean) / config.normal_std if config.normal_std > 0 else 0
        
        if deviation <= 1:
            return "good"
        elif deviation <= 2:
            return "good"
        else:
            return "degraded"
    
    def read_sensor(self, sensor_id: Optional[str] = None) -> SensorReading:
        """
        Generate a single sensor reading.
        
        Args:
            sensor_id: Specific sensor to read, or None for first sensor
            
        Returns:
            SensorReading with simulated data
        """
        if sensor_id is None:
            sensor_id = next(iter(self.sensors.keys()))
        
        if sensor_id not in self.sensors:
            raise ValueError(f"Unknown sensor: {sensor_id}")
        
        config = self.sensors[sensor_id]
        self._sequence += 1
        
        # Determine if this is an anomaly
        is_anomaly = random.random() < self.anomaly_rate
        
        # Generate value
        value = self._generate_value(config, is_anomaly)
        quality = self._assess_quality(value, config, is_anomaly)
        
        reading = SensorReading(
            sensor_id=sensor_id,
            device_id=self.device_id,
            sensor_type=config.sensor_type.value,
            value=value,
            unit=config.unit,
            timestamp=datetime.now(timezone.utc).isoformat(),
            sequence=self._sequence,
            is_anomaly=is_anomaly,
            quality=quality
        )
        
        if is_anomaly:
            logger.debug(f"Anomaly generated: sensor={sensor_id}, value={value}")
        
        return reading
    
    def read_all_sensors(self) -> List[SensorReading]:
        """
        Generate readings from all configured sensors.
        
        Returns:
            List of SensorReading objects
        """
        readings = []
        for sensor_id in self.sensors:
            readings.append(self.read_sensor(sensor_id))
        return readings
    
    def get_sensor_ids(self) -> List[str]:
        """Get list of configured sensor IDs"""
        return list(self.sensors.keys())
    
    def get_sequence_number(self) -> int:
        """Get current sequence number"""
        return self._sequence


@dataclass
class TelemetryPayload:
    """Complete telemetry payload ready for transmission"""
    device_id: str
    tier: int
    readings: List[Dict[str, Any]]
    timestamp: str
    sequence: int
    batch_size: int
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)
    
    def to_bytes(self) -> bytes:
        """Convert to bytes for signing (compact JSON to match JavaScript)"""
        import json
        # Use separators=(',', ':') for compact JSON matching JavaScript's JSON.stringify
        return json.dumps(self.to_dict(), sort_keys=True, separators=(',', ':')).encode('utf-8')
    
    def get_payload_size(self) -> int:
        """Get the size of the payload in bytes"""
        return len(self.to_bytes())


def create_telemetry_payload(
    device_id: str,
    tier: int,
    readings: List[SensorReading],
    sequence: int
) -> TelemetryPayload:
    """
    Create a complete telemetry payload from sensor readings.
    
    Args:
        device_id: Device identifier
        tier: Device tier (1 or 2)
        readings: List of sensor readings
        sequence: Payload sequence number
        
    Returns:
        TelemetryPayload ready for transmission
    """
    return TelemetryPayload(
        device_id=device_id,
        tier=tier,
        readings=[r.to_dict() for r in readings],
        timestamp=datetime.now(timezone.utc).isoformat(),
        sequence=sequence,
        batch_size=len(readings)
    )


# Convenience function for backward compatibility
def read_sensor() -> dict:
    """Legacy function - returns a simple sensor reading dict"""
    mock = SensorMock("device-001", ["temperature", "humidity"])
    reading = mock.read_sensor()
    return reading.to_dict()

