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

class TextArea extends Widget {

    constructor(text='', options={wrap: false, editable: true}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('textarea');
        }
        this.element.className = 'textarea-widget';

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this.append_text = this.append_text.bind(this);
        this.set_editable = this.set_editable.bind(this);
        this.set_wrap = this.set_wrap.bind(this);
        this.set_font = this.set_font.bind(this);
        this.set_limit = this.set_limit.bind(this);

        super.init_style();

        this.element.readOnly = ! this.get_option(options, 'editable', true);
        this.element.wrap = this.get_option(options, 'wrap', false) ? 'soft' : 'off';

        if (text) {
            this.set_text(text);
        }
    }

    set_text(text) {
        this.element.value = text;
    }

    get_text() {
        return this.element.value;
    }

    append_text(text) {
        this.element.value += text;
    }

    set_editable(tf) {
        this.element.readOnly = !tf;
    }

    set_wrap(tf) {
        this.element.wrap = tf ? 'soft' : 'off';
    }

    set_font(font, size=10) {
        this.element.style.fontFamily = font;
        this.element.style.fontSize = size + 'pt';
    }

    set_limit(numlines) {
        this.element.rows = numlines;
    }

}

export { Text, TextArea };
