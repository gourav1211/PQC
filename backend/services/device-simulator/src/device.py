"""
H2A-PQC Device Simulator
=========================
Main device simulation logic for IoT devices with Post-Quantum Cryptography.

Supports two operational modes:
- Tier 1 (Constrained): KEM-based authentication (low-power devices)
- Tier 2 (Capable): Full Dilithium signature generation
"""

import asyncio
import signal
import sys
import json
import base64
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

import aiohttp
import structlog

from .config import get_config, DeviceConfig, DeviceTier
from .crypto.pqc_engine import PQCEngine, CryptoMetrics
from .telemetry.sensor_mock import SensorMock, create_telemetry_payload, TelemetryPayload
from .metrics.collector import MetricsCollector


# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.dev.ConsoleRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)


class DeviceSimulator:
    """
    IoT Device Simulator with PQC capabilities.
    
    Simulates a resource-constrained IoT device that:
    1. Generates sensor telemetry data
    2. Signs data with PQC algorithms (Tier 2) or uses KEM auth (Tier 1)
    3. Transmits data to the edge gateway
    4. Collects and reports performance metrics
    """
    
    def __init__(self, config: Optional[DeviceConfig] = None):
        """
        Initialize the device simulator.
        
        Args:
            config: Device configuration (uses default if not provided)
        """
        self.config = config or get_config()
        self.logger = structlog.get_logger().bind(
            device_id=self.config.device_id,
            tier=self.config.device_tier.value
        )
        
        # Initialize PQC engine based on tier
        algorithm = self.config.get_algorithm_for_tier()
        self.pqc_engine = PQCEngine(
            algorithm=algorithm,
            tier=self.config.device_tier.value
        )
        
        # Initialize sensor mock
        self.sensor_mock = SensorMock(
            device_id=self.config.device_id,
            sensor_types=self.config.get_sensor_type_list(),
            anomaly_rate=self.config.anomaly_rate
        )
        
        # Initialize metrics collector
        self.metrics_collector = MetricsCollector(
            device_id=self.config.device_id,
            device_tier=self.config.device_tier.value,
            voltage_v=self.config.voltage_v,
            current_ma=self.config.current_ma
        )
        
        # State
        self._running = False
        self._registered = False
        self._session: Optional[aiohttp.ClientSession] = None
        self._gateway_public_key: Optional[bytes] = None
        self._telemetry_count = 0
        
    async def start(self):
        """Start the device simulator"""
        self.logger.info("Starting device simulator",
                        algorithm=self.pqc_engine.resolved_algorithm,
                        mode="signature" if self.config.is_signature_mode() else "kem")
        
        # Generate keypair
        self.logger.info("Generating PQC keypair...")
        public_key, secret_key, keygen_metrics = self.pqc_engine.generate_keypair()
        self.logger.info("Keypair generated",
                        public_key_size=len(public_key),
                        duration_ms=keygen_metrics.duration_ms)
        
        # Create HTTP session
        timeout = aiohttp.ClientTimeout(total=self.config.gateway_timeout_seconds)
        self._session = aiohttp.ClientSession(timeout=timeout)
        
        # Set running flag
        self._running = True
        
        # Register with gateway
        await self._register_with_gateway()
        
        # Start telemetry loop
        await self._telemetry_loop()
    
    async def stop(self):
        """Stop the device simulator gracefully"""
        self.logger.info("Stopping device simulator...")
        self._running = False
        
        # Log session summary
        summary = self.metrics_collector.get_session_summary()
        self.logger.info("Session summary", **summary)
        
        # Close HTTP session
        if self._session:
            await self._session.close()
        
        self.logger.info("Device simulator stopped")
    
    async def _register_with_gateway(self) -> bool:
        """
        Register the device with the edge gateway.
        
        Sends public key and device metadata to establish identity.
        Two-phase registration: initiate -> complete
        """
        if not self._session:
            self.logger.error("No HTTP session available")
            return False
        
        # Build registration payload with camelCase keys matching gateway API
        registration_payload = {
            "deviceId": self.config.device_id,
            "tier": self.config.device_tier.value,
            "algorithm": self.pqc_engine.resolved_algorithm,
            "publicKey": self.pqc_engine.get_public_key_b64(),
            "capabilities": {
                "sensors": self.sensor_mock.get_sensor_ids(),
                "mode": "signature" if self.config.is_signature_mode() else "kem"
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Add KEM public key for tier1 devices
        if not self.config.is_signature_mode():
            registration_payload["kemPublicKey"] = self.pqc_engine.get_public_key_b64()
        
        try:
            # Phase 1: Initiate registration
            url = f"{self.config.gateway_url}/api/v1/register/initiate"
            self.logger.info("Initiating registration with gateway", url=url)
            
            async with self._session.post(url, json=registration_payload) as response:
                if response.status == 200 or response.status == 201:
                    data = await response.json()
                    
                    # Store gateway public key if provided (for KEM mode)
                    if "gateway_public_key" in data:
                        self._gateway_public_key = base64.b64decode(data["gateway_public_key"])
                    
                    self.logger.info("Registration initiated",
                                    status=response.status,
                                    registration_id=data.get("registrationId"))
                    
                    # Phase 2: Complete registration
                    registration_id = data.get("registrationId")
                    if registration_id:
                        return await self._complete_registration(registration_id, registration_payload)
                    else:
                        # Some gateways may auto-complete registration
                        self._registered = True
                        return True
                else:
                    text = await response.text()
                    self.logger.error("Registration initiation failed",
                                     status=response.status,
                                     response=text)
                    return False
                    
        except aiohttp.ClientError as e:
            self.logger.error("Registration request failed", error=str(e))
            # Continue anyway - gateway might not require registration
            self._registered = True
            return False
        except Exception as e:
            self.logger.error("Unexpected registration error", error=str(e))
            self._registered = True
            return False
    
    async def _complete_registration(self, registration_id: str, original_payload: Dict[str, Any]) -> bool:
        """
        Complete the registration process with the gateway.
        
        Args:
            registration_id: The registration ID from initiate phase
            original_payload: The original registration payload
        """
        try:
            url = f"{self.config.gateway_url}/api/v1/register/complete"
            
            # Build proof based on device tier
            if self.config.is_signature_mode():
                # Tier 2/3: Sign a message as proof
                message = f"registration:{registration_id}:{self.config.device_id}"
                signature, _ = self.pqc_engine.sign(message.encode('utf-8'))
                proof = {
                    "signature": base64.b64encode(signature).decode('utf-8'),
                    "message": message
                }
            else:
                # Tier 1: Provide shared secret (simplified for demo)
                proof = {
                    "sharedSecret": "demo_shared_secret"
                }
            
            complete_payload = {
                "registrationId": registration_id,
                "proof": proof,
                "publicKey": original_payload.get("publicKey"),
                "kemPublicKey": original_payload.get("kemPublicKey")
            }
            
            self.logger.info("Completing registration", registration_id=registration_id)
            
            async with self._session.post(url, json=complete_payload) as response:
                if response.status == 200:
                    data = await response.json()
                    self._registered = True
                    self.logger.info("Registration completed successfully",
                                    device_id=self.config.device_id,
                                    status=response.status)
                    return True
                else:
                    text = await response.text()
                    self.logger.error("Registration completion failed",
                                     status=response.status,
                                     response=text)
                    return False
                    
        except Exception as e:
            self.logger.error("Registration completion error", error=str(e))
            return False
    
    async def _telemetry_loop(self):
        """Main telemetry transmission loop"""
        interval_seconds = self.config.telemetry_interval_ms / 1000.0
        
        self.logger.info("Starting telemetry loop",
                        interval_ms=self.config.telemetry_interval_ms)
        
        while self._running:
            try:
                # Generate and send telemetry
                await self._send_telemetry()
                
                # Wait for next interval
                await asyncio.sleep(interval_seconds)
                
            except asyncio.CancelledError:
                self.logger.info("Telemetry loop cancelled")
                break
            except Exception as e:
                self.logger.error("Telemetry error", error=str(e))
                await asyncio.sleep(interval_seconds)
    
    async def _send_telemetry(self):
        """Generate, sign, and send a telemetry payload"""
        self._telemetry_count += 1
        
        # Generate sensor readings
        readings = self.sensor_mock.read_all_sensors()
        
        # Create telemetry payload
        payload = create_telemetry_payload(
            device_id=self.config.device_id,
            tier=self.config.device_tier.value,
            readings=readings,
            sequence=self._telemetry_count
        )
        
        payload_bytes = payload.to_bytes()
        payload_size = len(payload_bytes)
        
        # Sign or authenticate based on tier
        if self.config.is_signature_mode():
            # Tier 2: Full signature
            signature, crypto_metrics = self.pqc_engine.sign(payload_bytes)
            auth_data = {
                "type": "signature",
                "signature": base64.b64encode(signature).decode('utf-8'),
                "algorithm": self.pqc_engine.resolved_algorithm
            }
            output_size = len(signature)
        else:
            # Tier 1: KEM-based authentication
            if self._gateway_public_key:
                ciphertext, shared_secret, crypto_metrics = self.pqc_engine.kem_encapsulate(
                    self._gateway_public_key
                )
                auth_data = {
                    "type": "kem",
                    "ciphertext": base64.b64encode(ciphertext).decode('utf-8'),
                    "algorithm": self.pqc_engine.resolved_algorithm
                }
                output_size = len(ciphertext)
            else:
                # Fallback: Use a mock KEM if no gateway key
                # In production, this would fail - but for demo we'll use the device's own key
                ciphertext, shared_secret, crypto_metrics = self.pqc_engine.kem_encapsulate(
                    self.pqc_engine.public_key
                )
                auth_data = {
                    "type": "kem",
                    "ciphertext": base64.b64encode(ciphertext).decode('utf-8'),
                    "algorithm": self.pqc_engine.resolved_algorithm
                }
                output_size = len(ciphertext)
        
        # Record metrics
        device_metrics = self.metrics_collector.record_crypto_operation(
            operation_type="sign" if self.config.is_signature_mode() else "kem",
            algorithm=self.pqc_engine.resolved_algorithm,
            duration_ms=crypto_metrics.duration_ms,
            cpu_time_ms=crypto_metrics.cpu_time_ms,
            input_size_bytes=payload_size,
            output_size_bytes=output_size,
            success=crypto_metrics.success,
            error=crypto_metrics.error
        )
        
        # Build transmission payload with camelCase keys matching gateway API
        transmission_payload = {
            "deviceId": self.config.device_id,
            "tier": self.config.device_tier.value,
            "payload": payload.to_dict(),
            "signature": auth_data.get("signature") if auth_data.get("type") == "signature" else None,
            "auth": auth_data,
            "metrics": {
                "crypto_time_ms": crypto_metrics.duration_ms,
                "cpu_time_ms": crypto_metrics.cpu_time_ms,
                "payload_size_bytes": payload_size,
                "auth_size_bytes": output_size,
                "estimated_energy_mj": device_metrics.estimated_energy_mj,
                "sequence": self._telemetry_count
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Send to gateway
        await self._transmit_to_gateway(transmission_payload, device_metrics)
    
    async def _transmit_to_gateway(self, payload: Dict[str, Any], metrics):
        """Transmit telemetry payload to edge gateway"""
        if not self._session:
            self.logger.error("No HTTP session available")
            return
        
        try:
            url = f"{self.config.gateway_url}/api/v1/telemetry"
            
            async with self._session.post(url, json=payload) as response:
                if response.status == 200 or response.status == 201 or response.status == 202:
                    if self._telemetry_count % 10 == 0:  # Log every 10th
                        self.logger.info("Telemetry sent",
                                        sequence=self._telemetry_count,
                                        crypto_time_ms=round(metrics.total_crypto_time_ms, 2),
                                        size_bytes=metrics.total_transmission_bytes)
                else:
                    text = await response.text()
                    self.logger.warning("Telemetry rejected",
                                       status=response.status,
                                       response=text[:200])
                    
        except aiohttp.ClientError as e:
            self.logger.error("Transmission failed", error=str(e))
        except Exception as e:
            self.logger.error("Unexpected transmission error", error=str(e))
    
    def get_status(self) -> Dict[str, Any]:
        """Get current device status"""
        return {
            "device_id": self.config.device_id,
            "tier": self.config.device_tier.value,
            "algorithm": self.pqc_engine.resolved_algorithm,
            "mode": "signature" if self.config.is_signature_mode() else "kem",
            "registered": self._registered,
            "running": self._running,
            "telemetry_count": self._telemetry_count,
            "metrics": self.metrics_collector.get_aggregated_metrics(last_n=100).to_dict()
        }


# Global device instance for signal handling
_device: Optional[DeviceSimulator] = None


def signal_handler(signum, frame):
    """Handle shutdown signals"""
    if _device:
        asyncio.create_task(_device.stop())
    sys.exit(0)


async def run_device():
    """Main entry point for running the device simulator"""
    global _device
    
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Create and start device
    _device = DeviceSimulator()
    
    try:
        await _device.start()
    except KeyboardInterrupt:
        await _device.stop()
    except Exception as e:
        logging.error(f"Device error: {e}")
        await _device.stop()
        raise


def main():
    """Synchronous entry point"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    print("=" * 60)
    print("H2A-PQC Device Simulator")
    print("=" * 60)
    
    config = get_config()
    print(f"Device ID: {config.device_id}")
    print(f"Device Tier: {config.device_tier.value}")
    print(f"Algorithm: {config.get_algorithm_for_tier()}")
    print(f"Gateway: {config.gateway_url}")
    print(f"Interval: {config.telemetry_interval_ms}ms")
    print("=" * 60)
    
    asyncio.run(run_device())


if __name__ == "__main__":
    main()

