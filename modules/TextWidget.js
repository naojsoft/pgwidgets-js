"use_strict";

import {Widget, Widgets} from "./Widget.js";

class Text extends Widget {

    constructor(text) {
        super();
       
        this.element = document.createElement('div');
        this.element.className = 'text';
        this.element.style.position = 'relative';
        this.element.style.margin = 0;

        let text_elt = document.createTextNode(text);
        this.element.appendChild(text_elt)
    }
}

Widgets.Text = Text;

export { Text };
