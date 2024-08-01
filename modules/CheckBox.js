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
        checkbox.type = "checkbox";
        this.element.appendChild(this.checkbox);
        this.label = document.createTextNode(text)
        this.element.appendChild(this.label);
        
        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        //super.init_style();

        this.element.textContent = text;
        this.element.onclick = () => this._cb_redirect('clicked');

        this.enable_callback('activated');
    }

    set_text(text) {
        this.label.innerText = text;
    }

    _cb_redirect(action) {
        if (action === 'clicked') {
            this.make_callback('activated', this.element.value);
        }
    }
};    

export { CheckBox };
