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
        this._cursors = {};        // name -> CSS cursor value
        this._currentCursor = null; // name of active custom cursor, or null

        for (let name of ['map', 'resize']) {
            this.enable_callback(name);
        }
        this._mapped = false;

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
            // Fire 'map' once on first non-zero layout.
            if (!this._mapped && (w > 0 || h > 0)) {
                this._mapped = true;
                let box = this.element.getBoundingClientRect();
                let parentBox = this.element.parentElement
                    ? this.element.parentElement.getBoundingClientRect()
                    : {left: 0, top: 0};
                this.make_callback('map', {
                    x: Math.round(box.left - parentBox.left),
                    y: Math.round(box.top - parentBox.top),
                    viewport_x: Math.round(box.left),
                    viewport_y: Math.round(box.top),
                    width: w,
                    height: h,
                });
            }
            this.make_callback('resize', {width: w, height: h});
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
     * Sets the margin of the widget.
     * @param {number|number[]} margin - A single number for all sides, or
     *   an array of [left, top, right, bottom] values in pixels.
     */
    set_margins(margin) {
        if (Array.isArray(margin)) {
            this.element.style.margin =
                margin[1] + 'px ' + margin[2] + 'px ' +
                margin[3] + 'px ' + margin[0] + 'px';
        } else {
            this.element.style.margin = margin + 'px';
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
     * Give keyboard focus to this widget. The element must be focusable
     * (e.g. a form element, or have tabindex set via
     * _initInteractiveEvents({focusable: true})).
     */
    set_focus() {
        this.element.focus();
    }

    /* CURSOR MANAGEMENT */

    /**
     * Register a named custom cursor. The cursor image is loaded from
     * the given URL (can be an SVG, PNG, etc.). If `size` is provided
     * the image is rasterized to that size via an offscreen canvas;
     * otherwise the image's natural dimensions are used.
     *
     * Custom cursors are applied only to this.element, so sub-parts
     * of compound widgets (scrollbar thumbs, resize grips, etc.) that
     * set their own cursor are unaffected.
     *
     * @param {string} name - A name to reference this cursor later.
     * @param {string} url - URL or data URI of the cursor image.
     * @param {number} hotspot_x - Hotspot x in pixels (must be within
     *   the cursor bounds).
     * @param {number} hotspot_y - Hotspot y in pixels.
     * @param {number[]|null} [size=null] - Optional [width, height] in
     *   pixels to resize the cursor image.
     */
    add_cursor(name, url, hotspot_x, hotspot_y, size = null) {
        if (size) {
            // Rasterize at the requested size via an offscreen canvas.
            let img = new window.Image();
            img.onload = () => {
                let canvas = document.createElement('canvas');
                canvas.width = size[0];
                canvas.height = size[1];
                let ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, size[0], size[1]);
                let dataUrl = canvas.toDataURL('image/png');
                this._cursors[name] =
                    `url('${dataUrl}') ${hotspot_x} ${hotspot_y}, auto`;
                // If this cursor is already active, apply the now-ready value.
                if (this._currentCursor === name) {
                    this.element.style.cursor = this._cursors[name];
                }
            };
            img.src = url;
        } else {
            this._cursors[name] =
                `url('${url}') ${hotspot_x} ${hotspot_y}, auto`;
        }
    }

    /**
     * Set the cursor for this widget's main element.
     *
     * @param {string} name - Either a name previously registered with
     *   add_cursor(), or a standard CSS cursor keyword (e.g.
     *   'crosshair', 'pointer', 'default').  Pass null or 'default' to
     *   revert to the browser default.
     */
    set_cursor(name) {
        if (name == null || name === 'default') {
            this._currentCursor = null;
            this.element.style.cursor = '';
        } else if (name in this._cursors) {
            this._currentCursor = name;
            this.element.style.cursor = this._cursors[name];
        } else {
            // Assume it's a standard CSS cursor keyword.
            this._currentCursor = null;
            this.element.style.cursor = name;
        }
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

    /* INTERACTIVE EVENTS */

    /**
     * Names of the interactive event callbacks registered by
     * _initInteractiveEvents(). Exposed as a static list so subclasses
     * (and documentation) can reference the canonical set.
     */
    static INTERACTIVE_EVENTS = [
        'pointer-down', 'pointer-up', 'pointer-move', 'enter', 'leave',
        'click', 'dblclick', 'scroll',
        'key-down', 'key-up', 'key-press',
        'focus-in', 'focus-out',
        'drag-drop', 'drag-over', 'drag-progress', 'contextmenu',
    ];

    /**
     * Wire up pointer, mouse, keyboard, focus, and drag-drop DOM event
     * listeners on this.element. Each listener converts the raw DOM
     * event into a serializable payload via _eventToPayload() and fires
     * the corresponding pgwidgets callback.
     *
     * Call this from a subclass constructor after this.element is set.
     * Not all widgets need interactive events — only call it for widgets
     * that should respond to user input (Canvas, Image, etc.).
     *
     * @param {Object} [options]
     * @param {boolean} [options.focusable=false] - If true, set
     *   tabindex="0" on the element so it can receive keyboard and focus
     *   events.
     * @param {string|null} [options.cursor=null] - If non-null, set the
     *   CSS cursor style on the element.
     */
    _initInteractiveEvents(options = {}) {
        let focusable = options.focusable || false;
        let cursor = options.cursor || null;

        let el = this.element;

        for (let name of Widget.INTERACTIVE_EVENTS) {
            this.enable_callback(name);
        }

        if (focusable) {
            el.setAttribute('tabindex', '0');
        }
        if (cursor) {
            el.style.cursor = cursor;
        }

        // Pointer events.
        el.addEventListener('pointerdown', (e) => this._cb_redirect('pointer-down', e));
        el.addEventListener('pointermove', (e) => this._cb_redirect('pointer-move', e));
        el.addEventListener('pointerup', (e) => this._cb_redirect('pointer-up', e));
        el.addEventListener('pointerover', (e) => this._cb_redirect('enter', e));
        el.addEventListener('pointerout', (e) => this._cb_redirect('leave', e));

        // Mouse events.
        el.addEventListener('wheel', (e) => this._cb_redirect('scroll', e));
        el.addEventListener('click', (e) => this._cb_redirect('click', e));
        el.addEventListener('dblclick', (e) => this._cb_redirect('dblclick', e));

        // Drag-drop events (also callable standalone via enable_callback).
        this._initDragEvents();

        // Context menu.
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._cb_redirect('contextmenu', e);
        });

        // Keyboard events.
        el.addEventListener('keydown', (e) => this._cb_redirect('key-down', e), true);
        el.addEventListener('keyup', (e) => this._cb_redirect('key-up', e), true);
        el.addEventListener('keypress', (e) => this._cb_redirect('key-press', e), true);

        // Focus events.
        el.addEventListener('focus', (e) => this._cb_redirect('focus-in', e), true);
        el.addEventListener('focusout', (e) => this._cb_redirect('focus-out', e), true);
    }

    /** @private */
    _cb_redirect(action, event) {
        this.make_callback(action, this._eventToPayload(event));
    }

    /**
     * Convert a DOM Event into a plain, JSON-serializable object.
     *
     * DOM events can't cross the wire to Python as-is: their useful
     * fields live on the prototype (so JSON.stringify produces `{}`),
     * and they contain circular references via event.target. This
     * method extracts the relevant fields into a flat dict / object
     * that serializes cleanly. Local JS `add_callback` handlers also
     * receive this payload (not the raw DOM event).
     *
     * ### Common fields (all event types)
     *
     * | Field          | Type     | Description                                  |
     * |----------------|----------|----------------------------------------------|
     * | `type`         | string   | DOM event type, e.g. `"pointerdown"`,        |
     * |                |          | `"wheel"`, `"keydown"`.                      |
     * | `time_stamp`   | number   | High-resolution timestamp (ms) from          |
     * |                |          | `Event.timeStamp`.                           |
     *
     * ### Pointer / mouse fields
     * Present on: `pointer-down`, `pointer-up`, `pointer-move`,
     * `enter`, `leave`, `click`, `dblclick`, `scroll`,
     * `contextmenu`, `drag-drop`, `drag-over`.
     *
     * | Field            | Type     | Description                                |
     * |------------------|----------|--------------------------------------------|
     * | `x`              | number   | Horizontal position in widget-local pixels |
     * |                  |          | (0 = left edge of element).                |
     * | `y`              | number   | Vertical position in widget-local pixels   |
     * |                  |          | (0 = top edge of element).                 |
     * | `viewport_x`     | number   | Horizontal position relative to the        |
     * |                  |          | browser viewport.                          |
     * | `viewport_y`     | number   | Vertical position relative to the browser  |
     * |                  |          | viewport.                                  |
     * | `button_trigger` | number   | Which button triggered this event.         |
     * |                  |          | 1 = left, 2 = middle, 3 = right.           |
     * |                  |          | Meaningful on press/release/click events;   |
     * |                  |          | always 1 on move events.                   |
     * | `button_mask`    | number   | Bitmask of buttons currently held down.    |
     * |                  |          | 0x1 = left, 0x2 = middle, 0x4 = right.     |
     * |                  |          | Useful for detecting drag state during      |
     * |                  |          | pointer-move.                              |
     * | `modifiers`      | string[] | Modifier keys held during the event.       |
     * |                  |          | Possible values: `'alt'`, `'ctrl'`,        |
     * |                  |          | `'shift'`, `'meta'`. Empty array if none.  |
     *
     * ### Pointer-specific fields
     * Present on: `pointer-down`, `pointer-up`, `pointer-move`,
     * `enter`, `leave` (not on plain mouse events like
     * `click`, `dblclick`, `scroll`).
     *
     * | Field          | Type    | Description                                   |
     * |----------------|---------|-----------------------------------------------|
     * | `pointer_id`   | number  | Unique identifier for the pointer (useful for |
     * |                |         | multi-touch).                                 |
     * | `pointer_type` | string  | Input device: `"mouse"`, `"pen"`, or          |
     * |                |         | `"touch"`.                                    |
     * | `pressure`     | number  | Pressure of the pointer, 0.0 to 1.0. Mouse    |
     * |                |         | buttons report 0.5 when pressed, 0 otherwise. |
     * | `is_primary`   | boolean | True if this is the primary pointer in a       |
     * |                |         | multi-pointer scenario.                       |
     *
     * ### Wheel fields
     * Present on: `scroll`.
     *
     * | Field        | Type   | Description                                     |
     * |--------------|--------|-------------------------------------------------|
     * | `delta_x`    | number | Horizontal scroll amount.                       |
     * | `delta_y`    | number | Vertical scroll amount (positive = scroll down).|
     * | `delta_z`    | number | Z-axis scroll amount (rarely used).             |
     * | `delta_mode` | number | Unit of delta values: 0 = pixels, 1 = lines,   |
     * |              |        | 2 = pages.                                      |
     *
     * ### Keyboard fields
     * Present on: `key-down`, `key-up`, `key-press`.
     *
     * | Field       | Type    | Description                                      |
     * |-------------|---------|--------------------------------------------------|
     * | `key`       | string  | The key value, e.g. `"a"`, `"Enter"`,            |
     * |             |         | `"ArrowUp"`, `" "` (space).                      |
     * | `keycode`   | string  | Physical key code, e.g. `"KeyA"`,                |
     * |             |         | `"ArrowUp"`, `"Space"`. Independent of keyboard  |
     * |             |         | layout.                                          |
     * | `repeat`    | boolean | True if the key is being held down and this is   |
     * |             |         | an auto-repeat event.                            |
     * | `modifiers` | string[]| Same as pointer modifiers above.                 |
     *
     * ### Drag-over fields
     * Present on: `drag-over`. Includes pointer fields above, plus:
     *
     * | Field    | Type     | Description                                       |
     * |----------|----------|---------------------------------------------------|
     * | `types`  | string[] | MIME types offered by the drag source (e.g.       |
     * |          |          | `["Files"]`, `["text/plain", "text/html"]`).      |
     *
     * ### Drag-drop fields
     * Present on: `drag-drop`. Includes pointer fields above, plus:
     *
     * | Field    | Type     | Description                                       |
     * |----------|----------|---------------------------------------------------|
     * | `types`  | string[] | MIME types offered by the drag source.             |
     * | `text`   | string?  | Plain text data, or null.                         |
     * | `url`    | string?  | URI list data, or null.                           |
     * | `html`   | string?  | HTML data, or null.                               |
     * | `files`  | array    | Dropped files. Each entry:                        |
     * |          |          | `{name, size, type, data}` where `data` is a     |
     * |          |          | data URI (base64). `data` is null on read error   |
     * |          |          | (with an `error` field instead).                  |
     *
     * ### Drag-progress fields
     * Present on: `drag-progress`. Fired during file reading.
     *
     * | Field        | Type   | Description                                     |
     * |--------------|--------|-------------------------------------------------|
     * | `loaded`     | number | Bytes read so far for the current file.         |
     * | `total`      | number | Total bytes of the current file.                |
     * | `file_name`  | string | Name of the file being read.                    |
     * | `file_index` | number | Zero-based index of the file in the drop.       |
     * | `file_count` | number | Total number of files in the drop.              |
     *
     * @param {Event} event - The DOM event to convert.
     * @returns {Object} A plain object with the fields described above.
     * @private
     */
    _eventToPayload(event) {
        let rect = this.element.getBoundingClientRect();
        let out = {
            type: event.type,
            time_stamp: event.timeStamp,
        };
        // Pointer / mouse coordinates.
        if ('clientX' in event) {
            out.viewport_x = event.clientX;
            out.viewport_y = event.clientY;
            out.x = event.clientX - rect.left;
            out.y = event.clientY - rect.top;
            out.button_trigger = event.button + 1;
            // DOM buttons bitmask: 1=left, 2=right, 4=middle.
            // Remap to: 0x1=left, 0x2=middle, 0x4=right.
            let b = event.buttons;
            out.button_mask = (b & 1)
                | ((b & 4) >> 1)   // DOM middle (4) -> 0x2
                | ((b & 2) << 1);  // DOM right  (2) -> 0x4
            let mods = [];
            if (event.altKey) mods.push('alt');
            if (event.ctrlKey) mods.push('ctrl');
            if (event.shiftKey) mods.push('shift');
            if (event.metaKey) mods.push('meta');
            out.modifiers = mods;
        }
        // Pointer-specific.
        if ('pointerId' in event) {
            out.pointer_id = event.pointerId;
            out.pointer_type = event.pointerType;
            out.pressure = event.pressure;
            out.is_primary = event.isPrimary;
        }
        // Wheel.
        if ('deltaX' in event) {
            out.delta_x = event.deltaX;
            out.delta_y = event.deltaY;
            out.delta_z = event.deltaZ;
            out.delta_mode = event.deltaMode;
        }
        // Keyboard.
        if ('key' in event) {
            out.key = event.key;
            out.keycode = event.code;
            out.repeat = event.repeat;
            if (!out.modifiers) {
                let mods = [];
                if (event.altKey) mods.push('alt');
                if (event.ctrlKey) mods.push('ctrl');
                if (event.shiftKey) mods.push('shift');
                if (event.metaKey) mods.push('meta');
                out.modifiers = mods;
            }
        }
        return out;
    }

    /**
     * Wire up drag-drop DOM listeners on this.element. Called
     * automatically by _initInteractiveEvents, or on-demand when
     * enable_callback is called with a drag action on a widget that
     * hasn't opted into full interactive events. Idempotent.
     * @private
     */
    _initDragEvents() {
        if (this._dragEventsWired) return;
        this._dragEventsWired = true;

        let el = this.element;
        // dragenter + dragover must both preventDefault() and
        // stopPropagation() to claim the drop target — otherwise a
        // parent container can reset the drop state and the browser
        // clears dataTransfer before the drop handler runs.
        el.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._handleDragOver(e);
        });
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._handleDrop(e);
        });
    }

    /**
     * Handle a dragover event. Fires the 'drag-over' callback with
     * pointer position and the list of data types being offered.
     * @private
     */
    _handleDragOver(event) {
        // Show a "copy" cursor while hovering over the drop target.
        event.dataTransfer.dropEffect = 'copy';
        let payload = this._eventToPayload(event);
        payload.types = [...event.dataTransfer.types];
        this.make_callback('drag-over', payload);
    }

    /**
     * Handle a drop event. Reads all dropped files asynchronously via
     * FileReader, then fires the 'drag-drop' callback with the full
     * payload including file contents as data URIs.
     *
     * Fires 'drag-progress' callbacks during file reading:
     *   {loaded, total, file_name, file_index, file_count}
     *
     * The 'drag-drop' payload includes:
     * - Standard pointer/mouse fields from _eventToPayload().
     * - `types`   string[]  — MIME types offered by the drag source.
     * - `text`    string|null — plain text, if available.
     * - `url`     string|null — URI list, if available.
     * - `html`    string|null — HTML content, if available.
     * - `files`   array of {name, size, type, data} — dropped files.
     *   `data` is a data URI (base64-encoded).
     * @private
     */
    _handleDrop(event) {
        let payload = this._eventToPayload(event);
        let dt = event.dataTransfer;

        payload.types = [...dt.types];
        payload.text = dt.getData('text/plain') || null;
        payload.url = dt.getData('text/uri-list') || null;
        payload.html = dt.getData('text/html') || null;

        let files = dt.files;
        if (files.length === 0) {
            // No files — fire immediately with empty file list.
            payload.files = [];
            this.make_callback('drag-drop', payload);
            return;
        }

        // Read all files as data URIs, firing progress along the way.
        let fileCount = files.length;
        let results = new Array(fileCount);
        let completed = 0;

        for (let i = 0; i < fileCount; i++) {
            let file = files[i];
            let reader = new FileReader();

            reader.onprogress = (pe) => {
                if (pe.lengthComputable) {
                    this.make_callback('drag-progress', {
                        loaded: pe.loaded,
                        total: pe.total,
                        file_name: file.name,
                        file_index: i,
                        file_count: fileCount,
                    });
                }
            };

            reader.onload = () => {
                results[i] = {
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/octet-stream',
                    data: reader.result,   // data URI
                };
                completed++;
                // Fire progress for file completion.
                this.make_callback('drag-progress', {
                    loaded: file.size,
                    total: file.size,
                    file_name: file.name,
                    file_index: i,
                    file_count: fileCount,
                });
                if (completed === fileCount) {
                    payload.files = results;
                    this.make_callback('drag-drop', payload);
                }
            };

            reader.onerror = () => {
                results[i] = {
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/octet-stream',
                    data: null,
                    error: reader.error?.message || 'read error',
                };
                completed++;
                if (completed === fileCount) {
                    payload.files = results;
                    this.make_callback('drag-drop', payload);
                }
            };

            reader.readAsDataURL(file);
        }
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
        // Auto-wire drag DOM listeners the first time any drag callback
        // is enabled on a widget that hasn't called _initInteractiveEvents.
        if (!this._dragEventsWired
                && (action === 'drag-drop' || action === 'drag-over'
                    || action === 'drag-progress')) {
            this._initDragEvents();
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

