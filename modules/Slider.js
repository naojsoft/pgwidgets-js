"use_strict";

import {Widget} from "./Widget.js";

class Slider extends Widget {

    constructor(options = {orientation: 'horizontal', track: false}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('input');
        }
        this.element.className = 'slider-widget';
        this.element.type = 'range';

        this.element.min = this.get_option(options, 'min', 0);
        this.element.max = this.get_option(options, 'max', 100);
        this.element.step = this.get_option(options, 'step', 1);
        this.element.value = this.get_option(options, 'value', 50);

        // JavaScript hack to bind "this" correctly for our methods
        this.set_value = this.set_value.bind(this);
        this.get_value = this.get_value.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        this.element.addEventListener("input", this._cb_redirect);
        this.enable_callback('activated');
    }

    _cb_redirect(event) {
        this.make_callback('activated', this.get_value());
    }

    set_value(num) {
        this.element.value = num;
    }

    get_value() {
        return Number(this.element.value);
    }
}

export { Slider };
