"""Test doubles for the three external services.

Each one substitutes at a seam the production code already has, so tests exercise the *real*
application code path and only the network call is replaced. The suite therefore runs green with
no `GOOGLE_CLIENT_ID`, no `STRIPE_SECRET_KEY` and no `ANTHROPIC_API_KEY` present.

Where a fake would weaken a test, there is no fake:

* **Stripe signatures are verified with the real library.** `sign_stripe_payload` computes a
  genuine HMAC and `stripe.Webhook.construct_event` checks it against a test signing secret. A
  stubbed verifier would make the "rejects an unsigned webhook" test prove nothing at all.
* **Our own JWTs are real.** Only *Google's* verification is faked; every token the API issues
  and checks in a test is a genuinely signed JWT.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from collections.abc import AsyncIterator
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from pydantic import Field

from app.core.exceptions import AuthenticationError
from app.core.security import GoogleIdentity

# The signing secret used by webhook tests. Never read from the environment: the test must be
# self-contained, and a suite that behaves differently depending on which keys happen to be set
# is a suite you cannot trust.
TEST_WEBHOOK_SECRET = "whsec_test_secret_for_the_suite_only"


class FakeGoogleVerifier:
    """Stands in for `GoogleJwksVerifier`.

    Accepts an opaque handle ("google-token:<email>") and returns the identity registered for it.
    Anything unregistered raises `AuthenticationError`, exactly as a bad signature would — which
    is what lets a test assert that a forged token is refused without minting a real RSA key.
    """

    def __init__(self) -> None:
        self._identities: dict[str, GoogleIdentity] = {}

    def register(
        self,
        *,
        email: str,
        sub: str | None = None,
        name: str | None = None,
        email_verified: bool = True,
    ) -> str:
        token = f"google-token:{email}"
        self._identities[token] = GoogleIdentity(
            sub=sub or f"google-sub-{email}",
            email=email.lower(),
            name=name or email.split("@")[0].title(),
            picture=f"https://example.test/avatar/{email}.png",
            email_verified=email_verified,
        )
        return token

    def verify(self, id_token: str) -> GoogleIdentity:
        identity = self._identities.get(id_token)
        if identity is None:
            raise AuthenticationError("Google sign-in could not be verified.")
        if not identity.email_verified:
            raise AuthenticationError("Your Google email address is not verified.")
        return identity


def sign_stripe_payload(
    payload: dict[str, Any], secret: str = TEST_WEBHOOK_SECRET
) -> tuple[bytes, str]:
    """Produce a body and a genuine `Stripe-Signature` header for it.

    This is Stripe's documented scheme: HMAC-SHA256 over `"{timestamp}.{body}"`. Building it by
    hand rather than stubbing the verifier means the webhook test drives the real
    `stripe.Webhook.construct_event`, so it fails if we ever weaken the verification.
    """
    body = json.dumps(payload, separators=(",", ":")).encode()
    timestamp = int(time.time())
    signed = f"{timestamp}.{body.decode()}".encode()
    signature = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return body, f"t={timestamp},v1={signature}"


def stripe_event(
    event_id: str,
    event_type: str,
    obj: dict[str, Any],
) -> dict[str, Any]:
    """A Stripe event envelope, shaped as the API delivers it."""
    return {
        "id": event_id,
        "object": "event",
        "api_version": "2024-06-20",
        "created": int(time.time()),
        "type": event_type,
        "livemode": False,
        "data": {"object": obj},
    }


def checkout_session(
    *,
    session_id: str,
    order_id: int,
    payment_intent: str = "pi_test_123",
    amount_total: int = 10_000,
    payment_status: str = "paid",
) -> dict[str, Any]:
    """A `checkout.session` object.

    `client_reference_id` carries our order id. The handler resolves the order through that and
    then re-reads it from the database — the amount on this object is Stripe's word for what was
    charged, never our source of truth for what the order costs.
    """
    return {
        "id": session_id,
        "object": "checkout.session",
        "client_reference_id": str(order_id),
        "payment_intent": payment_intent,
        "payment_status": payment_status,
        "amount_total": amount_total,
        "currency": "inr",
        "status": "complete" if payment_status == "paid" else "open",
    }


class ScriptedChatModel(BaseChatModel):
    """A stub LLM that replays a fixed script of turns.

    Substituted at `chat_service`'s model seam, which is what lets the agent tests — including
    the prompt-injection ones — run with no ANTHROPIC_API_KEY and no network.

    A stub rather than a recorded transcript, deliberately. These tests assert on what the tools
    and services *do* when a model asks for something, not on whether a particular model happens
    to phrase a request a particular way. Scripting the tool call makes the security assertion
    deterministic: the test does not depend on whether the model chooses to take the bait, only
    on what happens when it does.
    """

    # Pydantic fields (BaseChatModel is a pydantic model), so default_factory rather than a
    # bare list — a shared default here would leak one test's script into the next.
    responses: list[BaseMessage] = Field(default_factory=list)
    calls: list[list[BaseMessage]] = Field(default_factory=list)
    bound_tools: list[Any] = Field(default_factory=list)

    def __init__(self, responses: list[BaseMessage], **kwargs: Any) -> None:
        super().__init__(responses=list(responses), calls=[], **kwargs)

    @property
    def _llm_type(self) -> str:
        return "scripted-test-model"

    def bind_tools(self, tools: Any, **kwargs: Any) -> ScriptedChatModel:
        # The tool schemas are recorded rather than used: `test_agent_authz` asserts directly
        # that no order tool exposes a user field for a model to fill in.
        self.bound_tools = list(tools)  # type: ignore[attr-defined]
        return self

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> ChatResult:
        self.calls.append(list(messages))
        if self.responses:
            message = self.responses.pop(0)
        else:
            message = AIMessage(content="No further response scripted.")
        return ChatResult(generations=[ChatGeneration(message=message)])

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> ChatResult:
        return self._generate(messages, stop, run_manager, **kwargs)

    async def _astream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        """Emit the scripted turn as chunks.

        Implemented so the SSE path is covered by the suite rather than only by manual testing.
        Text is split into words to make it a genuine multi-chunk stream — a single-chunk stream
        would pass even if the endpoint were quietly buffering the whole reply.
        """
        result = self._generate(messages, stop, run_manager, **kwargs)
        message = result.generations[0].message

        if isinstance(message, AIMessage) and message.tool_calls:
            yield ChatGenerationChunk(
                message=AIMessageChunk(content="", tool_calls=message.tool_calls)
            )
            return

        text = message.content if isinstance(message.content, str) else ""
        for word in text.split(" "):
            yield ChatGenerationChunk(message=AIMessageChunk(content=word + " "))


def tool_call_message(name: str, args: dict[str, Any], call_id: str = "call_1") -> AIMessage:
    """An assistant turn that requests one tool call."""
    return AIMessage(
        content="",
        tool_calls=[{"name": name, "args": args, "id": call_id, "type": "tool_call"}],
    )
