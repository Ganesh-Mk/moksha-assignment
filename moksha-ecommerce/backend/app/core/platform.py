"""Windows-only asyncio setup.

psycopg 3's async mode cannot run on Python's default Windows event loop (`ProactorEventLoop`)
and raises `InterfaceError` on the first connection. It needs the selector loop instead.

The policy has to be installed *before* the loop is created, so this runs at import time rather
than in a lifespan hook. It is a no-op on Linux, which is what actually gets deployed — the
selector loop's ~512-socket ceiling therefore never applies in production.
"""

from __future__ import annotations

import asyncio
import sys


def apply_windows_event_loop_policy() -> None:
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
