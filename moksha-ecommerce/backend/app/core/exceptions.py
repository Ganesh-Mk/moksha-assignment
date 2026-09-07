"""Domain exceptions and the single place they become HTTP responses.

Services raise these. Services must never import `HTTPException` — a service that knows about
status codes is a service that cannot be called from anywhere except a router, which would
defeat the whole point of the agent calling services directly (see docs/DECISIONS.md D-003).

The mapping from domain error to status code lives in `install_exception_handlers` alone.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import ConfigurationError
from app.core.logging import current_request_id, get_logger

logger = get_logger(__name__)


class DomainError(Exception):
    """Base class for every expected, business-level failure."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "domain_error"

    def __init__(self, message: str, **details: Any) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ConflictError(DomainError):
    """The request is valid but conflicts with current state — e.g. a duplicate slug."""

    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class ValidationError(DomainError):
    # Literal 422: Starlette renamed this constant between versions and the name churn is not
    # worth a compatibility shim.
    status_code = 422
    code = "validation_error"


class AuthenticationError(DomainError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthenticated"


class ForbiddenError(DomainError):
    """403. Used only where the resource's existence is not itself a secret.

    For another user's *order* we deliberately raise NotFoundError instead — a 403 confirms the
    id exists and turns the endpoint into an enumeration oracle (D-007).
    """

    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


class InsufficientStockError(ConflictError):
    code = "insufficient_stock"

    def __init__(self, product_name: str, requested: int, available: int) -> None:
        super().__init__(
            f"Only {available} of “{product_name}” left — you asked for {requested}.",
            product_name=product_name,
            requested=requested,
            available=available,
        )


class InvalidStateTransitionError(ConflictError):
    code = "invalid_state_transition"

    def __init__(self, current: str, requested: str) -> None:
        super().__init__(
            f"An order cannot move from {current} to {requested}.",
            current=current,
            requested=requested,
        )


class RateLimitError(DomainError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"

    def __init__(self, message: str, retry_after_seconds: int) -> None:
        super().__init__(message, retry_after_seconds=retry_after_seconds)
        self.retry_after_seconds = retry_after_seconds


class PaymentError(DomainError):
    status_code = status.HTTP_402_PAYMENT_REQUIRED
    code = "payment_error"


class WebhookVerificationError(DomainError):
    """A webhook whose signature does not verify. Never process it; never 500 on it either."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "webhook_signature_invalid"


def _body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "error": {"code": code, "message": message},
        "request_id": current_request_id(),
    }
    if details:
        payload["error"]["details"] = details
    return payload


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain(_: Request, exc: DomainError) -> JSONResponse:
        headers = {}
        if isinstance(exc, RateLimitError):
            headers["Retry-After"] = str(exc.retry_after_seconds)
        if isinstance(exc, AuthenticationError):
            headers["WWW-Authenticate"] = "Bearer"
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(exc.code, exc.message, exc.details),
            headers=headers,
        )

    @app.exception_handler(ConfigurationError)
    async def _config(_: Request, exc: ConfigurationError) -> JSONResponse:
        # 503, not 500: the code is fine, the deployment is incomplete. The message names the
        # variable so the operator does not have to read source to find out which one.
        logger.error("feature_unconfigured", extra={"feature": exc.feature, "missing": exc.missing})
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=_body("feature_unconfigured", str(exc), {"missing": exc.missing}),
        )

    @app.exception_handler(RequestValidationError)
    async def _request_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_body(
                "validation_error",
                "Request body failed validation.",
                {"fields": [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]},
            ),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        # Log the trace, return nothing about it. Stack traces in responses leak file paths,
        # library versions and sometimes query fragments.
        logger.exception("unhandled_exception", extra={"exc_type": type(exc).__name__})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_body("internal_error", "Something went wrong on our side."),
        )
