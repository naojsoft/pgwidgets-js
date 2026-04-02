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
        this.element.style.overflow = 'hidden';
        this.element.style.margin = '1px';

        // JavaScript hack to bind "this" correctly for our methods
        this.set_widget = this.set_widget.bind(this);
        this.set_position = this.set_position.bind(this);
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);

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

