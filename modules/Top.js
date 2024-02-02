"use_strict";

import {ContainerWidget} from "./Widget.js";

class TopLevel extends ContainerWidget {

    constructor() {
        super();
        this.element = document.createElement('div');
        this.element.className = 'toplevel';
        this.element.style.position = 'absolute';
        //this.element.style.display = 'flex';
        //this.element.style.flex = '1';
        this.element.style.overflow = 'hidden';
        this.element.style.margin = 0;
    }

    set_widget(child) {
        this.children.push(child);
        this.element.appendChild(child.get_element());
    }

    show() {
        document.body.appendChild(this.get_element());
    }

    hide() {
        document.body.removeChild(this.get_element());
    }
};    

export { TopLevel };

