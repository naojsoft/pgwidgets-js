"use_strict";

import {ContainerWidget} from "./Widget.js";

class Page extends ContainerWidget {

    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'page';
        this.element.style.position = 'absolute';
        this.element.style.display = 'flex';
        //this.element.style.overflow = 'hidden';
        this.element.style.margin = '0px';
    }

    set_widget(child) {
        this.children.push(child);
        let elt = child.get_element();
        elt.style.flex = '1';
        this.element.appendChild(elt);
    }

    show() {
        document.body.appendChild(this.get_element());
    }

    hide() {
        document.body.removeChild(this.get_element());
    }
};    

export { Page };
