"use_strict";

import {Widget} from "./Widget.js";

/**
 * A read-only text display widget. Shows plain text or HTML content.
 * @extends Widget
 */
class Text extends Widget {

    /**
     * Creates a new Text widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.text=''] - Initial text content.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {text: ''}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'text-widget';

        var text = this.get_option(options, 'text', null);
        if (text !== null) {
            this.set_text(text);
        }
    }

    /**
     * Sets the displayed text content.
     * @param {string} text - The text to display.
     */
    set_text(text) {
        this.element.innerText = text;
    }

    /**
     * Returns the current text content.
     * @returns {string} The text content.
     */
    get_text() {
        return this.element.innerText;
    }

    /**
     * Sets the displayed content as HTML.
     * @param {string} html_text - The HTML string to render.
     */
    set_html(html_text) {
        this.element.innerHTML = html_text;
    }

    /** Clears all text content. */
    clear() {
        this.element.innerText = '';
    }

}

export { Text };
