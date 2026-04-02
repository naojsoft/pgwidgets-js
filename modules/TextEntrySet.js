"use_strict";

import {Widget} from "./Widget.js";

/**
 * A text entry with a companion button. Fires the 'activated' callback
 * when the user presses Enter/Return in the input or clicks the button.
 * @extends Widget
 */
class TextEntrySet extends Widget {

    /**
     * Creates a new TextEntrySet widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.text='Set'] - Label text for the button.
     * @param {string} [options.value=''] - Initial text value of the input.
     * @param {boolean} [options.editable=true] - Whether the input is editable.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'textentryset-widget';

        // text input
        this._input = document.createElement('input');
        this._input.className = 'textentryset-input';
        this._input.type = 'text';
        this._input.readOnly = !this.get_option(options, 'editable', true);
        this.element.appendChild(this._input);

        // button
        this._button = document.createElement('button');
        this._button.className = 'textentryset-button';
        let btnText = this.get_option(options, 'text', 'Set');
        this._button.textContent = btnText;
        this.element.appendChild(this._button);

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this.clear = this.clear.bind(this);
        this.set_button_text = this.set_button_text.bind(this);

        // fire activated on Enter key
        this._input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.make_callback('activated', this.get_text());
            }
        });

        // fire activated on button click
        this._button.addEventListener('click', () => {
            this.make_callback('activated', this.get_text());
        });

        this.enable_callback('activated');

        let value = this.get_option(options, 'value', '');
        if (value !== '') {
            this.set_text(value);
        }
    }

    /**
     * Sets the input text value.
     * @param {string} text - The text to set.
     */
    set_text(text) {
        this._input.value = text;
    }

    /**
     * Returns the current input text value.
     * @returns {string} The text value.
     */
    get_text() {
        return this._input.value;
    }

    /** Clears the input text. */
    clear() {
        this._input.value = '';
    }

    /**
     * Sets the button label text.
     * @param {string} text - The button text.
     */
    set_button_text(text) {
        this._button.textContent = text;
    }
}

export { TextEntrySet };
