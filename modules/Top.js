"use_strict";

import {ContainerWidget} from "./Widget.js";

class TopLevel extends ContainerWidget {

    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'toplevel-widget';
        this.element.style.position = 'absolute';
        this.element.style.display = 'flex';
        this.element.style.overflow = 'hidden';
        this.element.style.margin = '1px';

        // JavaScript hack to bind "this" correctly for our methods
        this.set_widget = this.set_widget.bind(this);
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
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

export { TopLevel };

