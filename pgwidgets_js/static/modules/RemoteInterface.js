"use strict";

import {Widget} from "./Widget.js";

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
            Widget._registry.delete(widget.wid);
            widget.wid = msg.wid;
            Widget._registry.set(widget.wid, widget);
        }
        return {type: "result", id: msg.id, wid: widget.wid};
    }

    /** @private */
    _handleCall(msg) {
        let widget = Widget._registry.get(msg.wid);
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
        let widget = Widget._registry.get(msg.wid);
        if (!widget) {
            return {type: "error", id: msg.id,
                    error: "Unknown widget id: " + msg.wid};
        }
        let key = msg.wid + ":" + msg.action;
        if (this._listeners.has(key)) {
            return {type: "result", id: msg.id};
        }
        let cb = (w, ...args) => {
            this._send({
                type: "callback",
                wid: msg.wid,
                action: msg.action,
                args: args.map(a => this._serializeValue(a))
            });
        };
        this._listeners.set(key, cb);
        widget.add_callback(msg.action, cb);
        return {type: "result", id: msg.id};
    }

    /** @private */
    _handleUnlisten(msg) {
        let widget = Widget._registry.get(msg.wid);
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
                let widget = Widget._registry.get(arg.__wid__);
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
        if (val instanceof Widget) {
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

    /** @private */
    _send(msg) {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify(msg));
        }
    }
}

export { RemoteInterface };
