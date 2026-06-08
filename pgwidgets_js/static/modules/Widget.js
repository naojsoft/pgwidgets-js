"use strict";

import {Callback} from "./Callback.js";

/**
 * Base class for all visual widgets. Provides DOM element management,
 * interactive event handling, and common styling methods.
 * Inherits the callback system and identity from Callback.
 * @extends Callback
 */
class Widget extends Callback {

    /**
     * Creates a new Widget instance.
     * Initializes the callback system and enables the 'resize' callback.
     */
    constructor () {
        super();
        this.element = null;
        this._enabled = true;

        this._expanding = {horizontal: false, vertical: false};

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
        queueMicrotask(() => {
            // Tag every widget element with a common class so the
            // user-select: none default in Widget.css applies.
            // Subclasses set this.element in their own constructor.
            if (this.element) {
                this.element.classList.add('pgwidgets-widget');
            }
            this._installLayoutObservers();
        });
    }

    /**
     * Allow or disallow browser text selection (drag-to-highlight)
     * inside this widget.  Off by default for all widgets; widgets
     * that exist to display text (TextEntry, TextArea, TextSource,
     * TextEntrySet) opt in via the same class so the user can copy
     * their content.  Form controls (input/textarea) ignore this and
     * always allow selection.
     *
     * @param {boolean} tf
     */
    set_allow_text_selection(tf) {
        if (!this.element) return;
        if (tf) {
            this.element.classList.add('pgwidgets-text-select');
        } else {
            this.element.classList.remove('pgwidgets-text-select');
        }
    }

    /** @private */
    _installLayoutObservers() {
        if (!this.element || this._widgetResizeObserver) return;

        // 'map' is driven by a MutationObserver + Element.checkVisibility(),
        // with ResizeObserver as a secondary trigger.  Both stay live
        // for the widget's lifetime: 'map' fires every time visibility
        // transitions from hidden to visible (tracked via wasVisible),
        // so a tab being switched in or a parent being unhidden re-
        // emits 'map'.  Per design, multi-fire is preferred over miss.
        // checkVisibility() does the precise layout-aware visibility
        // check (display:none anywhere, content-visibility, etc.) that
        // is hard to reproduce manually.  We coalesce a burst of
        // mutations per frame through requestAnimationFrame so the
        // check runs at most once per frame even during reconstruction
        // when the DOM is churning rapidly.
        let mapCheckScheduled = false;
        let wasVisible = false;
        let tryFireMap = () => {
            if (this._destroyed || !this.element) return;
            let visible;
            if (typeof this.element.checkVisibility === 'function') {
                visible = this.element.checkVisibility();
            } else {
                visible = this.element.isConnected
                    && this.element.offsetParent !== null;
            }
            if (!visible) { wasVisible = false; return; }
            let box = this.element.getBoundingClientRect();
            let w = Math.round(box.width);
            let h = Math.round(box.height);
            if (w <= 0 && h <= 0) { wasVisible = false; return; }
            if (wasVisible) return;  // already visible last check; no re-fire
            wasVisible = true;
            this._mapped = true;
            let parentBox = this.element.parentElement
                ? this.element.parentElement.getBoundingClientRect()
                : {left: 0, top: 0};
            // Cache the latest payload so a listener that registers
            // AFTER 'map' has already fired (a real possibility during
            // reconstruction, where layout can run between create and
            // listen) can be served the most recent event via the
            // catch-up path in RemoteInterface._handleListen.
            this._mappedEvent = {
                x: Math.round(box.left - parentBox.left),
                y: Math.round(box.top - parentBox.top),
                viewport_x: Math.round(box.left),
                viewport_y: Math.round(box.top),
                width: w,
                height: h,
            };
            this.make_callback('map', this._mappedEvent);
        };
        let scheduleMapCheck = () => {
            if (mapCheckScheduled) return;
            mapCheckScheduled = true;
            requestAnimationFrame(() => {
                mapCheckScheduled = false;
                tryFireMap();
            });
        };
        // Expose the scheduler so RemoteInterface._handleReconstructEnd
        // can force a re-check after reconstruction completes — a
        // backstop against the widget becoming visible mid-stream and
        // the observer firing before its listener was registered.
        this._scheduleMapCheck = scheduleMapCheck;

        // Force-fire 'map' regardless of visibility / size.  Used as
        // the final-fallback backstop at reconstruct-end so a widget
        // that's currently hidden (detached tab page, display:none
        // ancestor, etc.) still gets at least one 'map' event so its
        // listener can run setup logic.  Geometry is whatever the
        // element reports right now (may be 0×0).  If the widget later
        // becomes actually visible, the wasVisible-tracked path fires
        // 'map' again with real geometry — multi-fire is preferred
        // over miss.
        this._forceFireMap = () => {
            if (this._mapped || this._destroyed) return;
            if (!this.element) return;
            this._mapped = true;
            wasVisible = false;  // let the next real visibility re-fire
            let box = this.element.getBoundingClientRect();
            let parentBox = this.element.parentElement
                ? this.element.parentElement.getBoundingClientRect()
                : {left: 0, top: 0};
            this._mappedEvent = {
                x: Math.round(box.left - parentBox.left),
                y: Math.round(box.top - parentBox.top),
                viewport_x: Math.round(box.left),
                viewport_y: Math.round(box.top),
                width: Math.round(box.width),
                height: Math.round(box.height),
            };
            this.make_callback('map', this._mappedEvent);
        };

        this._mapMutationObserver = new MutationObserver(scheduleMapCheck);
        this._mapMutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'hidden'],
        });
        scheduleMapCheck();

        let prevW = -1, prevH = -1;
        this._widgetResizeObserver = new ResizeObserver((entries) => {
            let rect = entries[0].contentRect;
            let w = Math.round(rect.width);
            let h = Math.round(rect.height);
            scheduleMapCheck();
            if (w === prevW && h === prevH) return;
            prevW = w;
            prevH = h;
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
     * Sets the minimum size of the widget. Pass null for either
     * dimension to clear that constraint.
     * @param {number|null} width - Minimum width in pixels, or null.
     * @param {number|null} height - Minimum height in pixels, or null.
     */
    set_min_size(width, height) {
        this.element.style.minWidth =
            (width === null || width === undefined) ? '' : width + 'px';
        this.element.style.minHeight =
            (height === null || height === undefined) ? '' : height + 'px';
    }

    /**
     * Sets the maximum size of the widget. Pass null for either
     * dimension to clear that constraint.
     * @param {number|null} width - Maximum width in pixels, or null.
     * @param {number|null} height - Maximum height in pixels, or null.
     */
    set_max_size(width, height) {
        this.element.style.maxWidth =
            (width === null || width === undefined) ? '' : width + 'px';
        this.element.style.maxHeight =
            (height === null || height === undefined) ? '' : height + 'px';
    }

    /**
     * Declare that this widget should expand to fill available space
     * along the given axis/axes.  Analogous to Qt's
     * QSizePolicy.Expanding: in a flex parent (every pgwidgets
     * container) the widget grabs whatever room is left over.
     *
     * Setting expanding writes inline CSS immediately AND stores the
     * flags on the widget, so it can be called either before or
     * after the widget is added to its parent and end up at the same
     * styles.  When a Box's ``add_widget(child, stretch=N)`` is
     * called with N>0, that explicit per-container stretch takes
     * precedence over a set_expanding flag on the same main axis
     * (set_expanding still wins for the cross axis and for non-Box
     * parents).
     *
     * @param {boolean} [horizontal=false] - Grow to fill width.
     * @param {boolean} [vertical=false]   - Grow to fill height.
     */
    set_expanding(horizontal=false, vertical=false) {
        this._expanding = {
            horizontal: !!horizontal,
            vertical:   !!vertical,
        };
        if (!this.element) return;
        let s = this.element.style;
        if (horizontal || vertical) {
            // flex-grow:1 on the main axis fills it; align-self:
            // stretch ensures the cross axis fills too even when an
            // ancestor has changed align-items.  min-*:0 lets the
            // item shrink below intrinsic content if the parent is
            // tight (matches the Box.js stretch>0 path) -- BUT only
            // if the caller hasn't already declared a floor via
            // ``set_min_size``.  An explicit min is a hard floor we
            // must respect, not erase.
            s.flex = '1 1 auto';
            s.alignSelf = 'stretch';
        }
        // width/height: 100% are the fallback for non-flex parents
        // (e.g. an Image inside a TabWidget content area that lays
        // out children with block flow).  They're harmless in flex
        // parents because flex layout takes precedence over the
        // computed width/height.
        if (horizontal) {
            s.width = '100%';
            if (!s.minWidth) s.minWidth = '0';
        }
        if (vertical) {
            s.height = '100%';
            if (!s.minHeight) s.minHeight = '0';
        }
    }

    /**
     * Returns the current expanding policy as ``{horizontal, vertical}``.
     * Containers read this to size newly-added children.
     */
    get_expanding() {
        return {...this._expanding};
    }

    /**
     * Sets the border color on the widget element.
     * @param {string} color - CSS color value.
     */
    set_border_color(color) {
        this.element.style['border-color'] = color;
    }

    /**
     * Sets the background color on the widget element.  Pass null
     * (or any falsy value) to clear the override and let the
     * inherited style take over.  Themed widgets (buttons, etc.)
     * paint multi-state backgrounds; a generic set_bg may be
     * partially overridden by hover/active states on those.
     * @param {string|null} color - CSS color value, or null to
     *     clear.
     */
    set_bg(color) {
        if (color == null || color === '') {
            this.element.style.backgroundColor = '';
        } else {
            this.element.style.backgroundColor = color;
        }
    }

    /**
     * Resizes the widget to the given dimensions.
     * @param {number} width - Width in pixels.
     * @param {number} height - Height in pixels.
     */
    resize(width, height) {
        if (width != null) {
            this.element.style.width = width + 'px';
        }
        if (height != null) {
            this.element.style.height = height + 'px';
        }
    }

    /**
     * Returns the current size of the widget.
     * @returns {number[]} A tuple [width, height] in pixels.
     */
    get_size() {
        return [this.element.offsetWidth, this.element.offsetHeight];
    }

    /**
     * Returns the widget's position within the viewport.
     * @returns {number[]} A tuple [x, y] in pixels.
     */
    get_position() {
        let rect = this.element.getBoundingClientRect();
        return [rect.left, rect.top];
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

    /**
     * Whether this widget is a layout container, i.e. one that accepts
     * other widgets via add_widget() (e.g. Box, TopLevel, Frame).
     * Overridden to return true by ContainerWidget.  Note that widgets
     * like MenuBar/ToolBar/Menu are NOT containers in this sense.
     * @returns {boolean} false for the base Widget.
     */
    is_container() {
        return false;
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
        if (!size) {
            // No raster step — register the cursor synchronously
            // using the URL as-is.  Caller is responsible for
            // ensuring the source image is at a sensible cursor
            // size (browsers reject anything > 128px in most cases).
            this._cursors[name] =
                `url('${url}') ${hotspot_x} ${hotspot_y}, auto`;
            return;
        }
        // size requested: register the name *now* (so set_cursor
        // called in the same tick under Pyodide can record intent)
        // but mark the value as pending.  The actual CSS value is
        // filled in by the onload handler below, after rasterizing.
        // This avoids applying the raw SVG URL — its intrinsic size
        // may exceed the browser's cursor limit and trigger a CSS
        // parse error before the rasterised version is ready.
        this._cursors[name] = null;
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
            // If this cursor was selected while pending, apply it now.
            if (this._currentCursor === name) {
                this.element.style.cursor = this._cursors[name];
            }
        };
        img.onerror = () => {
            console.warn("add_cursor: failed to load image for '"
                         + name + "'");
            // Drop the pending entry so set_cursor falls through to
            // the CSS-keyword branch instead of waiting forever.
            delete this._cursors[name];
        };
        img.src = url;
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
            // Record intent.  If the cursor is still rasterizing
            // (value is null) it will be applied by add_cursor's
            // onload handler when ready.
            this._currentCursor = name;
            const value = this._cursors[name];
            if (value !== null) {
                this.element.style.cursor = value;
            }
        } else {
            // Assume it's a standard CSS cursor keyword.
            this._currentCursor = null;
            this.element.style.cursor = name;
        }
    }

    /**
     * Tear down this widget: disconnect observers, clear callbacks, remove
     * the DOM element from its parent, and drop it from the global
     * registry so it can be garbage collected. Safe to call more than
     * once; subsequent calls are no-ops. Subclasses that allocate extra
     * resources (timers, offscreen buffers, pending rAF, external
     * listeners) should override and call super.destroy() last.
     */
    destroy() {
        if (this._destroyed) return;

        if (this._widgetResizeObserver) {
            this._widgetResizeObserver.disconnect();
            this._widgetResizeObserver = null;
        }
        if (this._mapMutationObserver) {
            this._mapMutationObserver.disconnect();
            this._mapMutationObserver = null;
        }

        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;

        super.destroy();
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
        'drop-start', 'drop-end', 'drag-over', 'drop-progress', 'contextmenu',
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
     * `contextmenu`, `drop-start`, `drop-end`, `drag-over`.
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
     * Present on: `drop-start`, `drop-end`. Includes pointer fields above, plus:
     *
     * | Field    | Type     | Description                                       |
     * |----------|----------|---------------------------------------------------|
     * | `types`  | string[] | MIME types offered by the drag source.             |
     * | `text`   | string?  | Plain text data, or null.                         |
     * | `url`    | string?  | URI list data, or null.                           |
     * | `html`   | string?  | HTML data, or null.                               |
     * | `files`  | array    | Dropped files. Each entry:                        |
     * |          |          | `{name, size, type, encoding, data}` where        |
     * |          |          | `encoding` is `"bytes"` (default — `data` is the  |
     * |          |          | file's raw bytes as an `ArrayBuffer`; on the      |
     * |          |          | Python side, a `bytes` object) and reserved      |
     * |          |          | values include `"base64"`.  `data` is null on    |
     * |          |          | read error (with an `error` field also set).      |
     *
     * ### Drag-progress fields
     * Present on: `drop-progress`. Fired during file reading.
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
     * Handle a drop event. Fires 'drop-start' immediately with
     * file metadata (name, size, type — no data yet), then reads all
     * dropped files asynchronously via FileReader and fires
     * 'drop-end' with the full payload including file contents
     * as ArrayBuffers.
     *
     * Fires 'drop-progress' callbacks during file reading:
     *   {transferred_bytes, total_bytes, file_name, file_index, file_count}
     *
     * The payload includes:
     * - Standard pointer/mouse fields from _eventToPayload().
     * - `types`   string[]  — MIME types offered by the drag source.
     * - `text`    string|null — plain text, if available.
     * - `url`     string|null — URI list, if available.
     * - `html`    string|null — HTML content, if available.
     * - `files`   array of {name, size, type, data} — dropped files.
     *   `data` is null in drop-start, an ArrayBuffer in drop-end.
     *   When delivered over the remote interface, the buffer is
     *   shipped as raw binary WebSocket frames so the Python side
     *   sees `bytes`.
     * @private
     */
    _handleDrop(event) {
        let payload = this._eventToPayload(event);
        let dt = event.dataTransfer;

        payload.types = [...dt.types];
        payload.text = dt.getData('text/plain') || null;
        payload.url = dt.getData('text/uri-list') || null;
        payload.html = dt.getData('text/html') || null;

        // Browser address bar drags typically provide text/plain
        // with the URL but not text/uri-list.  Promote text to url
        // when it looks like a URL.
        if (!payload.url && payload.text) {
            let t = payload.text.trim();
            if (/^https?:\/\/\S+$/.test(t) || /^file:\/\/\S+$/.test(t)) {
                payload.url = t;
            }
        }

        let files = dt.files;
        if (files.length === 0) {
            // No files — fire both start and end immediately.
            payload.files = [];
            this.make_callback('drop-start', payload);
            this.make_callback('drop-end', payload);
            return;
        }

        // Build file metadata (no data yet) for drop-start.
        let fileMeta = [];
        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            fileMeta.push({
                name: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream',
                // 'bytes' indicates that the eventual `data` field
                // delivered with drop-end will be raw bytes (an
                // ArrayBuffer on the JS side; `bytes` on the Python
                // side after binary-chunk reassembly).  Reserved for
                // future use: 'base64' if a sender ever chooses to
                // deliver the file as a base64-encoded string.
                encoding: 'bytes',
                data: null,
            });
        }
        payload.files = fileMeta;
        this.make_callback('drop-start', payload);

        // Read all files as ArrayBuffers, firing progress along the way.
        let fileCount = files.length;
        let results = new Array(fileCount);
        let completed = 0;

        for (let i = 0; i < fileCount; i++) {
            let file = files[i];
            let reader = new FileReader();

            reader.onprogress = (pe) => {
                if (pe.lengthComputable) {
                    this.make_callback('drop-progress', {
                        transferred_bytes: pe.loaded,
                        total_bytes: pe.total,
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
                    encoding: 'bytes',
                    // ArrayBuffer; RemoteInterface ships it as raw
                    // binary frames so the server receives `bytes`.
                    data: reader.result,
                };
                completed++;
                // Fire progress for file completion.
                this.make_callback('drop-progress', {
                    transferred_bytes: file.size,
                    total_bytes: file.size,
                    file_name: file.name,
                    file_index: i,
                    file_count: fileCount,
                });
                if (completed === fileCount) {
                    payload.files = results;
                    this.make_callback('drop-end', payload);
                }
            };

            reader.onerror = () => {
                results[i] = {
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/octet-stream',
                    encoding: 'bytes',
                    data: null,
                    error: reader.error?.message || 'read error',
                };
                completed++;
                if (completed === fileCount) {
                    payload.files = results;
                    this.make_callback('drop-end', payload);
                }
            };

            reader.readAsArrayBuffer(file);
        }
    }

    /* CALLBACK HANDLING (override) */

    /**
     * Registers a new callback action type. Overrides Callback to
     * auto-wire drag DOM listeners when a drag callback is first enabled.
     * @param {string} action - The name of the callback action to enable.
     */
    enable_callback(action) {
        super.enable_callback(action);
        // Auto-wire drag DOM listeners the first time any drag callback
        // is enabled on a widget that hasn't called _initInteractiveEvents.
        if (!this._dragEventsWired
                && (action === 'drop-start' || action === 'drop-end'
                    || action === 'drag-over' || action === 'drop-progress')) {
            this._initDragEvents();
        }
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

        for (let name of ['child-added', 'child-removed']) {
            this.enable_callback(name);
        }
    }

    /**
     * @returns {boolean} true -- ContainerWidget and its subclasses
     * (Box, TopLevel, Frame, TabWidget, ScrollArea, ...) are containers.
     */
    is_container() {
        return true;
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
     * Returns the number of child widgets in this container.
     * @returns {number} The child count.
     */
    num_children() {
        return this.children.length;
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
            this.make_callback('child-added', child);
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
            this.make_callback('child-removed', child);
        }
        return idx;
    }

    /**
     * Removes a child widget and its DOM element from this container.
     * @param {Widget} child - The child widget to remove.
     * @param {boolean} [destroy=false] - If true, also destroy the child.
     */
    remove(child, destroy=false) {
        let idx = this.remove_child(child);
        if (idx > -1) {
            let elt = child.get_element();
            if (elt.parentNode) {
                elt.parentNode.removeChild(elt);
            }
            if (destroy) {
                child.destroy();
            }
        }
    }

    /** Alias for remove(). */
    remove_widget(child, destroy=false) {
        this.remove(child, destroy);
    }

    /**
     * Removes all children from this container.
     * @param {boolean} [destroy=false] - If true, also destroy each child.
     */
    remove_all(destroy=false) {
        let kids = this.children.slice();
        for (let child of kids) {
            this.remove(child, destroy);
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

export { Callback, Widget, ContainerWidget };

