"use_strict";

import {Widget} from "./Widget.js";

class Label extends Widget {

    constructor(text='', options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'label-widget';

        let halign = this.get_option(options, 'halign', 'left');
        this.element.style.textAlign = halign;

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this.set_color = this.set_color.bind(this);
        this.set_halign = this.set_halign.bind(this);
        this.set_font = this.set_font.bind(this);

        if (text !== '') {
            this.set_text(text);
        }
    }

    set_text(text) {
        this.element.innerText = text;
    }

    get_text() {
        return this.element.innerText;
    }

    set_color(bg=null, fg=null) {
        if (bg !== null) {
            this.element.style.backgroundColor = bg;
        }
        if (fg !== null) {
            this.element.style.color = fg;
        }
    }

    set_halign(align) {
        this.element.style.textAlign = align;
    }

    set_font(font, size=10) {
        this.element.style.fontFamily = font;
        this.element.style.fontSize = size + 'pt';
    }
}

export { Label };
