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
        this.activeHandle = null;
        this.activeIndex = -1;

        // JavaScript hack to bind "this" correctly for our methods
        this.add_widget = this.add_widget.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
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
        pane.appendChild(child.get_element());
        this.element.appendChild(pane);
        this.panes.push(pane);
        this.children.push(child);
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
            image.src = "../icons/hdots.svg";
        } else {
            handle.classList.add('horizontal');
            image.height = 24;
            image.src = "../icons/vdots.svg";
        }
        handle.appendChild(image);

        this.element.appendChild(handle);
        this.handles.push(handle);
        return handle;
    }

    onMouseDown(e, handleIndex) {
        e.preventDefault();
        this.activeIndex = handleIndex;

        // capture the current pixel sizes of the two adjacent panes and
        // convert from flex to fixed flex-basis so dragging is predictable
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

    onMouseMove(e) {
        if (this.activeIndex < 0) return;

        let delta;
        if (this.orientation === 'vertical') {
            delta = e.clientY - this.startPos;
        } else {
            delta = e.clientX - this.startPos;
        }

        let newSizeA = this.startSizeA + delta;
        let newSizeB = this.startSizeB - delta;

        // enforce minimum pane size
        const minSize = 20;
        if (newSizeA < minSize) {
            newSizeB -= (minSize - newSizeA);
            newSizeA = minSize;
        }
        if (newSizeB < minSize) {
            newSizeA -= (minSize - newSizeB);
            newSizeB = minSize;
        }

        let paneA = this.panes[this.activeIndex];
        let paneB = this.panes[this.activeIndex + 1];
        paneA.style.flex = '0 0 ' + newSizeA + 'px';
        paneB.style.flex = '0 0 ' + newSizeB + 'px';
    }

    onMouseUp(e) {
        this.activeIndex = -1;
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }

    /**
     * Sets the sizes of the panes in pixels.
     * @param {number[]} sizes - Array of pixel sizes, one per pane.
     */
    set_sizes(sizes) {
        for (let i = 0; i < sizes.length && i < this.panes.length; i++) {
            this.panes[i].style.flex = '0 0 ' + sizes[i] + 'px';
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
