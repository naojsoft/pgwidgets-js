"use_strict";

import {Widget} from "./Widget.js";

/**
 * A radio button widget with mutual exclusion within a group.
 * Only one radio button in a group can be selected at a time.
 * Fires the 'activated' callback with the state when selected.
 * @extends Widget
 */
class RadioButton extends Widget {

    /**
     * Creates a new RadioButton.
     * @param {string} [text=''] - Label text next to the radio button.
     * @param {Object} [options] - Configuration options.
     * @param {RadioButton|null} [options.group=null] - Another RadioButton to join its group,
     *   or null to start a new group.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(text='', options={}) {
        if (text === null || text === undefined) text = '';
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'radiobutton-widget';
        this.state = false;

        // radio indicator
        this.indicator = document.createElement('span');
        this.indicator.className = 'radiobutton-indicator';
        this.element.appendChild(this.indicator);

        // label
        this.label = document.createElement('span');
        this.label.className = 'radiobutton-label';
        this.label.textContent = text;
        this.element.appendChild(this.label);

        // group management
        let groupOwner = this.get_option(options, 'group', null);
        if (groupOwner !== null) {
            // join existing group
            this.group = groupOwner.group;
            this.group.push(this);
        } else {
            // start a new group
            this.group = [this];
        }

        this.element.addEventListener('click', this._cb_redirect);
        this.enable_callback('activated');
    }

    _cb_redirect = (event) => {
        if (!this.state) {
            this._select();
        }
    }

    _select() {
        // deselect all others in the group
        for (let rb of this.group) {
            if (rb !== this && rb.state) {
                rb.state = false;
                rb._update_visual();
            }
        }
        this.state = true;
        this._update_visual();
        this.make_callback('activated', this.state);
    }

    _update_visual() {
        if (this.state) {
            this.indicator.classList.add('selected');
        } else {
            this.indicator.classList.remove('selected');
        }
    }

    /**
     * Sets the radio button label text.
     * @param {string} text - The label text.
     */
    set_text(text) {
        this.label.textContent = text;
    }

    /**
     * Sets the selection state. If true, deselects all others in the group.
     * @param {boolean} value - True to select, false to deselect.
     */
    set_state(value) {
        if (value) {
            this._select();
        } else {
            this.state = false;
            this._update_visual();
        }
    }

    /**
     * Returns the current selection state.
     * @returns {boolean} True if selected, false otherwise.
     */
    get_state() {
        return this.state;
    }
}

export { RadioButton };
