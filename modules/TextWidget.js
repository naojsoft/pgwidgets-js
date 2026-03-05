"use_strict";

import {Widget} from "./Widget.js";

class Text extends Widget {

    constructor(options = {text: ''}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'text-widget';

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.set_html = this.set_html.bind(this);

        var text = this.get_option(options, 'text', null);
        if (text !== null) {
            this.set_text(text);
        }
    }

    set_text(text) {
        this.element.innerText = text;
    }

    get_text() {
        return this.element.innerText;
    }

    set_html(html_text) {
        this.element.innerHTML = html_text;
    }
    
}

class Label extends Widget {

    constructor(options = {text: ''}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'label-widget';

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.set_html = this.set_html.bind(this);

        var text = this.get_option(options, 'text', null);
        if (text !== null) {
            this.set_text(text);
        }
    }

    set_text(text) {
        this.element.innerText = text;
    }

    set_html(html_text) {
        this.element.innerHTML = html_text;
    }
    
    set_font(font, size=10) {
        this.element.innerText = text;
    }

    set_color(fg=null, bg=null) {
        this.element.innerText = text;
    }

    set_halign() {
        this.element.innerText = text;
    }

}

class TextEntry extends Widget {

    constructor(text='', options={editable: true}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('input');
        }
        this.element.setAttribute('type', 'text');
        
        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        super.init_style();

        this.element.textContent = text;
        this.element.onclick = () => this._cb_redirect('clicked');

        this.enable_callback('activated');
    }

    set_text(text) {
        this.element.innerText = text;
    }

    get_text() {
        this.element.innerText = text;
    }

    set_editable(tf) {
        this.element.innerText = text;
    }

    set_font(font, size=10) {
        this.element.innerText = text;
    }

    _cb_redirect(action) {
        if (action === 'clicked') {
            this.make_callback('activated');
        }
    }
}

class TextArea extends Widget {

    constructor(text='', options={wrap: false, editable: true}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('textarea');
        }
        
        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        super.init_style();

        this.element.textContent = text;
    }

    set_text(text) {
        this.element.innerText = text;
    }

    get_text() {
        this.element.innerText = text;
    }

    append_text(text) {
        this.element.innerText = text;
    }

    set_editable(tf) {
        this.element.innerText = text;
    }

    set_wrap(tf) {
        this.element.innerText = text;
    }

    set_font(font, size=10) {
        this.element.innerText = text;
    }

    set_limit(numlines) {
        this.element.innerText = text;
    }

}

export { Text };
