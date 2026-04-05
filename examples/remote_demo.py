#!/usr/bin/env python3
"""
Demo: driving pgwidgets from Python with a synchronous (non-async) API.

Requirements:
    pip install websockets

Usage:
    1. python remote_demo_sync.py
    2. Open examples/remote.html in a browser
       (serve with e.g. 'python -m http.server 8000' from the repo root)
"""

import asyncio
import json
import threading

import websockets

PORT = 9500


class PGWidgets:
    """
    Synchronous client for controlling pgwidgets over WebSocket.

    The async event loop runs in a background thread. All public methods
    are plain blocking calls that can be used from any thread.
    """

    def __init__(self):
        self._next_id = 1
        self._next_wid = 1
        self._lock = threading.Lock()
        self._results = {}       # id -> result msg
        self._events = {}        # id -> threading.Event
        self._callbacks = {}     # "wid:action" -> handler fn
        self._ws = None

        # start the async event loop in a background thread
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

        # wait for a browser to connect
        self._connected = threading.Event()

    def _run_loop(self):
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._serve())

    async def _serve(self):
        async with websockets.serve(self._handler, "localhost", PORT):
            await asyncio.Future()  # run forever

    async def _handler(self, ws):
        self._ws = ws
        self._connected.set()
        print("Browser connected")
        try:
            async for message in ws:
                self._handle_message(message)
        finally:
            print("Browser disconnected")
            self._ws = None

    def wait_for_connection(self):
        """Block until a browser connects."""
        self._connected.wait()

    def _handle_message(self, data):
        msg = json.loads(data)
        if isinstance(msg, list):
            for m in msg:
                self._handle_one(m)
        else:
            self._handle_one(msg)

    def _handle_one(self, msg):
        msg_type = msg.get("type")

        if msg_type in ("result", "error"):
            msg_id = msg.get("id")
            event = self._events.get(msg_id)
            if event:
                self._results[msg_id] = msg
                event.set()

        elif msg_type == "callback":
            key = f"{msg['wid']}:{msg['action']}"
            handler = self._callbacks.get(key)
            if handler:
                threading.Thread(target=handler,
                                 args=(msg["wid"], *msg["args"]),
                                 daemon=True).start()

    def _send(self, msg):
        """Send a message and block until the result arrives."""
        with self._lock:
            msg_id = self._next_id
            self._next_id += 1
        msg["id"] = msg_id
        event = threading.Event()
        self._events[msg_id] = event
        # schedule the send on the async loop
        asyncio.run_coroutine_threadsafe(
            self._ws.send(json.dumps(msg)), self._loop
        )
        event.wait()
        result = self._results.pop(msg_id)
        del self._events[msg_id]
        if result.get("type") == "error":
            raise RuntimeError(result["error"])
        return result

    def _alloc_wid(self):
        """Allocate and return the next widget id."""
        with self._lock:
            wid = self._next_wid
            self._next_wid += 1
        return wid

    def create(self, cls_name, *args):
        """Create a widget and return its wid."""
        wid = self._alloc_wid()
        self._send({
            "type": "create",
            "wid": wid,
            "class": cls_name,
            "args": list(args)
        })
        return wid

    def call(self, wid, method, *args):
        """Call a method on a widget and return the result value."""
        result = self._send({
            "type": "call",
            "wid": wid,
            "method": method,
            "args": list(args)
        })
        return result.get("value")

    def listen(self, wid, action, handler):
        """Register a callback handler for a widget action."""
        key = f"{wid}:{action}"
        self._callbacks[key] = handler
        self._send({
            "type": "listen",
            "wid": wid,
            "action": action
        })

    def unlisten(self, wid, action):
        """Remove a callback handler."""
        key = f"{wid}:{action}"
        self._callbacks.pop(key, None)
        self._send({
            "type": "unlisten",
            "wid": wid,
            "action": action
        })

    def wref(self, wid):
        """Return a widget reference for use in method args."""
        return {"__wid__": wid}


def main():
    pg = PGWidgets()
    print(f"Waiting for browser connection on ws://localhost:{PORT} ...")
    pg.wait_for_connection()

    # --- Build the UI using plain synchronous calls ---

    top = pg.create("TopLevel", {"title": "Remote Demo (sync)", "resizable": True})
    pg.call(top, "resize", 400, 300)

    vbox = pg.create("VBox")
    pg.call(vbox, "set_spacing", 8)
    pg.call(vbox, "set_padding", 10)

    status = pg.create("Label", "Click a button!")

    hbox = pg.create("HBox")
    pg.call(hbox, "set_spacing", 6)

    btn_hello = pg.create("Button", "Hello")
    btn_world = pg.create("Button", "World")
    btn_clear = pg.create("Button", "Clear")

    pg.call(hbox, "add_widget", pg.wref(btn_hello), 0)
    pg.call(hbox, "add_widget", pg.wref(btn_world), 0)
    pg.call(hbox, "add_widget", pg.wref(btn_clear), 0)

    entry = pg.create("TextEntry", {"text": "Type here", "linehistory": 5})
    slider = pg.create("Slider", {"min": 0, "max": 100, "value": 50})

    pg.call(vbox, "add_widget", pg.wref(hbox), 0)
    pg.call(vbox, "add_widget", pg.wref(entry), 0)
    pg.call(vbox, "add_widget", pg.wref(slider), 0)
    pg.call(vbox, "add_widget", pg.wref(status), 1)

    pg.call(top, "set_widget", pg.wref(vbox))
    pg.call(top, "show")

    # --- Callbacks are plain functions ---

    def on_hello(wid, *args):
        pg.call(status, "set_text", "Hello!")

    def on_world(wid, *args):
        pg.call(status, "set_text", "World!")

    def on_clear(wid, *args):
        pg.call(status, "set_text", "")
        pg.call(entry, "set_text", "")

    def on_entry(wid, text):
        pg.call(status, "set_text", f"Entered: {text}")

    def on_slider(wid, value):
        pg.call(status, "set_text", f"Slider: {value}")

    pg.listen(btn_hello, "activated", on_hello)
    pg.listen(btn_world, "activated", on_world)
    pg.listen(btn_clear, "activated", on_clear)
    pg.listen(entry, "activated", on_entry)
    pg.listen(slider, "activated", on_slider)

    print("UI built. Interact with the browser window.")

    # Keep main thread alive
    try:
        while True:
            import time
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down.")


if __name__ == "__main__":
    main()
