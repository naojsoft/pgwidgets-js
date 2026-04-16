"use_strict";

import {ContainerWidget} from "./Widget.js";

/**
 * A flexible box layout container, similar to Qt's QBoxLayout.
 * Arranges child widgets either horizontally or vertically using CSS flexbox.
 * @extends ContainerWidget
 */
class Box extends ContainerWidget {

    /**
     * Creates a new Box layout container.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.orientation='horizontal'] - Layout direction: 'horizontal' or 'vertical'.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = { orientation: 'horizontal' }) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'box-widget';
        this.orientation = this.get_option(options, 'orientation', 'horizontal');

        // JavaScript hack to bind "this" correctly for our methods
        this.add_widget = this.add_widget.bind(this);
        this.set_spacing = this.set_spacing.bind(this);
        this.init_style = this.init_style.bind(this);

        this.init_style();
    }

    init_style() {
        super.init_style();

        let style = this.element.style;
        if (this.orientation === 'vertical') {
            this.element.classList.add('vertical');
        }
        else {
            this.element.classList.add('horizontal');
        };
    }
    
    /**
     * Adds a child widget to the box layout.
     * @param {Widget} child - The widget to add.
     * @param {number} [stretch=0] - Stretch factor. 0 means natural size;
     *   values > 0 distribute extra space proportionally (like Qt's stretch factor).
     */
    add_widget(child, stretch=0) {
        super.add(child);

        let elt = child.get_element();
        elt.classList.add('box-child');

        // main axis: stretch=0 means natural size, stretch>0 means
        // distribute extra space proportionally (like Qt's stretch factor)
        if (stretch > 0) {
            elt.style.flex = stretch + ' 1 0px';
        } else {
            elt.style.flex = '0 0 auto';
        }

        // cross axis: always fill (like Qt)
        let orient = this.orientation;
        if (orient === 'vertical') {
            elt.style.width = '100%';
        } else {
            elt.style.height = '100%';
        }
        elt.style.minWidth = '0';
        elt.style.minHeight = '0';

        // Wrap resize() so that a caller-supplied pixel size doesn't
        // override the cross-axis stretch applied above.  Without this,
        // a subsequent resize(w, h) sets style.width/height to pixels
        // and the child no longer grows past that value when the
        // container is re-expanded.
        let origResize = child.resize.bind(child);
        child.resize = function(w, h) {
            origResize(w, h);
            if (orient === 'vertical') {
                elt.style.width = '100%';
            } else {
                elt.style.height = '100%';
            }
        };
    }

    /**
     * Sets the gap between child widgets.
     * @param {number} [gap=0] - Spacing in pixels.
     */
    set_spacing(gap=0) {
        let style = this.element.style;
        style['gap'] = gap + "px";
    }

};    

/**
 * A vertical box layout container. Shortcut for Box with vertical orientation.
 * @extends Box
 */
class VBox extends Box {

    /** Creates a new vertical box layout. */
    constructor() {
        super({orientation: 'vertical'});
    }
}

/**
 * A horizontal box layout container. Shortcut for Box with horizontal orientation.
 * @extends Box
 */
class HBox extends Box {

    /** Creates a new horizontal box layout. */
    constructor() {
        super({orientation: 'horizontal'});
    }
}

/**
 * A box layout designed for arranging buttons, with flex-grow enabled.
 * @extends Box
 */
class ButtonBox extends Box {

    /**
     * Creates a new ButtonBox.
     * @param {Object} [options] - Configuration options (same as Box).
     */
    constructor(options = { orientation: 'horizontal' }) {
        super(options);
    }

    init_style() {
        super.init_style();

        let style = this.element.style;
        style['flex-grow'] = 1;
        style['flex-basis'] = 0;
    }
    
}

export { Box, HBox, VBox, ButtonBox };

