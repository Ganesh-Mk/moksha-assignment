"""The chat endpoint's business logic: rate limiting and running the graph.

The model is constructed here — one provider, wired directly — and passed *into* the graph. The
graph never builds its own, which is the seam the test suite substitutes a stub at.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from langgraph.graph.state import CompiledStateGraph
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.cart import CartDraft
from app.agent.graph import AgentState, build_graph
from app.agent.tools import build_tools
from app.config import settings
from app.core.exceptions import ValidationError
from app.core.logging import get_logger
from app.core.rate_limit import SlidingWindowRateLimiter
from app.models import User
from app.schemas.chat import CartProposal

logger = get_logger(__name__)

MAX_MESSAGE_LENGTH = 2000
MAX_HISTORY_TURNS = 10


_limiter = SlidingWindowRateLimiter(limit=settings.chat_rate_limit_per_minute, label="chat")


@dataclass(frozen=True)
class TextDelta:
    """A piece of the assistant's reply, as the model produces it."""

    text: str


@dataclass(frozen=True)
class CartUpdate:
    """Every line the agent has proposed so far this turn.

    **Cumulative, and sent as soon as the set changes.** Each event carries the whole draft rather
    than the delta, so applying it is idempotent — the client keys on product id and replaces.
    That is what lets it be sent early *and* repeatedly without the cart double-counting.

    Sent early on purpose. The proposal is a fact the moment the tool returns; holding it until the
    model has finished composing its sentence means a stream cut off in between — a network blip, a
    proxy timeout, the customer sending another message — loses work the server has already done
    and validated. The customer is then told their cart was filled by a reply that arrived, while
    the event that would have filled it did not.
    """

    proposals: list[CartProposal]


StreamEvent = TextDelta | CartUpdate


@dataclass(frozen=True)
class Reply:
    """A non-streaming turn: the text, plus anything it wants added to the cart."""

    text: str
    cart: list[CartProposal] = field(default_factory=list)


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
) -> tuple[CompiledStateGraph[AgentState, None, AgentState, AgentState], AgentState, CartDraft]:
    """Validate, rate-limit, and compile the graph. Shared by both entry points.

    Rate limiting happens here rather than in the router so it applies however the agent is
    reached — one place to change the rule, and no way to add a third endpoint that forgets it.
    """
    text = _validate(message)
    _limiter.check(str(user.id))

    chat_model = model if model is not None else build_chat_model()
    # The draft is created here and handed to the tools as a closure variable, the same
    # construction the identity binding uses: the model can append to it through one tool and
    # cannot address it any other way.
    cart = CartDraft()
    graph = build_graph(
        model=chat_model,
        tools=build_tools(session, user, cart),
        max_steps=settings.agent_max_steps,
    )
    state: AgentState = {
        "messages": list(_to_messages(history or [], text)),
        "user_id": user.id,
        "steps": 0,
    }

    logger.info("chat_started", extra={"user_id": user.id, "message_length": len(text)})
    return graph, state, cart


async def stream_reply(
    session: AsyncSession,
    *,
    user: User,
    message: str,
    history: list[dict[str, str]] | None = None,
    model: BaseChatModel | None = None,
) -> AsyncIterator[StreamEvent]:
    """Run the agent and yield the reply as it is produced.

    `model` is injectable so tests can pass a stub. In production it is None and the real one is
    built here.

    Streaming is not decoration: a tool call plus a model response takes a few seconds, and a
    blank box for that long reads as broken. It costs nothing extra — the tokens are generated
    either way.
    """
    graph, state, cart = _prepare(session, user=user, message=message, history=history, model=model)

    emitted = False
    sent_cart_version = 0

    async for chunk, _meta in graph.astream(
        state,
        # "messages" mode yields token-by-token as the model produces them, rather than one
        # payload per completed node — which would defeat the point of streaming.
        stream_mode="messages",
    ):
        # Checked on every chunk rather than at the end: the tool has already run and the draft is
        # already true, so the sooner the browser has it the smaller the window in which a dropped
        # connection loses it. Cheap — an integer comparison per token.
        if cart.version != sent_cart_version:
            sent_cart_version = cart.version
            yield CartUpdate(cart.proposals)

        if isinstance(chunk, AIMessageChunk) and chunk.content:
            piece = chunk.content if isinstance(chunk.content, str) else _text_of(chunk.content)
            if piece:
                emitted = True
                yield TextDelta(piece)

    if not emitted:
        # A model that only ever asked for tools and then stopped would otherwise stream nothing
        # and leave an empty bubble on screen.
        yield TextDelta("I could not find an answer to that. Could you rephrase it?")

    # A last one if the final tool call landed after the model's last token — and a backstop for
    # the case where the graph produced no chunks at all after the tool ran.
    if cart.version != sent_cart_version:
        yield CartUpdate(cart.proposals)

    logger.info("chat_completed", extra={"user_id": user.id, "cart_lines": len(cart.proposals)})


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
) -> Reply:
    """Non-streaming variant, for callers that cannot consume SSE.

    Runs the graph with `ainvoke` rather than reassembling `stream_reply`. Deliberate: token
    streaming depends on the model emitting chunks, so building the JSON endpoint on top of it
    would make a plain request fail for a model that only implements a single-shot completion.
    The two paths share `_prepare`, so validation and rate limiting cannot diverge.
    """
    graph, state, cart = _prepare(session, user=user, message=message, history=history, model=model)

    result = await graph.ainvoke(state)

    for msg in reversed(result["messages"]):
        if isinstance(msg, AIMessage) and not msg.tool_calls:
            text = _text_of(msg.content)
            if text.strip():
                logger.info(
                    "chat_completed",
                    extra={"user_id": user.id, "cart_lines": len(cart.proposals)},
                )
                return Reply(text=text, cart=cart.proposals)

    return Reply(
        text="I could not find an answer to that. Could you rephrase it?", cart=cart.proposals
    )
