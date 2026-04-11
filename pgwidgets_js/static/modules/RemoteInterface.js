"use strict";

import {Callback} from "./Callback.js";

/**
 * Remote interface for controlling pgwidgets over a WebSocket connection.
 * Receives JSON messages to create widgets, call methods, and listen for
 * callbacks. Results and callback events are sent back over the socket.
 *
 * Message protocol:
 *
 * Client -> Browser:
 *   {type: "create", id, class, args}     Create a widget, returns wid
 *   {type: "call", id, wid, method, args} Call a method, returns result
 *   {type: "listen", id, wid, action}     Register for a callback
 *   {type: "unlisten", id, wid, action}   Remove a callback listener
 *   [ msg, msg, ... ]                     Batch of messages
 *
 * Browser -> Client:
 *   {type: "result", id, wid?, value?}    Response to create/call/listen
 *   {type: "error", id, error}            Error response
 *   {type: "callback", wid, action, args} Callback event
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

        this._ws.onopen = () => {
            console.log("RemoteInterface: connected to " + this._url);
        };

        this._ws.onmessage = this._onMessage;

        this._ws.onclose = () => {
            console.log("RemoteInterface: disconnected");
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
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            console.error("RemoteInterface: invalid JSON", event.data);
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
    _dispatch(msg) {
        try {
            switch (msg.type) {
            case "init":
                return this._handleInit(msg);
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
     * @private
     */
    _handleInit(msg) {
        // Destroy all registered widgets. Iterate over a copy since
        // destroy() mutates the registry.
        for (let [wid, widget] of [...Callback._registry]) {
            widget.destroy();
        }
        Callback._registry.clear();
        Callback._nextId = 1;

        // Clear our listener map.
        this._listeners.clear();

        // Clear the document body of any leftover DOM.
        document.body.innerHTML = '';

        return {type: "result", id: msg.id};
    }

    /** @private */
    _handleCreate(msg) {
        let cls = this._classMap[msg.class];
        if (!cls) {
            return {type: "error", id: msg.id,
                    error: "Unknown widget class: " + msg.class};
        }
        let args = this._resolveArgs(msg.args || []);
        let widget = new cls(...args);
        // if the client assigned a wid, re-register under that id
        if (msg.wid !== undefined) {
            Callback._registry.delete(widget.wid);
            widget.wid = msg.wid;
            Callback._registry.set(widget.wid, widget);
        }
        return {type: "result", id: msg.id, wid: widget.wid};
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
        let result = widget[msg.method](...args);
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
        if (this._listeners.has(key)) {
            return {type: "result", id: msg.id};
        }
        let cb = (w, ...args) => {
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
        return {type: "result", id: msg.id};
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
            return {__wid__: val.wid};
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
