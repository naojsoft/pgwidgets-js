"use_strict";

import {Widget} from "./Widget.js";

/**
 * A single-line text input widget.
 * Fires the 'activated' callback on keydown events.
 * @extends Widget
 */
class TextEntry extends Widget {

    /**
     * Creates a new TextEntry widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.text=''] - Initial text value.
     * @param {boolean} [options.editable=true] - Whether the input is editable.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {text: '', editable: true}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('input');
        }
        this.element.className = 'textentry-widget';

        this.element.type = 'text';
        this.element.readOnly = ! this.get_option(options, 'editable', true);
        this.element.placeholder = '';

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        this.element.addEventListener("keydown", this._cb_redirect);
        this.enable_callback('activated');

        var text = this.get_option(options, 'text', null);
        if (text !== null) {
            this.set_text(text);
        }
    }

    _cb_redirect(event) {
        this.make_callback('activated');
    }

    /**
     * Sets the input text value.
     * @param {string} text - The text to set.
     */
    set_text(text) {
        this.element.value = text;
    }

    /**
     * Returns the current input text value.
     * @returns {string} The text value.
     */
    get_text() {
        return this.element.value;
    }
}

export { TextEntry };
