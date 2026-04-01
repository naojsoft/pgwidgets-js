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
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
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

