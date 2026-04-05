"use_strict";

import {ContainerWidget} from "./Widget.js";

/**
 * A frame container with an optional titled border, similar to GTK's GtkFrame.
 * Uses an HTML fieldset/legend for the etched border appearance.
 * @extends ContainerWidget
 */
class Frame extends ContainerWidget {

    /**
     * Creates a new Frame widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.title=''] - Title text displayed in the frame border.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('fieldset');
        }
        this.element.className = 'frame-widget';

        this.title = this.get_option(options, 'title', '');

        if (this.title !== '') {
            this.legend = document.createElement('legend');
            this.legend.className = 'frame-title';
            this.legend.textContent = this.title;
            this.element.appendChild(this.legend);
        }

        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'frame-content';
        this.element.appendChild(this.contentContainer);

        // JavaScript hack to bind "this" correctly for our methods
        this.set_widget = this.set_widget.bind(this);
        this.set_title = this.set_title.bind(this);
    }

    /**
     * Sets the single child widget inside the frame. Replaces any existing child.
     * @param {Widget} child - The widget to display inside the frame.
     */
    set_widget(child) {
        if (this.children.length > 0) {
            this.contentContainer.removeChild(this.children[0].get_element());
            this.remove_child(this.children[0]);
        }
        super.add_child(child);
        this.contentContainer.appendChild(child.get_element());
    }

    /**
     * Sets or updates the frame title text.
     * Creates the legend element if it doesn't exist yet.
     * @param {string} text - The title text to display.
     */
    set_title(text) {
        this.title = text;
        if (!this.legend) {
            this.legend = document.createElement('legend');
            this.legend.className = 'frame-title';
            this.element.insertBefore(this.legend, this.contentContainer);
        }
        this.legend.textContent = text;
    }
}

export { Frame };
