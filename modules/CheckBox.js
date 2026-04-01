"use_strict";

import {Widget} from "./Widget.js";

class CheckBox extends Widget {

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

        // JavaScript hack to bind "this" correctly for our methods
        this.set_state = this.set_state.bind(this);
        this.get_state = this.get_state.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        this.checkbox.onclick = () => this._cb_redirect('clicked');

        this.enable_callback('activated');
    }

    set_state(tf) {
        this.checkbox.checked = tf;
    }

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
