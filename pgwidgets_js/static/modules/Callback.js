"use strict";

/**
 * Base class providing identity (wid), a global registry, a callback
 * system, and a small utility helper.  This is the lightest base for
 * objects that need to participate in the pgwidgets callback / remote
 * protocol but have no DOM presence (Timer, FileDialog, etc.).
 *
 * Visual widgets extend Widget, which itself extends Callback.
 */
class Callback {

    static _nextId = 1;
    static _registry = new Map();

    constructor() {
        // Skip over any registry slot that's already occupied so we
        // never silently overwrite a widget at an in-use wid.  This
        // matters under the remote interface: a class in the classMap
        // that doesn't call super() (e.g. a plain JS class layered on
        // top) leaves _nextId behind the Python-assigned wid range,
        // and the next super() call would otherwise clobber a real
        // widget there.  RemoteInterface._handleCreate also bumps
        // _nextId past msg.wid, this is a defensive backstop.
        while (Callback._registry.has(Callback._nextId)) {
            Callback._nextId++;
        }
        this.wid = Callback._nextId++;
        Callback._registry.set(this.wid, this);

        this.cb = {};
        this._destroyed = false;

        // JavaScript hack to bind "this" correctly for our methods
        this.enable_callback = this.enable_callback.bind(this);
        this.add_callback = this.add_callback.bind(this);
        this.clear_callback = this.clear_callback.bind(this);
        this.remove_callback = this.remove_callback.bind(this);
        this.make_callback = this.make_callback.bind(this);
    }

    /* CALLBACK HANDLING */

    /**
     * Registers a new callback action type.
     * @param {string} action - The name of the callback action to enable.
     */
    enable_callback(action) {
        if (!(action in this.cb)) {
            this.cb[action] = [];
        }
    }

    /**
     * Returns whether the given callback action has been enabled.
     * @param {string} action - The callback action name.
     * @returns {boolean} True if the action is enabled, false otherwise.
     */
    has_callback(action) {
        return action in this.cb;
    }

    /**
     * Adds a callback function for the given action.
     * The callback receives (widget, ...args) when triggered.
     * @param {string} action - The callback action name.
     * @param {Function} cb_fn - The callback function to add.
     */
    add_callback(action, cb_fn) {
        if (!(action in this.cb)) {
            throw new Error(
                `Unknown callback action '${action}' on ${this.constructor.name} (wid=${this.wid}). ` +
                `Available: ${Object.keys(this.cb).join(', ')}`);
        }
        let cb_list = this.cb[action];
        let idx = cb_list.indexOf(cb_fn);
        if (idx == -1) {
            // only add if cb_fn is not already present
            cb_list.push(cb_fn);
        }
    }

    /**
     * Removes a specific callback function for the given action.
     * @param {string} action - The callback action name.
     * @param {Function} cb_fn - The callback function to remove.
     */
    remove_callback(action, cb_fn) {
        if (!(action in this.cb)) {
            return
        }
        let cb_list = this.cb[action];
        let idx = cb_list.indexOf(cb_fn);
        if (idx > -1) {
            cb_list.splice(idx, 1);
        }
    }

    /**
     * Removes all callback functions for the given action.
     * @param {string} action - The callback action name.
     */
    clear_callback(action) {
        if (!(action in this.cb)) {
            return
        }
        this.cb[action] = [];
    }

    /**
     * Invokes all registered callbacks for the given action.
     * Each callback receives (this, ...args). Exceptions are caught and logged.
     * @param {string} action - The callback action name.
     * @param {...*} args - Additional arguments passed to each callback.
     */
    make_callback(action, ...args) {
        let cb_list = this.cb[action];
        if (!cb_list) return;  // action not enabled — nothing to fire
        let params = [...args];  // shallow copy
        for (let cb_fn of cb_list) {
            // catch exceptions and log them but continue to invoke callbacks
            try {
                (cb_fn)(this, ...params);
            } catch (error) {
                console.error(error);
            }
        }
    }

    /* UTILITY FUNCTIONS */

    /**
     * Retrieves an option value from an object, returning a default if not present.
     * @param {Object} obj - The options object.
     * @param {string} key - The key to look up.
     * @param {*} default_value - Value to return if key is not found.
     * @returns {*} The option value or the default.
     */
    get_option(obj, key, default_value) {
        if (key in obj) {
            return obj[key];
        }
        return default_value;
    }

    /**
     * Tear down this object: clear callbacks and drop from the global
     * registry so it can be garbage collected.  Safe to call more than
     * once; subsequent calls are no-ops.  Subclasses should override and
     * call super.destroy() last.
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        this.cb = {};
        Callback._registry.delete(this.wid);
    }
}

export { Callback };
