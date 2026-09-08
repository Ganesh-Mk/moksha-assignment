"""The agent's one tool that changes what the customer sees: `add_to_cart`.

The claim being tested is narrow and worth stating precisely. The agent can put a **validated
proposal** in front of the customer — a product that exists, is live, and had stock when it was
checked. It cannot place an order, cannot take payment, and cannot write a row. The last test in
each class is the one that would catch that changing.
"""

from __future__ import annotations

import json

import pytest
from httpx import AsyncClient
from langchain_core.messages import AIMessage
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.cart import MAX_PER_LINE, CartDraft
from app.agent.tools import build_tools
from app.models import Order, Product, User
from app.services import chat_service
from tests.conftest import auth_header
from tests.fakes import ScriptedChatModel, tool_call_message
from tests.test_orders import make_product

API = "/api/v1"


@pytest.fixture
async def catalogue(db: AsyncSession) -> None:
    await make_product(db, slug="curl-defining-gel", price_cents=64_900, stock=12)
    await make_product(db, slug="heat-shield-spray", price_cents=44_900, stock=0)
    await make_product(db, slug="argan-hair-oil", price_cents=74_900, stock=2)


class TestTheCartTool:
    async def test_it_proposes_a_line_from_real_product_data(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        cart = CartDraft()
        tools = {t.name: t for t in build_tools(db, customer, cart)}

        result = await tools["add_to_cart"].ainvoke({"name_or_slug": "curl gel", "quantity": 2})

        assert result["added"] is True
        [line] = cart.proposals
        assert line.slug == "curl-defining-gel"
        assert line.quantity == 2
        # Read from the database, not from anything the model said.
        assert line.unit_price_cents == 64_900

    async def test_quantity_is_clamped_to_stock_and_the_clamp_is_reported(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        """Silently adding fewer than asked leaves the model telling the customer a lie."""
        cart = CartDraft()
        tools = {t.name: t for t in build_tools(db, customer, cart)}

        result = await tools["add_to_cart"].ainvoke(
            {"name_or_slug": "argan-hair-oil", "quantity": 50}
        )

        assert cart.proposals[0].quantity == 2
        assert "2" in result["message"]

    async def test_two_adds_of_one_product_merge(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        """The order endpoint takes one line per product, and its stock lock takes one lock per
        product — two unmerged lines would each be checked against the full stock."""
        cart = CartDraft()
        tools = {t.name: t for t in build_tools(db, customer, cart)}

        await tools["add_to_cart"].ainvoke({"name_or_slug": "curl gel", "quantity": 2})
        await tools["add_to_cart"].ainvoke({"name_or_slug": "curl gel", "quantity": 3})

        assert len(cart.proposals) == 1
        assert cart.proposals[0].quantity == 5

    async def test_a_line_can_never_exceed_the_per_line_ceiling(
        self, db: AsyncSession, customer: User
    ) -> None:
        await make_product(db, slug="endless-supply", stock=100_000)
        cart = CartDraft()
        tools = {t.name: t for t in build_tools(db, customer, cart)}

        await tools["add_to_cart"].ainvoke({"name_or_slug": "endless-supply", "quantity": 5_000})

        assert cart.proposals[0].quantity == MAX_PER_LINE

    @pytest.mark.parametrize(
        ("slug", "quantity"),
        [("no-such-thing", 1), ("heat-shield-spray", 1), ("curl gel", 0)],
        ids=["unknown-product", "sold-out", "zero-quantity"],
    )
    async def test_it_refuses_and_proposes_nothing(
        self, db: AsyncSession, customer: User, catalogue: None, slug: str, quantity: int
    ) -> None:
        cart = CartDraft()
        tools = {t.name: t for t in build_tools(db, customer, cart)}

        result = await tools["add_to_cart"].ainvoke({"name_or_slug": slug, "quantity": quantity})

        assert result["added"] is False
        assert cart.proposals == []

    async def test_a_withdrawn_product_cannot_be_added(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        """Soft-deleted products stay in the table for the sake of past orders. They are not
        for sale, and the agent must not be a way around that."""
        product = (
            await db.execute(select(Product).where(Product.slug == "curl-defining-gel"))
        ).scalar_one()
        product.is_active = False
        await db.commit()

        cart = CartDraft()
        tools = {t.name: t for t in build_tools(db, customer, cart)}
        result = await tools["add_to_cart"].ainvoke({"name_or_slug": "curl-defining-gel"})

        assert result["added"] is False
        assert cart.proposals == []

    async def test_adding_to_the_cart_writes_no_order(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        """The headline claim. A proposal is not a purchase.

        If this ever fails, the agent has become able to spend a customer's money on the strength
        of a sentence they typed — which is the whole reason the cart stayed client-owned.
        """
        cart = CartDraft()
        tools = {t.name: t for t in build_tools(db, customer, cart)}

        await tools["add_to_cart"].ainvoke({"name_or_slug": "curl gel", "quantity": 3})

        assert await db.scalar(select(func.count()).select_from(Order)) == 0
        # And the catalogue is untouched: stock is only decremented at checkout, under a lock.
        product = (
            await db.execute(select(Product).where(Product.slug == "curl-defining-gel"))
        ).scalar_one()
        assert product.stock == 12


class TestProposalsReachTheClient:
    async def test_the_json_endpoint_returns_them(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        model = ScriptedChatModel(
            [
                tool_call_message("add_to_cart", {"name_or_slug": "curl gel", "quantity": 1}),
                AIMessage(content="Added. Open the cart to pay."),
            ]
        )

        reply = await chat_service.complete_reply(
            db, user=customer, message="order me the curl gel", model=model
        )

        assert reply.text == "Added. Open the cart to pay."
        assert [(line.slug, line.quantity) for line in reply.cart] == [("curl-defining-gel", 1)]

    async def test_a_turn_that_added_nothing_carries_an_empty_cart(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        model = ScriptedChatModel([AIMessage(content="We have three products.")])

        reply = await chat_service.complete_reply(
            db, user=customer, message="what do you sell?", model=model
        )

        assert reply.cart == []

    async def test_the_stream_emits_one_cart_event_before_done(
        self, client: AsyncClient, customer: User, catalogue: None
    ) -> None:
        """One event at the end, not one per tool call: the agent may add two products across
        two calls, and the client should apply a single coherent set."""
        import app.services.chat_service as cs

        original = cs.build_chat_model
        cs.build_chat_model = lambda: ScriptedChatModel(  # type: ignore[assignment]
            [
                tool_call_message("add_to_cart", {"name_or_slug": "curl gel", "quantity": 2}),
                tool_call_message("add_to_cart", {"name_or_slug": "argan-hair-oil"}),
                AIMessage(content="Both are in your cart."),
            ]
        )
        try:
            response = await client.post(
                f"{API}/chat/stream",
                headers=auth_header(customer),
                json={"message": "add the gel and the oil"},
            )
        finally:
            cs.build_chat_model = original  # type: ignore[assignment]

        events = [
            json.loads(line.removeprefix("data: "))
            for line in response.text.splitlines()
            if line.startswith("data: ")
        ]
        cart_events = [e for e in events if "cart" in e]

        assert len(cart_events) == 1
        assert events[-1] == {"done": True}
        lines = {line["slug"]: line["quantity"] for line in cart_events[0]["cart"]}
        assert lines == {"curl-defining-gel": 2, "argan-hair-oil": 1}
        # The payload carries what the browser needs to render a cart line without refetching.
        assert cart_events[0]["cart"][0]["unit_price_cents"] == 64_900

    async def test_the_cart_endpoint_still_requires_authentication(
        self, client: AsyncClient
    ) -> None:
        """No token, no agent, therefore no way to reach the cart tool at all."""
        response = await client.post(f"{API}/chat", json={"message": "add the gel"})

        assert response.status_code == 401
