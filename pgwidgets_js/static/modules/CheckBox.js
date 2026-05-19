"use_strict";

import {Widget} from "./Widget.js";

/**
 * A checkbox widget with a text label.
 * Fires the 'activated' callback with the checked state when toggled.
 * @extends Widget
 */
class CheckBox extends Widget {

    /**
     * Creates a new CheckBox widget.
     * @param {string} [text=''] - Label text next to the checkbox.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(text='', options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        
        this.element.className = 'checkbox-widget';
        
        this.checkbox = document.createElement('input');
        this.checkbox.type = "checkbox";
        this.element.appendChild(this.checkbox);
        this.label = document.createTextNode(text);
        this.element.appendChild(this.label);

        this.checkbox.onclick = () => this._cb_redirect('clicked');

        this.enable_callback('activated');
    }

    /**
     * Sets the checked state programmatically.
     * @param {boolean} tf - True for checked, false for unchecked.
     */
    set_state(tf) {
        this.checkbox.checked = tf;
    }

    /**
     * Returns the current checked state.
     * @returns {boolean} True if checked, false if unchecked.
     */
    get_state() {
        return this.checkbox.checked;
    }

    _cb_redirect(action) {
        if (action === 'clicked') {
            this.make_callback('activated', this.checkbox.checked);
        }
    }
};    

export { CheckBox };
