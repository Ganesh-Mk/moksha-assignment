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
from typing import Any

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
