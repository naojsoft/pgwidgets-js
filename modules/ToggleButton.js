"use_strict";

import {Widget} from "./Widget.js";

class ToggleButton extends Widget {

    constructor(text='', options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('button');
        }
        this.element.className = 'togglebutton-widget';
        this.element.textContent = text;
        this.state = false;

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.set_state = this.set_state.bind(this);
        this.get_state = this.get_state.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        this.element.addEventListener('click', this._cb_redirect);
        this.enable_callback('activated');
    }

    _cb_redirect(event) {
        this.state = !this.state;
        this._update_visual();
        this.make_callback('activated', this.state);
    }

    _update_visual() {
        if (this.state) {
            this.element.classList.add('pressed');
        } else {
            this.element.classList.remove('pressed');
        }
    }

    set_text(text) {
        this.element.textContent = text;
    }

    set_state(value) {
        this.state = !!value;
        this._update_visual();
    }

    get_state() {
        return this.state;
    }
}

export { ToggleButton };
