"use strict";

import {ContainerWidget} from "./Widget.js";
import {ScrollBar} from "./ScrollBar.js";

const default_icon_url = new URL("../icons/pgicon.svg", import.meta.url).href;


/**
 * An individual sub-window within an MDIWidget workspace.
 * Supports dragging, resizing, minimize, maximize, raise, lower, and close.
 * @extends ContainerWidget
 */
class MDISubWindow extends ContainerWidget {

    /**
     * Creates a new MDI sub-window.
     * @param {MDIWidget} mdi_widget - The parent MDI workspace.
     * @param {Widget} child - The child widget displayed in this sub-window.
     * @param {string} title - Window title text.
     * @param {number} width - Initial width in pixels.
     * @param {number} height - Initial height in pixels.
     * @param {string} icon_url - URL of the title bar icon.
     */
    constructor(mdi_widget, child, title, width, height, icon_url) {
        super();
        // the MDI window we belong to
        this.mdi_widget = mdi_widget
        //this.mdi_widget = null;
        
        // JavaScript hack to bind "this" correctly for our methods
        this.update_state = this.update_state.bind(this);
        this.get_state = this.get_state.bind(this);
        this.get_child = this.get_child.bind(this);
        this.makeDraggable = this.makeDraggable.bind(this);
        this.makeResizable = this.makeResizable.bind(this);
        this.toggle_minimize = this.toggle_minimize.bind(this);
        this.toggle_maximize = this.toggle_maximize.bind(this);
        this.raise_ = this.raise_.bind(this);
        this.lower_ = this.lower.bind(this);
        this.signal_close = this.signal_close.bind(this);
        this.close = this.close.bind(this);
        this.set_title = this.set_title.bind(this);

        this.enable_callback('move');

        this.element = document.createElement('div');
        this.element.className = 'mdi-window';
        let style = this.element.style;
        style.width = width + 'px';
        style.height = height + 'px';
        style.zIndex = 1;
        
        this.titleBar = document.createElement('div');
        this.titleBar.className = 'mdi-title-bar';

        this.icon = document.createElement('img');
        if (icon_url) {
            this.icon.src = icon_url;
            this.icon.width = 20;
        }

        this.titleText = document.createElement('span');
        this.titleText.innerHTML = title;

        this.buttons = document.createElement('div');
        this.buttons.className = 'mdi-buttons';

        // lower: downward arrow
        this.lowerButton = document.createElement('div');
        this.lowerButton.className = 'mdi-button';
        this.lowerButton.innerHTML =
            '<svg viewBox="0 0 10 10">' +
            '<polyline points="2,4 5,8 8,4" />' +
            '<line x1="5" y1="1" x2="5" y2="8" />' +
            '</svg>';
        this.lowerButton.onclick = () => this.lower();

        // minimize: horizontal line at bottom
        this.minimizeButton = document.createElement('div');
        this.minimizeButton.className = 'mdi-button';
        this.minimizeButton.innerHTML =
            '<svg viewBox="0 0 10 10">' +
            '<line x1="2" y1="8" x2="8" y2="8" />' +
            '</svg>';
        this.minimizeButton.onclick = () => this.toggle_minimize();

        // maximize: square outline
        this.maximizeButton = document.createElement('div');
        this.maximizeButton.className = 'mdi-button';
        this.maximizeButton.innerHTML =
            '<svg viewBox="0 0 10 10">' +
            '<rect x="1.5" y="1.5" width="7" height="7" fill="none" />' +
            '</svg>';
        this.maximizeButton.onclick = () => this.toggle_maximize();

        // close: X
        this.closeButton = document.createElement('div');
        this.closeButton.className = 'mdi-button mdi-close';
        this.closeButton.innerHTML =
            '<svg viewBox="0 0 10 10">' +
            '<line x1="1" y1="1" x2="9" y2="9" />' +
            '<line x1="9" y1="1" x2="1" y2="9" />' +
            '</svg>';
        this.closeButton.onclick = () => this.signal_close();

        this.buttons.appendChild(this.lowerButton);
        this.buttons.appendChild(this.minimizeButton);
        this.buttons.appendChild(this.maximizeButton);
        this.buttons.appendChild(this.closeButton);

        this.child_container = document.createElement('div');
        this.child_container.className = 'mdi-child-container';
        this.child_container.appendChild(child.get_element());
        
        this.titleBar.appendChild(this.icon);
        this.titleBar.appendChild(this.titleText);
        this.titleBar.appendChild(this.buttons);
        
        this.element.appendChild(this.titleBar);
        this.element.appendChild(this.child_container);
        this.children.push(child);

        // Random placement of subwindow
        let wsRect = this.mdi_widget.workspace.getBoundingClientRect();
        let maxX = Math.max(0, wsRect.width - width);
        let maxY = Math.max(0, wsRect.height - height);
        style.left = Math.floor(Math.random() * maxX) + 'px';
        style.top = Math.floor(Math.random() * maxY) + 'px';

        //this.mdi_widget.add_widget(this);

        this.makeDraggable(this.element, this.titleBar);
        this.makeResizable(this.element);

        // Add click event to bring the window to the top when
        // title bar is clicked
        this.titleBar.addEventListener('mousedown', () => this.raise_());

        this.update_state(this.get_state());
    }

    /**
     * Sets the position of the sub-window within the MDI workspace.
     * @param {number} x - Left position in pixels.
     * @param {number} y - Top position in pixels.
     */
    set_position(x, y) {
        this.element.style.left = x + 'px';
        this.element.style.top = y + 'px';
        if (this.mdi_widget) {
            this.mdi_widget._updateWorkspaceSize();
        }
    }

    resize(width, height) {
        super.resize(width, height);
        if (this.mdi_widget) {
            this.mdi_widget._updateWorkspaceSize();
        }
    }

    /**
     * Sets the title text of the sub-window.
     * @param {string} title - The new title text.
     */
    set_title(title) {
        this.titleText.innerHTML = title;
    }

    /**
     * Saves the current window geometry into the state record.
     * @param {Object} rec - The state record to update.
     * @returns {Object} The updated state record.
     */
    update_state(rec) {
        let style = this.element.style;
        rec.width = style.width;
        rec.height = style.height;
        rec.left = style.left;
        rec.top = style.top;
        return rec;
    }
    
    /**
     * Returns the current window state record, creating one if needed.
     * @returns {Object} The state record with {state, width, height, left, top}.
     */
    get_state() {
        const rec = this.mdi_widget.windowStateMap.get(this.element);
        if (rec) {
            return rec;
        } else {
            // create record and store window's state
            let newrec = this.update_state({state: 'normal'});
            this.mdi_widget.windowStateMap.set(this.element, newrec);
            return newrec;
        }
    };

    /**
     * Returns the child widget contained in this sub-window.
     * @returns {Widget} The child widget.
     */
    get_child() {
        return this.children[0];
    }

    /**
     * Makes the sub-window draggable via the given handle element.
     * @param {HTMLElement} element - The window element to move.
     * @param {HTMLElement} handle - The element that initiates dragging (title bar).
     */
    makeDraggable(element, handle) {
        let baseX, baseY;
        let offsetX, offsetY;
        let isMoving = false;
        let rec = this.get_state();

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            let wsRect = this.mdi_widget.workspace.getBoundingClientRect();
            baseX = Math.floor(wsRect.left);
            baseY = Math.floor(wsRect.top);
            offsetX = Math.floor(e.x - this.element.getBoundingClientRect().left);
            offsetY = Math.floor(e.y - this.element.getBoundingClientRect().top);
            isMoving = true;
        });

        this.handleDrag = (e) => {
            if (isMoving) {
                const x = Math.floor(e.x - offsetX - baseX);
                const y = Math.floor(e.y - offsetY - baseY);

                element.style.left = x + 'px';
                element.style.top = y + 'px';
                this.update_state(rec);

                this.raise_();
                this.mdi_widget._updateWorkspaceSize();
            }
        };

        document.addEventListener('mousemove', this.handleDrag);
        document.addEventListener('mouseup', () => {
            if (isMoving) {
                isMoving = false;
                this.make_callback('move',
                    parseInt(element.style.left) || 0,
                    parseInt(element.style.top) || 0);
            }
        });
    }
    
    /**
     * Makes the sub-window resizable via grip handles at all four corners.
     * Grips appear on hover and allow dragging to resize from any corner.
     * @param {HTMLElement} element - The window element to resize.
     */
    makeResizable(element) {
        const corners = [
            { name: 'nw', cursor: 'nwse-resize' },
            { name: 'ne', cursor: 'nesw-resize' },
            { name: 'sw', cursor: 'nesw-resize' },
            { name: 'se', cursor: 'nwse-resize' },
        ];

        for (let corner of corners) {
            let grip = document.createElement('div');
            grip.className = 'mdi-grip mdi-grip-' + corner.name;
            grip.style.cursor = corner.cursor;

            // no inner content needed - CSS handles the triangle
            grip.innerHTML = '';

            element.appendChild(grip);
            this._setupCornerResize(element, grip, corner.name);
        }
    }

    /**
     * Sets up mouse event handling for a single corner resize grip.
     * @param {HTMLElement} element - The window element to resize.
     * @param {HTMLElement} grip - The grip DOM element.
     * @param {string} corner - Corner identifier: 'nw', 'ne', 'sw', or 'se'.
     */
    _setupCornerResize(element, grip, corner) {
        let startX, startY, startW, startH, startLeft, startTop;
        let rec = this.get_state();

        const onMouseMove = (e) => {
            let dx = e.clientX - startX;
            let dy = e.clientY - startY;
            const minW = 60;
            const minH = 40;

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

            this.update_state(rec);
            rec.state = 'normal';
            this.raise_();
            this.mdi_widget._updateWorkspaceSize();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            // nw/sw/ne corners also move the window origin.
            // 'resize' is emitted automatically via ResizeObserver.
            if (corner !== 'se') {
                this.make_callback('move',
                    parseInt(element.style.left) || 0,
                    parseInt(element.style.top) || 0);
            }
        };

        grip.addEventListener('mousedown', (e) => {
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

    /** Toggles the sub-window between minimized and normal states. */
    toggle_minimize() {
        const rec = this.get_state();
        let style = this.element.style;
        if (rec.state === 'minimized') {
            // Restore the window to its previous state
            this.child_container.style.display = '';
            style.width = rec.width;
            style.height = rec.height;
            style.left = rec.left;
            style.top = rec.top;
            rec.state = 'normal';
            this.mdi_widget._layoutMinimized();
        } else {
            // Minimize: save state, hide content, show only title bar
            if (rec.state === 'normal') {
                this.update_state(rec);
            }
            this.child_container.style.display = 'none';
            style.width = 'auto';
            style.height = 'auto';
            rec.state = 'minimized';
            this.mdi_widget._layoutMinimized();
        }

        this.raise_();
    }

    /** Toggles the sub-window between maximized and normal states. */
    toggle_maximize() {
        const workspace = this.mdi_widget._viewport;
        let style = this.element.style;
        const pad = 5;
        // Check if the window is currently maximized
        const rec = this.get_state();
        if (rec.state === 'maximized') {
            // Restore the window to its previous state
            style.width = rec.width;
            style.height = rec.height;
            style.left = rec.left;
            style.top = rec.top;
            rec.state = 'normal';
        } else {
            // Maximize the window and store its state
            if (rec.state === 'normal') {
                this.update_state(rec);
            };
            let width = Math.floor(workspace.clientWidth - pad);
            let height = Math.floor(workspace.clientHeight - pad);
            style.width = width + 'px';
            style.height = height + 'px';
            style.left = '0';
            style.top = '0';
            rec.state = 'maximized';
        }
        
        // Bring the window to the top when maximized or restored
        this.raise_();
    }
    
    /** Raises the sub-window to the top of the z-order. */
    raise_() {
        let num_children = this.mdi_widget.children.length;
        this.element.style.zIndex = num_children;
        for (let subwin of this.mdi_widget.children) {
            if (subwin != this) {
                let win_elt = subwin.get_element();
                if (win_elt.style.zIndex == num_children) {
                    win_elt.style.zIndex--;
                }
            }
        }

        this.mdi_widget.make_callback('page-switch', this.get_child());
    }
    
    /** Lowers the sub-window to the bottom of the z-order. */
    lower() {
        this.element.style.zIndex = 1;
        for (let subwin of this.mdi_widget.children) {
            if (subwin != this) {
                let win_elt = subwin.get_element();
                if (win_elt.style.zIndex == 1) {
                    win_elt.style.zIndex++;
                }
            }
        }

        // TODO: some child should get the page-switch callback
        //this.mdi_widget.make_callback('page-switch', ??);
    }
    
    /** Fires the 'page-close' callback and closes this sub-window. */
    signal_close() {
        this.mdi_widget.make_callback('page-close', this.get_child());
        this.close();
    }

    /** Closes and removes this sub-window from the MDI workspace. */
    close() {
        let mdi = this.mdi_widget;
        mdi.remove_child(this);
        mdi.windowStateMap.delete(this.element);
        this.element.remove();
        mdi._updateWorkspaceSize();
    }
}
    
/**
 * A Multiple Document Interface (MDI) workspace container.
 * Manages multiple draggable, resizable sub-windows with cascade and tile layouts.
 * @extends ContainerWidget
 *
 * Callbacks:
 * - 'page-switch': fired when a sub-window is raised/focused.
 * - 'page-close': fired when a sub-window close button is clicked.
 */
class MDIWidget extends ContainerWidget {

    /**
     * Creates a new MDI workspace.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = { }) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'mdi-widget';

        // viewport clips the workspace
        this._viewport = document.createElement('div');
        this._viewport.className = 'mdi-viewport';
        this.element.appendChild(this._viewport);

        // inner workspace holds all sub-windows; sized to fit content
        this.workspace = document.createElement('div');
        this.workspace.className = 'mdi-workspace';
        this._viewport.appendChild(this.workspace);

        // custom scrollbars
        this._hScrollBar = new ScrollBar({orientation: 'horizontal'});
        this._vScrollBar = new ScrollBar({orientation: 'vertical'});
        this._hScrollBar.get_element().classList.add('mdi-hbar');
        this._vScrollBar.get_element().classList.add('mdi-vbar');

        this._corner = document.createElement('div');
        this._corner.className = 'mdi-scrollbar-corner';

        this.element.appendChild(this._hScrollBar.get_element());
        this.element.appendChild(this._vScrollBar.get_element());
        this.element.appendChild(this._corner);

        this._scrollTimer = null;
        this._scrollReady = false;

        // scrollbar callbacks
        this._hScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this.workspace.scrollWidth - this._viewport.clientWidth;
            this._viewport.scrollLeft = pct * maxScroll;
            this._syncFromScroll();
        });
        this._vScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this.workspace.scrollHeight - this._viewport.clientHeight;
            this._viewport.scrollTop = pct * maxScroll;
            this._syncFromScroll();
        });

        // native scroll (e.g. touch, programmatic)
        this._viewport.addEventListener('scroll', () => this._syncFromScroll());

        // prevent mouse wheel from scrolling the viewport
        this._viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
        });

        this.windowStateMap = new Map();

        // JavaScript hack to bind "this" correctly for our methods
        this.add_widget = this.add_widget.bind(this);
        this.cascade_windows = this.cascade_windows.bind(this);
        this.tile_windows = this.tile_windows.bind(this);
        this.get_subwin = this.get_subwin.bind(this);
        this.get_configuration = this.get_configuration.bind(this);
        this.close_child = this.close_child.bind(this);
        this.get_index = this.get_index.bind(this);
        this.set_index = this.set_index.bind(this);
        this.index_of = this.index_of.bind(this);
        this.index_to_widget = this.index_to_widget.bind(this);
        this.set_resistance = this.set_resistance.bind(this);
        this.set_scroll_position = this.set_scroll_position.bind(this);
        this._updateWorkspaceSize = this._updateWorkspaceSize.bind(this);
        this._syncScrollbars = this._syncScrollbars.bind(this);
        this._syncFromScroll = this._syncFromScroll.bind(this);

        // observe viewport size changes
        this._resizeObserver = new ResizeObserver(() => this._syncScrollbars());
        this._resizeObserver.observe(this._viewport);

        for (let name of ['page-switch', 'page-close', 'scrolled']) {
            this.enable_callback(name);
        }

        requestAnimationFrame(() => { this._scrollReady = true; });
    }

    /**
     * Sets the workspace expansion resistance.
     * 0.0 = frictionless (workspace expands immediately with window movement).
     * 1.0 = locked (windows cannot be moved outside the workspace).
     * @param {number} value - Resistance factor between 0.0 and 1.0.
     */
    set_resistance(value) {
        this.resistance = Math.max(0, Math.min(1, value));
    }

    /**
     * Adds a child widget as a new sub-window in the MDI workspace.
     * @param {Widget} child - The widget to display in the sub-window.
     * @param {Object} [options] - Sub-window options.
     * @param {string} [options.title=''] - Window title text.
     * @param {number} [options.width=300] - Initial width in pixels.
     * @param {number} [options.height=300] - Initial height in pixels.
     * @param {string|null} [options.icon_url=null] - Title bar icon URL.
     * @param {number|null} [options.x=null] - Initial left position in pixels.
     * @param {number|null} [options.y=null] - Initial top position in pixels.
     * @returns {MDISubWindow} The created sub-window.
     */
    add_widget(child, options = { title: "", width: 300, height: 300, icon_url: null }) {
        const title = this.get_option(options, 'title', '');
        const width = this.get_option(options, 'width', 300);
        const height = this.get_option(options, 'height', 300);
        const icon_url = this.get_option(options, 'icon_url', default_icon_url);
        const x = this.get_option(options, 'x', null);
        const y = this.get_option(options, 'y', null);

        const subwin = new MDISubWindow(this, child, title, width, height, icon_url);
        this.children.push(subwin);
        this.workspace.appendChild(subwin.get_element());

        if (x !== null && y !== null) {
            subwin.set_position(x, y);
        }

        subwin.raise_();
        this._updateWorkspaceSize();
        return subwin;
    }
    
    /** Arranges all sub-windows in a cascading (staggered) layout. */
    cascade_windows() {
        let offsetX = 0;
        let offsetY = 0;
        let vpW = this._viewport.clientWidth;
        let vpH = this._viewport.clientHeight;

        for (let i = 0; i < this.children.length; i++) {
            let subwin = this.children[i];
            let win_elt = subwin.get_element();
            let rec = subwin.get_state();

            // restore saved size (e.g. after tile, minimize, maximize)
            win_elt.style.width = rec.width;
            win_elt.style.height = rec.height;
            if (rec.state === 'minimized') {
                subwin.child_container.style.display = '';
            }

            win_elt.style.left = offsetX + 'px';
            win_elt.style.top = offsetY + 'px';
            win_elt.style.zIndex = i + 1;
            rec.state = "normal";

            offsetX += 20;
            offsetY += 20;

            if (offsetX + win_elt.clientWidth > vpW) {
                offsetX = 0;
            }
            if (offsetY + win_elt.clientHeight > vpH) {
                offsetY = 0;
            }
        }
        this._updateWorkspaceSize();
    }

    /** Arranges all sub-windows in a tiled grid layout. */
    tile_windows() {
        const containerWidth = this._viewport.clientWidth;
        const containerHeight = this._viewport.clientHeight;
        const columns = Math.ceil(Math.sqrt(this.children.length));
        const rows = Math.ceil(this.children.length / columns);
        const tileWidth = containerWidth / columns;
        const tileHeight = containerHeight / rows;

        let row = 0;
        let col = 0;
        
        for (let subwin of this.children) {
            let win_elt = subwin.get_element();
            let rec = subwin.get_state();
            // save original size if in normal state, before tiling overwrites it
            if (rec.state === 'normal') {
                subwin.update_state(rec);
            }
            if (rec.state === 'minimized') {
                subwin.child_container.style.display = '';
            }
            win_elt.style.width = tileWidth + 'px';
            win_elt.style.height = tileHeight + 'px';
            win_elt.style.left = col * tileWidth + 'px';
            win_elt.style.top = row * tileHeight + 'px';
            rec.state = "tiled";

            col++;
            if (col >= columns) {
                col = 0;
                row++;
            }
        }
        this._updateWorkspaceSize();
    }

    /**
     * Lays out all minimized sub-windows in a row along the bottom of the workspace.
     */
    _layoutMinimized() {
        const workspaceH = this._viewport.clientHeight;
        let x = 0;
        for (let subwin of this.children) {
            let rec = this.windowStateMap.get(subwin.get_element());
            if (rec && rec.state === 'minimized') {
                let style = subwin.get_element().style;
                style.left = x + 'px';
                // position so the bottom of the title bar sits at the bottom
                let h = subwin.get_element().offsetHeight;
                style.top = (workspaceH - h) + 'px';
                x += subwin.get_element().offsetWidth + 2;
            }
        }
    }

    /**
     * Updates the workspace div size to encompass all sub-windows,
     * then syncs the custom scrollbars.
     */
    _updateWorkspaceSize() {
        let maxRight = 0;
        let maxBottom = 0;
        let vw = this._viewport.clientWidth;
        let vh = this._viewport.clientHeight;

        for (let subwin of this.children) {
            let el = subwin.get_element();
            let left = parseInt(el.style.left) || 0;
            let top = parseInt(el.style.top) || 0;
            let right = left + el.offsetWidth;
            let bottom = top + el.offsetHeight;
            if (right > maxRight) maxRight = right;
            if (bottom > maxBottom) maxBottom = bottom;
        }

        this.workspace.style.width = Math.max(vw, maxRight) + 'px';
        this.workspace.style.height = Math.max(vh, maxBottom) + 'px';

        this._syncScrollbars();
    }

    /**
     * Updates scrollbar thumb sizes and visibility based on workspace vs viewport.
     * @private
     */
    _syncScrollbars() {
        if (!this._viewport || !this._hScrollBar
            || !this._hScrollBar.get_element()) return;
        let vw = this._viewport.clientWidth;
        let vh = this._viewport.clientHeight;
        let ww = this.workspace.scrollWidth;
        let wh = this.workspace.scrollHeight;

        let showH = ww > vw + 1;
        let showV = wh > vh + 1;

        this._hScrollBar.get_element().style.display = showH ? '' : 'none';
        this._vScrollBar.get_element().style.display = showV ? '' : 'none';
        this._corner.style.display = (showH && showV) ? '' : 'none';

        if (showH) {
            this._hScrollBar.set_thumb_width(Math.min(1, vw / Math.max(1, ww)));
        }
        if (showV) {
            this._vScrollBar.set_thumb_width(Math.min(1, vh / Math.max(1, wh)));
        }

        this._syncFromScroll();
    }

    /**
     * Sets the scroll position using percentages (0–1).
     * @param {number} h_pct - Horizontal scroll percentage.
     * @param {number} v_pct - Vertical scroll percentage.
     */
    set_scroll_position(h_pct, v_pct) {
        let maxX = this.workspace.scrollWidth - this._viewport.clientWidth;
        let maxY = this.workspace.scrollHeight - this._viewport.clientHeight;
        if (maxX > 0) this._viewport.scrollLeft = h_pct * maxX;
        if (maxY > 0) this._viewport.scrollTop = v_pct * maxY;
        this._scrollSilent = true;
        this._syncFromScroll();
        this._scrollSilent = false;
    }

    /**
     * Returns the current scroll position as [h_pct, v_pct] (0–1).
     * @returns {number[]}
     */
    get_scroll_position() {
        let maxX = this.workspace.scrollWidth - this._viewport.clientWidth;
        let maxY = this.workspace.scrollHeight - this._viewport.clientHeight;
        return [
            maxX > 0 ? this._viewport.scrollLeft / maxX : 0,
            maxY > 0 ? this._viewport.scrollTop / maxY : 0,
        ];
    }

    /**
     * Syncs scrollbar positions from the viewport's current scroll offset.
     * @private
     */
    _syncFromScroll() {
        let maxScrollX = this.workspace.scrollWidth - this._viewport.clientWidth;
        let maxScrollY = this.workspace.scrollHeight - this._viewport.clientHeight;

        let hPct = maxScrollX > 0 ? this._viewport.scrollLeft / maxScrollX : 0;
        let vPct = maxScrollY > 0 ? this._viewport.scrollTop / maxScrollY : 0;

        if (maxScrollX > 0) this._hScrollBar.set_scroll_percent(hPct);
        if (maxScrollY > 0) this._vScrollBar.set_scroll_percent(vPct);

        // Debounced scroll-end callback (suppressed for programmatic scrolls
        // and during initial construction before layout settles)
        if (this._scrollTimer) clearTimeout(this._scrollTimer);
        if (this._scrollReady && !this._scrollSilent) {
            this._scrollTimer = setTimeout(() => {
                this._scrollTimer = null;
                this.make_callback('scrolled', hPct, vPct);
            }, 150);
        }
    }

    /**
     * Returns the MDISubWindow containing the given child widget.
     * @param {Widget} child - The child widget to look up.
     * @returns {MDISubWindow|null} The sub-window, or null if not found.
     */
    get_subwin(child) {
        for (let subwin of this.children) {
            let subwin_child = subwin.get_child();
            if (subwin_child === child) {
                return subwin;
            }
        }
        return null;
    }

    /**
     * Returns the configuration of the sub-window containing the given child.
     * @param {Widget} child - The child widget to look up.
     * @returns {Object|null} Configuration object with x, y, width, height,
     *   and title, or null if the child is not found.
     */
    get_configuration(child) {
        let subwin = this.get_subwin(child);
        if (subwin === null) {
            return null;
        }
        let style = subwin.get_element().style;
        return {
            x: parseInt(style.left, 10) || 0,
            y: parseInt(style.top, 10) || 0,
            width: parseInt(style.width, 10) || 0,
            height: parseInt(style.height, 10) || 0,
            title: subwin.titleText.innerHTML,
        };
    }

    /**
     * Returns the 0-based index of the currently active (topmost) sub-window's
     * child widget, or -1 if there are no children.
     * @returns {number} The index, or -1.
     */
    get_index() {
        if (this.children.length === 0) return -1;
        // find the subwindow with the highest z-index
        let maxZ = -1;
        let activeIdx = 0;
        for (let i = 0; i < this.children.length; i++) {
            let z = parseInt(this.children[i].get_element().style.zIndex) || 0;
            if (z > maxZ) {
                maxZ = z;
                activeIdx = i;
            }
        }
        return activeIdx;
    }

    /**
     * Raises the sub-window at the given index to the top (makes it active).
     * @param {number} index - 0-based index into the children list.
     */
    set_index(index) {
        if (index >= 0 && index < this.children.length) {
            let subwin = this.children[index];
            subwin.raise_();
        }
    }

    /**
     * Returns the index of the given child widget, or -1 if not found.
     * @param {Widget} child - The child widget to look up.
     * @returns {number} The 0-based index, or -1.
     */
    index_of(child) {
        for (let i = 0; i < this.children.length; i++) {
            if (this.children[i].get_child() === child) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Returns the child widget at the given index, or null if out of range.
     * @param {number} index - 0-based index.
     * @returns {Widget|null} The child widget, or null.
     */
    index_to_widget(index) {
        if (index < 0 || index >= this.children.length) {
            return null;
        }
        return this.children[index].get_child();
    }

    /**
     * Closes and removes the sub-window containing the given child widget.
     * @param {Widget} child - The child widget whose sub-window to close.
     */
    close_child(child) {
        let subwin = this.get_subwin(child);
        if (subwin !== null) {
            subwin.close();
        }
    }

}

export { MDISubWindow, MDIWidget };

