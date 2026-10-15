"""Bound request bytes before the multipart parser, including chunked uploads."""

import anyio
from starlette.responses import PlainTextResponse


class BodyLimit:
    def __init__(self, app, maximum=2_020_000):
        self.app = app
        self.maximum = maximum

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] in ("GET", "HEAD", "OPTIONS"):
            return await self.app(scope, receive, send)
        chunks = []
        size = 0
        try:
            with anyio.fail_after(15):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    body = message.get("body", b"")
                    size += len(body)
                    if size > self.maximum:
                        return await PlainTextResponse("Request limit exceeded", status_code=413)(
                            scope, receive, send
                        )
                    chunks.append(body)
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            return await PlainTextResponse("Request timeout", status_code=408)(scope, receive, send)
        delivered = False

        async def bounded_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()

        await self.app(scope, bounded_receive, send)
