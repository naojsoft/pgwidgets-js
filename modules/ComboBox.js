"use_strict";

import {Widget} from "./Widget.js";

class ComboBox extends Widget {

    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('select');
        }
        
        this.element.className = 'combobox-widget';
        
        // JavaScript hack to bind "this" correctly for our methods
        this.append_text = this.append_text.bind(this);
        this.clear = this.clear.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        this.element.onclick = () => this._cb_redirect('clicked');

        this.enable_callback('activated');
    }

    append_text(text, value=null) {
        var option = document.createElement("option");
        option.innerHTML = text;
        if (value === null) {
            // default value is the index of the item in the box
            value = this.element.options.length;
        }
        option.value = value;
        this.element.appendChild(option);
    }

    clear(text) {
        this.element.options.length = 0;
    }

    set_index(idx) {
        this.element.selectedIndex = idx;
    }

    get_index() {
        return this.element.selectedIndex;
    }

    _cb_redirect(action) {
        if (action === 'clicked') {
            let idx = this.element.selectedIndex;
            this.make_callback('activated', idx);
        }
    }
};    

export { ComboBox };
