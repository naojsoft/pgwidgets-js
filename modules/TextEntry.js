"use_strict";

import {Widget} from "./Widget.js";

class TextEntry extends Widget {

    constructor(options = {text: '', editable: true}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('input');
        }
        this.element.className = 'textentry-widget';

        this.element.type = 'text';
        this.element.readOnly = ! this.get_option(options, 'editable', true);
        this.element.placeholder = '';

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        this.element.addEventListener("keydown", this._cb_redirect);
        this.enable_callback('activated');

        var text = this.get_option(options, 'text', null);
        if (text !== null) {
            this.set_text(text);
        }
    }

    _cb_redirect(event) {
        this.make_callback('activated');
    }

    set_text(text) {
        this.element.value = text;
    }

    get_text() {
        return this.element.value;
    }
}

export { TextEntry };
