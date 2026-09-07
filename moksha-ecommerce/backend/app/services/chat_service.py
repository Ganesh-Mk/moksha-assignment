"""The chat endpoint's business logic: rate limiting and running the graph.

The model is constructed here — one provider, wired directly — and passed *into* the graph. The
graph never builds its own, which is the seam the test suite substitutes a stub at.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from collections.abc import AsyncIterator

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from langgraph.graph.state import CompiledStateGraph
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.graph import AgentState, build_graph
from app.agent.tools import build_tools
from app.config import settings
from app.core.exceptions import RateLimitError, ValidationError
from app.core.logging import get_logger
from app.models import User

logger = get_logger(__name__)

MAX_MESSAGE_LENGTH = 2000
MAX_HISTORY_TURNS = 10


class SlidingWindowRateLimiter:
    """Per-user request limiter over a one-minute sliding window.

    **In-process, and that is a deliberate limitation with a stated fix.** It holds state in a
    dict, so with more than one API instance each gets its own allowance. The production answer is
    Redis with the same sliding-window logic — a shared counter, one `ZADD`/`ZCOUNT` per request.

    It is here rather than absent because every agent turn is a paid API call, and an endpoint
    that will call an LLM on demand with no ceiling is a billing incident waiting for someone to
    notice it. A single-instance limit is not perfect; it is the difference between a bounded and
    an unbounded cost.
    """

    def __init__(self, *, limit: int, window_seconds: int = 60) -> None:
        self._limit = limit
        self._window = window_seconds
        self._hits: dict[int, deque[float]] = defaultdict(deque)

    def check(self, user_id: int) -> None:
        now = time.monotonic()
        hits = self._hits[user_id]

        # Drop everything outside the window before counting, so the window really does slide
        # rather than resetting on a fixed boundary — a fixed window lets a user spend their
        # whole allowance twice across the boundary in quick succession.
        while hits and now - hits[0] > self._window:
            hits.popleft()

        if len(hits) >= self._limit:
            retry_after = int(self._window - (now - hits[0])) + 1
            logger.warning("chat_rate_limited", extra={"user_id": user_id})
            raise RateLimitError(
                "You are sending messages faster than I can answer. "
                f"Please wait {retry_after} seconds.",
                retry_after_seconds=retry_after,
            )

        hits.append(now)


_limiter = SlidingWindowRateLimiter(limit=settings.chat_rate_limit_per_minute)


def build_chat_model() -> BaseChatModel:
    """Construct the Anthropic chat model.

    Called at request time, not import time, so `require_anthropic()` raises a 503 naming
    ANTHROPIC_API_KEY when the key is missing rather than crashing the whole process at startup.
    """
    from langchain_anthropic import ChatAnthropic

    return ChatAnthropic(
        # `model` is the field; `model_name` is its alias. Using the field name keeps this
        # type-checked rather than relying on populate-by-alias.
        model=settings.agent_model,
        api_key=SecretStr(settings.require_anthropic()),
        # Low but non-zero: this agent reports facts from tools, and creative variation in a
        # price or an order status is not a feature.
        temperature=0.2,
        max_tokens=1024,
        timeout=30,
        stop=None,
    )


def _to_messages(history: list[dict[str, str]], message: str) -> list[HumanMessage | AIMessage]:
    """Convert the client's transcript into LangChain messages.

    History is trimmed to the last few turns. Two reasons: cost grows with every token resent,
    and a long transcript is a larger surface for a customer to bury instructions in.
    """
    messages: list[HumanMessage | AIMessage] = []
    for turn in history[-MAX_HISTORY_TURNS * 2 :]:
        role = turn.get("role")
        content = (turn.get("content") or "")[:MAX_MESSAGE_LENGTH]
        if not content:
            continue
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
    messages.append(HumanMessage(content=message))
    return messages


def _validate(message: str) -> str:
    text = message.strip()
    if not text:
        raise ValidationError("Please type a message.")
    if len(text) > MAX_MESSAGE_LENGTH:
        raise ValidationError(f"Messages are limited to {MAX_MESSAGE_LENGTH} characters.")
    return text


def _prepare(
    session: AsyncSession,
    *,
    user: User,
    message: str,
    history: list[dict[str, str]] | None,
    model: BaseChatModel | None,
) -> tuple[CompiledStateGraph[AgentState, None, AgentState, AgentState], AgentState]:
    """Validate, rate-limit, and compile the graph. Shared by both entry points.

    Rate limiting happens here rather than in the router so it applies however the agent is
    reached — one place to change the rule, and no way to add a third endpoint that forgets it.
    """
    text = _validate(message)
    _limiter.check(user.id)

    chat_model = model if model is not None else build_chat_model()
    graph = build_graph(
        model=chat_model,
        tools=build_tools(session, user),
        max_steps=settings.agent_max_steps,
    )
    state: AgentState = {
        "messages": list(_to_messages(history or [], text)),
        "user_id": user.id,
        "steps": 0,
    }

    logger.info("chat_started", extra={"user_id": user.id, "message_length": len(text)})
    return graph, state


async def stream_reply(
    session: AsyncSession,
    *,
    user: User,
    message: str,
    history: list[dict[str, str]] | None = None,
    model: BaseChatModel | None = None,
) -> AsyncIterator[str]:
    """Run the agent and yield the reply as it is produced.

    `model` is injectable so tests can pass a stub. In production it is None and the real one is
    built here.

    Streaming is not decoration: a tool call plus a model response takes a few seconds, and a
    blank box for that long reads as broken. It costs nothing extra — the tokens are generated
    either way.
    """
    graph, state = _prepare(session, user=user, message=message, history=history, model=model)

    emitted = False
    async for chunk, _meta in graph.astream(
        state,
        # "messages" mode yields token-by-token as the model produces them, rather than one
        # payload per completed node — which would defeat the point of streaming.
        stream_mode="messages",
    ):
        if isinstance(chunk, AIMessageChunk) and chunk.content:
            piece = chunk.content if isinstance(chunk.content, str) else _text_of(chunk.content)
            if piece:
                emitted = True
                yield piece

    if not emitted:
        # A model that only ever asked for tools and then stopped would otherwise stream nothing
        # and leave an empty bubble on screen.
        yield "I could not find an answer to that. Could you rephrase it?"

    logger.info("chat_completed", extra={"user_id": user.id})


def _text_of(content: object) -> str:
    """Flatten Anthropic's structured content blocks to plain text.

    A streamed chunk's content can be a list of typed blocks rather than a string, and only the
    text blocks belong in the reply — tool-use blocks are the agent's internal plumbing.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        )
    return ""


async def complete_reply(
    session: AsyncSession,
    *,
    user: User,
    message: str,
    history: list[dict[str, str]] | None = None,
    model: BaseChatModel | None = None,
) -> str:
    """Non-streaming variant, for callers that cannot consume SSE.

    Runs the graph with `ainvoke` rather than reassembling `stream_reply`. Deliberate: token
    streaming depends on the model emitting chunks, so building the JSON endpoint on top of it
    would make a plain request fail for a model that only implements a single-shot completion.
    The two paths share `_prepare`, so validation and rate limiting cannot diverge.
    """
    graph, state = _prepare(session, user=user, message=message, history=history, model=model)

    result = await graph.ainvoke(state)

    for msg in reversed(result["messages"]):
        if isinstance(msg, AIMessage) and not msg.tool_calls:
            text = _text_of(msg.content)
            if text.strip():
                logger.info("chat_completed", extra={"user_id": user.id})
                return text

    return "I could not find an answer to that. Could you rephrase it?"
