"""Phase 6: the agent answers the brief's three questions from real database data.

The brief is explicit about what it is testing here:

> "The AI agent should retrieve actual product and order information through backend APIs/tools
> rather than relying only on general LLM knowledge."

So these tests assert on the *tool results* — the data that came out of PostgreSQL — rather than
on the model's prose. A test that asserted on wording would be testing the stub; a test that
asserts a price of ₹649.00 came back from the database is testing the thing the brief cares about.
"""

from __future__ import annotations

import json

import pytest
from httpx import AsyncClient
from langchain_core.messages import AIMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.tools import build_tools
from app.models import Order, OrderStatus, User
from app.services import chat_service
from tests.conftest import auth_header
from tests.fakes import ScriptedChatModel, tool_call_message
from tests.test_orders import make_product

API = "/api/v1"


@pytest.fixture
async def catalogue(db: AsyncSession) -> None:
    await make_product(db, slug="curl-defining-gel", price_cents=64_900, stock=12)
    await make_product(db, slug="heat-shield-spray", price_cents=44_900, stock=0)
    await make_product(db, slug="argan-hair-oil", price_cents=74_900, stock=30)


class TestTheBriefsThreeQuestions:
    """ "What is the price of Product X?" · "What products are available?" · "My order status?\""""

    async def test_price_of_a_named_product_comes_from_the_database(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        tools = {t.name: t for t in build_tools(db, customer)}

        result = await tools["get_product"].ainvoke({"name_or_slug": "Curl Defining Gel"})

        assert result["found"] is True
        # Formatted for a human, but derived from the integer cents in the row.
        assert result["price"] == "₹649.00"
        assert result["price_cents"] == 64_900

    async def test_a_product_can_be_found_by_how_a_customer_would_say_it(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        """Customers say "the curl gel", not `curl-defining-gel`."""
        tools = {t.name: t for t in build_tools(db, customer)}

        result = await tools["get_product"].ainvoke({"name_or_slug": "curl gel"})

        assert result["found"] is True
        assert result["slug"] == "curl-defining-gel"

    async def test_what_products_are_available(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        tools = {t.name: t for t in build_tools(db, customer)}

        result = await tools["list_products"].ainvoke({})

        assert result["total"] == 3
        assert {p["slug"] for p in result["products"]} == {
            "curl-defining-gel",
            "heat-shield-spray",
            "argan-hair-oil",
        }

    async def test_availability_reflects_real_stock(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        tools = {t.name: t for t in build_tools(db, customer)}

        in_stock = await tools["list_products"].ainvoke({"in_stock_only": True})

        assert {p["slug"] for p in in_stock["products"]} == {
            "curl-defining-gel",
            "argan-hair-oil",
        }

    async def test_order_status_comes_from_the_customers_own_order(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        order = Order(
            user_id=customer.id,
            status=OrderStatus.FULFILLED,
            subtotal_cents=64_900,
            total_cents=64_900,
            currency="INR",
        )
        db.add(order)
        await db.commit()
        await db.refresh(order)
        tools = {t.name: t for t in build_tools(db, customer)}

        result = await tools["get_order_status"].ainvoke({"order_id": order.id})

        assert result["status"] == "fulfilled"
        assert result["total"] == "₹649.00"

    async def test_a_withdrawn_product_is_not_quoted(
        self, db: AsyncSession, customer: User
    ) -> None:
        """The agent must not quote a price for something nobody can buy."""
        product = await make_product(db, slug="discontinued", price_cents=1000)
        product.is_active = False
        await db.commit()
        tools = {t.name: t for t in build_tools(db, customer)}

        result = await tools["get_product"].ainvoke({"name_or_slug": "discontinued"})

        assert result["found"] is False


class TestTheGraphRunsToolsAgainstRealData:
    async def test_a_tool_call_reaches_the_database_and_returns_to_the_model(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        """The full loop: model asks → tool queries Postgres → result returns → model answers."""
        model = ScriptedChatModel(
            [
                tool_call_message("get_product", {"name_or_slug": "curl gel"}),
                AIMessage(content="The Curl Defining Gel is ₹649.00 and we have 12 in stock."),
            ]
        )

        reply = await chat_service.complete_reply(
            db, user=customer, message="how much is the curl gel?", model=model
        )

        assert "649" in reply

        # The assertion that matters: real data came back from the database, not from the model.
        tool_messages = [
            m for call in model.calls for m in call if getattr(m, "type", None) == "tool"
        ]
        assert tool_messages
        payload = json.loads(str(tool_messages[-1].content).replace("'", '"'))
        assert payload["price_cents"] == 64_900

    async def test_the_agent_sees_a_price_change_immediately(
        self, db: AsyncSession, customer: User, catalogue: None
    ) -> None:
        """Nothing is cached in the model. A tool call is a live query.

        This is the difference between an agent with tools and an agent answering from training
        data — and the specific thing the brief says it is checking.
        """
        tools = {t.name: t for t in build_tools(db, customer)}
        before = await tools["get_product"].ainvoke({"name_or_slug": "curl-defining-gel"})

        from sqlalchemy import select

        from app.models import Product

        product = (
            await db.execute(select(Product).where(Product.slug == "curl-defining-gel"))
        ).scalar_one()
        product.price_cents = 99_900
        await db.commit()

        after = await tools["get_product"].ainvoke({"name_or_slug": "curl-defining-gel"})

        assert before["price"] == "₹649.00"
        assert after["price"] == "₹999.00"


class TestChatEndpoint:
    async def test_the_json_endpoint_returns_a_reply(
        self, client: AsyncClient, customer: User, catalogue: None
    ) -> None:
        """Through the real router, dependencies and exception handlers.

        The model seam is a service function rather than a FastAPI dependency, so it is patched
        directly. Everything else on the path — auth, validation, the graph, the tools, the
        database — is the real thing.
        """
        import app.services.chat_service as cs

        original = cs.build_chat_model
        cs.build_chat_model = lambda: ScriptedChatModel(  # type: ignore[assignment]
            [AIMessage(content="We stock three products.")]
        )
        try:
            response = await client.post(
                f"{API}/chat", headers=auth_header(customer), json={"message": "what do you sell?"}
            )
        finally:
            cs.build_chat_model = original  # type: ignore[assignment]

        assert response.status_code == 200
        assert response.json()["reply"] == "We stock three products."

    async def test_the_stream_endpoint_emits_sse_deltas_then_done(
        self, client: AsyncClient, customer: User, catalogue: None
    ) -> None:
        """Multi-chunk, so a quietly-buffered response would fail this."""
        import app.services.chat_service as cs

        original = cs.build_chat_model
        cs.build_chat_model = lambda: ScriptedChatModel(  # type: ignore[assignment]
            [AIMessage(content="We have twelve gels in stock.")]
        )
        try:
            response = await client.post(
                f"{API}/chat/stream",
                headers=auth_header(customer),
                json={"message": "how many gels?"},
            )
        finally:
            cs.build_chat_model = original  # type: ignore[assignment]

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")

        events = [
            json.loads(line.removeprefix("data: "))
            for line in response.text.splitlines()
            if line.startswith("data: ")
        ]
        deltas = [e["delta"] for e in events if "delta" in e]

        assert len(deltas) > 1, "the reply arrived in one chunk — it is being buffered"
        assert "".join(deltas).strip() == "We have twelve gels in stock."
        assert events[-1] == {"done": True}

    @pytest.mark.parametrize("message", ["", "   ", "x" * 2001])
    async def test_invalid_messages_are_rejected(
        self, client: AsyncClient, customer: User, message: str
    ) -> None:
        response = await client.post(
            f"{API}/chat", headers=auth_header(customer), json={"message": message}
        )

        assert response.status_code == 422

    async def test_an_unconfigured_agent_returns_503_naming_the_variable(
        self, client: AsyncClient, customer: User, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from app.config import settings

        monkeypatch.setattr(settings, "anthropic_api_key", None)

        response = await client.post(
            f"{API}/chat", headers=auth_header(customer), json={"message": "hi"}
        )

        assert response.status_code == 503
        assert "ANTHROPIC_API_KEY" in response.json()["error"]["details"]["missing"]
