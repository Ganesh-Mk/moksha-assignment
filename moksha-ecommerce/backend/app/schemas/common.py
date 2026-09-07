"""Shared response shapes."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Page[T](BaseModel):
    """A page of results with the metadata a client needs to paginate.

    Offset pagination rather than cursor: the catalogue is small, admins want to jump to page 5,
    and `total` lets the UI render a real page count. Cursor pagination is the right answer for a
    large, frequently-mutating feed — the trade-off is worth stating out loud rather than
    reaching for whichever one is fashionable.
    """

    items: list[T]
    total: int = Field(description="Total rows matching the filter, ignoring pagination.")
    limit: int
    offset: int

    @property
    def has_more(self) -> bool:
        return self.offset + len(self.items) < self.total


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, object] | None = None


class ErrorResponse(BaseModel):
    """The single error shape every failure uses, documented once in OpenAPI.

    `request_id` matches the `X-Request-ID` response header, so a user reporting a failure can
    quote one value that pulls up the whole server-side trace.
    """

    error: ErrorDetail
    request_id: str | None = None
