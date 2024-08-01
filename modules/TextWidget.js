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
        //this.element.style.position = 'relative';

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
    
}

export { Text };
