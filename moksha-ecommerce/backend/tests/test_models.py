"""Phase 1: the data model enforces its own invariants.

These test the *database*, not the service layer. The service validates all of this too, but a
constraint here also protects the seed script, a migration, and anyone with a psql prompt — and
the point of choosing PostgreSQL was to get exactly that guarantee (DECISIONS D-001).
"""

from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ALLOWED_TRANSITIONS,
    STOCK_HOLDING_STATUSES,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    StripeEvent,
    User,
    UserRole,
)


async def _a_user(db: AsyncSession, email: str = "a@example.test") -> User:
    user = User(google_sub=f"sub-{email}", email=email, name="A", role=UserRole.CUSTOMER)
    db.add(user)
    await db.commit()
    return user


async def _a_product(db: AsyncSession, *, slug: str = "p", stock: int = 10) -> Product:
    product = Product(
        name="P", slug=slug, description="", price_cents=1000, category="cleanse", stock=stock
    )
    db.add(product)
    await db.commit()
    return product


class TestMoneyAndStockConstraints:
    async def test_price_cannot_be_negative(self, db: AsyncSession) -> None:
        db.add(Product(name="P", slug="neg", description="", price_cents=-1, category="c", stock=1))
        with pytest.raises(IntegrityError):
            await db.commit()

    async def test_stock_cannot_go_negative(self, db: AsyncSession) -> None:
        # The row-lock in order_service is what prevents oversell; this constraint is the
        # backstop that turns a logic bug into a failed transaction rather than negative stock.
        product = await _a_product(db, slug="s", stock=1)
        product.stock = -1
        with pytest.raises(IntegrityError):
            await db.commit()

    async def test_order_item_quantity_must_be_positive(self, db: AsyncSession) -> None:
        user = await _a_user(db)
        product = await _a_product(db)
        order = Order(user_id=user.id, subtotal_cents=0, total_cents=0)
        db.add(order)
        await db.flush()
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=0,
                unit_price_cents=1000,
                product_name="P",
            )
        )
        with pytest.raises(IntegrityError):
            await db.commit()


class TestIdentityUniqueness:
    async def test_google_sub_is_unique(self, db: AsyncSession) -> None:
        db.add(User(google_sub="dup", email="one@x.test", name="One"))
        await db.commit()
        db.add(User(google_sub="dup", email="two@x.test", name="Two"))
        with pytest.raises(IntegrityError):
            await db.commit()

    async def test_email_is_unique(self, db: AsyncSession) -> None:
        db.add(User(google_sub="s1", email="same@x.test", name="One"))
        await db.commit()
        db.add(User(google_sub="s2", email="same@x.test", name="Two"))
        with pytest.raises(IntegrityError):
            await db.commit()

    async def test_product_slug_is_unique(self, db: AsyncSession) -> None:
        await _a_product(db, slug="taken")
        db.add(
            Product(
                name="Other", slug="taken", description="", price_cents=1, category="c", stock=1
            )
        )
        with pytest.raises(IntegrityError):
            await db.commit()


class TestOrderIntegrity:
    async def test_a_product_appears_at_most_once_per_order(self, db: AsyncSession) -> None:
        """Adding the same product twice must raise quantity, not add a second line.

        The oversell lock takes one lock per product row. A second line for the same product
        would slip past it, because the first line's locked quantity is not the total the order
        is actually asking for.
        """
        user = await _a_user(db)
        product = await _a_product(db)
        order = Order(user_id=user.id, subtotal_cents=0, total_cents=0)
        db.add(order)
        await db.flush()
        for _ in range(2):
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=1,
                    unit_price_cents=1000,
                    product_name="P",
                )
            )
        with pytest.raises(IntegrityError):
            await db.commit()

    async def test_line_items_snapshot_price_independently_of_the_product(
        self, db: AsyncSession
    ) -> None:
        """An order is a historical record; a later price change must not rewrite it (D-006)."""
        user = await _a_user(db)
        product = await _a_product(db)
        order = Order(user_id=user.id, subtotal_cents=1000, total_cents=1000)
        db.add(order)
        await db.flush()
        item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=1,
            unit_price_cents=product.price_cents,
            product_name=product.name,
        )
        db.add(item)
        await db.commit()

        product.price_cents = 999_99
        product.name = "Renamed"
        await db.commit()
        await db.refresh(item)

        assert item.unit_price_cents == 1000
        assert item.product_name == "P"

    async def test_a_product_with_order_history_cannot_be_deleted(self, db: AsyncSession) -> None:
        """RESTRICT, not CASCADE — removing a product must not erase evidence it was sold."""
        user = await _a_user(db)
        product = await _a_product(db)
        order = Order(user_id=user.id, subtotal_cents=1000, total_cents=1000)
        db.add(order)
        await db.flush()
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=1,
                unit_price_cents=1000,
                product_name="P",
            )
        )
        await db.commit()

        await db.delete(product)
        with pytest.raises(IntegrityError):
            await db.commit()


class TestWebhookLedger:
    async def test_a_stripe_event_id_can_only_be_recorded_once(self, db: AsyncSession) -> None:
        """The unique constraint *is* the idempotency mechanism (D-005).

        The webhook handler inserts before doing any work, so a duplicate delivery fails here
        rather than in a read-then-write check that two concurrent retries could both pass.
        """
        db.add(StripeEvent(event_id="evt_1", event_type="checkout.session.completed"))
        await db.commit()
        db.add(StripeEvent(event_id="evt_1", event_type="checkout.session.completed"))
        with pytest.raises(IntegrityError):
            await db.commit()


class TestStateMachine:
    def test_every_status_has_a_transition_rule(self) -> None:
        # A status missing from the table would be treated as terminal by accident rather than
        # by decision.
        assert set(ALLOWED_TRANSITIONS) == set(OrderStatus)

    def test_terminal_states_are_terminal(self) -> None:
        for status in (OrderStatus.FULFILLED, OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED):
            assert ALLOWED_TRANSITIONS[status] == frozenset()

    def test_only_successful_states_hold_stock(self) -> None:
        assert {
            OrderStatus.PENDING_PAYMENT,
            OrderStatus.PAID,
            OrderStatus.FULFILLED,
        } == STOCK_HOLDING_STATUSES
        # Both failure states release it, which is what makes a cancelled checkout return the
        # unit to the catalogue.
        assert OrderStatus.CANCELLED not in STOCK_HOLDING_STATUSES
        assert OrderStatus.PAYMENT_FAILED not in STOCK_HOLDING_STATUSES
