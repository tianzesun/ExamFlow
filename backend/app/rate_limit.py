"""Rate limits for sign-in, uploads, paper generation and the public QR check.

Counts are kept in memory in each server process (a sliding window per person or address).
With several workers each keeps its own count, so the effective limit is up to the worker
count times the figure here; these are guards against abuse and runaway scripts, not quotas.
"""

import math
import threading
import time
from collections import deque

from fastapi import Depends, HTTPException, Request, status

from app.auth import get_current_user
from app.config import get_settings
from app.models.user import User

_lock = threading.Lock()
_hits: dict[tuple[str, str], deque[float]] = {}
_last_sweep = 0.0
SWEEP_EVERY_SECONDS = 300


def client_address(request: Request) -> str:
    # Behind a proxy, run uvicorn with --proxy-headers so this is the browser's address.
    return request.client.host if request.client else "unknown"


def _sweep(now: float) -> None:
    """Forget keys idle for longer than any window, so memory doesn't grow without bound."""
    global _last_sweep
    if now - _last_sweep < SWEEP_EVERY_SECONDS:
        return
    _last_sweep = now
    for key in [k for k, q in _hits.items() if not q or now - q[-1] > SWEEP_EVERY_SECONDS * 4]:
        del _hits[key]


def hit(bucket: str, who: str, limit: int, window_seconds: int) -> None:
    """Count one request; raise 429 when `who` has made `limit` in the last window."""
    if not get_settings().RATE_LIMITS_ENABLED:
        return
    now = time.monotonic()
    with _lock:
        _sweep(now)
        q = _hits.setdefault((bucket, who), deque())
        while q and now - q[0] >= window_seconds:
            q.popleft()
        if len(q) >= limit:
            retry = max(1, math.ceil(window_seconds - (now - q[0])))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Wait a moment and try again.",
                headers={"Retry-After": str(retry)},
            )
        q.append(now)


def per_user(bucket: str, limit: int, window_seconds: int):
    """Route dependency: at most `limit` requests per signed-in user in the window."""
    def dependency(user: User = Depends(get_current_user)) -> None:
        hit(bucket, str(user.id), limit, window_seconds)
    return dependency


def per_address(bucket: str, limit: int, window_seconds: int):
    """Route dependency for routes used without signing in: limit per client address."""
    def dependency(request: Request) -> None:
        hit(bucket, client_address(request), limit, window_seconds)
    return dependency


def reset() -> None:
    """Forget every count (tests)."""
    with _lock:
        _hits.clear()
