"use_strict";

import {ContainerWidget} from "./Widget.js";

class Frame extends ContainerWidget {

    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('fieldset');
        }
        this.element.className = 'frame-widget';

        this.title = this.get_option(options, 'title', '');

        if (this.title !== '') {
            this.legend = document.createElement('legend');
            this.legend.className = 'frame-title';
            this.legend.textContent = this.title;
            this.element.appendChild(this.legend);
        }

        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'frame-content';
        this.element.appendChild(this.contentContainer);

        // JavaScript hack to bind "this" correctly for our methods
        this.set_widget = this.set_widget.bind(this);
        this.set_title = this.set_title.bind(this);
    }

    set_widget(child) {
        if (this.children.length > 0) {
            this.contentContainer.removeChild(this.children[0].get_element());
            this.remove_child(this.children[0]);
        }
        super.add_child(child);
        this.contentContainer.appendChild(child.get_element());
    }

    set_title(text) {
        this.title = text;
        if (!this.legend) {
            this.legend = document.createElement('legend');
            this.legend.className = 'frame-title';
            this.element.insertBefore(this.legend, this.contentContainer);
        }
        this.legend.textContent = text;
    }
}

export { Frame };
