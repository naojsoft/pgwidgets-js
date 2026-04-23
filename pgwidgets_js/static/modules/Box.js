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
        this.insert_widget = this.insert_widget.bind(this);
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

        let orient = this.orientation;

        // Override any CSS height/width:100% on the main axis so that
        // flex-basis:auto resolves to content size, not parent size.
        if (orient === 'vertical') {
            elt.style.height = 'auto';
        } else {
            elt.style.width = 'auto';
        }

        // main axis: stretch=0 means natural size, stretch>0 means
        // distribute extra space proportionally (like Qt's stretch factor).
        // Using 'auto' flex-basis so children contribute their content
        // size to parent intrinsic sizing (Qt-like: stretch distributes
        // extra space beyond content, not all space).
        if (stretch > 0) {
            elt.style.flex = stretch + ' 1 auto';
        } else {
            elt.style.flex = '0 0 auto';
        }

        // cross axis: always fill (like Qt)
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
        if (typeof child.resize === 'function') {
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
    }

    /**
     * Inserts a child widget at the given index in the box layout.
     * @param {number} index - 0-based position to insert at.
     * @param {Widget} child - The widget to insert.
     * @param {number} [stretch=0] - Stretch factor (same as add_widget).
     */
    insert_widget(index, child, stretch=0) {
        let elt = child.get_element();
        elt.classList.add('box-child');

        let orient = this.orientation;

        // Override any CSS height/width:100% on the main axis
        if (orient === 'vertical') {
            elt.style.height = 'auto';
        } else {
            elt.style.width = 'auto';
        }

        if (stretch > 0) {
            elt.style.flex = stretch + ' 1 auto';
        } else {
            elt.style.flex = '0 0 auto';
        }

        if (orient === 'vertical') {
            elt.style.width = '100%';
        } else {
            elt.style.height = '100%';
        }
        elt.style.minWidth = '0';
        elt.style.minHeight = '0';

        // Insert into children array at the right position
        if (index >= this.children.length) {
            this.children.push(child);
            this.element.appendChild(elt);
        } else {
            let refChild = this.children[index];
            this.children.splice(index, 0, child);
            this.element.insertBefore(elt, refChild.get_element());
        }

        // Wrap resize() for cross-axis stretch (same as add_widget)
        if (typeof child.resize === 'function') {
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

        this.make_callback('child-added', child);
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
 * A box layout designed for arranging buttons.
 * All buttons are sized to match the widest button, with labels centered.
 * @extends Box
 */
class ButtonBox extends Box {

    /**
     * Creates a new ButtonBox.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.orientation='horizontal'] - Layout direction.
     * @param {string} [options.halign='center'] - Horizontal alignment of buttons
     *   within the box: 'left', 'center', or 'right'.
     */
    constructor(options = { orientation: 'horizontal' }) {
        super(options);
        this._halign = this.get_option(options, 'halign', 'center');
        this._applyAlign();

        this.set_halign = this.set_halign.bind(this);
    }

    /** @private */
    _applyAlign() {
        let val = 'center';
        switch (this._halign) {
            case 'left': val = 'flex-start'; break;
            case 'right': val = 'flex-end'; break;
            default: val = 'center'; break;
        }
        this.element.style.justifyContent = val;
    }

    /**
     * Sets the horizontal alignment of buttons within the box.
     * @param {string} halign - 'left', 'center', or 'right'.
     */
    set_halign(halign) {
        this._halign = halign;
        this._applyAlign();
    }

    /**
     * Adds a child widget and equalizes all button widths.
     * @param {Widget} child - The widget to add.
     * @param {number} [stretch=0] - Stretch factor.
     */
    add_widget(child, stretch=0) {
        super.add_widget(child, stretch);
        child.get_element().style.textAlign = 'center';
        this._equalizeWidths();
    }

    /**
     * Inserts a child widget at the given index and equalizes widths.
     * @param {number} index - 0-based position.
     * @param {Widget} child - The widget to insert.
     * @param {number} [stretch=0] - Stretch factor.
     */
    insert_widget(index, child, stretch=0) {
        super.insert_widget(index, child, stretch);
        child.get_element().style.textAlign = 'center';
        this._equalizeWidths();
    }

    /**
     * Sets all children to the width of the widest child.
     * @private
     */
    _equalizeWidths() {
        // Use requestAnimationFrame so the DOM has laid out the elements
        requestAnimationFrame(() => {
            let maxW = 0;
            for (let child of this.children) {
                let elt = child.get_element();
                // Temporarily clear any forced width so we measure natural size
                elt.style.minWidth = '';
                elt.style.width = '';
            }
            // Force a reflow to get natural widths
            for (let child of this.children) {
                let elt = child.get_element();
                let w = elt.getBoundingClientRect().width;
                if (w > maxW) maxW = w;
            }
            if (maxW > 0) {
                let px = Math.ceil(maxW) + 'px';
                for (let child of this.children) {
                    let elt = child.get_element();
                    elt.style.minWidth = px;
                }
            }
        });
    }
}

export { Box, HBox, VBox, ButtonBox };

