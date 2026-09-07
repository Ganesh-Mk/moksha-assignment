"""Structured JSON logging with a request-scoped correlation id.

Every log line emitted while handling a request carries the same `request_id`, and that id is
returned to the client in the `X-Request-ID` header. A user reporting "my checkout failed" can
hand over one id that pulls up the entire request server-side — including the Stripe call and
the agent's tool calls, because the contextvar propagates into every `await` beneath the handler.
"""

from __future__ import annotations

import logging
import sys
from contextvars import ContextVar
from typing import Any

from pythonjsonlogger import json as jsonlogger

from app.config import settings

# ContextVar rather than a thread-local: the app is async, so many requests share one thread.
_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
_user_id: ContextVar[int | None] = ContextVar("user_id", default=None)


def set_request_context(request_id: str, user_id: int | None = None) -> None:
    _request_id.set(request_id)
    if user_id is not None:
        _user_id.set(user_id)


def set_log_user(user_id: int) -> None:
    """Attach the authenticated user to every subsequent log line in this request."""
    _user_id.set(user_id)


def current_request_id() -> str | None:
    return _request_id.get()


class ContextFilter(logging.Filter):
    """Injects the request-scoped ids into every record, so call sites never pass them."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get()
        record.user_id = _user_id.get()
        return True


class _Formatter(jsonlogger.JsonFormatter):
    def add_fields(
        self,
        log_record: dict[str, Any],
        record: logging.LogRecord,
        message_dict: dict[str, Any],
    ) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record["level"] = record.levelname
        log_record["logger"] = record.name
        log_record.setdefault("request_id", getattr(record, "request_id", None))
        log_record.setdefault("user_id", getattr(record, "user_id", None))
        # Timestamps in UTC ISO-8601 so log aggregation across regions sorts correctly.
        log_record["timestamp"] = self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z")


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_Formatter("%(timestamp)s %(level)s %(logger)s %(message)s"))
    handler.addFilter(ContextFilter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(settings.log_level.upper())

    # uvicorn installs its own handlers; hand its records to ours so access logs are JSON too.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers = []
        logger.propagate = True

    # SQLAlchemy's engine logger is extremely chatty at INFO and drowns the useful lines.
    logging.getLogger("sqlalchemy.engine").setLevel("WARNING")

    # httpx logs a line per outbound call. Useful in a debugger, noise in every request log —
    # and it fires for our own test client too, which doubles every line in the suite output.
    for noisy in ("httpx", "httpx2", "httpcore", "urllib3"):
        logging.getLogger(noisy).setLevel("WARNING")


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
