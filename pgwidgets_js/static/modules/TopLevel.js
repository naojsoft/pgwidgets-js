"use_strict";

import {ContainerWidget} from "./Widget.js";

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
     * @param {boolean} [options.resizable=false] - Whether the widget can be resized via corner grips.
     * @param {string|null} [options.title=null] - If provided, displays a draggable title bar.
     * @param {boolean} [options.moveable] - Whether the widget can be dragged by the title bar.
     *   Defaults to true if title is set, false otherwise.
     * @param {boolean} [options.closeable=true] - Whether a close button is shown in
     *   the title bar. Only takes effect if a title bar exists. Clicking the
     *   button fires the 'close' callback; it does not automatically hide the
     *   widget — the callback handler is responsible for that.
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

        // JavaScript hack to bind "this" correctly for our methods
        this.set_widget = this.set_widget.bind(this);
        this.set_position = this.set_position.bind(this);
        this.set_title = this.set_title.bind(this);
        this.set_moveable = this.set_moveable.bind(this);
        this.raise_ = this.raise_.bind(this);
        this.lower = this.lower.bind(this);
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);

        this.enable_callback('move');
        this.enable_callback('close');

        this._titleBar = null;
        this._titleText = null;
        this._closeButton = null;
        this._moveable = false;
        this._closeable = this.get_option(options, 'closeable', true);
        let title = this.get_option(options, 'title', null);
        if (title !== null) {
            this._makeTitleBar(title);
        }
        // default: moveable if title bar exists, not moveable otherwise
        this._moveable = this.get_option(options, 'moveable',
                                         this._titleBar !== null);
        if (this._titleBar && !this._moveable) {
            this._titleBar.style.cursor = 'default';
        }

        let resizable = this.get_option(options, 'resizable', false);
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
     * Creates the title bar and sets up drag-to-move behavior.
     * @param {string} title - The title text to display.
     * @private
     */
    _makeTitleBar(title) {
        this._titleBar = document.createElement('div');
        this._titleBar.className = 'toplevel-title-bar';

        this._titleText = document.createElement('span');
        this._titleText.className = 'toplevel-title-text';
        this._titleText.textContent = title;

        this._titleBar.appendChild(this._titleText);

        if (this._closeable) {
            this._makeCloseButton();
        }

        this.element.appendChild(this._titleBar);

        this._makeDraggable();
    }

    /**
     * Creates the title-bar close button. Reuses the MDI button styling for
     * visual consistency. Clicking fires the 'close' callback.
     * @private
     */
    _makeCloseButton() {
        // Spacer pushes the close button to the right edge of the title bar.
        let spacer = document.createElement('div');
        spacer.style.flex = '1';
        this._titleBar.appendChild(spacer);

        this._closeButton = document.createElement('div');
        this._closeButton.className = 'mdi-button mdi-close toplevel-close';
        this._closeButton.style.marginRight = '16px';
        this._closeButton.innerHTML =
            '<svg viewBox="0 0 10 10">' +
            '<line x1="1" y1="1" x2="9" y2="9" />' +
            '<line x1="9" y1="1" x2="1" y2="9" />' +
            '</svg>';
        this._closeButton.addEventListener('mousedown', (e) => {
            // Don't let the title-bar drag handler see this.
            e.stopPropagation();
        });
        this._closeButton.onclick = (e) => {
            e.stopPropagation();
            this.make_callback('close');
        };
        this._titleBar.appendChild(this._closeButton);
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
            if (!this._moveable) return;
            e.preventDefault();
            offsetX = e.clientX - (parseInt(element.style.left) || 0);
            offsetY = e.clientY - (parseInt(element.style.top) || 0);
            isDragging = true;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
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
        document.body.removeChild(this.get_element());
    }
};    

export { TopLevel };

