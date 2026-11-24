"""
Limitador de peticiones (Rate Limiter) y protección anti-fuerza bruta por IP + cuenta.

Sin dependencias externas: usa ventanas deslizantes en memoria con limpieza automática.
Protege /chat, /documents/upload, /auth y /tools contra abuso de cuota y ataques DoS.
"""

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional, Tuple
from fastapi import HTTPException, Request, status
from app.core.config import settings


def get_trusted_client_ip(request: Optional[Request]) -> str:
    """
    Obtiene la IP del cliente minimizando suplantación de cabeceras X-Forwarded-For.
    En producción detrás de Render (proxy inverso único), toma la última IP añadida por el proxy;
    en desarrollo local utiliza directamente request.client.host.
    """
    if not request:
        return "unknown"
    if settings.ENVIRONMENT == "production":
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            parts = [p.strip() for p in forwarded.split(",") if p.strip()]
            if parts:
                # El último salto previo al proxy confiable no puede ser falsificado por el cliente
                return parts[-1][:64]
    return (request.client.host if request.client else "unknown")[:64]


class SlidingWindowRateLimiter:
    """Limitador por ventana deslizante en memoria (thread-safe)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._buckets: Dict[str, Deque[float]] = defaultdict(deque)
        self._last_gc = time.monotonic()

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()

    def check(
        self,
        key: str,
        limit: int,
        window_seconds: int = 60,
        bypass_in_test: bool = True,
    ) -> None:
        if bypass_in_test and settings.ENVIRONMENT == "test":
            return

        now = time.monotonic()
        with self._lock:
            # Limpieza periódica de buckets inactivos para evitar crecimiento indefinido de RAM
            if now - self._last_gc > 300:
                stale_keys = [
                    k for k, dq in self._buckets.items()
                    if not dq or (now - dq[-1]) > 3600
                ]
                for k in stale_keys:
                    del self._buckets[k]
                self._last_gc = now

            bucket = self._buckets[key]
            cutoff = now - window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= limit:
                retry_after = max(1, int(window_seconds - (now - bucket[0])) + 1)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Has superado el límite temporal de solicitudes. Intenta nuevamente en {retry_after} segundos.",
                    headers={"Retry-After": str(retry_after)},
                )
            bucket.append(now)


class IpAccountLockoutTracker:
    """
    Bloqueo anti-fuerza bruta por par (correo + IP):
    impide que un atacante bloquee la cuenta de una víctima desde una IP externa,
    mientras sigue bloqueando tras 5 intentos fallidos desde la misma IP.
    """

    def __init__(self, max_attempts: int = 5, lockout_seconds: int = 15 * 60) -> None:
        self.max_attempts = max_attempts
        self.lockout_seconds = lockout_seconds
        self._lock = threading.Lock()
        self._attempts: Dict[Tuple[str, str], Tuple[int, float]] = {}

    def reset(self) -> None:
        with self._lock:
            self._attempts.clear()

    def check_locked(self, email: str, ip_key: str) -> Optional[int]:
        """Retorna los minutos restantes si (email, ip_key) está bloqueado, o None."""
        now = time.monotonic()
        pair = (email.lower(), ip_key or "unknown")
        with self._lock:
            rec = self._attempts.get(pair)
            if not rec:
                return None
            count, locked_until = rec
            if locked_until > now:
                return max(1, int((locked_until - now) // 60) + 1)
            if locked_until > 0 and locked_until <= now:
                del self._attempts[pair]
            return None

    def register_failure(self, email: str, ip_key: str) -> Tuple[int, bool]:
        """Registra un fallo para (email, ip_key). Retorna (conteo_actual, quedo_bloqueado)."""
        now = time.monotonic()
        pair = (email.lower(), ip_key or "unknown")
        with self._lock:
            count, locked_until = self._attempts.get(pair, (0, 0.0))
            if locked_until > 0 and locked_until <= now:
                count = 0
                locked_until = 0.0
            count += 1
            if count >= self.max_attempts:
                self._attempts[pair] = (0, now + self.lockout_seconds)
                return self.max_attempts, True
            self._attempts[pair] = (count, 0.0)
            return count, False

    def clear(self, email: str, ip_key: str) -> None:
        pair = (email.lower(), ip_key or "unknown")
        with self._lock:
            self._attempts.pop(pair, None)


rate_limiter = SlidingWindowRateLimiter()
login_lockout_tracker = IpAccountLockoutTracker(max_attempts=5, lockout_seconds=15 * 60)
