"""The seed data's invariants.

This file exists because of a bug that reached production: two products lost their `image_url`
and the shop rendered "No image" for them for a day. The seed is the one place where the backend
names a file the *frontend* has to be carrying, and nothing checked that the two agreed.

These are pure data assertions — no database, no fixtures. They run in milliseconds and they
cover the coupling that actually broke.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.seed import PRODUCTS, SeedProduct

# backend/tests/ -> backend/ -> moksha-ecommerce/ -> frontend/public
PUBLIC_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public"


@pytest.mark.parametrize("product", PRODUCTS, ids=lambda p: p.slug)
class TestEverySeededProduct:
    def test_its_artwork_exists_in_the_frontend(self, product: SeedProduct) -> None:
        """The assertion that would have caught the missing images.

        `image_url` is a root-relative path the frontend serves from `public/`. Nothing at
        runtime notices when it points at a file that is not there — the browser just renders a
        broken image, and only a human looking at the page finds out.
        """
        asset = PUBLIC_DIR / product.image_url.lstrip("/")

        assert asset.is_file(), f"{product.slug} points at {product.image_url}, which is missing"

    def test_its_price_is_a_positive_integer_of_paise(self, product: SeedProduct) -> None:
        # Money is int cents everywhere (D-004). A float here would survive the dataclass and
        # surface much later as an off-by-a-paisa total.
        assert isinstance(product.price_cents, int)
        assert product.price_cents > 0

    def test_its_stock_is_not_negative(self, product: SeedProduct) -> None:
        assert product.stock >= 0

    def test_it_has_a_real_description(self, product: SeedProduct) -> None:
        assert len(product.description.strip()) > 20


class TestTheCatalogueAsAWhole:
    def test_slugs_are_unique(self) -> None:
        """The seed upserts on slug, so a duplicate would silently overwrite its twin."""
        slugs = [p.slug for p in PRODUCTS]

        assert len(slugs) == len(set(slugs))

    def test_names_are_unique(self) -> None:
        """Two products with one name is indistinguishable from a bug, on screen and to the
        agent's fuzzy `find_product` lookup."""
        names = [p.name for p in PRODUCTS]

        assert len(names) == len(set(names))

    def test_the_image_paths_are_root_relative(self) -> None:
        """Not absolute URLs: the same seed has to work on localhost, on a preview deployment and
        in production without a per-environment image host."""
        assert all(p.image_url.startswith("/products/") for p in PRODUCTS)

    def test_the_hydra_curls_line_is_the_photographed_one(self) -> None:
        """The five products from the Assignment 1 landing page, sharing its photography.

        Named here so that removing one is a decision rather than an accident — the two
        deliverables being visibly one brand is the reason both were built.
        """
        photographed = {p.slug for p in PRODUCTS if p.image_url.endswith(".webp")}

        assert photographed == {
            "hydra-curls-shampoo",
            "hydra-curls-conditioner",
            "hydra-curls-defining-gel",
            "hydra-curls-defining-cream",
            "hydra-curls-hydrating-mask",
        }

    def test_the_two_awkward_products_are_still_awkward(self) -> None:
        """The demo depends on them: one product with a single unit in stock so the oversell
        path can be shown live, and one sold out."""
        by_slug = {p.slug: p for p in PRODUCTS}

        assert by_slug["curl-defining-gel"].stock == 1
        assert by_slug["silk-press-serum"].stock == 0
