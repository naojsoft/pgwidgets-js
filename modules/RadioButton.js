"use_strict";

import {Widget} from "./Widget.js";

class RadioButton extends Widget {

    constructor(text='', options={}) {
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

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.set_state = this.set_state.bind(this);
        this.get_state = this.get_state.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        this.element.addEventListener('click', this._cb_redirect);
        this.enable_callback('activated');
    }

    _cb_redirect(event) {
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

    set_text(text) {
        this.label.textContent = text;
    }

    set_state(value) {
        if (value) {
            this._select();
        } else {
            this.state = false;
            this._update_visual();
        }
    }

    get_state() {
        return this.state;
    }
}

export { RadioButton };
