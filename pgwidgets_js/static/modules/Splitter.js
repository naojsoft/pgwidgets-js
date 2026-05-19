"use_strict";

import {ContainerWidget} from "./Widget.js";

/**
 * A resizable split pane container, similar to Qt's QSplitter.
 * Child widgets are separated by draggable handles. Supports horizontal
 * and vertical orientations with document-level mouse tracking.
 * @extends ContainerWidget
 */
class Splitter extends ContainerWidget {

    /**
     * Creates a new Splitter widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.orientation='horizontal'] - Split direction: 'horizontal' or 'vertical'.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {orientation: 'horizontal'}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'splitter';
        this.orientation = this.get_option(options, 'orientation', 'horizontal');

        if (this.orientation === 'vertical') {
            this.element.classList.add('vertical');
        } else {
            this.element.classList.add('horizontal');
        }

        this.handles = [];
        this.panes = [];
        this.paneMins = [];
        this.activeHandle = null;
        this.activeIndex = -1;

        this.enable_callback('sizing');

    }

    /**
     * Adds a child widget as a new pane in the splitter.
     * A draggable handle is inserted between adjacent panes.
     * @param {Widget} child - The widget to add.
     */
    add_widget(child) {
        if (this.panes.length > 0) {
            let handle = this._add_handle();
            let handleIndex = this.handles.length - 1;
            handle.addEventListener('mousedown',
                                    (e) => this.onMouseDown(e, handleIndex));
        }

        const pane = document.createElement('div');
        pane.className = 'splitter-pane';
        pane.style.flex = '1 1 0';
        pane.style.overflow = 'hidden';
        // Minimum pane extent in the split direction (default 20px).
        const defaultMin = 20;
        if (this.orientation === 'vertical') {
            pane.style.minHeight = defaultMin + 'px';
        } else {
            pane.style.minWidth = defaultMin + 'px';
        }
        let elt = child.get_element();
        pane.appendChild(elt);
        this.element.appendChild(pane);
        this.panes.push(pane);
        this.paneMins.push(defaultMin);
        this.children.push(child);
        this.make_callback('child-added', child);

        // The pane owns the child's size on both axes via flex and
        // align-items: stretch.  Wrap resize() so a caller-supplied
        // pixel size doesn't override the stretch once the container
        // is shrunk and re-expanded.  Subclass side effects still run
        // via the original resize.
        if (typeof child.resize === 'function') {
            let origResize = child.resize.bind(child);
            child.resize = function(w, h) {
                origResize(w, h);
                elt.style.width = '';
                elt.style.height = '';
            };
        }
    }

    /**
     * Set the minimum size (in pixels) of the pane containing `child`
     * along the splitter's orientation. A value of 0 allows the pane
     * to be collapsed entirely; the handle(s) always remain visible.
     * @param {Widget} child - A widget previously added via add_widget.
     * @param {number} min_px - Minimum pane extent in pixels.
     */
    set_minimum_size(child, min_px) {
        let idx = this.children.indexOf(child);
        if (idx < 0) return;
        let pane = this.panes[idx];
        this.paneMins[idx] = min_px;
        if (this.orientation === 'vertical') {
            pane.style.minHeight = min_px + 'px';
        } else {
            pane.style.minWidth = min_px + 'px';
        }
    }

    _add_handle() {
        let handle = document.createElement('div');
        handle.className = 'splitter-handle';
        let image = document.createElement('img');
        // prevent divider image from interfering with dragging
        image.addEventListener('dragstart', (event) => event.preventDefault());

        if (this.orientation === 'vertical') {
            handle.classList.add('vertical');
            image.width = 24;
            image.src = new URL("../icons/hdots.svg", import.meta.url).href;
        } else {
            handle.classList.add('horizontal');
            image.height = 24;
            image.src = new URL("../icons/vdots.svg", import.meta.url).href;
        }
        handle.appendChild(image);

        this.element.appendChild(handle);
        this.handles.push(handle);
        return handle;
    }

    onMouseDown(e, handleIndex) {
        e.preventDefault();
        this.activeIndex = handleIndex;

        // Normalize ALL panes to flex-grow values equal to their current
        // pixel extent, so non-adjacent panes keep their sizes while we
        // adjust only the two panes next to this handle. Read all sizes
        // BEFORE writing any flex values, otherwise each write triggers
        // a relayout that skews subsequent reads.
        let sizes = this.panes.map((p) => {
            let r = p.getBoundingClientRect();
            return this.orientation === 'vertical' ? r.height : r.width;
        });
        for (let i = 0; i < this.panes.length; i++) {
            this.panes[i].style.flex = sizes[i] + ' 1 0';
        }

        let paneA = this.panes[handleIndex];
        let paneB = this.panes[handleIndex + 1];
        let rectA = paneA.getBoundingClientRect();
        let rectB = paneB.getBoundingClientRect();

        if (this.orientation === 'vertical') {
            this.startSizeA = rectA.height;
            this.startSizeB = rectB.height;
            this.startPos = e.clientY;
        } else {
            this.startSizeA = rectA.width;
            this.startSizeB = rectB.width;
            this.startPos = e.clientX;
        }

        // listen on document so dragging works even if mouse leaves the widget
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
    }

    // Class-field arrows so the handler identity is stable per
    // instance (needed for removeEventListener to find the same fn
    // we added), and `this` is the Splitter instance regardless of
    // who fires the event.
    onMouseMove = (e) => {
        if (this.activeIndex < 0) return;

        let delta;
        if (this.orientation === 'vertical') {
            delta = e.clientY - this.startPos;
        } else {
            delta = e.clientX - this.startPos;
        }

        let newSizeA = this.startSizeA + delta;
        let newSizeB = this.startSizeB - delta;

        // enforce per-pane minimum sizes
        const minA = this.paneMins[this.activeIndex];
        const minB = this.paneMins[this.activeIndex + 1];
        if (newSizeA < minA) {
            newSizeB -= (minA - newSizeA);
            newSizeA = minA;
        }
        if (newSizeB < minB) {
            newSizeA -= (minB - newSizeB);
            newSizeB = minB;
        }

        // Use flex-grow proportional to the new sizes so the panes
        // continue to expand/shrink in proportion when the splitter
        // itself is resized.
        let paneA = this.panes[this.activeIndex];
        let paneB = this.panes[this.activeIndex + 1];
        paneA.style.flex = newSizeA + ' 1 0';
        paneB.style.flex = newSizeB + ' 1 0';
    }

    onMouseUp = (e) => {
        this.activeIndex = -1;
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
        this.make_callback('sizing', this.get_sizes());
    }

    /**
     * Sets the sizes of the panes in pixels.
     * @param {number[]} sizes - Array of pixel sizes, one per pane.
     */
    set_sizes(sizes) {
        for (let i = 0; i < sizes.length && i < this.panes.length; i++) {
            this.panes[i].style.flex = sizes[i] + ' 1 0';
        }
    }

    /**
     * Returns the current sizes of all panes in pixels.
     * @returns {number[]} Array of pixel sizes.
     */
    get_sizes() {
        let sizes = [];
        for (let pane of this.panes) {
            let rect = pane.getBoundingClientRect();
            if (this.orientation === 'vertical') {
                sizes.push(rect.height);
            } else {
                sizes.push(rect.width);
            }
        }
        return sizes;
    }
}

export { Splitter };
