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
        this.insert_alpha = this.insert_alpha.bind(this);
        this.delete_alpha = this.delete_alpha.bind(this);
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this.get_alpha = this.get_alpha.bind(this);
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

    clear() {
        this.element.options.length = 0;
    }

    set_index(idx) {
        this.element.selectedIndex = idx;
    }

    get_index() {
        return this.element.selectedIndex;
    }

    insert_alpha(text, value=null) {
        var option = document.createElement("option");
        option.textContent = text;
        if (value === null) {
            value = this.element.options.length;
        }
        option.value = value;

        // find insertion point to maintain sorted order
        let opts = this.element.options;
        let inserted = false;
        for (let i = 0; i < opts.length; i++) {
            if (text.localeCompare(opts[i].textContent) < 0) {
                this.element.insertBefore(option, opts[i]);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            this.element.appendChild(option);
        }
    }

    delete_alpha(text) {
        let opts = this.element.options;
        for (let i = 0; i < opts.length; i++) {
            if (opts[i].textContent === text) {
                this.element.removeChild(opts[i]);
                return;
            }
        }
    }

    set_text(text) {
        let opts = this.element.options;
        for (let i = 0; i < opts.length; i++) {
            if (opts[i].textContent === text) {
                this.element.selectedIndex = i;
                return;
            }
        }
    }

    get_text() {
        let idx = this.element.selectedIndex;
        if (idx < 0) {
            return null;
        }
        return this.element.options[idx].textContent;
    }

    get_alpha(idx) {
        if (idx < 0 || idx >= this.element.options.length) {
            return null;
        }
        return this.element.options[idx].textContent;
    }

    _cb_redirect(action) {
        if (action === 'clicked') {
            let idx = this.element.selectedIndex;
            this.make_callback('activated', idx);
        }
    }
};    

export { ComboBox };
