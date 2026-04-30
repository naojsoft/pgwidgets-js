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

        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this._onMessage = this._onMessage.bind(this);
        this._dispatch = this._dispatch.bind(this);
        this._handleCreate = this._handleCreate.bind(this);
        this._handleCall = this._handleCall.bind(this);
        this._handleListen = this._handleListen.bind(this);
        this._handleUnlisten = this._handleUnlisten.bind(this);
        this._resolveArgs = this._resolveArgs.bind(this);
        this._serializeValue = this._serializeValue.bind(this);
        this._send = this._send.bind(this);

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

        this._ws.onmessage = this._onMessage;

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
        // Binary frame: pair with the most recently queued binary-call
        // header (FIFO).  Used for image streaming and similar cases
        // where base64 in JSON would inflate the payload by ~33%.
        if (event.data instanceof ArrayBuffer
                || event.data instanceof Blob) {
            let header = this._pendingBinary && this._pendingBinary.shift();
            if (!header) {
                console.error("RemoteInterface: unexpected binary frame "
                              + "with no queued header");
                return;
            }
            this._handleBinaryCall(header, event.data);
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
        // Args are followed by the binary payload as the last argument.
        let args = (header.args || []).concat([payload]);
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
            // Suppress callbacks during reconstruction or cross-browser
            // sync — these are side effects, not user actions.
            if (this._reconstructing || this._syncing) {
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
     * then sends file data as file-chunk messages, yielding between
     * chunks via setTimeout(0) to keep the WebSocket responsive for
     * other traffic.
     * @param {number} wid - Widget ID.
     * @param {string} action - Callback action name.
     * @param {Object} payload - Payload with a `files` array.
     * @private
     */
    _sendChunkedFiles(wid, action, payload) {
        let transferId = this._nextTransferId++;
        let chunkSize = this._chunkSize;

        // Build metadata-only payload (strip file data).
        let metaFiles = payload.files.map(f => ({
            name: f.name,
            size: f.size,
            type: f.type,
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

        // Build a flat list of all chunks to send.
        let chunks = [];
        for (let fi = 0; fi < payload.files.length; fi++) {
            let data = payload.files[fi].data || '';
            let numChunks = Math.max(1, Math.ceil(data.length / chunkSize));
            for (let ci = 0; ci < numChunks; ci++) {
                let slice = data.slice(ci * chunkSize,
                                       (ci + 1) * chunkSize);
                chunks.push({
                    type: "file-chunk",
                    wid: wid,
                    transfer_id: transferId,
                    file_index: fi,
                    file_count: payload.files.length,
                    chunk_index: ci,
                    num_chunks: numChunks,
                    data: slice,
                });
            }
        }

        // Send chunks one at a time, yielding between each to allow
        // other WebSocket messages to interleave.
        let i = 0;
        let sendNext = () => {
            if (i < chunks.length) {
                this._send(chunks[i]);
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
}

export { RemoteInterface };
