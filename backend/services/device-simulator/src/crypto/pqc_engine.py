"""
H2A-PQC Cryptographic Engine
=============================
Post-Quantum Cryptography operations using liboqs (Open Quantum Safe).

Supports:
- Digital Signatures: Dilithium (ML-DSA) for Tier 2 devices
- Key Encapsulation: Kyber (ML-KEM) for Tier 1 devices (KEM-Trick)
"""

import time
import json
import base64
import logging
from dataclasses import dataclass, asdict
from typing import Tuple, Optional
from datetime import datetime, timezone

# Setup logger
logger = logging.getLogger(__name__)

# Import liboqs for PQC operations
try:
    import oqs
    LIBOQS_AVAILABLE = True
    logger.info("liboqs loaded successfully")
except ImportError:
    LIBOQS_AVAILABLE = False
    logger.warning("liboqs not available. Using mock cryptographic operations.")


@dataclass
class CryptoMetrics:
    """Metrics collected during cryptographic operations"""
    operation: str                    # 'sign', 'verify', 'kem_encapsulate', 'kem_decapsulate'
    algorithm: str                    # Algorithm used (e.g., 'Dilithium2')
    start_time_ns: int               # Operation start time (nanoseconds)
    end_time_ns: int                 # Operation end time (nanoseconds)
    duration_ms: float               # Duration in milliseconds
    cpu_time_ms: float               # CPU time consumed
    input_size_bytes: int            # Size of input data
    output_size_bytes: int           # Size of output (signature/ciphertext)
    success: bool                    # Whether operation succeeded
    error: Optional[str] = None      # Error message if failed
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return asdict(self)
    
    def estimate_energy_mj(self, voltage_v: float = 3.3, current_ma: float = 50.0) -> float:
        """
        Estimate energy consumption in millijoules.
        
        Formula: E = V × I × T
        Where:
            E = Energy (millijoules)
            V = Voltage (volts)
            I = Current (milliamps)
            T = Time (seconds)
        """
        time_seconds = self.duration_ms / 1000.0
        energy_mj = voltage_v * current_ma * time_seconds
        return round(energy_mj, 4)


class PQCEngine:
    """
    Post-Quantum Cryptography Engine
    
    Provides cryptographic operations for both Tier 1 (KEM) and Tier 2 (Signature) devices.
    All operations are instrumented with timing metrics for benchmarking.
    """
    
    # Algorithm mappings for liboqs
    # Note: liboqs 0.15.0+ uses FIPS 204 names (ML-DSA) instead of Dilithium
    SIGNATURE_ALGORITHMS = {
        # Legacy names map to new FIPS 204 names
        "Dilithium2": "ML-DSA-44",
        "Dilithium3": "ML-DSA-65",
        "Dilithium5": "ML-DSA-87",
        # ML-DSA (FIPS 204) names - direct mapping
        "ML-DSA-44": "ML-DSA-44",
        "ML-DSA-65": "ML-DSA-65",
        "ML-DSA-87": "ML-DSA-87",
    }
    
    KEM_ALGORITHMS = {
        # Legacy Kyber names still supported in liboqs 0.15.0
        "Kyber512": "Kyber512",
        "Kyber768": "Kyber768",
        "Kyber1024": "Kyber1024",
        # ML-KEM (FIPS 203) names - also supported
        "ML-KEM-512": "ML-KEM-512",
        "ML-KEM-768": "ML-KEM-768",
        "ML-KEM-1024": "ML-KEM-1024",
    }
    
    def __init__(self, algorithm: str, tier):
        """
        Initialize the PQC Engine.
        
        Args:
            algorithm: PQC algorithm name (e.g., 'Dilithium2', 'Kyber512')
            tier: Device tier (1, 2, "tier1", or "tier2")
                  1 or "tier1" = KEM mode
                  2 or "tier2" = Signature mode
        """
        self.tier = tier
        self.algorithm = algorithm
        self.public_key: Optional[bytes] = None
        self.secret_key: Optional[bytes] = None
        
        logger.debug(f"Initializing PQCEngine: algorithm={algorithm}, tier={tier}")
        
        # Determine mode based on tier (handle both int and string values)
        self.is_signature_mode = tier == 2 or tier == "tier2"
        self.is_kem_mode = tier == 1 or tier == "tier1"
        
        # Resolve algorithm name
        if self.is_signature_mode:
            self.resolved_algorithm = self.SIGNATURE_ALGORITHMS.get(algorithm, "Dilithium2")
        else:
            self.resolved_algorithm = self.KEM_ALGORITHMS.get(algorithm, "Kyber512")
        
        # Initialize liboqs objects (lazily created during key generation)
        self._signer: Optional[oqs.Signature] = None if LIBOQS_AVAILABLE else None
        self._kem: Optional[oqs.KeyEncapsulation] = None if LIBOQS_AVAILABLE else None
        
    def generate_keypair(self) -> Tuple[bytes, bytes, CryptoMetrics]:
        """
        Generate a new keypair for the configured algorithm.
        
        Returns:
            Tuple of (public_key, secret_key, metrics)
        """
        start_cpu = time.process_time()
        start_ns = time.time_ns()
        
        try:
            if not LIBOQS_AVAILABLE:
                # Mock implementation for testing without liboqs
                self.public_key = b"mock_public_key_" + self.algorithm.encode()
                self.secret_key = b"mock_secret_key_" + self.algorithm.encode()
            elif self.is_signature_mode:
                self._signer = oqs.Signature(self.resolved_algorithm)
                self.public_key = self._signer.generate_keypair()
                self.secret_key = self._signer.export_secret_key()
            else:
                self._kem = oqs.KeyEncapsulation(self.resolved_algorithm)
                self.public_key = self._kem.generate_keypair()
                self.secret_key = self._kem.export_secret_key()
            
            end_ns = time.time_ns()
            end_cpu = time.process_time()
            
            metrics = CryptoMetrics(
                operation="keygen",
                algorithm=self.resolved_algorithm,
                start_time_ns=start_ns,
                end_time_ns=end_ns,
                duration_ms=(end_ns - start_ns) / 1_000_000,
                cpu_time_ms=(end_cpu - start_cpu) * 1000,
                input_size_bytes=0,
                output_size_bytes=len(self.public_key) + len(self.secret_key),
                success=True
            )
            
            logger.info(f"Keypair generated: algorithm={self.resolved_algorithm}, pk_size={len(self.public_key)}")
            return self.public_key, self.secret_key, metrics
            
        except Exception as e:
            end_ns = time.time_ns()
            end_cpu = time.process_time()
            
            metrics = CryptoMetrics(
                operation="keygen",
                algorithm=self.resolved_algorithm,
                start_time_ns=start_ns,
                end_time_ns=end_ns,
                duration_ms=(end_ns - start_ns) / 1_000_000,
                cpu_time_ms=(end_cpu - start_cpu) * 1000,
                input_size_bytes=0,
                output_size_bytes=0,
                success=False,
                error=str(e)
            )
            logger.error(f"Key generation failed: {e}")
            raise RuntimeError(f"Key generation failed: {e}") from e
    
    def sign(self, message: bytes) -> Tuple[bytes, CryptoMetrics]:
        """
        Sign a message using Dilithium (Tier 2 operation).
        
        Args:
            message: The message bytes to sign
            
        Returns:
            Tuple of (signature, metrics)
        """
        if not self.is_signature_mode:
            raise ValueError("Sign operation not available for Tier 1 (KEM) devices")
        
        if self.secret_key is None:
            raise ValueError("No secret key available. Call generate_keypair() first.")
        
        start_cpu = time.process_time()
        start_ns = time.time_ns()
        
        try:
            if not LIBOQS_AVAILABLE:
                # Mock signature for testing
                import hashlib
                mock_sig = hashlib.sha256(message + self.secret_key).digest()
                signature = b"mock_sig_" + mock_sig
            else:
                if self._signer is None:
                    self._signer = oqs.Signature(self.resolved_algorithm, self.secret_key)
                signature = self._signer.sign(message)
            
            end_ns = time.time_ns()
            end_cpu = time.process_time()
            
            metrics = CryptoMetrics(
                operation="sign",
                algorithm=self.resolved_algorithm,
                start_time_ns=start_ns,
                end_time_ns=end_ns,
                duration_ms=(end_ns - start_ns) / 1_000_000,
                cpu_time_ms=(end_cpu - start_cpu) * 1000,
                input_size_bytes=len(message),
                output_size_bytes=len(signature),
                success=True
            )
            
            logger.debug(f"Signed message: size={len(message)}, sig_size={len(signature)}, time={metrics.duration_ms:.2f}ms")
            return signature, metrics
            
        except Exception as e:
            end_ns = time.time_ns()
            end_cpu = time.process_time()
            
            metrics = CryptoMetrics(
                operation="sign",
                algorithm=self.resolved_algorithm,
                start_time_ns=start_ns,
                end_time_ns=end_ns,
                duration_ms=(end_ns - start_ns) / 1_000_000,
                cpu_time_ms=(end_cpu - start_cpu) * 1000,
                input_size_bytes=len(message),
                output_size_bytes=0,
                success=False,
                error=str(e)
            )
            logger.error(f"Signing failed: {e}")
            raise RuntimeError(f"Signing failed: {e}") from e
    
    def kem_encapsulate(self, recipient_public_key: bytes) -> Tuple[bytes, bytes, CryptoMetrics]:
        """
        Perform KEM encapsulation (Tier 1 KEM-Trick authentication).
        
        This generates a shared secret and ciphertext. The ability to
        decapsulate proves identity without expensive signature generation.
        
        Args:
            recipient_public_key: The recipient's public key
            
        Returns:
            Tuple of (ciphertext, shared_secret, metrics)
        """
        if not self.is_kem_mode:
            raise ValueError("KEM encapsulation not available for Tier 2 (Signature) devices")
        
        start_cpu = time.process_time()
        start_ns = time.time_ns()
        
        try:
            if not LIBOQS_AVAILABLE:
                # Mock KEM for testing
                import hashlib
                shared_secret = hashlib.sha256(recipient_public_key + b"shared").digest()
                ciphertext = b"mock_ciphertext_" + hashlib.sha256(recipient_public_key).digest()
            else:
                kem = oqs.KeyEncapsulation(self.resolved_algorithm)
                ciphertext, shared_secret = kem.encap_secret(recipient_public_key)
            
            end_ns = time.time_ns()
            end_cpu = time.process_time()
            
            metrics = CryptoMetrics(
                operation="kem_encapsulate",
                algorithm=self.resolved_algorithm,
                start_time_ns=start_ns,
                end_time_ns=end_ns,
                duration_ms=(end_ns - start_ns) / 1_000_000,
                cpu_time_ms=(end_cpu - start_cpu) * 1000,
                input_size_bytes=len(recipient_public_key),
                output_size_bytes=len(ciphertext) + len(shared_secret),
                success=True
            )
            
            logger.debug(f"KEM encapsulated: ct_size={len(ciphertext)}, time={metrics.duration_ms:.2f}ms")
            return ciphertext, shared_secret, metrics
            
        except Exception as e:
            end_ns = time.time_ns()
            end_cpu = time.process_time()
            
            metrics = CryptoMetrics(
                operation="kem_encapsulate",
                algorithm=self.resolved_algorithm,
                start_time_ns=start_ns,
                end_time_ns=end_ns,
                duration_ms=(end_ns - start_ns) / 1_000_000,
                cpu_time_ms=(end_cpu - start_cpu) * 1000,
                input_size_bytes=len(recipient_public_key),
                output_size_bytes=0,
                success=False,
                error=str(e)
            )
            logger.error(f"KEM encapsulation failed: {e}")
            raise RuntimeError(f"KEM encapsulation failed: {e}") from e
    
    def kem_decapsulate(self, ciphertext: bytes) -> Tuple[bytes, CryptoMetrics]:
        """
        Perform KEM decapsulation to recover shared secret.
        
        Args:
            ciphertext: The ciphertext from encapsulation
            
        Returns:
            Tuple of (shared_secret, metrics)
        """
        if self.secret_key is None:
            raise ValueError("No secret key available. Call generate_keypair() first.")
        
        start_cpu = time.process_time()
        start_ns = time.time_ns()
        
        try:
            if not LIBOQS_AVAILABLE:
                # Mock decapsulation
                import hashlib
                shared_secret = hashlib.sha256(ciphertext + self.secret_key).digest()
            else:
                if self._kem is None:
                    self._kem = oqs.KeyEncapsulation(self.resolved_algorithm, self.secret_key)
                shared_secret = self._kem.decap_secret(ciphertext)
            
            end_ns = time.time_ns()
            end_cpu = time.process_time()
            
            metrics = CryptoMetrics(
                operation="kem_decapsulate",
                algorithm=self.resolved_algorithm,
                start_time_ns=start_ns,
                end_time_ns=end_ns,
                duration_ms=(end_ns - start_ns) / 1_000_000,
                cpu_time_ms=(end_cpu - start_cpu) * 1000,
                input_size_bytes=len(ciphertext),
                output_size_bytes=len(shared_secret),
                success=True
            )
            
            return shared_secret, metrics
            
        except Exception as e:
            end_ns = time.time_ns()
            end_cpu = time.process_time()
            
            metrics = CryptoMetrics(
                operation="kem_decapsulate",
                algorithm=self.resolved_algorithm,
                start_time_ns=start_ns,
                end_time_ns=end_ns,
                duration_ms=(end_ns - start_ns) / 1_000_000,
                cpu_time_ms=(end_cpu - start_cpu) * 1000,
                input_size_bytes=len(ciphertext),
                output_size_bytes=0,
                success=False,
                error=str(e)
            )
            raise RuntimeError(f"KEM decapsulation failed: {e}") from e
    
    def get_public_key_b64(self) -> str:
        """Get the public key as base64 encoded string"""
        if self.public_key is None:
            raise ValueError("No public key available")
        return base64.b64encode(self.public_key).decode('utf-8')
    
    def get_algorithm_info(self) -> dict:
        """Get information about the configured algorithm"""
        info = {
            "algorithm": self.resolved_algorithm,
            "tier": self.tier,
            "mode": "signature" if self.is_signature_mode else "kem",
        }
        
        if LIBOQS_AVAILABLE:
            if self.is_signature_mode:
                sig = oqs.Signature(self.resolved_algorithm)
                info["public_key_size"] = sig.details["length_public_key"]
                info["secret_key_size"] = sig.details["length_secret_key"]
                info["signature_size"] = sig.details["length_signature"]
            else:
                kem = oqs.KeyEncapsulation(self.resolved_algorithm)
                info["public_key_size"] = kem.details["length_public_key"]
                info["secret_key_size"] = kem.details["length_secret_key"]
                info["ciphertext_size"] = kem.details["length_ciphertext"]
                info["shared_secret_size"] = kem.details["length_shared_secret"]
        
        return info


def get_available_algorithms() -> dict:
    """Get lists of available PQC algorithms"""
    if not LIBOQS_AVAILABLE:
        return {
            "signatures": list(PQCEngine.SIGNATURE_ALGORITHMS.keys()),
            "kems": list(PQCEngine.KEM_ALGORITHMS.keys()),
            "liboqs_available": False
        }
    
    return {
        "signatures": oqs.get_enabled_sig_mechanisms(),
        "kems": oqs.get_enabled_kem_mechanisms(),
        "liboqs_available": True
    }

