For Developers
==============

This page explains how the pgwidgets-js remote interface works under the
hood and is aimed at anyone implementing a new language binding (Ruby,
Rust, Go, etc.) or a new transport. It is intentionally protocol-level:
the JavaScript side is the authoritative implementation and this page
describes the contract any other side must satisfy.

Read this together with:

* ``pgwidgets_js/static/modules/RemoteInterface.js`` — the browser-side
  protocol handler (single file, ~840 lines).
* ``pgwidgets_js/defs.py`` — the canonical widget definitions
  (constructor args, methods, callbacks). Every binding generator
  starts here.
* ``pgwidgets-python/pgwidgets/sync/application.py`` and
  ``async_/application.py`` — the reference server implementation in
  Python. The reconstruction code is the largest piece by far.


Architecture
------------

The browser is the renderer; it knows nothing about the application.
All widget identity, state, and event routing live on the server side.

::

   ┌────────────────────────────┐         ┌──────────────────────────────┐
   │  Server (your binding)     │         │  Browser (pgwidgets-js)      │
   │                            │         │                              │
   │  Widget objects            │  WS     │  RemoteInterface             │
   │  ────────────              │ ──────► │  ────────────                │
   │  - mirror tree of children │  JSON   │  - Callback._registry        │
   │  - cache state per widget  │ ◄────── │    (wid → widget instance)   │
   │  - cache replay calls      │         │  - DOM widgets               │
   │  - cache user callbacks    │         │                              │
   │                            │         │  No app state.               │
   └────────────────────────────┘         └──────────────────────────────┘

The transport is one WebSocket connection. Messages are individual JSON
objects, JSON arrays (batch), or raw binary frames (for image payloads).
Each request carries an ``id`` and gets exactly one response with the
same ``id``; the server side is expected to await results when a return
value matters.

Widget identity is a single integer, the **wid**. Wids are allocated by
the server (so it can build widget trees before any browser is
connected). The browser uses the wid as the key in
``Callback._registry`` and never assigns its own wids in normal
operation. The one exception is widgets created *inside* a method call
(e.g. ``mdi.add_subwindow(...)`` returns a new ``MDISubWindow``); these
get auto-allocated wids on the browser side that the server then learns
about from the call result.


Message Protocol
----------------

All control messages are JSON. The protocol is small and largely
symmetric: ``{type, id, ...payload}``.

Server → Browser
~~~~~~~~~~~~~~~~

``{type: "init", id}``
   First message after the WebSocket connects. The browser destroys
   any existing widgets, clears its registry, and answers with a
   ``result`` that includes the previous ``session_id`` and ``token``
   (if any) read from the URL or ``sessionStorage``. This is how
   reconnection finds the right session.

``{type: "session-info", session_id, token}``
   Sent after the server has decided which session this browser belongs
   to. The browser stores the credentials in ``sessionStorage`` and
   rewrites its own URL so the link is bookmarkable. There is no
   response.

``{type: "create", id, wid, class, args}``
   Instantiate ``class`` with ``args`` and register it under ``wid``.
   The args are resolved recursively: any ``{__wid__: N}`` is replaced
   with the widget at wid ``N`` from the registry, so constructor
   arguments can be other widgets. Reply: ``{type: "result", id, wid,
   next_wid}``.

``{type: "call", id, wid, method, args, silent?}``
   Invoke ``widget[method](...args)``. ``silent: true`` is used during
   cross-browser sync — the browser still executes the call but
   suppresses outgoing callback events so the change does not echo
   back. Reply: ``{type: "result", id, value?}``.

``{type: "binary-call", id, wid, method, args}`` (followed by a raw binary WebSocket frame)
   Identical to ``call`` except the binary frame becomes the *first*
   argument to the method. Used for small image bytes (JPEG/PNG etc.)
   so the payload isn't base64-inflated through JSON. Order matters:
   the JSON header is queued FIFO; the next binary frame is paired
   with the head of the queue.

``{type: "binary-call-chunked", id, wid, method, args, transfer_id, num_chunks}`` (announce; followed by N binary-chunk pairs)
   Opens a chunked transfer for payloads too large to ship in one
   frame.  The announce reserves a ``transfer_id``; the receiver
   accumulates exactly ``num_chunks`` paired ``binary-chunk`` messages
   and then dispatches ``widget[method](payload, ...args)``.  Optional
   fields ``shape`` (array of ints) and ``dtype`` (one of
   ``"uint8"``, ``"uint16"``, ``"uint32"``, ``"int8"``, ``"int16"``,
   ``"int32"``, ``"float32"``, ``"float64"``) promote the delivered
   payload from a raw ``ArrayBuffer`` to a typed array of that dtype.
   See *Chunked binary transport* below.

``{type: "binary-chunk", transfer_id, chunk_index, num_chunks, encoding, [file_index, file_count, data]}`` (one chunk)
   One chunk of an in-flight transfer.  ``encoding`` is per-chunk:

   * ``"binary"`` (default): the **next** WebSocket frame is the
     chunk's raw bytes.  Zero protocol overhead.
   * ``"base64"``: the ``data`` field on this JSON message **is** the
     chunk, base64-encoded.  No following binary frame.  Useful when
     the transport can't carry raw binary cleanly.

   The optional ``file_index`` / ``file_count`` fields scope a chunk
   to one file within a multi-file upload; without them the chunks
   belong to a single payload.

``{type: "listen", id, wid, action}``
   Subscribe to a callback. The browser wires up a forwarder on the
   widget that will emit ``{type: "callback", wid, action, args}`` back
   to the server every time the callback fires (with the dedup and
   suppression rules described under *Callbacks* below).

``{type: "unlisten", id, wid, action}``
   Remove the forwarder.

``{type: "reconstruct-start", id, next_wid}`` and ``{type: "reconstruct-end", id}``
   Brackets around a full UI replay; see *Reconstruction* below.

``[ msg, msg, ... ]``
   A batch. The browser dispatches each message and replies with an
   array of result objects in the same order.

Browser → Server
~~~~~~~~~~~~~~~~

``{type: "result", id, value?, wid?, next_wid?, session_id?, token?}``
   Response to any request. ``value`` is the method's return value
   (serialized: widget instances become ``{__wid__, __class__}``).
   ``next_wid`` is the current value of the browser-side
   auto-allocation counter, which lets the server know what wids it can
   safely use without colliding with a previous auto-allocation.

``{type: "error", id, error}``
   Failure response.

``{type: "callback", wid, action, args}``
   A registered callback fired. Args are serialized the same way as
   return values (widget refs become ``{__wid__}``).

``{type: "viewport", width, height}``
   Sent at session-info time and on every window resize, so the server
   can answer ``get_screen_size()`` locally without a round-trip.

``{type: "binary-chunk", wid, transfer_id, file_index, file_count, chunk_index, num_chunks, encoding}`` (followed by a raw binary frame, unless ``encoding == "base64"``)
   Same shape as the server-side ``binary-chunk``; used by the
   browser to upload dropped files / picker selections.  See *File
   uploads* below.


Serialization Rules
-------------------

* **Widget references in args/return values** are encoded as objects
  with a ``__wid__`` key (return values also include ``__class__`` so
  the receiver can decide which language-side class to wrap with). The
  reverse mapping happens on both sides:

  - Browser ``_resolveArgs`` walks the args tree and replaces
    ``{__wid__: N}`` with ``Callback._registry.get(N)``.
  - Server-side bindings should walk the same way and substitute their
    own widget objects.

* **Plain values** (numbers, strings, booleans, null, lists, dicts)
  pass through JSON.

* **Tuples vs lists**: JSON has no tuples. Wherever the JS side
  declares a multi-argument setter like
  ``"set_position": ["x", "y"]``, the binding is free to expose it as
  one method taking two args, or as one method taking a 2-tuple/array.
  The server-side cache should normalize to a tuple-shaped value (the
  Python implementation stores a tuple in ``widget._state[key]``) so
  reconstruction can re-spread it as ``method(*tuple)``.

* **Binary payloads** travel out of band. Build the JSON header
  describing the call (``binary-call`` for one frame,
  ``binary-call-chunked`` + N ``binary-chunk`` for multi-frame
  transfers), send it, then send the raw binary frame(s).  Receivers
  pair them by FIFO order on a single connection; ``transfer_id``
  in chunked transfers groups frames belonging to the same payload.
  Do not interleave other binary frames between a chunk header and
  its payload.


Widget Definitions: ``defs.py``
-------------------------------

Every binding generator reads ``pgwidgets_js/defs.py``. It is plain
Python data and intentionally not version-locked to any language:

.. code-block:: python

   WIDGETS = {
       "Button": {
           "base": "widget",
           "args": ["text"],
           "options": ["icon_url", "iconsize", "toggle"],
           "methods": {
               "set_text": ["text"],
               "get_text": [],
               "set_icon": ["url", "iconsize"],
               # ...
           },
           "callbacks": ["activated"],
       },
       # ...
   }

For each widget the entry tells you:

``base``
   ``"widget"`` (visual, paintable, has a DOM element) or ``"container"``
   (a widget that holds children) or ``"callback"`` (a non-visual object
   like ``Timer`` that still gets a wid and participates in the registry
   but has no DOM box). The string ``"widget"`` and ``"container"``
   imply visual; ``"callback"`` does not. This matters for which auto-
   sync listeners (``resize``, ``move``) the binding should register
   passively — see *State tracking* below.

``args`` / ``options``
   Constructor signature. ``args`` are positional. ``options`` are
   passed as the last positional argument, a plain JS object. The
   generator typically exposes both as Python kwargs.

``methods``
   Method name → list of parameter names (no ``self``). The parameter
   names matter because the binding turns them into keyword-able
   arguments. The list is the canonical arg order to send over the
   wire.

``callbacks``
   Widget-specific callback action names. Every visual widget also
   supports the universal ``resize`` callback, fired as
   ``{width, height}`` whenever the DOM box changes size, and ``map``,
   fired once when the element first reaches a non-zero visible box.

A binding must also classify each method into a category so it knows
how to wrap it. The Python reference implementation does this in
``pgwidgets/method_types.py`` and a binding will want to mirror those
categories (or import the same tables — they are plain Python). The
categories are:

* **SETTER** — ``set_X`` style. Sends ``call`` to browser; **also
  caches the value in the local widget's state map** under key ``X``.
  Returns nothing useful.
* **GETTER** — ``get_X`` style. Returns from the local state map
  *without* a round-trip. The state was populated by a matching
  setter or by an auto-sync callback (see below).
* **ACTION** — fire-and-forget side effect (``play``, ``scroll_to``,
  ``set_focus``). No state cache.
* **REPLAY** action — a factory call like ``add_action``,
  ``add_separator``, ``add_name``. These are actions that create
  child widgets or affect tree structure; the binding records them in
  a per-widget ``_replay_calls`` list so they can be re-issued during
  reconstruction.
* **CHILD** — ``add_widget``, ``set_widget``, ``insert_widget``, etc.
  Tracks parent/child relationships in the local tree.
* **JS_ONLY** — round-trip query that isn't cached (``get_paused``,
  ``get_column_count`` etc., when there is no corresponding setter).


Constructing Widgets
--------------------

Creating a widget is two operations:

1. The server side allocates the next wid (its own counter, starting at
   1 and incrementing). It stores a widget object locally with that wid.
2. It sends ``{type: "create", id, wid, class, args}``. The browser
   constructs the JS class, registers it under ``wid``, and responds
   with ``{result, wid, next_wid}``.

The ``next_wid`` in the response is the JS side's internal counter; the
binding must keep its allocator above that number to avoid collisions
with widgets the browser creates on its own (e.g. ``MDISubWindow``
instances returned from ``mdi.add_subwindow``). A safe rule is: after
every ``result`` carrying ``next_wid``, set the server-side allocator
to ``max(current, next_wid)``.

Constructor args that reference other widgets are passed as
``{__wid__: N}`` — same encoding as everywhere else.

Some widgets are factory-creators: ``toolbar.add_action(opts)``,
``menu.add_name("File")``. The browser-side method returns a new
widget instance; the response carries its auto-allocated wid in
``value: {__wid__: N, __class__: "ToolBarAction"}``. The binding
should wrap that into a local widget object and start tracking its
state. Until then, the binding may use a *proxy* — a placeholder
widget with a server-allocated wid that buffers callbacks and tracked
state. When the real widget is created, ``_transfer_proxy`` in the
Python reference replays all buffered state and callbacks onto the
real widget, then repoints the proxy's wid to the new one.


Callbacks
---------

Subscribing
~~~~~~~~~~~

To receive a callback the binding sends ``{type: "listen", wid,
action}``. The browser wires up a forwarder via ``add_callback`` on
the JS widget. From then on, every time the callback fires, the
browser sends back ``{type: "callback", wid, action, args}``.

Idempotency
~~~~~~~~~~~

A duplicate ``listen`` for the same ``wid:action`` is a no-op in normal
operation; during reconstruction it replaces the existing listener
(necessary because the JS widget instance is fresh).

Suppression
~~~~~~~~~~~

Two flags on ``RemoteInterface`` gate outgoing callbacks:

* ``_syncing`` — set while a ``silent`` call is executing. Used for
  multi-browser sync so a state change pushed to peers doesn't echo
  back.
* ``_reconstructing`` — set between ``reconstruct-start`` and
  ``reconstruct-end``. Suppresses all callbacks **except** ``map``,
  which is a one-shot lifecycle event tied to the widget first
  becoming visible; missing it would leave the user's map handler
  permanently un-fired.

Auto-sync callbacks
~~~~~~~~~~~~~~~~~~~

A binding should subscribe to two callbacks on every visual widget,
not because the user asked, but because they back the local state
cache:

* ``resize`` — captures ``_state["size"] = (w, h)`` so ``get_size()``
  returns the latest layout-determined size without a round-trip.
* ``move`` — captures ``_state["position"] = (x, y)`` where supported.

These are *passive* subscriptions: the binding listens, captures, and
suppresses replay. They are distinct from *auto-sync* subscriptions
which actively push state to peers and replay on reconstruction (e.g.
``resize`` on widgets whose definition has the ``resizable`` option).
See `State Tracking`_ below.


State Tracking
--------------

The server is the source of truth, so for every widget it must
maintain enough state to recreate the widget from scratch. The Python
reference stores this in ``widget._state`` (dict, keyed by the same
strings as method names without the ``set_`` prefix).

For each setter call ``widget.set_X(v)``:

* Send ``{type: "call", wid, method: "set_X", args: [v]}`` to the
  browser.
* Store ``widget._state["X"] = v``. If the setter takes multiple args
  (e.g. ``set_position(x, y)``), store the tuple ``(x, y)``.
* Mark ``X`` as *user-set* (in the Python reference,
  ``widget._user_set_state.add("X")``). This matters during
  reconstruction so layout-driven values aren't confused with
  user-set ones.

For each fixed-value setter (``show`` → ``visible=True``, ``hide`` →
``visible=False``), store the fixed value under the corresponding key.

For each replay action (``add_separator``, ``add_action``, …), append
``(method, args, returned_widget, seq)`` to ``widget._replay_calls``.
``seq`` is a monotonically-increasing counter that interleaves with
``widget._children`` insertions, so during reconstruction the two
streams can be re-interleaved in the original order. (Without that,
``add_widget(a); add_separator(); add_widget(b)`` would re-emerge as
``[a, b, sep]`` instead of ``[a, sep, b]``.)

For each callback that arrives, run the auto-sync logic:

* ``resize`` → store ``_state["size"] = (width, height)``.
* ``move`` → store ``_state["position"] = (x, y)``.

Capture is unconditional (for getters). *Replay* is conditional: only
replay these keys on reconstruction if the user explicitly set them, OR
the widget opted into active sync. See *Reconstruction* below.

For widget-specific syncs (``Slider`` ``activated`` → ``value``,
``ComboBox`` ``activated`` → ``index``, etc.), see
``WIDGET_CALLBACK_SYNC`` in ``method_types.py``.


Reconstruction
--------------

Reconstruction is the heart of the design. The browser is treated as
disposable: any time a page is refreshed, navigates away, or the
WebSocket reconnects, the server replays every widget it knows about
so the UI reappears in its current state. The user's Python code
keeps running and never sees the disconnect.

What triggers it
~~~~~~~~~~~~~~~~

* A browser reconnects with a known ``(session_id, token)`` (sent in
  the ``init`` ack).
* A new browser joins the session URL (``?session=...&token=...``).
* The server explicitly calls ``session.reconstruct()`` (rare).

The walk
~~~~~~~~

The reference reconstruction loop is essentially this (paraphrased
from ``sync/application.py``):

.. code-block:: python

   def reconstruct(self):
       self._reconstructing = True
       self._send({"type": "reconstruct-start",
                   "id": ..., "next_wid": self._next_wid})

       # 1. Walk widget tree, reconstruct each widget.
       for widget in self.walk_widget_tree():
           self._reconstruct_widget(widget)

       # 2. Deferred state: keys like 'visible' that depend on the
       #    full tree being assembled (Splitter sizes etc.).
       for widget in self.walk_widget_tree():
           self._replay_deferred_state(widget)

       self._send({"type": "reconstruct-end", "id": ...})
       self._reconstructing = False

``_reconstruct_widget`` for a single widget performs the following
steps in order. Each one matters; getting them out of order produces
subtle visual bugs.

**1. Create the widget.**
   ``{type: "create", wid, class, args}`` where ``args`` are the
   original constructor arguments (cached in
   ``widget._constructor_args`` / ``_constructor_options``). Any
   widget references embedded in those args (e.g. a ``Label``'s
   ``menu`` option pointing at a ``Menu``) must be reconstructed
   first.

**2a. Replay item lists.**
   ``ComboBox`` items, etc. — anything tracked via
   ``ITEM_LIST_CONFIG``. These must come before any state that
   indexes into them (``set_index``).

**2b. Replay state that changed after construction.**
   Iterate ``widget._state``. For each key, decide whether to replay:

   * Skip keys already supplied to the constructor with the same
     value.
   * Skip keys managed by child methods (children handled in step 3).
   * Skip fixed-value keys (``visible``); defer to step 4.
   * Skip post-children keys (``Splitter`` ``sizes``,
     ``TabWidget`` ``index``, ``_collapsed_paths``, …).
   * Skip keys starting with ``_`` (private bookkeeping).
   * **Skip auto-sync keys that came in passively.** This is the
     subtle rule: if the key has a matching state-sync action
     (``size`` → ``resize``, ``position`` → ``move``) and the user
     didn't explicitly set it AND the widget didn't opt into active
     sync, the value was captured purely from a layout-driven resize
     callback. Replaying it would pin the widget to pixel dimensions
     and override flex/expanding layout. Skip.
   * For binary state (e.g. ``set_binary_image`` payloads), replay
     via the binary transport, not embedded base64 in JSON.
   * Otherwise: send ``{type: "call", wid, method: "set_X", args}``.
     If the value is a tuple it unpacks into multiple args.

**3. Attach children and replay factory calls (interleaved).**
   ``widget._children`` and ``widget._replay_calls`` each carry a seq
   number; merge them in seq order and replay each. For each
   ``add_widget`` / ``set_widget``, ensure the child has been
   reconstructed first (recursion guarded by
   ``self._reconstructed_wids``).

**4. Re-register callbacks.**
   Iterate ``widget._registered_callbacks`` (the user's callbacks)
   and re-send ``listen`` messages, since the browser-side registry
   was cleared by ``reconstruct-start``. Same for auto-sync and
   passive-sync actions.

**5. Deferred state (outer loop, after the whole tree is built).**
   Splitter sizes (need panes to exist), TabWidget index (needs
   tabs), tree expand/collapse paths, fix-value visibility (``show``
   / ``hide``), etc.

**6. Backstops at ``reconstruct-end``.**
   The browser, on receiving ``reconstruct-end``, schedules two
   ``requestAnimationFrame`` ticks:

   * Tick 1: visibility-aware re-fire of ``map`` for every widget,
     plus a synthetic ``resize`` with the final laid-out size. The
     mid-reconstruction ``resize`` events were suppressed on the
     Python side (they're state-replay echoes), so this is the
     widget's first chance to learn its real final size.
   * Tick 2: force-fire ``map`` for any widget that's still
     unmapped, regardless of visibility. Catches widgets in
     detached subtrees (e.g. inactive ``TabWidget`` pages).

Factory-replay edge cases
~~~~~~~~~~~~~~~~~~~~~~~~~

When the user calls a factory like ``toolbar.add_action(opts)``, the
return is a new widget. The server stored a proxy. During
reconstruction:

1. ``_replay_one_factory_call`` replays the factory call, gets back
   the *real* new wid from the browser.
2. ``_transfer_proxy`` copies callbacks, class-specific synced state,
   and any other state from the proxy onto the new widget. **It
   applies the same auto-sync skip rule as step 2b** — passively-
   captured size/position is not replayed.
3. The proxy's wid is repointed to the new wid; the binding's wid
   map is updated so user code holding the proxy reference keeps
   working.
4. If the proxy accumulated its own factory sub-calls (e.g.
   ``menu.add_name("..")``), recurse.

What not to replay
~~~~~~~~~~~~~~~~~~

A short checklist of state that is captured for *getter* support but
must not be replayed on reconstruction:

* ``size`` / ``position`` of any widget whose definition doesn't
  declare ``resizable`` and that the user never explicitly resized.
* Anything starting with ``_`` (private bookkeeping).
* Anything in ``_FIXED_STATE_KEYS`` (handled by the deferred loop).
* Anything in ``_CHILD_STATE_KEYS`` (handled by the child loop).


Multi-Browser Sync
------------------

A session can have multiple connected browsers. When one browser fires
a state-syncing callback (e.g. ``resize`` on a resizable widget,
``activated`` on a ``Slider``), the server applies the change locally,
then *pushes* it to all the other browsers as a ``call`` with
``"silent": true``. The peers execute the call but their
``RemoteInterface`` sets ``_syncing = true`` for the duration, so the
resulting callback does not echo back.

This is a one-line mechanism on the protocol side. The work is in
deciding which actions to forward; see ``STATE_SYNC_CALLBACKS`` and
``WIDGET_CALLBACK_SYNC`` in ``method_types.py`` for the policy table.


Chunked Binary Transport
------------------------

Used in both directions for payloads too large to ship in a single
WebSocket frame, or when the sender wants to interleave control
messages with a long transfer.  The same ``binary-chunk`` envelope
is symmetric: server → browser (for ``binary-call-chunked`` —
e.g. an Image's pixel buffer) and browser → server (for file
uploads).

Wire layout::

   server→browser (binary-call-chunked):

      → {"type": "binary-call-chunked",
         "id": 42, "wid": 7, "method": "load_buffer",
         "args": [[2048, 2048], {...}],
         "transfer_id": 17, "num_chunks": 32,
         "shape": [2048, 2048, 4], "dtype": "uint8"}    ← optional
      → {"type": "binary-chunk", "transfer_id": 17,
         "chunk_index": 0, "num_chunks": 32, "encoding": "binary"}
      → <raw 524288-byte binary frame>
      → {"type": "binary-chunk", ..., "chunk_index": 1, ...}
      → <raw 524288-byte binary frame>
        ⋮
      → {"type": "binary-chunk", ..., "chunk_index": 31, ...}
      → <raw <=524288-byte binary frame>

   browser→server (file upload):

      → {"type": "callback", "wid": 7, "action": "drop-end",
         "args": [{"transfer_id": 17,
                   "files": [{"name": "...", "size": ..., "type": ...}],
                   ...}]}
      → {"type": "binary-chunk", "wid": 7,
         "transfer_id": 17, "file_index": 0, "file_count": 1,
         "chunk_index": 0, "num_chunks": N, "encoding": "binary"}
      → <raw binary frame>
        ⋮

Per-chunk ``encoding`` lets a sender choose ``"binary"`` (next
frame is the chunk) or ``"base64"`` (the chunk rides in this JSON
message's ``data`` field, no following binary frame).  Default is
``"binary"``; both pgwidgets-js and pgwidgets-python only emit the
binary form, but receivers must accept either.

When the announce includes ``shape`` and ``dtype``, the receiver
constructs a typed array of that dtype (``Uint8Array``,
``Float32Array``, …) before dispatch instead of a raw
``ArrayBuffer``.  The supported dtypes mirror pgwidgets-python's
:class:`pgwidgets.Buffer` (``uint8`` / ``uint16`` / ``uint32`` /
``int8`` / ``int16`` / ``int32`` / ``float32`` / ``float64``).

Chunks may arrive out-of-order in principle (a single TCP/WS
stream preserves order in practice, but receivers should still
write into indexed slots by ``chunk_index``, not append).  The
transfer completes when every slot is filled; the receiver
reassembles, dispatches, and discards the transfer.

A binding can opt to ignore the chunked path and only support
single-frame ``binary-call`` if it doesn't need large payloads or
file uploads.


Session Identity and Reconnection
---------------------------------

The session ID is a server-side concept. When a browser first
connects with no credentials, the server allocates a new session and
sends ``{type: "session-info", session_id, token}``. The browser
stores those in ``sessionStorage`` and rewrites its URL to
``?session=ID&token=TOKEN``.

On reconnect (the WebSocket dropped, the page was refreshed, the user
followed a saved link), the browser sends the credentials back in the
``init`` ack: ``{type: "result", id, session_id, token}``. The server
either:

* recognizes ``(session_id, token)``, attaches this WebSocket to the
  existing session, and immediately starts a reconstruction; or
* rejects the credentials with a 4xxx close code (the browser shows
  a "Connection rejected" page and clears its stored credentials).

The URL is preferred over ``sessionStorage`` because it lets a user
paste a link to share a session.


Things That Will Bite You
-------------------------

In rough order of how easy they are to miss:

* **Wid collisions and classMap classes that don't extend Callback.**
  Advancing your allocator past ``next_wid`` (from every ``result``,
  not just the latest) is necessary but not sufficient.  If the
  receiving side has a class in ``classMap`` whose constructor
  doesn't call ``super()`` (e.g. a plain JS class layered on top of
  pgwidgets-js — gingajs's ``Controller`` is one), then ``_nextId``
  doesn't advance during that widget's construction.  The **next**
  widget's ``super()`` will then auto-assign a wid that the previous
  Python-allocated widget is already sitting at, silently
  overwriting it in the registry.  Symptom: subsequent
  ``add_widget`` / ``listen`` calls fail with "Unknown widget id".
  Mitigations in the reference implementation (do at least one):

  - ``_handleCreate`` bumps ``Callback._nextId`` past ``msg.wid``
    *before* calling ``new cls(...)``, so the auto-wid is guaranteed
    to land in unoccupied territory.
  - The ``Callback`` constructor skips occupied registry slots when
    allocating, as a defensive backstop.

  A binding that only ever uses classes which extend ``Callback`` is
  safe without either mitigation, but it's worth having both.

* **Tuple vs single-arg setters.** ``set_position(x, y)`` stores a
  tuple but ``set_text(s)`` stores a string. Your binding must
  normalize so reconstruction can re-spread tuples as multiple args
  and singles as one arg.

* **Suppressing callbacks.** Forget to set ``_syncing`` /
  ``_reconstructing`` and you'll get echo loops or duplicate state
  updates.

* **The ``map`` exception.** Don't apply ``_reconstructing``
  suppression to ``map``. The observers fire once and disconnect; if
  you swallow ``map`` the user's handler is dead until something
  else re-fires it.

* **Replaying passively-captured size.** This is the silent killer.
  Capture must be unconditional (for getters), replay must be
  conditional (or you pin every widget to whatever pixel size the
  layout happened to settle at on capture). The same guard applies
  in both the top-level state replay AND ``_transfer_proxy``.

* **Order in ``_replay_interleaved``.** ``_children`` and
  ``_replay_calls`` carry their own sequence numbers for exactly
  this reason. Replay them merged in seq order.

* **Constructor args that are widgets.** Reconstruct them first
  (``_ensure_reconstructed``) before sending the parent's ``create``.

* **Binary frames are FIFO-paired with headers.** A single
  ``binary-call`` JSON header followed by anything other than the
  expected binary frame breaks the pairing for every following
  binary call on that connection.  Same applies to chunked
  ``binary-chunk`` headers with ``encoding == "binary"``.

* **Atomic emission of a chunked transfer.** On the sender side,
  all chunks for one transfer should ship under a single
  coroutine / lock on the WebSocket so other binary calls can't
  splice frames in between.  Receivers use ``transfer_id`` to
  disambiguate, so out-of-band interleaving is technically OK —
  but the reference implementation chooses atomic emission anyway
  to keep failure modes simpler.

* **Chunk reassembly by index, not append.** WebSocket frames over
  a single TCP stream do arrive in order, so a naive append-based
  reassembler will *work* in practice — but ``chunk_index`` is on
  every chunk header for a reason.  Writing chunks into a slotted
  array indexed by ``chunk_index`` is one extra line and bullet-
  proofs you against any future transport that doesn't preserve
  order.

* **Mixing encodings within a transfer.** ``"binary"`` and
  ``"base64"`` chunks are interchangeable per the protocol, but
  doing both in one transfer is surprising.  Pick one per transfer
  and stay consistent.

* **Unknown dtypes degrade to raw ArrayBuffer.** If an announce
  carries ``dtype: "float16"`` (or anything else not in the
  standard set), the JS side has no matching TypedArray
  constructor and logs a warning, then delivers the raw
  ``ArrayBuffer`` instead.  Stick to the documented dtypes
  (``uint8`` / ``uint16`` / ``uint32`` / ``int8`` / ``int16`` /
  ``int32`` / ``float32`` / ``float64``).

* **API shape: ``f.data`` is bytes.** As of the binary-transport
  unification, ``payload.files[i].data`` in drop / FileDialog
  callbacks is raw bytes (``ArrayBuffer`` on the JS side, ``bytes``
  on the Python side) — not a ``"data:<mime>;base64,…"`` string.
  Old code that did ``base64.b64decode(data.split(",", 1)[1])`` is
  now wrong; just use ``data`` directly.


Where to Look in the Code
-------------------------

If you want to read one file front to back, start with
``RemoteInterface.js``. It is intentionally self-contained.

For the server-side dance, the Python reference is in two paired
implementations (sync and async share roughly identical structure):

``pgwidgets/method_types.py``
   Tables: ``ACTION_METHODS``, ``REPLAY_METHODS``, ``CHILD_METHODS``,
   ``SPECIAL_SETTERS``, ``SPECIAL_GETTERS``, ``FIXED_SETTERS``,
   ``STATE_SYNC_CALLBACKS``, ``STATE_SYNC_REQUIRES_OPTION``,
   ``WIDGET_CALLBACK_SYNC``, ``STATE_DEFAULTS``,
   ``STATE_KEY_DEFAULTS``, ``ITEM_LIST_CONFIG``,
   ``POST_CHILDREN_STATE_KEYS``, ``CLEAR_RESETS``,
   ``FACTORY_RETURN_TYPES``.
   The ``classify_method`` function turns a method name plus its
   parameter list into one of ``SETTER / GETTER / ACTION / CHILD /
   JS_ONLY``.

``pgwidgets/sync/widget.py`` (and ``async_/widget.py``)
   The metaclass / class generator. Walks each entry in ``WIDGETS``
   from ``defs.py`` and synthesizes one Python class per JS widget,
   with methods generated by ``_make_setter`` / ``_make_getter`` /
   ``_make_action`` / ``_make_child_method`` etc. This is the file
   that gives a binding its "feel" — its decisions here are what user
   code looks like.

``pgwidgets/sync/application.py`` (and ``async_/application.py``)
   Session, transport, reconstruction. ``_reconstruct_widget``,
   ``_replay_interleaved``, ``_transfer_proxy``, and
   ``_reregister_callbacks`` are the four methods worth reading
   carefully if reconstruction is what you need to implement.

The protocol itself is small. The categorization tables are where the
ergonomics live; copying them and porting ``classify_method`` to your
language is the bulk of the work for a new binding generator.
