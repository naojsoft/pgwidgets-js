"use strict";

import {Callback} from "./Callback.js";

/**
 * Remote interface for controlling pgwidgets over a WebSocket connection.
 * Receives JSON messages to create widgets, call methods, and listen for
 * callbacks. Results and callback events are sent back over the socket.
 *
 * Message protocol:
 *
 * Server -> Browser:
 *   {type: "init", id}                        Init handshake
 *   {type: "session-info", session_id, token} Session credentials
 *   {type: "reconstruct-start", id}           Begin UI reconstruction
 *   {type: "reconstruct-end", id}             End UI reconstruction
 *   {type: "create", id, class, args}         Create a widget, returns wid
 *   {type: "call", id, wid, method, args}     Call a method, returns result
 *   {type: "listen", id, wid, action}         Register for a callback
 *   {type: "unlisten", id, wid, action}       Remove a callback listener
 *   [ msg, msg, ... ]                         Batch of messages
 *
 * Browser -> Server:
 *   {type: "result", id, wid?, value?,        Response (may include
 *    session_id?, token?}                      reconnect credentials)
 *   {type: "error", id, error}                Error response
 *   {type: "callback", wid, action, args}     Callback event
 *
 * Reconnection:
 *   Session credentials are stored in the URL (?session=ID&token=TOKEN)
 *   and in sessionStorage. On reconnect the init ack includes these so
 *   the server can reattach to the existing session and reconstruct the
 *   UI. The URL is preferred over sessionStorage so links can be shared.
 */
class RemoteInterface {

    // dtype → TypedArray constructor, used to wrap a reassembled
    // chunked-binary payload when the sender attached shape/dtype.
    // Keys mirror pgwidgets-python's pgwidgets.buffer._DTYPES.
    static _TYPED_ARRAY_CTORS = {
        "uint8":   Uint8Array,
        "uint16":  Uint16Array,
        "uint32":  Uint32Array,
        "int8":    Int8Array,
        "int16":   Int16Array,
        "int32":   Int32Array,
        "float32": Float32Array,
        "float64": Float64Array,
    };

    /**
     * Creates a new RemoteInterface.
     * @param {Object} classMap - Map of class names to constructors
     *   (e.g. the Widgets object from Widgets.js).
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.url='ws://localhost:9500'] - WebSocket URL.
     * @param {boolean} [options.auto_connect=true] - Connect immediately.
     * @param {boolean} [options.reconnect=true] - Auto-reconnect on disconnect.
     * @param {number} [options.reconnect_interval=500] - Reconnect delay in ms.
     */
    constructor(classMap, options = {}) {
        this._classMap = classMap;
        this._url = options.url || 'ws://localhost:9500';
        this._reconnect = options.reconnect !== undefined ? options.reconnect : true;
        this._reconnectInterval = options.reconnect_interval || 500;
        this._ws = null;
        this._listeners = new Map();  // "wid:action" -> callback fn
        this._nextTransferId = 1;
        this._chunkSize = options.chunk_size || 512 * 1024;  // bytes of base64 per chunk
        this._reconstructing = false;  // true during UI reconstruction
        this._syncing = false;         // true during cross-browser sync calls
        this._sessionId = null;
        this._sessionToken = null;

        // Restore session credentials from sessionStorage if available.
        this._loadSessionCredentials();

        if (options.auto_connect !== false) {
            this.connect();
        }
    }

    /** Opens the WebSocket connection. */
    connect() {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            return;
        }
        this._ws = new WebSocket(this._url);
        // Receive binary frames as ArrayBuffer so we can wrap them
        // in a Blob with the right MIME type for image decoding.
        this._ws.binaryType = "arraybuffer";

        this._ws.onopen = () => {
            console.log("RemoteInterface: connected to " + this._url);
        };

        // Arrow wrapper so the handler runs with `this` = RemoteInterface,
        // not the WebSocket itself.
        this._ws.onmessage = (e) => this._onMessage(e);

        this._ws.onclose = (event) => {
            console.log("RemoteInterface: disconnected (code=" + event.code + ")");
            if (event.code >= 4000 && event.code < 5000) {
                // Application-level rejection — do not reconnect.
                this._reconnect = false;
                let reason = event.reason || "Connection rejected by server";
                console.error("RemoteInterface: " + reason);
                // Clear stale credentials so a fresh connection works.
                this._sessionId = null;
                this._sessionToken = null;
                try { sessionStorage.removeItem('pgwidgets_session_id'); } catch(e) {}
                try { sessionStorage.removeItem('pgwidgets_session_token'); } catch(e) {}
                // Build a clean URL without session/token params.
                let cleanUrl = new URL(window.location.href);
                cleanUrl.searchParams.delete('session');
                cleanUrl.searchParams.delete('token');
                document.body.innerHTML =
                    '<div style="padding:2em;font-family:sans-serif">' +
                    '<h2>Connection Rejected</h2>' +
                    '<p>' + reason + '</p>' +
                    '<p><a href="' + cleanUrl.href + '">Start a new session</a></p></div>';
                return;
            }
            if (this._reconnect) {
                setTimeout(() => this.connect(), this._reconnectInterval);
            }
        };

        this._ws.onerror = (e) => {
            console.error("RemoteInterface: WebSocket error", e);
        };
    }

    /** Closes the WebSocket connection. */
    disconnect() {
        this._reconnect = false;
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
    }

    /** @private */
    _onMessage(event) {
        // Binary frame: pair with the most recently queued JSON header
        // (FIFO).  Two header types reserve a binary frame:
        //   * binary-call  — single-payload call (existing fast path)
        //   * binary-chunk — one chunk of a chunked transfer (when
        //                    encoding === "binary"; base64 chunks
        //                    carry their data inline and don't reserve)
        if (event.data instanceof ArrayBuffer
                || event.data instanceof Blob) {
            let header = this._pendingBinary && this._pendingBinary.shift();
            if (!header) {
                console.error("RemoteInterface: unexpected binary frame "
                              + "with no queued header");
                return;
            }
            if (header.type === "binary-chunk") {
                this._handleBinaryChunk(header, event.data);
            } else {
                this._handleBinaryCall(header, event.data);
            }
            return;
        }

        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            console.error("RemoteInterface: invalid JSON", event.data);
            return;
        }

        // Queue the binary-call header; the next binary frame is its data.
        if (msg && msg.type === "binary-call") {
            if (!this._pendingBinary) this._pendingBinary = [];
            this._pendingBinary.push(msg);
            return;
        }

        // Chunked binary transfer: announce header opens the transfer,
        // subsequent binary-chunk messages add data.  Encoding is
        // per-chunk so a sender can mix raw frames and base64 in one
        // transfer if it wants — typically a sender will pick one and
        // stick with it.
        if (msg && msg.type === "binary-call-chunked") {
            this._handleBinaryCallChunked(msg);
            return;
        }
        if (msg && msg.type === "binary-chunk") {
            let encoding = msg.encoding || "binary";
            if (encoding === "binary") {
                // Pair with next binary frame.
                if (!this._pendingBinary) this._pendingBinary = [];
                this._pendingBinary.push(msg);
            } else if (encoding === "base64") {
                // Decode inline data; no following binary frame.
                let payload = this._decodeBase64(msg.data || "");
                this._handleBinaryChunk(msg, payload);
            } else {
                console.error("RemoteInterface: unknown binary-chunk "
                              + "encoding: " + encoding);
            }
            return;
        }

        // batch support: array of messages -> array of results
        if (Array.isArray(msg)) {
            let results = [];
            for (let m of msg) {
                results.push(this._dispatch(m));
            }
            this._send(results);
            return;
        }

        let result = this._dispatch(msg);
        if (result !== undefined) {
            this._send(result);
        }
    }

    /**
     * Decode a base64 string to a Uint8Array.  Used for binary-chunk
     * messages with encoding="base64".
     * @private
     */
    _decodeBase64(str) {
        let bin = atob(str);
        let len = bin.length;
        let out = new Uint8Array(len);
        for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
        return out.buffer;
    }

    /**
     * Open a chunked binary transfer.  The announce header carries the
     * destination (wid + method), the JSON args that follow the binary
     * payload on the JS side, and the number of chunks to expect.
     *
     * Optional ``shape`` / ``dtype`` fields on the announce promote
     * the delivered payload from a raw ``ArrayBuffer`` to a typed
     * array (``Uint8Array``, ``Float32Array``, …) — pgwidgets-python
     * sets these when a ``Buffer`` is passed as an argument.
     * @private
     */
    _handleBinaryCallChunked(msg) {
        if (!this._chunkTransfers) this._chunkTransfers = new Map();
        if (this._chunkTransfers.has(msg.transfer_id)) {
            console.warn("RemoteInterface: transfer_id "
                         + msg.transfer_id + " already open; overwriting");
        }
        this._chunkTransfers.set(msg.transfer_id, {
            wid: msg.wid,
            method: msg.method,
            args: msg.args || [],
            num_chunks: msg.num_chunks,
            received: new Array(msg.num_chunks),
            count: 0,
            shape: msg.shape || null,
            dtype: msg.dtype || null,
        });
    }

    /**
     * Append one chunk to an in-flight transfer.  When the last chunk
     * arrives, concatenate everything into a single Uint8Array and
     * dispatch to the target widget's method.  ``payload`` is an
     * ArrayBuffer (binary frame) or Blob.
     * @private
     */
    _handleBinaryChunk(header, payload) {
        let transfer = this._chunkTransfers
            && this._chunkTransfers.get(header.transfer_id);
        if (!transfer) {
            console.warn("RemoteInterface: binary-chunk for unknown "
                         + "transfer_id " + header.transfer_id);
            return;
        }
        let tid = header.transfer_id;
        let idx = header.chunk_index;
        // Normalize Blob to ArrayBuffer asynchronously, then process.
        if (payload instanceof Blob) {
            payload.arrayBuffer().then(buf => {
                this._storeChunk(tid, idx, buf);
            });
        } else {
            this._storeChunk(tid, idx, payload);
        }
    }

    /** @private */
    _storeChunk(tid, idx, buffer) {
        let transfer = this._chunkTransfers && this._chunkTransfers.get(tid);
        if (!transfer) return;
        if (idx < 0 || idx >= transfer.num_chunks) {
            console.error("RemoteInterface: chunk_index " + idx
                          + " out of range for transfer "
                          + "(num_chunks=" + transfer.num_chunks + ")");
            return;
        }
        if (transfer.received[idx] !== undefined) {
            console.warn("RemoteInterface: duplicate chunk_index " + idx);
            return;
        }
        transfer.received[idx] = buffer;
        transfer.count++;
        if (transfer.count < transfer.num_chunks) return;
        // All chunks present — reassemble and dispatch.
        this._chunkTransfers.delete(tid);
        let total = 0;
        for (let b of transfer.received) total += b.byteLength;
        let out = new Uint8Array(total);
        let off = 0;
        for (let b of transfer.received) {
            out.set(new Uint8Array(b), off);
            off += b.byteLength;
        }
        let widget = Callback._registry.get(transfer.wid);
        if (!widget) {
            console.warn("binary-call-chunked for unknown wid",
                         transfer.wid);
            return;
        }
        let method = widget[transfer.method];
        if (typeof method !== 'function') {
            console.warn("binary-call-chunked: " + transfer.method
                         + " is not a function on "
                         + widget.constructor.name);
            return;
        }
        // If the sender attached a dtype, deliver a typed array so
        // the receiver doesn't have to second-guess byte layout.
        // Otherwise pass the raw ArrayBuffer (existing behavior).
        let firstArg;
        if (transfer.dtype) {
            let Ctor = RemoteInterface._TYPED_ARRAY_CTORS[transfer.dtype];
            if (!Ctor) {
                console.error("RemoteInterface: unknown dtype "
                              + transfer.dtype + "; delivering raw "
                              + "ArrayBuffer");
                firstArg = out.buffer;
            } else {
                firstArg = new Ctor(out.buffer);
            }
        } else {
            firstArg = out.buffer;
        }
        try {
            method.apply(widget, [firstArg].concat(transfer.args));
        } catch (e) {
            console.error("binary-call-chunked dispatch error:", e);
        }
    }

    /** @private */
    _handleBinaryCall(header, payload) {
        let widget = Callback._registry.get(header.wid);
        if (!widget) {
            console.warn("binary-call for unknown wid", header.wid);
            return;
        }
        let method = widget[header.method];
        if (typeof method !== 'function') {
            console.warn("binary-call: " + header.method
                         + " is not a function on " + widget.constructor.name);
            return;
        }
        // The binary payload is the FIRST argument, followed by any
        // additional args from the JSON header.  Putting the binary
        // first lets JS method signatures match their Python
        // counterparts (data first, metadata after).
        let args = [payload].concat(header.args || []);
        try {
            method.apply(widget, args);
        } catch (e) {
            console.error("binary-call dispatch error:", e);
        }
    }

    /** @private */
    _dispatch(msg) {
        try {
            switch (msg.type) {
            case "init":
                return this._handleInit(msg);
            case "session-info":
                return this._handleSessionInfo(msg);
            case "reconstruct-start":
                return this._handleReconstructStart(msg);
            case "reconstruct-end":
                return this._handleReconstructEnd(msg);
            case "create":
                return this._handleCreate(msg);
            case "call":
                return this._handleCall(msg);
            case "listen":
                return this._handleListen(msg);
            case "unlisten":
                return this._handleUnlisten(msg);
            case "register-font":
                return this._handleRegisterFont(msg);
            case "set-default-font":
                return this._handleSetDefaultFont(msg);
            default:
                return {type: "error", id: msg.id,
                        error: "Unknown message type: " + msg.type};
            }
        } catch (e) {
            return {type: "error", id: msg.id, error: e.message};
        }
    }

    /**
     * Handle an init message: destroy all existing widgets, clear
     * listeners, and reset the document body. This allows a fresh
     * Python application to start with a clean slate without requiring
     * a browser reload.
     *
     * The ack includes session_id and token from sessionStorage so the
     * server can reconnect us to an existing session.
     * @private
     */
    _handleInit(msg) {
        // Build the result with stored credentials FIRST, before any
        // cleanup that might throw — the server needs these to
        // reconnect us to an existing session.
        let result = {type: "result", id: msg.id};
        if (this._sessionId !== null && this._sessionToken !== null) {
            result.session_id = this._sessionId;
            result.token = this._sessionToken;
        }

        // Destroy all registered widgets. Iterate over a copy since
        // destroy() mutates the registry.
        for (let [wid, widget] of [...Callback._registry]) {
            try { widget.destroy(); } catch (e) {
                console.warn("RemoteInterface: error destroying widget", e);
            }
        }
        Callback._registry.clear();
        Callback._nextId = 1;

        // Clear our listener map.
        this._listeners.clear();

        // Clear the document body of any leftover DOM.
        document.body.innerHTML = '';

        return result;
    }

    /**
     * Handle a session-info message: store the session ID and token
     * so we can reconnect to this session later.
     * @private
     */
    _handleSessionInfo(msg) {
        this._sessionId = msg.session_id;
        this._sessionToken = msg.token;
        this._saveSessionCredentials();
        this._updateUrl();
        console.log("RemoteInterface: session " + msg.session_id);
        // Send the current viewport size and listen for changes so the
        // server can answer get_screen_size() without a round-trip.
        this._sendViewport();
        if (!this._viewportListenerInstalled) {
            this._viewportListenerInstalled = true;
            window.addEventListener('resize', () => this._sendViewport());
        }
    }

    /**
     * Send the current browser viewport size to the server.
     * @private
     */
    _sendViewport() {
        this._send({
            type: "viewport",
            width: window.innerWidth,
            height: window.innerHeight,
        });
    }

    /**
     * Handle reconstruct-start: the server is about to replay the
     * widget tree. Clear the DOM and suppress callback dispatch.
     * @private
     */
    _handleReconstructStart(msg) {
        this._reconstructing = true;
        // Destroy all existing widgets and clear the registry so
        // reconstruction starts with a clean slate (same as init).
        for (let [wid, widget] of [...Callback._registry]) {
            widget.destroy();
        }
        Callback._registry.clear();
        // Set _nextId above all Python-allocated wids so auto-assigned
        // wids (from widgets created inside method calls, e.g.
        // MDISubWindow) never collide with Python wids.
        if (msg.next_wid !== undefined) {
            Callback._nextId = msg.next_wid;
        }
        this._listeners.clear();
        document.body.innerHTML = '';
        console.log("RemoteInterface: reconstruction started");
        return {type: "result", id: msg.id};
    }

    /**
     * Handle reconstruct-end: reconstruction is complete, re-enable
     * callback dispatch.
     * @private
     */
    _handleReconstructEnd(msg) {
        this._reconstructing = false;
        // Two-stage backstop for the 'map' lifecycle callback.
        //
        // Stage 1 (next rAF): trigger a visibility-aware re-check on
        // every widget — catches the case where layout settling lagged
        // the per-widget MutationObserver's first frame.
        //
        // Stage 2 (one more rAF later): force-fire 'map' for any
        // widget that's STILL unmapped, regardless of visibility or
        // size.  This covers widgets in detached subtrees (e.g.
        // TabWidget/StackWidget inactive pages, which are removed
        // from the DOM entirely and would otherwise never fire 'map'
        // until the user activates them).  Listeners can still run
        // their setup logic; if the widget later becomes really
        // visible, 'map' fires again with real geometry (multi-fire
        // is preferred over miss, per design).
        requestAnimationFrame(() => {
            for (let [, widget] of Callback._registry) {
                if (typeof widget._scheduleMapCheck === 'function') {
                    widget._scheduleMapCheck();
                }
                // Synthetic resize-family fires with the final
                // layout-settled sizes.  Resize events fired mid-
                // reconstruction were suppressed on the Python side
                // (state-replay echoes), so without this the user's
                // handler is stuck with whatever size happened to be
                // current when 'map' fired — even if the layout has
                // since settled to something different.  Firing here
                // lets a "regenerate sized to the widget" handler
                // catch up before the user notices a mismatched
                // bitmap.
                //
                // Two events are covered:
                //   'resize'      — every Widget (this.cb['resize']).
                //   'area-resize' — AbstractScrollArea (and its
                //                   ScrollArea subclass).  Carries
                //                   the inner content area size and
                //                   per-scrollbar dimensions, which
                //                   plain 'resize' can't report.
                if (widget.element && widget.element.isConnected) {
                    let box = widget.element.getBoundingClientRect();
                    let w = Math.round(box.width);
                    let h = Math.round(box.height);
                    if (w > 0 || h > 0) {
                        if (widget.cb && widget.cb['resize']) {
                            widget.make_callback('resize',
                                {width: w, height: h});
                        }
                        if (typeof widget._fireAreaResize
                                === 'function') {
                            widget._fireAreaResize();
                        }
                    }
                }
            }
            requestAnimationFrame(() => {
                for (let [, widget] of Callback._registry) {
                    if (typeof widget._forceFireMap === 'function'
                            && !widget._mapped) {
                        widget._forceFireMap();
                    }
                }
            });
        });
        console.log("RemoteInterface: reconstruction complete");
        return {type: "result", id: msg.id};
    }

    /**
     * Load session credentials from the URL query string (preferred)
     * or sessionStorage (fallback).  The URL is authoritative because
     * it lets the user open a specific session by pasting a link,
     * while sessionStorage is per-origin and may reference a
     * different session.
     * @private
     */
    _loadSessionCredentials() {
        // Try URL first: ?session=<id>&token=<token>
        try {
            let params = new URLSearchParams(window.location.search);
            let urlSid = params.get('session');
            let urlToken = params.get('token');
            if (urlSid !== null) {
                this._sessionId = /^\d+$/.test(urlSid)
                    ? parseInt(urlSid, 10) : urlSid;
                this._sessionToken = urlToken;
                return;
            }
        } catch (e) {
            // URLSearchParams may not be available in very old browsers.
        }

        // Fallback: sessionStorage
        try {
            this._sessionId = sessionStorage.getItem('pgwidgets_session_id');
            this._sessionToken = sessionStorage.getItem('pgwidgets_session_token');
            if (this._sessionId !== null && /^\d+$/.test(this._sessionId)) {
                this._sessionId = parseInt(this._sessionId, 10);
            }
        } catch (e) {
            // sessionStorage may be unavailable (e.g. sandboxed iframe).
        }
    }

    /**
     * Save session credentials to sessionStorage.
     * @private
     */
    _saveSessionCredentials() {
        try {
            sessionStorage.setItem('pgwidgets_session_id',
                                   String(this._sessionId));
            sessionStorage.setItem('pgwidgets_session_token',
                                   this._sessionToken);
        } catch (e) {
            // sessionStorage may be unavailable.
        }
    }

    /**
     * Update the browser URL to include the session ID and token
     * so the link can be shared or bookmarked for reconnection.
     * Uses replaceState to avoid polluting the back-button history.
     * @private
     */
    _updateUrl() {
        try {
            let url = new URL(window.location);
            url.searchParams.set('session', String(this._sessionId));
            if (this._sessionToken) {
                url.searchParams.set('token', this._sessionToken);
            }
            window.history.replaceState(null, '', url);
        } catch (e) {
            // history API may be unavailable.
        }
    }

    /** @private */
    _handleCreate(msg) {
        let cls = this._classMap[msg.class];
        if (!cls) {
            return {type: "error", id: msg.id,
                    error: "Unknown widget class: " + msg.class};
        }
        let args = this._resolveArgs(msg.args || []);
        // Save anything currently at msg.wid; an internal sub-widget
        // from a previous constructor may have grabbed that wid as
        // its auto-id, and we need to relocate it before assigning
        // msg.wid to the new widget.
        let displaced = null;
        if (msg.wid !== undefined) {
            displaced = Callback._registry.get(msg.wid);
        }
        // Bump _nextId past msg.wid BEFORE constructing, so super()
        // inside the constructor (Callback's wid = _nextId++) cannot
        // auto-assign a wid that collides with a previously-assigned
        // Python wid and silently overwrite that widget in the
        // registry.  This matters whenever a class registered in the
        // classMap does not call super() (so msg.wid stays "ahead" of
        // _nextId), e.g. plain JS classes layered onto pgwidgets-js
        // via a merged classMap.
        if (msg.wid !== undefined && Callback._nextId <= msg.wid) {
            Callback._nextId = msg.wid + 1;
        }
        let beforeNextId = Callback._nextId;
        let widget = new cls(...args);
        // console.log("[CREATE] msg.wid=" + msg.wid
        //             + " class=" + msg.class
        //             + " auto_wid=" + widget.wid
        //             + " _nextId before=" + beforeNextId
        //             + " after=" + Callback._nextId
        //             + " displaced=" + (displaced
        //                 ? displaced.constructor.name : "none"));
        if (msg.wid !== undefined) {
            let autoWid = widget.wid;
            if (autoWid !== msg.wid) {
                Callback._registry.delete(autoWid);
            }
            // Relocate any displaced widget to a fresh auto-wid.
            if (displaced && displaced !== widget) {
                console.warn("[_handleCreate] wid=" + msg.wid
                    + " (" + msg.class + ") displaced "
                    + displaced.constructor.name
                    + " (auto-wid=" + msg.wid
                    + "); relocating displaced to new wid="
                    + Callback._nextId);
                let newWid = Callback._nextId++;
                displaced.wid = newWid;
                Callback._registry.set(newWid, displaced);
            }
            widget.wid = msg.wid;
            // If we're replacing an existing widget at this wid, drop
            // any _listeners entries pointing at the old instance —
            // otherwise subsequent "listen" messages get dedup'd and
            // the new widget's cb stays empty.
            for (let key of [...this._listeners.keys()]) {
                if (key.startsWith(msg.wid + ":")) {
                    this._listeners.delete(key);
                }
            }
            Callback._registry.set(msg.wid, widget);
        }
        return {type: "result", id: msg.id, wid: widget.wid,
                next_wid: Callback._nextId};
    }

    /** @private */
    _handleCall(msg) {
        let widget = Callback._registry.get(msg.wid);
        if (!widget) {
            return {type: "error", id: msg.id,
                    error: "Unknown widget id: " + msg.wid};
        }
        if (typeof widget[msg.method] !== 'function') {
            return {type: "error", id: msg.id,
                    error: "Unknown method: " + msg.method + " on " +
                    widget.constructor.name};
        }
        let args = this._resolveArgs(msg.args || []);
        // Silent calls suppress callbacks (used for cross-browser sync)
        if (msg.silent) this._syncing = true;
        let result = widget[msg.method](...args);
        if (msg.silent) this._syncing = false;
        let response = {type: "result", id: msg.id};
        if (result !== undefined) {
            response.value = this._serializeValue(result);
        }
        return response;
    }

    /** @private */
    _handleListen(msg) {
        let widget = Callback._registry.get(msg.wid);
        if (!widget) {
            return {type: "error", id: msg.id,
                    error: "Unknown widget id: " + msg.wid};
        }
        let key = msg.wid + ":" + msg.action;
        if (this._listeners.has(key) && !this._reconstructing) {
            return {type: "result", id: msg.id};
        }
        // During reconstruction, remove the old listener before
        // re-registering so callbacks route to the new wrapper.
        let oldCb = this._listeners.get(key);
        if (oldCb) {
            widget.remove_callback(msg.action, oldCb);
            this._listeners.delete(key);
        }
        let cb = (w, ...args) => {
            // Suppress callbacks during cross-browser sync (silent calls
            // replay state without re-emitting it back).  Reconstruction
            // also suppresses most callbacks for the same reason, except
            // 'map' — it's a one-shot lifecycle event tied to the widget
            // becoming visually present.  Reconstruction can span
            // multiple rendering frames, and the layout observers may
            // fire mid-stream; suppressing 'map' there means the event
            // is lost for that widget's lifetime since the observers
            // disconnect after the single fire.
            if (this._syncing) {
                return;
            }
            if (this._reconstructing && msg.action !== 'map') {
                return;
            }
            // console.log("[JS-CB] firing wid=" + msg.wid
            //             + " action=" + msg.action
            //             + " widget_class=" + (w
            //                 ? w.constructor.name : "?")
            //             + " widget.wid=" + (w ? w.wid : "?"));
            // If the payload contains files with data, use chunked
            // transfer (works for drop-end, FileDialog, etc.).
            let payload = args[0];
            if (payload && typeof payload === 'object'
                    && payload.files && payload.files.length > 0
                    && payload.files.some(f => f.data)) {
                this._sendChunkedFiles(msg.wid, msg.action, payload);
                return;
            }
            // Suppress local file-read progress callbacks — the
            // chunked transfer generates its own progress on the
            // Python side.
            if (msg.action === 'drop-progress'
                    || msg.action === 'progress') {
                return;
            }
            this._send({
                type: "callback",
                wid: msg.wid,
                action: msg.action,
                args: args.map(a => this._serializeValue(a))
            });
        };
        this._listeners.set(key, cb);
        widget.enable_callback(msg.action);
        widget.add_callback(msg.action, cb);

        // Catch-up for the 'map' lifecycle callback.  During
        // reconstruction the layout observer can fire before the
        // listen for 'map' arrives (the listen is sent at the end of
        // _reconstruct_widget, after children are attached, which can
        // span multiple rendering frames).  Widget caches the latest
        // payload in _mappedEvent precisely so we can replay it here.
        if (msg.action === 'map'
                && widget._mapped && widget._mappedEvent) {
            cb(widget, widget._mappedEvent);
        }

        // For "modified" actions, attach a debounced DOM input listener
        // so text changes are pushed to the server without the user
        // having to press Enter.
        if (msg.action === "modified") {
            this._attachModifiedListener(widget);
        }

        // For "toggled" on Expander, wrap toggleContent to fire the
        // callback with the new collapsed state.
        if (msg.action === "toggled" && typeof widget.toggleContent === "function") {
            this._wrapToggleContent(widget);
        }

        return {type: "result", id: msg.id};
    }

    /**
     * Attach a debounced DOM 'input' listener that fires the widget's
     * "modified" callback with the current value.  Works for any widget
     * that has an _input (TextEntry) or _textarea (TextArea) element.
     * @private
     */
    _attachModifiedListener(widget) {
        let el = widget._input || widget._textarea;
        if (!el) return;
        let timer = null;
        let listener = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                widget.make_callback("modified", el.value);
            }, 300);
        };
        el.addEventListener("input", listener);
        // Store so we can clean up on destroy/reconstruction
        widget._modifiedListener = listener;
        widget._modifiedElement = el;
    }

    /**
     * Wrap an Expander's toggleContent so it fires a "toggled"
     * callback with the new collapsed state after each toggle.
     * @private
     */
    _wrapToggleContent(widget) {
        if (widget._toggleWrapped) return;
        let orig = widget.toggleContent.bind(widget);
        widget.toggleContent = function() {
            orig();
            widget.make_callback("toggled", widget.collapsed);
        };
        widget._toggleWrapped = true;
    }

    /** @private */
    _handleUnlisten(msg) {
        let widget = Callback._registry.get(msg.wid);
        if (!widget) {
            return {type: "error", id: msg.id,
                    error: "Unknown widget id: " + msg.wid};
        }
        let key = msg.wid + ":" + msg.action;
        let cb = this._listeners.get(key);
        if (cb) {
            widget.remove_callback(msg.action, cb);
            this._listeners.delete(key);
        }
        return {type: "result", id: msg.id};
    }

    /**
     * Register a custom font with the document.  ``msg.url`` is
     * the location the bytes are served from (the Application's
     * built-in HTTP server exposes ``/_pgwidgets/font/<id>``).
     * Uses the FontFace API so the registration is observable by
     * every widget that subsequently reads computed font styles.
     * @private
     */
    _handleRegisterFont(msg) {
        if (typeof FontFace === 'undefined') {
            return {type: "result", id: msg.id};
        }
        // Resolve relative URLs against the page so a font served
        // by ``Application._start_http_server`` works whether
        // pgwidgets is being run with the built-in server or
        // embedded in a Flask/nginx stack on a different port.
        let url = new URL(msg.url, window.location.href).href;
        let weight = RemoteInterface._normalizeFontWeight(msg.weight);
        let style  = RemoteInterface._normalizeFontStyle(msg.style);
        let face = new FontFace(
            msg.family, `url(${url})`,
            {weight: weight, style: style});
        face.load().then(f => {
            document.fonts.add(f);
        }).catch(err => {
            console.warn(
                'pgwidgets: failed to load font',
                msg.family, weight, style, url, err);
        });
        return {type: "result", id: msg.id};
    }

    /**
     * CSS ``font-weight`` only accepts ``normal`` / ``bold`` /
     * ``bolder`` / ``lighter`` / numeric ``1``-``1000``, but TTF
     * metadata commonly uses descriptive names like ``thin``,
     * ``light``, ``medium``, ``black``, etc.  Translate the usual
     * suspects to their numeric equivalents (per the
     * ``font-weight`` mapping table in the CSS Fonts spec).
     * Unknown values pass through so a caller can still send a
     * raw numeric weight (e.g. ``'350'``) and have it work.
     * @private
     */
    static _normalizeFontWeight(w) {
        if (w == null || w === '') return 'normal';
        let s = String(w).toLowerCase().replace(/[\s_-]+/g, '');
        const map = {
            'thin':         '100',
            'hairline':     '100',
            'extralight':   '200',
            'ultralight':   '200',
            'light':        '300',
            'normal':       '400',
            'regular':      '400',
            'book':         '400',
            'medium':       '500',
            'semibold':     '600',
            'demibold':     '600',
            'bold':         '700',
            'extrabold':    '800',
            'ultrabold':    '800',
            'black':        '900',
            'heavy':        '900',
            'extrablack':   '950',
            'ultrablack':   '950',
        };
        if (s in map) return map[s];
        // Pass-through: already a numeric string or a CSS
        // relative keyword.  FontFace will reject anything
        // genuinely invalid and the load promise will reject,
        // surfacing the warning in our catch handler.
        return String(w);
    }

    /**
     * CSS ``font-style`` accepts ``normal`` / ``italic`` /
     * ``oblique`` (optionally with an angle).  ``slanted`` and
     * other descriptive variants get mapped to ``italic`` --
     * the closest semantic match -- so a TTF tagged with one of
     * them still loads.
     * @private
     */
    static _normalizeFontStyle(s) {
        if (s == null || s === '') return 'normal';
        let t = String(s).toLowerCase().replace(/[\s_-]+/g, '');
        if (t === 'normal' || t === 'roman' || t === 'upright') {
            return 'normal';
        }
        if (t === 'italic' || t === 'italics' || t === 'slanted') {
            return 'italic';
        }
        if (t.startsWith('oblique')) return 'oblique';
        return String(s);
    }

    /**
     * Apply (or clear) the document-level default font.  Writes
     * a managed ``<style id="pg-default-font">`` element on
     * ``<head>`` that sets ``--pg-default-font-*`` CSS variables
     * on ``:root``.  The base widget stylesheet consumes these
     * variables, so any widget that has no explicit ``set_font``
     * inherits the default.  ``msg.font === null`` clears it.
     * @private
     */
    _handleSetDefaultFont(msg) {
        let styleEl = document.getElementById('pg-default-font');
        if (msg.font == null) {
            if (styleEl) styleEl.remove();
            return {type: "result", id: msg.id};
        }
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'pg-default-font';
            document.head.appendChild(styleEl);
        }
        let f = msg.font;
        let decls = [`--pg-default-font-family: ${f.family}`];
        if (f.size   != null) decls.push(`--pg-default-font-size: ${f.size}px`);
        if (f.weight != null) decls.push(`--pg-default-font-weight: ${f.weight}`);
        if (f.style  != null) decls.push(`--pg-default-font-style: ${f.style}`);
        styleEl.textContent = `:root { ${decls.join('; ')}; }`;
        return {type: "result", id: msg.id};
    }

    /**
     * Recursively resolves widget references in an arguments array.
     * Objects with a __wid__ key are replaced with the actual widget.
     * @private
     */
    _resolveArgs(args) {
        return args.map(arg => {
            if (arg === null || arg === undefined) {
                return arg;
            }
            if (typeof arg === 'object' && '__wid__' in arg) {
                let widget = Callback._registry.get(arg.__wid__);
                if (!widget) {
                    throw new Error("Unknown widget id: " + arg.__wid__);
                }
                return widget;
            }
            if (Array.isArray(arg)) {
                return this._resolveArgs(arg);
            }
            if (typeof arg === 'object') {
                let resolved = {};
                for (let k in arg) {
                    resolved[k] = this._resolveArgs([arg[k]])[0];
                }
                return resolved;
            }
            return arg;
        });
    }

    /**
     * Serializes a value for JSON transport.
     * Widget instances are converted to {__wid__: N}.
     * @private
     */
    _serializeValue(val) {
        if (val instanceof Callback) {
            return {__wid__: val.wid,
                    __class__: val.constructor.name};
        }
        if (Array.isArray(val)) {
            return val.map(v => this._serializeValue(v));
        }
        if (val !== null && typeof val === 'object') {
            let out = {};
            for (let k in val) {
                out[k] = this._serializeValue(val[k]);
            }
            return out;
        }
        return val;
    }

    /**
     * Send a callback with file data using chunked transfer.
     * Sends the callback first with metadata only (no file data),
     * then sends file data as binary-chunk header + raw binary frame
     * pairs, yielding between chunks via setTimeout(0) to keep the
     * WebSocket responsive for other traffic.
     *
     * Each file's ``data`` field is expected to be an ``ArrayBuffer``
     * (the drop handler in Widget.js uses ``readAsArrayBuffer``).
     * Empty files are still announced with one zero-length chunk.
     *
     * @param {number} wid - Widget ID.
     * @param {string} action - Callback action name.
     * @param {Object} payload - Payload with a `files` array, each
     *   carrying ``{name, size, type, data: ArrayBuffer}``.
     * @private
     */
    _sendChunkedFiles(wid, action, payload) {
        let transferId = this._nextTransferId++;
        let chunkSize = this._chunkSize;

        // Build metadata-only payload (strip file data).  ``encoding``
        // describes the eventual `data` field's wire form (currently
        // always "bytes"; reserved for "base64" if a future sender
        // delivers the file body without binary frame reassembly).
        let metaFiles = payload.files.map(f => ({
            name: f.name,
            size: f.size,
            type: f.type,
            encoding: f.encoding || 'bytes',
        }));
        let metaPayload = Object.assign({}, payload, {
            transfer_id: transferId,
            files: metaFiles,
        });
        this._send({
            type: "callback",
            wid: wid,
            action: action,
            args: [this._serializeValue(metaPayload)],
        });

        // Build a flat list of (header, slice) pairs to send.  The
        // header rides as JSON; the slice rides as a raw binary frame
        // on the very next send.  Per-chunk encoding lets a future
        // sender pick base64-inline if the transport can't carry raw
        // binary; here we always emit raw frames.
        let pairs = [];
        for (let fi = 0; fi < payload.files.length; fi++) {
            let buf = payload.files[fi].data;
            // Normalize: caller may legitimately have no data (zero
            // byte file).  Empty array buffer keeps the chunk count at 1.
            if (!buf) buf = new ArrayBuffer(0);
            let byteLen = buf.byteLength;
            let numChunks = Math.max(1, Math.ceil(byteLen / chunkSize));
            for (let ci = 0; ci < numChunks; ci++) {
                let start = ci * chunkSize;
                let end = Math.min(start + chunkSize, byteLen);
                let slice = buf.slice(start, end);
                pairs.push({
                    header: {
                        type: "binary-chunk",
                        wid: wid,
                        transfer_id: transferId,
                        file_index: fi,
                        file_count: payload.files.length,
                        chunk_index: ci,
                        num_chunks: numChunks,
                        encoding: "binary",
                    },
                    payload: slice,
                });
            }
        }

        // Send pairs one at a time, yielding between each.  Header
        // and payload of the same pair go back-to-back so the
        // receiver can pair them by FIFO order (no other binary
        // sends are interleaved on this socket).
        let i = 0;
        let sendNext = () => {
            if (i < pairs.length) {
                let p = pairs[i];
                this._send(p.header);
                this._sendBinaryFrame(p.payload);
                i++;
                setTimeout(sendNext, 0);
            }
        };
        setTimeout(sendNext, 0);
    }

    /** @private */
    _send(msg) {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify(msg));
        }
    }

    /**
     * Send a raw binary WebSocket frame.  Used by the chunked
     * transfer path; ``data`` is an ArrayBuffer or typed array.
     * @private
     */
    _sendBinaryFrame(data) {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(data);
        }
    }
}

export { RemoteInterface };
