"""Phase 0: the skeleton boots, connects, and is traceable."""

from __future__ import annotations

from httpx import AsyncClient


async def test_health_is_public_and_needs_no_database(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_readiness_reports_database_and_feature_configuration(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/db")

    assert response.status_code == 200
    body = response.json()
    assert body["database"] == "ok"
    # Every optional integration reports its own state, so a half-configured deployment is
    # visible from the outside rather than discovered when a customer hits checkout.
    assert set(body["features"]) == {
        "google_sign_in",
        "stripe_payments",
        "ai_agent",
        "demo_login",
    }


async def test_every_response_carries_a_correlation_id(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")

    assert response.headers["X-Request-ID"]


async def test_inbound_correlation_id_is_honoured_so_traces_span_frontend_and_api(
    client: AsyncClient,
) -> None:
    response = await client.get("/api/v1/health", headers={"X-Request-ID": "trace-me"})

    assert response.headers["X-Request-ID"] == "trace-me"


async def test_inbound_correlation_id_is_length_capped(client: AsyncClient) -> None:
    # The header is attacker-controlled and ends up in log storage, so it is truncated.
    response = await client.get("/api/v1/health", headers={"X-Request-ID": "x" * 500})

    assert len(response.headers["X-Request-ID"]) == 64
