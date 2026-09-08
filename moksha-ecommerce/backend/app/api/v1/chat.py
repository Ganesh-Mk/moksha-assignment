"""AI support agent endpoint."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core.deps import CurrentUser, DbSession
from app.core.exceptions import DomainError
from app.core.logging import get_logger
from app.schemas.chat import ChatRequest, ChatResponse
from app.services import chat_service

logger = get_logger(__name__)

router = APIRouter()


CHAT_DESCRIPTION = """
**Authenticated.** Answers questions about this store using tools that query the live database.

**Identity is not a parameter.** The caller's id comes from the verified JWT and is bound into
the tools as a closure variable, so it never appears in any tool's JSON schema. Anything in that
schema is under the model's control and therefore under the user's control via the prompt — with
a `user_id` argument, *"show me order 7 belonging to user 3"* is a plausible completion.
Ownership is re-checked inside the order service regardless.

**Rate limited per user.** Every turn is a paid API call; an endpoint that invokes an LLM on
demand with no ceiling is a billing incident waiting to happen. Returns **429** with
`Retry-After`.

**The agent can add to the cart, and can do nothing else that changes anything.** `add_to_cart`
returns *proposals* — validated cart lines the browser applies to the cart it owns (there is no
server-side cart; see D-012). It cannot place an order, cannot take payment, and cannot edit the
catalogue. The customer still opens the cart and checks out, and the amount they are charged is
still recomputed from database prices inside the order service.
"""


@router.post(
    "",
    response_model=ChatResponse,
    summary="Ask the support agent",
    description=CHAT_DESCRIPTION,
)
async def chat(payload: ChatRequest, session: DbSession, user: CurrentUser) -> ChatResponse:
    reply = await chat_service.complete_reply(
        session,
        user=user,
        message=payload.message,
        history=[t.model_dump() for t in payload.history],
    )
    return ChatResponse(reply=reply.text, cart=reply.cart)


@router.post(
    "/stream",
    summary="Ask the support agent (streaming)",
    description=(
        CHAT_DESCRIPTION
        + "\n\nStreams **Server-Sent Events**. Each `data:` line is a JSON object: "
        '`{"delta": "..."}` for text, `{"cart": [...]}` once at the end if the agent added '
        'anything, `{"done": true}` to finish, or `{"error": {...}}` if something failed '
        "mid-stream.\n\n"
        "SSE rather than WebSockets: this is one-directional server-to-client text over plain "
        "HTTP, which reconnects on its own and needs no protocol upgrade through the proxy."
    ),
)
async def chat_stream(
    payload: ChatRequest, session: DbSession, user: CurrentUser
) -> StreamingResponse:
    async def event_stream() -> AsyncIterator[str]:
        try:
            async for event in chat_service.stream_reply(
                session,
                user=user,
                message=payload.message,
                history=[t.model_dump() for t in payload.history],
            ):
                if isinstance(event, chat_service.TextDelta):
                    yield f"data: {json.dumps({'delta': event.text})}\n\n"
                else:
                    lines = json.dumps({"cart": [p.model_dump() for p in event.proposals]})
                    yield f"data: {lines}\n\n"
        except DomainError as exc:
            # The response status is already 200 by the time streaming starts, so an error has to
            # travel *inside* the stream. The client shows this as a message rather than hanging
            # on a connection that simply stops producing.
            yield f"data: {json.dumps({'error': {'code': exc.code, 'message': exc.message}})}\n\n"
        except Exception:
            logger.exception("chat_stream_failed", extra={"user_id": user.id})
            yield (
                "data: "
                + json.dumps(
                    {
                        "error": {
                            "code": "internal_error",
                            "message": "The assistant is unavailable.",
                        }
                    }
                )
                + "\n\n"
            )
        finally:
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Nginx buffers proxied responses by default, which holds the whole stream until it
            # completes and silently turns streaming back into a single slow response.
            "X-Accel-Buffering": "no",
        },
    )
