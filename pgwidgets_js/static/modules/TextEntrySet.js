"use_strict";

import {TextEntry} from "./TextEntry.js";

/**
 * A text entry with a companion button. Fires the 'activated' callback
 * when the user presses Enter/Return in the input or clicks the button.
 * Inherits line history and text methods from TextEntry.
 * @extends TextEntry
 */
class TextEntrySet extends TextEntry {

    /**
     * Creates a new TextEntrySet widget.
     * @param {string} [text=''] - Initial text value of the input.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.label='Set'] - Label text for the button.
     * @param {boolean} [options.editable=true] - Whether the input is editable.
     * @param {number} [options.linehistory=1] - Number of lines to keep in history.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(text='', options={}) {
        if (text === null || text === undefined) text = '';
        super(text, options);

        // wrap the input in a container div
        let wrapper = document.createElement('div');
        wrapper.className = 'textentryset-widget';

        // restyle the input for the composite widget
        this._input.className = 'textentryset-input';
        wrapper.appendChild(this._input);

        // button
        this._button = document.createElement('button');
        this._button.className = 'textentryset-button';
        let btnText = this.get_option(options, 'label', 'Set');
        this._button.textContent = btnText;
        wrapper.appendChild(this._button);

        this.element = wrapper;

        // JavaScript hack to bind "this" correctly for our methods
        this.set_button_text = this.set_button_text.bind(this);

        // fire activated on button click
        this._button.addEventListener('click', () => {
            this._recordHistory();
            this.make_callback('activated', this.get_text());
        });
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
