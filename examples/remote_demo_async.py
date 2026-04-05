#!/usr/bin/env python3
"""
Demo: driving pgwidgets from Python over WebSocket.

Requirements:
    pip install websockets

Usage:
    1. python remote_demo.py
    2. Open examples/remote.html in a browser
       (serve with e.g. 'python -m http.server 8000' from the repo root)
"""

import asyncio
import json
import websockets

PORT = 9500


class PGWidgets:
    """Client for controlling pgwidgets over a WebSocket connection."""

    def __init__(self, ws):
        self.ws = ws
        self._next_id = 1
        self._next_wid = 1
        self._pending = {}       # id -> Future
        self._callbacks = {}     # "wid:action" -> handler fn

    def _alloc_wid(self):
        """Allocate and return the next widget id."""
        wid = self._next_wid
        self._next_wid += 1
        return wid

    async def _send(self, msg):
        """Send a message and wait for the result."""
        msg_id = self._next_id
        self._next_id += 1
        msg["id"] = msg_id
        future = asyncio.get_event_loop().create_future()
        self._pending[msg_id] = future
        await self.ws.send(json.dumps(msg))
        return await future

    async def _send_batch(self, msgs):
        """Send a batch of messages and wait for all results."""
        results_futures = []
        for msg in msgs:
            msg_id = self._next_id
            self._next_id += 1
            msg["id"] = msg_id
            future = asyncio.get_event_loop().create_future()
            self._pending[msg_id] = future
            results_futures.append(future)
        await self.ws.send(json.dumps(msgs))
        return await asyncio.gather(*results_futures)

    def _handle_message(self, data):
        """Process an incoming message from the browser."""
        msg = json.loads(data)

        # batch response
        if isinstance(msg, list):
            for m in msg:
                self._handle_one(m)
        else:
            self._handle_one(msg)

    def _handle_one(self, msg):
        msg_type = msg.get("type")

        if msg_type in ("result", "error"):
            msg_id = msg.get("id")
            future = self._pending.pop(msg_id, None)
            if future:
                if msg_type == "error":
                    future.set_exception(RuntimeError(msg["error"]))
                else:
                    future.set_result(msg)

        elif msg_type == "callback":
            key = f"{msg['wid']}:{msg['action']}"
            handler = self._callbacks.get(key)
            if handler:
                # schedule callback handler as a task
                asyncio.ensure_future(handler(msg["wid"], *msg["args"]))

    async def create(self, cls_name, *args):
        """Create a widget and return its wid."""
        wid = self._alloc_wid()
        await self._send({
            "type": "create",
            "wid": wid,
            "class": cls_name,
            "args": list(args)
        })
        return wid

    async def call(self, wid, method, *args):
        """Call a method on a widget and return the result value."""
        result = await self._send({
            "type": "call",
            "wid": wid,
            "method": method,
            "args": list(args)
        })
        return result.get("value")

    async def listen(self, wid, action, handler):
        """Register a callback handler for a widget action."""
        key = f"{wid}:{action}"
        self._callbacks[key] = handler
        await self._send({
            "type": "listen",
            "wid": wid,
            "action": action
        })

    async def unlisten(self, wid, action):
        """Remove a callback handler."""
        key = f"{wid}:{action}"
        self._callbacks.pop(key, None)
        await self._send({
            "type": "unlisten",
            "wid": wid,
            "action": action
        })

    def wref(self, wid):
        """Return a widget reference for use in method args."""
        return {"__wid__": wid}


async def build_ui(pg):
    """Build a demo UI remotely."""

    # Create a TopLevel window
    top = await pg.create("TopLevel", {"title": "Remote Demo", "resizable": True})
    await pg.call(top, "resize", 400, 300)

    # VBox layout
    vbox = await pg.create("VBox")
    await pg.call(vbox, "set_spacing", 8)
    await pg.call(vbox, "set_padding", 10)

    # A label for status
    status = await pg.create("Label", "Click a button!")

    # Some buttons
    hbox = await pg.create("HBox")
    await pg.call(hbox, "set_spacing", 6)

    btn_hello = await pg.create("Button", "Hello")
    btn_world = await pg.create("Button", "World")
    btn_clear = await pg.create("Button", "Clear")

    await pg.call(hbox, "add_widget", pg.wref(btn_hello), 0)
    await pg.call(hbox, "add_widget", pg.wref(btn_world), 0)
    await pg.call(hbox, "add_widget", pg.wref(btn_clear), 0)

    # A text entry
    entry = await pg.create("TextEntry", {"text": "Type here", "linehistory": 5})

    # A slider
    slider = await pg.create("Slider", {"min": 0, "max": 100, "value": 50})

    # Assemble the layout
    await pg.call(vbox, "add_widget", pg.wref(hbox), 0)
    await pg.call(vbox, "add_widget", pg.wref(entry), 0)
    await pg.call(vbox, "add_widget", pg.wref(slider), 0)
    await pg.call(vbox, "add_widget", pg.wref(status), 1)

    await pg.call(top, "set_widget", pg.wref(vbox))
    await pg.call(top, "show")

    # Register callbacks
    async def on_hello(wid, *args):
        await pg.call(status, "set_text", "Hello!")

    async def on_world(wid, *args):
        await pg.call(status, "set_text", "World!")

    async def on_clear(wid, *args):
        await pg.call(status, "set_text", "")
        await pg.call(entry, "set_text", "")

    async def on_entry(wid, text):
        await pg.call(status, "set_text", f"Entered: {text}")

    async def on_slider(wid, value):
        await pg.call(status, "set_text", f"Slider: {value}")

    await pg.listen(btn_hello, "activated", on_hello)
    await pg.listen(btn_world, "activated", on_world)
    await pg.listen(btn_clear, "activated", on_clear)
    await pg.listen(entry, "activated", on_entry)
    await pg.listen(slider, "activated", on_slider)

    print("UI built. Interact with the browser window.")


async def handler(ws):
    print(f"Browser connected")
    pg = PGWidgets(ws)

    # Start receiving messages in the background so responses
    # are processed while we build the UI
    async def receive_loop():
        async for message in ws:
            pg._handle_message(message)

    recv_task = asyncio.create_task(receive_loop())

    # Build the UI
    await build_ui(pg)

    # Keep running until the browser disconnects
    await recv_task
    print("Browser disconnected")


async def main():
    print(f"Waiting for browser connection on ws://localhost:{PORT} ...")
    async with websockets.serve(handler, "localhost", PORT):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
