"""Business logic. The single source of truth for every rule.

Routers and the AI agent's tools both call into this package, so a rule enforced here is
enforced for both. Nothing in here imports `HTTPException` — see docs/DECISIONS.md D-003.
"""
