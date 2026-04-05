"use_strict";

import {ContainerWidget} from "./Widget.js";

/**
 * A page container similar to TopLevel, used as a full-page root widget.
 * Uses absolute positioning and flex display.
 * @extends ContainerWidget
 */
class Page extends ContainerWidget {

    /**
     * Creates a new Page widget.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'page';
        this.element.style.position = 'absolute';
        this.element.style.display = 'flex';
        //this.element.style.overflow = 'hidden';
        this.element.style.margin = '0px';
    }

    /**
     * Sets the single child widget of this Page. The child fills the entire area.
     * @param {Widget} child - The widget to display.
     */
    set_widget(child) {
        this.children.push(child);
        let elt = child.get_element();
        elt.style.flex = '1';
        this.element.appendChild(elt);
    }

    /** Appends the Page element to the document body, making it visible. */
    show() {
        document.body.appendChild(this.get_element());
    }

    /** Removes the Page element from the document body, hiding it. */
    hide() {
        document.body.removeChild(this.get_element());
    }
};    

export { Page };
