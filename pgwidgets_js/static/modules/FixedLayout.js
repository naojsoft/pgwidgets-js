"use strict";

import {ContainerWidget} from "./Widget.js";

/**
 * A simple absolute-positioning container.  Each child is placed at
 * a fixed (x, y) offset within the container and sized at its
 * natural size — unless the caller has explicitly resized it via
 * ``child.resize(w, h)``, in which case that explicit size sticks.
 *
 * Useful when you want to compose a static panel of widgets at
 * known positions (HUDs, calibration overlays, hand-laid forms).
 *
 * @extends ContainerWidget
 */
class FixedLayout extends ContainerWidget {

    /**
     * Creates a new FixedLayout container.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'fixed-layout-widget';
        // Establish a positioning context so children's absolute
        // (left, top) coordinates are relative to this container.
        this.element.style.position = 'relative';

        this.add_widget = this.add_widget.bind(this);
    }

    /**
     * Adds a child widget at a fixed position within this container.
     * The child renders at its natural size unless ``resize()`` was
     * called on it — explicit sizes set via ``resize()`` are
     * preserved.
     *
     * @param {Widget} child - The widget to add.
     * @param {number} x - Horizontal offset in pixels from the
     *   container's content edge.
     * @param {number} y - Vertical offset in pixels from the
     *   container's content edge.
     */
    add_widget(child, x, y) {
        super.add(child);
        let elt = child.get_element();
        elt.classList.add('fixed-layout-child');
        elt.style.position = 'absolute';
        elt.style.left = x + 'px';
        elt.style.top = y + 'px';
    }
}

export { FixedLayout };
