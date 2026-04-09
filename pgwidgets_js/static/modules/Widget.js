"use strict";

/**
 * Base class for all widgets. Provides DOM element management, callback system,
 * and common utility methods.
 */
class Widget {

    static _nextId = 1;
    static _registry = new Map();

    /**
     * Creates a new Widget instance.
     * Initializes the callback system and enables the 'resize' callback.
     */
    constructor () {
        this.wid = Widget._nextId++;
        Widget._registry.set(this.wid, this);
        this.element = null;
        this._enabled = true;

        // JavaScript hack to bind "this" correctly for our methods
        this.get_element = this.get_element.bind(this);
        this.set_border_width = this.set_border_width.bind(this);
        this.set_border_color = this.set_border_color.bind(this);
        this.init_style = this.init_style.bind(this);
        this.resize = this.resize.bind(this);
        this.set_enabled = this.set_enabled.bind(this);
        this.get_enabled = this.get_enabled.bind(this);
        this.set_tooltip = this.set_tooltip.bind(this);
        this.get_tooltip = this.get_tooltip.bind(this);
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.enable_callback = this.enable_callback.bind(this);
        this.add_callback = this.add_callback.bind(this);
        this.clear_callback = this.clear_callback.bind(this);
        this.remove_callback = this.remove_callback.bind(this);
        this.make_callback = this.make_callback.bind(this);

        this.cb = {}

        for (let name of ['resize']) {
            this.enable_callback(name);
        }

        // Install a ResizeObserver on this.element to emit a universal
        // 'resize' callback whenever the widget changes size. The
        // subclass constructor sets this.element AFTER super() returns,
        // so defer to a microtask so it's available.
        queueMicrotask(() => this._installResizeObserver());
    }

    /** @private */
    _installResizeObserver() {
        if (!this.element || this._widgetResizeObserver) return;
        let prevW = -1, prevH = -1;
        this._widgetResizeObserver = new ResizeObserver((entries) => {
            let rect = entries[0].contentRect;
            let w = Math.round(rect.width);
            let h = Math.round(rect.height);
            if (w === prevW && h === prevH) return;
            prevW = w;
            prevH = h;
            this.make_callback('resize', w, h);
        });
        this._widgetResizeObserver.observe(this.element);
    }

    /**
     * Initializes default inline styles on the widget element.
     * Sets position to relative and margin to 0.
     */
    init_style() {
        let style = this.element.style;
        style.position = 'relative';
        style['flex-basis'] = 'auto';
        style.margin = '0px';
    }

    /**
     * Returns the underlying DOM element for this widget.
     * @returns {HTMLElement} The DOM element.
     */
    get_element() {
        return this.element;
    }

    /**
     * Sets the border width on the widget element.
     * @param {number} width - Border width in pixels.
     */
    set_border_width(width) {
        this.element.style.borderWidth = width + 'px';
        this.element.style.borderStyle = width > 0 ? 'solid' : 'none';
    }

    /**
     * Sets the border color on the widget element.
     * @param {string} color - CSS color value.
     */
    set_border_color(color) {
        this.element.style['border-color'] = color;
    }

    /**
     * Resizes the widget to the given dimensions.
     * @param {number} width - Width in pixels.
     * @param {number} height - Height in pixels.
     */
    resize(width, height) {
        this.element.style.width = width + 'px';
        this.element.style.height = height + 'px';
    }

    /**
     * Returns the current size of the widget.
     * @returns {number[]} A tuple [width, height] in pixels.
     */
    get_size() {
        return [this.element.offsetWidth, this.element.offsetHeight];
    }

    /**
     * Sets the padding of the widget.
     * @param {number|number[]} padding - A single number for all sides, or
     *   an array of [left, top, right, bottom] values in pixels.
     */
    set_padding(padding) {
        if (Array.isArray(padding)) {
            this.element.style.padding =
                padding[1] + 'px ' + padding[2] + 'px ' +
                padding[3] + 'px ' + padding[0] + 'px';
        } else {
            this.element.style.padding = padding + 'px';
        }
    }

    /**
     * Sets the font properties of the widget.
     * @param {string} font - CSS font family name.
     * @param {number|null} [size=null] - Font size in points, or null to leave unchanged.
     * @param {string|null} [weight=null] - Font weight (e.g. 'bold', 'normal', '600'), or null to leave unchanged.
     * @param {string|null} [style=null] - Font style (e.g. 'italic', 'normal'), or null to leave unchanged.
     */
    set_font(font, size=null, weight=null, style=null) {
        this.element.style.fontFamily = font;
        if (size !== null) {
            this.element.style.fontSize = size + 'pt';
        }
        if (weight !== null) {
            this.element.style.fontWeight = weight;
        }
        if (style !== null) {
            this.element.style.fontStyle = style;
        }
    }

    /**
     * Enables or disables the widget. A disabled widget is visually dimmed
     * and does not respond to user interaction.
     * @param {boolean} tf - True to enable, false to disable.
     */
    set_enabled(tf) {
        this._enabled = tf;
        if (tf) {
            this.element.classList.remove('widget-disabled');
        } else {
            this.element.classList.add('widget-disabled');
        }
        // native form elements support the disabled attribute
        if ('disabled' in this.element) {
            this.element.disabled = !tf;
        }
    }

    /**
     * Returns whether the widget is currently enabled.
     * @returns {boolean} True if enabled, false if disabled.
     */
    get_enabled() {
        return this._enabled;
    }

    /**
     * Set a tooltip that appears when the user hovers over the widget.
     * Pass null or an empty string to clear. Uses the native browser
     * tooltip (the HTML `title` attribute).
     * @param {string|null} msg - Tooltip text, or null to clear.
     */
    set_tooltip(msg) {
        if (msg == null || msg === '') {
            this.element.removeAttribute('title');
        } else {
            this.element.setAttribute('title', msg);
        }
    }

    /**
     * @returns {string} The current tooltip text, or '' if none.
     */
    get_tooltip() {
        return this.element.getAttribute('title') || '';
    }

    /** Makes the widget visible. */
    show() {
        this.element.style.display = '';
    }

    /** Hides the widget. */
    hide() {
        this.element.style.display = 'none';
    }

    /**
     * Returns whether the widget is currently visible.
     * @returns {boolean} True if visible, false if hidden.
     */
    is_visible() {
        return this.element.style.display !== 'none';
    }

    /**
     * Tear down this widget: disconnect observers, clear callbacks, remove
     * the DOM element from its parent, and drop it from the widget
     * registry so it can be garbage collected. Safe to call more than
     * once; subsequent calls are no-ops. Subclasses that allocate extra
     * resources (timers, offscreen buffers, pending rAF, external
     * listeners) should override and call super.destroy() last.
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        if (this._widgetResizeObserver) {
            this._widgetResizeObserver.disconnect();
            this._widgetResizeObserver = null;
        }

        this.cb = {};

        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;

        Widget._registry.delete(this.wid);
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
     * Adds a callback function for the given action.
     * The callback receives (widget, ...args) when triggered.
     * @param {string} action - The callback action name.
     * @param {Function} cb_fn - The callback function to add.
     */
    add_callback(action, cb_fn) {
        if (!(action in this.cb)) {
            // TODO: raise an error
            this.cb[action] = [];
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
        let params = [...args];  // shallow copy
        for (let cb_fn of cb_list) {
            // catch exceptions and log them but continue to invoke callbacks
            try {
                //console.log("making callback '"+action+"' cb_fn="+cb_fn);
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

}

/**
 * Base class for container widgets that manage child widgets.
 * Extends Widget with child management (add, remove, get).
 * @extends Widget
 */
class ContainerWidget extends Widget {

    /**
     * Creates a new ContainerWidget instance with an empty children array.
     */
    constructor () {
        super();

        this.children = [];

        // JavaScript hack to bind "this" correctly for our methods
        this.get_children = this.get_children.bind(this);
        this.add = this.add.bind(this);
        this.add_child = this.add_child.bind(this);
        this.remove = this.remove.bind(this);
        this.remove_child = this.remove_child.bind(this);
    }
/*
    init_style() {
        super.init_style()

        let style = this.element.style;
        style.display = 'flex';
    }
*/
    
    /**
     * Returns the array of child widgets.
     * @returns {Widget[]} The children array.
     */
    get_children() {
        return this.children;
    }

    /**
     * Adds a child widget to the children array (no DOM manipulation).
     * Prevents duplicate additions.
     * @param {Widget} child - The child widget to add.
     * @returns {number} The existing index if already present, or -1 if newly added.
     */
    add_child(child) {
        let idx = this.children.indexOf(child);
        if (idx == -1) {
            // only add if child is not already present
            this.children.push(child);
        }
        return idx;
    }
    
    /**
     * Adds a child widget and appends its DOM element to this container's element.
     * @param {Widget} child - The child widget to add.
     */
    add(child) {
        let idx = this.add_child(child);
        if (idx == -1) {
            this.element.appendChild(child.get_element());
        }
    }
    
    /**
     * Removes a child widget from the children array (no DOM manipulation).
     * @param {Widget} child - The child widget to remove.
     * @returns {number} The index where the child was, or -1 if not found.
     */
    remove_child(child) {
        let idx = this.children.indexOf(child);
        if (idx > -1) {
            this.children.splice(idx, 1);
        }
        return idx;
    }

    /**
     * Removes a child widget and its DOM element from this container.
     * @param {Widget} child - The child widget to remove.
     */
    remove(child) {
        let idx = this.remove_child(child);
        if (idx > -1) {
            this.element.removeChild(child.get_element());
        }
    }

    /**
     * Destroy this container and all of its child widgets recursively.
     */
    destroy() {
        if (this._destroyed) return;
        // Iterate over a copy — children may mutate this.children.
        for (let child of this.children.slice()) {
            child.destroy();
        }
        this.children = [];
        super.destroy();
    }
}

export { Widget, ContainerWidget };

