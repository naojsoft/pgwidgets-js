"use_strict";

import {ContainerWidget} from "./Widget.js";
import {showWindowMenu} from "./WindowMenu.js";

/**
 * The root-level container widget that attaches to the document body.
 * Uses absolute positioning and flex display. Typically the outermost widget.
 * @extends ContainerWidget
 */
class TopLevel extends ContainerWidget {

    /**
     * Creates a new TopLevel widget.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     * @param {boolean} [options.resizable=true] - Whether the widget can be resized via corner grips.
     * @param {string|null} [options.title=null] - If provided, displays a draggable title bar.
     * @param {string|null} [options.icon=null] - URL of an icon to show
     *   at the left edge of the title bar.  Hidden when null.
     * @param {boolean} [options.moveable=true] - Whether the widget can be dragged by the title bar.
     * @param {boolean} [options.closeable=true] - Whether a close button is shown in
     *   the title bar.
     * @param {boolean} [options.minimizable=false] - Show a minimize button.
     *   Minimized windows auto-stack along the bottom of the viewport.
     * @param {boolean} [options.maximizable=false] - Show a maximize button.
     *   Maximize fills the browser viewport (snapshot at click time; window
     *   does not follow viewport resizes).
     * @param {boolean} [options.lowerable=false] - Show a lower (send-to-back)
     *   button.
     * @param {boolean} [options.shadeable=true] - Allow the window to be
     *   "shaded" (rolled up to just the title bar, in place).  Available
     *   from the right-click context menu and via double-click on the
     *   title bar.
     */
    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'toplevel-widget';
        this.element.style.position = 'absolute';
        this.element.style.display = 'flex';
        this.element.style.flexDirection = 'column';
        this.element.style.overflow = 'hidden';
        this.element.style.margin = '1px';

        this.enable_callback('move');
        this.enable_callback('close');
        this.enable_callback('window-state');

        this._titleBar = null;
        this._titleText = null;
        this._titleIcon = null;
        this._closeButton = null;
        this._minimizeButton = null;
        this._maximizeButton = null;
        this._lowerButton = null;
        this._moveable = false;
        this._closeable = this.get_option(options, 'closeable', true);
        this._minimizable = this.get_option(options, 'minimizable', false);
        this._maximizable = this.get_option(options, 'maximizable', false);
        this._lowerable = this.get_option(options, 'lowerable', false);
        this._shadeable = this.get_option(options, 'shadeable', true);

        // Window state machine: 'normal' | 'shaded' | 'minimized' | 'maximized'.
        // _savedRect remembers the "normal" geometry so we can restore from
        // a non-normal state.
        this._winState = 'normal';
        this._savedRect = null;

        let title = this.get_option(options, 'title', null);
        if (title !== null) {
            this._makeTitleBar(title);
            let icon = this.get_option(options, 'icon', null);
            if (icon) this.set_icon(icon);
        }
        this._moveable = this.get_option(options, 'moveable', true);
        if (this._titleBar && !this._moveable) {
            this._titleBar.style.cursor = 'default';
        }

        let resizable = this.get_option(options, 'resizable', true);
        if (resizable) {
            this._makeResizable();
        }
    }

    /**
     * Sets the position of the TopLevel widget.
     * @param {number} x - The left position in pixels.
     * @param {number} y - The top position in pixels.
     */
    set_position(x, y) {
        this.element.style.left = x + 'px';
        this.element.style.top = y + 'px';
    }

    /**
     * Creates the title bar and sets up drag-to-move + right-click menu.
     * @param {string} title - The title text to display.
     * @private
     */
    _makeTitleBar(title) {
        this._titleBar = document.createElement('div');
        this._titleBar.className = 'toplevel-title-bar';

        // Icon slot: hidden until set_icon() is called.
        this._titleIcon = document.createElement('img');
        this._titleIcon.className = 'toplevel-title-icon';
        this._titleIcon.style.display = 'none';
        this._titleBar.appendChild(this._titleIcon);

        this._titleText = document.createElement('span');
        this._titleText.className = 'toplevel-title-text';
        this._titleText.textContent = title;

        this._titleBar.appendChild(this._titleText);

        // Spacer pushes any buttons to the right edge of the title bar.
        // We always include it so additional setters (e.g. set_closeable
        // in the future) can add buttons on the fly without re-laying out.
        let spacer = document.createElement('div');
        spacer.style.flex = '1';
        this._titleBar.appendChild(spacer);

        // Order matches the convention: lower, minimize, maximize, close.
        if (this._lowerable)    this._makeLowerButton();
        if (this._minimizable)  this._makeMinimizeButton();
        if (this._maximizable)  this._makeMaximizeButton();
        if (this._closeable)    this._makeCloseButton();

        this.element.appendChild(this._titleBar);

        this._makeDraggable();

        // Right-press on the title bar opens the context menu.  Use
        // mousedown so press-drag-release behaves like the menubar
        // (release on a menu item activates it).
        this._titleBar.addEventListener('mousedown', (e) => {
            if (e.button !== 2) return;
            e.preventDefault();
            e.stopPropagation();
            this._showContextMenu(e.clientX, e.clientY, e);
        });
        // Suppress the browser's native context menu (which would
        // otherwise pop on the matching mouseup).
        this._titleBar.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    /** @private SVG icons used by the title-bar buttons. */
    static get _ICONS() {
        return {
            lower:    '<svg viewBox="0 0 10 10">'
                    + '<polyline points="2,4 5,8 8,4" />'
                    + '<line x1="5" y1="1" x2="5" y2="8" /></svg>',
            minimize: '<svg viewBox="0 0 10 10">'
                    + '<line x1="2" y1="8" x2="8" y2="8" /></svg>',
            maximize: '<svg viewBox="0 0 10 10">'
                    + '<rect x="1.5" y="1.5" width="7" height="7" '
                    +    'fill="none" /></svg>',
            restore:  '<svg viewBox="0 0 10 10">'
                    + '<rect x="1" y="3" width="6" height="6" '
                    +    'fill="none" />'
                    + '<rect x="3" y="1" width="6" height="6" '
                    +    'fill="none" /></svg>',
            close:    '<svg viewBox="0 0 10 10">'
                    + '<line x1="1" y1="1" x2="9" y2="9" />'
                    + '<line x1="9" y1="1" x2="1" y2="9" /></svg>',
        };
    }

    /** @private Helper to build a title-bar button div with handlers. */
    _makeTitleButton(extraClass, icon, onClick) {
        let btn = document.createElement('div');
        btn.className = 'mdi-button' + (extraClass ? ' ' + extraClass : '');
        btn.innerHTML = icon;
        btn.addEventListener('mousedown', (e) => {
            // Don't let the title-bar drag handler see this.
            e.stopPropagation();
        });
        btn.onclick = (e) => {
            e.stopPropagation();
            onClick();
        };
        return btn;
    }

    /** @private */
    _makeLowerButton() {
        this._lowerButton = this._makeTitleButton(
            null, TopLevel._ICONS.lower, () => this.lower());
        this._titleBar.appendChild(this._lowerButton);
    }

    /** @private */
    _makeMinimizeButton() {
        this._minimizeButton = this._makeTitleButton(
            null, TopLevel._ICONS.minimize, () => this.toggle_minimize());
        this._titleBar.appendChild(this._minimizeButton);
    }

    /** @private */
    _makeMaximizeButton() {
        this._maximizeButton = this._makeTitleButton(
            null, TopLevel._ICONS.maximize, () => this.toggle_maximize());
        this._titleBar.appendChild(this._maximizeButton);
    }

    /** @private */
    _makeCloseButton() {
        this._closeButton = this._makeTitleButton(
            'mdi-close toplevel-close', TopLevel._ICONS.close,
            () => this.make_callback('close'));
        this._closeButton.style.marginRight = '16px';
        this._titleBar.appendChild(this._closeButton);
    }

    /** @private Update the maximize button's icon to reflect state. */
    _refreshMaximizeIcon() {
        if (!this._maximizeButton) return;
        this._maximizeButton.innerHTML =
            (this._winState === 'maximized')
                ? TopLevel._ICONS.restore
                : TopLevel._ICONS.maximize;
    }

    /** @private Build and show the right-click context menu.
     *  @param x mouse clientX
     *  @param y mouse clientY
     *  @param openEvent the originating mousedown event (for press-drag
     *    mode), or undefined for click-release callers.
     */
    _showContextMenu(x, y, openEvent) {
        let items = [];
        items.push({label: 'Raise', action: () => this.raise_()});
        if (this._lowerable) {
            items.push({label: 'Lower', action: () => this.lower()});
        }
        items.push(null);  // separator
        if (this._shadeable) {
            items.push({
                label: this._winState === 'shaded' ? 'Unshade' : 'Shade',
                action: () => this.toggle_shade(),
            });
        }
        if (this._minimizable) {
            items.push({
                label: this._winState === 'minimized'
                    ? 'Unminimize' : 'Minimize',
                action: () => this.toggle_minimize(),
            });
        }
        if (this._maximizable) {
            items.push({
                label: this._winState === 'maximized'
                    ? 'Unmaximize' : 'Maximize',
                action: () => this.toggle_maximize(),
            });
        }
        if (this._closeable) {
            if (items.length && items[items.length - 1] !== null) {
                items.push(null);  // separator before Close
            }
            items.push({label: 'Close',
                        action: () => this.make_callback('close')});
        }
        showWindowMenu(x, y, items, {armed: !!openEvent,
                                     openEvent: openEvent});
    }

    /**
     * Sets or updates the title bar text.
     * If no title bar exists yet, one is created.
     * @param {string} title - The title text to display.
     */
    set_title(title) {
        if (this._titleBar === null) {
            this._makeTitleBar(title);
        } else {
            this._titleText.textContent = title;
        }
    }

    /**
     * Set or clear the title-bar icon.  Only effective when a title
     * bar exists; if none does, this is a no-op.
     * @param {string|null} url - Image URL or data: URL, or null to hide.
     */
    set_icon(url) {
        if (!this._titleIcon) return;
        if (url) {
            this._titleIcon.src = url;
            this._titleIcon.style.display = '';
        } else {
            this._titleIcon.removeAttribute('src');
            this._titleIcon.style.display = 'none';
        }
    }

    /**
     * Sets whether the TopLevel can be moved by dragging the title bar.
     * @param {boolean} tf - True to allow moving, false to disallow.
     */
    set_moveable(tf) {
        this._moveable = tf;
        if (this._titleBar) {
            this._titleBar.style.cursor = tf ? 'move' : 'default';
        }
    }

    /**
     * Makes the TopLevel draggable via the title bar.
     * @private
     */
    _makeDraggable() {
        let offsetX, offsetY;
        let isDragging = false;
        const element = this.element;

        const onMouseMove = (e) => {
            if (isDragging) {
                element.style.left = (e.clientX - offsetX) + 'px';
                element.style.top = (e.clientY - offsetY) + 'px';
            }
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                this.make_callback('move',
                    parseInt(element.style.left) || 0,
                    parseInt(element.style.top) || 0);
            }
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        this._titleBar.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;  // left button only
            if (!this._moveable) return;
            e.preventDefault();
            offsetX = e.clientX - (parseInt(element.style.left) || 0);
            offsetY = e.clientY - (parseInt(element.style.top) || 0);
            isDragging = true;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Double-click to shade/unshade.  Ignore double-clicks on
        // buttons inside the title bar.
        this._titleBar.addEventListener('dblclick', (e) => {
            if (e.button !== 0) return;
            if (!this._shadeable) return;
            // Skip if the click landed on a button.
            if (e.target.closest('.mdi-button')) return;
            e.preventDefault();
            e.stopPropagation();
            this.toggle_shade();
        });
    }

    /**
     * Adds four corner resize grips to the TopLevel widget.
     * @private
     */
    _makeResizable() {
        const corners = [
            { name: 'nw', cursor: 'nwse-resize' },
            { name: 'ne', cursor: 'nesw-resize' },
            { name: 'sw', cursor: 'nesw-resize' },
            { name: 'se', cursor: 'nwse-resize' },
        ];

        for (let corner of corners) {
            let grip = document.createElement('div');
            grip.className = 'toplevel-grip toplevel-grip-' + corner.name;
            grip.style.cursor = corner.cursor;
            grip.innerHTML = '';
            this.element.appendChild(grip);
            this._setupCornerResize(grip, corner.name);
        }
    }

    /**
     * Sets up mouse event handling for a single corner resize grip.
     * @param {HTMLElement} grip - The grip DOM element.
     * @param {string} corner - Corner identifier: 'nw', 'ne', 'sw', or 'se'.
     * @private
     */
    _setupCornerResize(grip, corner) {
        let startX, startY, startW, startH, startLeft, startTop;
        const element = this.element;
        const minW = 60;
        const minH = 40;

        const onMouseMove = (e) => {
            let dx = e.clientX - startX;
            let dy = e.clientY - startY;

            if (corner === 'se') {
                element.style.width = Math.max(minW, startW + dx) + 'px';
                element.style.height = Math.max(minH, startH + dy) + 'px';
            } else if (corner === 'sw') {
                let newW = Math.max(minW, startW - dx);
                element.style.width = newW + 'px';
                element.style.left = (startLeft + startW - newW) + 'px';
                element.style.height = Math.max(minH, startH + dy) + 'px';
            } else if (corner === 'ne') {
                element.style.width = Math.max(minW, startW + dx) + 'px';
                let newH = Math.max(minH, startH - dy);
                element.style.height = newH + 'px';
                element.style.top = (startTop + startH - newH) + 'px';
            } else if (corner === 'nw') {
                let newW = Math.max(minW, startW - dx);
                element.style.width = newW + 'px';
                element.style.left = (startLeft + startW - newW) + 'px';
                let newH = Math.max(minH, startH - dy);
                element.style.height = newH + 'px';
                element.style.top = (startTop + startH - newH) + 'px';
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            // If the nw/sw/ne corners shifted the origin, also report a
            // 'move' for the new position. 'resize' is emitted
            // automatically by the base-class ResizeObserver.
            if (corner !== 'se') {
                this.make_callback('move',
                    parseInt(element.style.left) || 0,
                    parseInt(element.style.top) || 0);
            }
        };

        grip.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;  // left button only
            e.preventDefault();
            e.stopPropagation();
            startX = e.clientX;
            startY = e.clientY;
            startW = element.offsetWidth;
            startH = element.offsetHeight;
            startLeft = parseInt(element.style.left) || 0;
            startTop = parseInt(element.style.top) || 0;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    /**
     * Raises this TopLevel to the front (highest z-order).
     */
    raise_() {
        // Find the highest zIndex among sibling TopLevel elements
        let max = 0;
        for (let el of document.body.children) {
            let z = parseInt(el.style.zIndex) || 0;
            if (z > max) max = z;
        }
        this.element.style.zIndex = max + 1;
    }

    /**
     * Lowers this TopLevel to the back (lowest z-order).
     */
    lower() {
        // Find the lowest zIndex among sibling TopLevel elements
        let min = Infinity;
        for (let el of document.body.children) {
            let z = parseInt(el.style.zIndex) || 0;
            if (z < min) min = z;
        }
        this.element.style.zIndex = min - 1;
    }

    // -- Window state (normal | shaded | minimized | maximized) --

    /** @returns {string} Current window state. */
    get_window_state() {
        return this._winState;
    }

    /**
     * Switch to the named state.  Use 'normal' to restore.  This is
     * the canonical entry point for state changes — the toggle_*
     * methods just route through this.
     * @param {string} state - 'normal' | 'shaded' | 'minimized' | 'maximized'.
     */
    set_window_state(state) {
        if (state === this._winState) return;
        // Always restore from the current state first.
        this._exitState(this._winState);
        this._enterState(state);
        this._winState = state;
        this._refreshMaximizeIcon();
        this.make_callback('window-state', state);
    }

    /** Toggle between normal and minimized. */
    toggle_minimize() {
        this.set_window_state(
            this._winState === 'minimized' ? 'normal' : 'minimized');
    }

    /** Toggle between normal and maximized. */
    toggle_maximize() {
        this.set_window_state(
            this._winState === 'maximized' ? 'normal' : 'maximized');
    }

    /** Toggle between normal and shaded (rolled up to title bar). */
    toggle_shade() {
        this.set_window_state(
            this._winState === 'shaded' ? 'normal' : 'shaded');
    }

    /** @private Save the current normal-state geometry for later restore. */
    _saveRect() {
        let s = this.element.style;
        this._savedRect = {
            left:   s.left   || '',
            top:    s.top    || '',
            width:  s.width  || (this.element.offsetWidth + 'px'),
            height: s.height || (this.element.offsetHeight + 'px'),
        };
    }

    /** @private Restore previously-saved normal-state geometry. */
    _restoreRect() {
        if (!this._savedRect) return;
        let s = this.element.style;
        s.left   = this._savedRect.left;
        s.top    = this._savedRect.top;
        s.width  = this._savedRect.width;
        s.height = this._savedRect.height;
    }

    /** @private Tear down whatever was set up for the given state. */
    _exitState(state) {
        if (state === 'shaded') {
            this.element.classList.remove('toplevel-shaded');
            // Height was set to auto; restore the saved height.
            if (this._savedRect) {
                this.element.style.height = this._savedRect.height;
            }
        } else if (state === 'minimized') {
            this.element.classList.remove('toplevel-minimized');
            this.element.classList.remove('toplevel-shaded');
            this._restoreRect();
            // Update the bottom strip (other minimized windows
            // restack without us).
            TopLevel._layoutMinimized();
        } else if (state === 'maximized') {
            this._restoreRect();
        }
    }

    /** @private Apply the new state. */
    _enterState(state) {
        if (state === 'normal') return;
        // Snapshot the current geometry as the "normal" rect.
        this._saveRect();
        if (state === 'shaded') {
            this.element.classList.add('toplevel-shaded');
            // Collapse to title-bar height.  CSS hides children other
            // than the title bar; setting style.height to auto lets
            // the element shrink-wrap.
            this.element.style.height = 'auto';
        } else if (state === 'minimized') {
            this.element.classList.add('toplevel-minimized');
            // Hide content but keep the title bar.  We reuse the
            // shaded mechanism (CSS rule hides non-title-bar children).
            this.element.classList.add('toplevel-shaded');
            this.element.style.width = 'auto';
            this.element.style.height = 'auto';
            TopLevel._layoutMinimized();
        } else if (state === 'maximized') {
            this.element.style.left = '0';
            this.element.style.top = '0';
            this.element.style.width = window.innerWidth + 'px';
            this.element.style.height = window.innerHeight + 'px';
        }
    }

    /**
     * @private Stack all currently-minimized TopLevels along the bottom
     * of the viewport.  Static because layout depends on the global
     * set of minimized windows, not any one instance.
     */
    static _layoutMinimized() {
        let mins = [...document.querySelectorAll(
            '.toplevel-widget.toplevel-minimized')];
        // Stack from the bottom-left corner upward to the right.
        let pad = 4;
        let x = pad;
        let y = window.innerHeight;
        let rowH = 0;
        for (let el of mins) {
            let w = el.offsetWidth || 160;
            let h = el.offsetHeight || 24;
            if (rowH === 0) {
                y = window.innerHeight - h - pad;
                rowH = h;
            }
            if (x + w + pad > window.innerWidth) {
                // Wrap onto a new row above.
                x = pad;
                y -= rowH + pad;
                rowH = h;
            }
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            x += w + pad;
        }
    }

    /**
     * Sets the single child widget of this TopLevel container.
     * The child fills the entire TopLevel area via flex.
     * @param {Widget} child - The widget to display.
     */
    set_widget(child) {
        this.children.push(child);
        let elt = child.get_element();
        elt.style.flex = '1';
        this.element.appendChild(elt);
    }

    /** Appends the TopLevel element to the document body, making it visible. */
    show() {
        document.body.appendChild(this.get_element());
    }

    /** Removes the TopLevel element from the document body, hiding it. */
    hide() {
        let elt = this.get_element();
        if (elt.parentNode) {
            elt.parentNode.removeChild(elt);
        }
    }
};    

export { TopLevel };

