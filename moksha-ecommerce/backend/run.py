"""Local development entrypoint.

    python run.py

Exists because of one Windows-only problem with a confusing symptom: `/health` works, and every
route that touches the database returns 500 with
`InterfaceError: Psycopg cannot use the 'ProactorEventLoop'`.

psycopg's async mode requires the selector event loop, and uvicorn does not read the asyncio
*policy* — it builds its loop from a factory that is hardcoded to `ProactorEventLoop` on Windows
(`uvicorn/loops/asyncio.py`). Setting the policy at import time therefore changes nothing, no
matter how early it runs. The loop has to be supplied directly, which is what this file does.

Deployment is unaffected: the Docker image runs Linux, where uvicorn already chooses the selector
loop and `uvicorn app.main:app` is the correct command.
"""

from __future__ import annotations

import asyncio
import os
import sys

import uvicorn


def loop_factory() -> asyncio.AbstractEventLoop:
    if sys.platform == "win32":
        return asyncio.SelectorEventLoop()
    return asyncio.new_event_loop()


def main() -> None:
    config = uvicorn.Config(
        "app.main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        # Reloading watches `app` only; the whole tree would restart on every test artifact.
        reload=os.getenv("RELOAD", "1") == "1",
        reload_dirs=["app"],
        log_config=None,  # app.core.logging owns logging; uvicorn's config would replace it
    )

    if config.should_reload:
        # The reload supervisor runs the server in a child process we do not control. That is
        # fine: uvicorn already picks the selector loop whenever it uses subprocesses.
        uvicorn.supervisors.ChangeReload(
            config, target=uvicorn.Server(config).run, sockets=[config.bind_socket()]
        ).run()
        return

    asyncio.run(uvicorn.Server(config).serve(), loop_factory=loop_factory)


if __name__ == "__main__":
    main()
