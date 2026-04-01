"use_strict";

import {Widget} from "./Widget.js";

class ProgressBar extends Widget {

    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'progressbar-widget';

        this.fill = document.createElement('div');
        this.fill.className = 'progressbar-fill';
        this.element.appendChild(this.fill);

        this.label = document.createElement('span');
        this.label.className = 'progressbar-label';
        this.element.appendChild(this.label);

        this.value = 0;

        // JavaScript hack to bind "this" correctly for our methods
        this.set_value = this.set_value.bind(this);
        this.get_value = this.get_value.bind(this);

        this._display();
    }

    _display() {
        let pct = this.value * 100;
        this.fill.style.width = pct + '%';
        this.label.textContent = Math.round(pct) + '%';
    }

    set_value(value) {
        this.value = Math.max(0, Math.min(1, value));
        this._display();
    }

    get_value() {
        return this.value;
    }
}

export { ProgressBar };
