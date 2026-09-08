"""A sliding-window rate limiter, shared by the endpoints that need one.

Extracted from `chat_service` when a second caller appeared. Two users of one implementation is
the point at which a copy stops being cheaper than a shared module — and the second caller here
is a password endpoint, where getting the limiting wrong has worse consequences than a large
Anthropic bill.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

from app.core.exceptions import RateLimitError
from app.core.logging import get_logger

logger = get_logger(__name__)


class SlidingWindowRateLimiter:
    """Counts requests per key over a rolling window.

    **In-process, and that is a deliberate limitation with a stated fix.** State lives in a dict,
    so with more than one API instance each gets its own allowance. The production answer is Redis
    with the same logic — one `ZADD`/`ZCOUNT` per request against a shared counter.

    It is here rather than absent because the alternatives are worse: an uncapped LLM endpoint is
    a billing incident waiting to be noticed, and an uncapped password endpoint is a brute-force
    target. A single-instance limit is not perfect; it is the difference between a bounded and an
    unbounded exposure.

    The window genuinely slides — entries outside it are dropped before counting. A fixed window
    resets on a boundary, which lets a caller spend a whole allowance twice in quick succession
    either side of it.
    """

    def __init__(self, *, limit: int, window_seconds: int = 60, label: str = "request") -> None:
        self._limit = limit
        self._window = window_seconds
        self._label = label
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, *, message: str | None = None) -> None:
        """Record one hit for `key`, or raise `RateLimitError` if it is over the limit."""
        now = time.monotonic()
        hits = self._hits[key]

        while hits and now - hits[0] > self._window:
            hits.popleft()

        if len(hits) >= self._limit:
            retry_after = int(self._window - (now - hits[0])) + 1
            # The key is logged, not the credential that may have accompanied it.
            logger.warning("rate_limited", extra={"limiter": self._label, "key": key})
            raise RateLimitError(
                message or f"Too many attempts. Please wait {retry_after} seconds.",
                retry_after_seconds=retry_after,
            )

        hits.append(now)

    def reset(self, key: str) -> None:
        """Clear a key's history — called after a success, so one bad guess costs nothing."""
        self._hits.pop(key, None)
