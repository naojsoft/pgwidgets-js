"use_strict";

import {Widget} from "./Widget.js";

/**
 * A toggle button that maintains a pressed/unpressed state.
 * Fires the 'activated' callback with the new boolean state when toggled.
 * @extends Widget
 */
class ToggleButton extends Widget {

    /**
     * Creates a new ToggleButton.
     * @param {string} [text=''] - Button label text.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    /**
     * Creates a new ToggleButton.
     * @param {string} [text=''] - Button label text.
     * @param {Object} [options] - Configuration options.
     * @param {ToggleButton|null} [options.group=null] - Another ToggleButton to join its
     *   mutual-exclusion group, or null for independent toggle behavior.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(text='', options={}) {
        if (text === null || text === undefined) text = '';
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('button');
        }
        this.element.className = 'togglebutton-widget';
        this.element.textContent = text;
        this.state = false;

        // group management
        let groupOwner = this.get_option(options, 'group', null);
        if (groupOwner !== null) {
            if (groupOwner.group !== null) {
                this.group = groupOwner.group;
            } else {
                groupOwner.group = [groupOwner];
                this.group = groupOwner.group;
            }
            this.group.push(this);
        } else {
            this.group = null;
        }

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.set_state = this.set_state.bind(this);
        this.get_state = this.get_state.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        this.element.addEventListener('click', this._cb_redirect);
        this.enable_callback('activated');
    }

    _cb_redirect(event) {
        if (this.group !== null) {
            if (this.state) {
                // toggle off the current one
                this.state = false;
                this._update_visual();
                this.make_callback('activated', this.state);
            } else {
                // turn off others, turn on this one
                for (let btn of this.group) {
                    if (btn !== this && btn.state) {
                        btn.state = false;
                        btn._update_visual();
                    }
                }
                this.state = true;
                this._update_visual();
                this.make_callback('activated', this.state);
            }
        } else {
            this.state = !this.state;
            this._update_visual();
            this.make_callback('activated', this.state);
        }
    }

    _update_visual() {
        if (this.state) {
            this.element.classList.add('pressed');
        } else {
            this.element.classList.remove('pressed');
        }
    }

    /**
     * Sets the button label text.
     * @param {string} text - The label text.
     */
    set_text(text) {
        this.element.textContent = text;
    }

    /**
     * Sets the toggle state programmatically (does not fire callback).
     * @param {boolean} value - True for pressed, false for unpressed.
     */
    set_state(value) {
        if (value && this.group !== null) {
            for (let btn of this.group) {
                if (btn !== this && btn.state) {
                    btn.state = false;
                    btn._update_visual();
                }
            }
        }
        this.state = !!value;
        this._update_visual();
    }

    /**
     * Returns the current toggle state.
     * @returns {boolean} True if pressed, false if unpressed.
     */
    get_state() {
        return this.state;
    }
}

export { ToggleButton };
