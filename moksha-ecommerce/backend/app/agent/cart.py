"""Where the agent's `add_to_cart` tool writes.

The cart is client-owned state (DECISIONS D-012) — there is no server-side cart table, and adding
one just so the agent could write to it would be a schema change driven by a chat feature. So the
agent does not add to a cart; it **proposes lines**, and the browser applies them to the cart it
already owns.

That keeps the boundary honest in a way worth stating out loud: the agent can put something in
front of the customer, and it cannot buy it for them. Payment is unchanged — cart, checkout,
Stripe — and every server-side rule still runs at checkout, including the stock lock and the
recomputation of the total from database prices.
"""

from __future__ import annotations

from app.models import Product
from app.schemas.chat import CartProposal

# The same ceiling the client applies per line. Duplicated deliberately rather than imported from
# nowhere: the browser cannot be trusted to enforce it, and the server has no cart to enforce it
# on, so the agent enforces it at the only point it controls.
MAX_PER_LINE = 99


class CartDraft:
    """The lines the agent has proposed during one request.

    Owned by the request and passed into `build_tools`, so it is a closure variable rather than
    anything the model can address — the same construction the identity binding uses. A model
    cannot enumerate, read back or clear this; it can only append through the tool.
    """

    def __init__(self) -> None:
        self._lines: dict[int, CartProposal] = {}
        # Bumped on every accepted add. The streaming endpoint watches it so it can send the
        # proposal the moment it exists rather than after the model has finished talking.
        self.version = 0

    def add(self, product: Product, quantity: int) -> CartProposal:
        """Record a proposed line, merging with any earlier proposal for the same product.

        Merging rather than appending, for the same reason the client's cart merges: the order
        endpoint takes one line per product, and its stock lock takes one lock per product, so
        two unmerged lines would each be checked against the full stock and together could ask
        for more than exists.
        """
        existing = self._lines.get(product.id)
        wanted = quantity + (existing.quantity if existing else 0)
        clamped = max(1, min(wanted, product.stock, MAX_PER_LINE))

        proposal = CartProposal(
            product_id=product.id,
            slug=product.slug,
            name=product.name,
            quantity=clamped,
            unit_price_cents=product.price_cents,
            currency=product.currency,
            image_url=product.image_url,
            stock=product.stock,
        )
        self._lines[product.id] = proposal
        self.version += 1
        return proposal

    @property
    def proposals(self) -> list[CartProposal]:
        return list(self._lines.values())

    def __bool__(self) -> bool:
        return bool(self._lines)
