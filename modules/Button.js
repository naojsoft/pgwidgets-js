"use_strict";

import {Widget} from "./Widget.js";

class Button extends Widget {

    constructor(text='', options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('button');
        }
        this.element.className = 'button-widget';

        this.iconElement = null;
        this.textElement = document.createElement('span');
        this.textElement.className = 'button-text';
        this.textElement.textContent = text;
        if (text !== '') {
            this.element.appendChild(this.textElement);
        }

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.set_icon = this.set_icon.bind(this);
        this.set_color = this.set_color.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        super.init_style();

        this.element.onclick = () => this._cb_redirect('clicked');
        this.enable_callback('activated');
    }

    set_text(text) {
        this.textElement.textContent = text;
        if (text !== '' && !this.textElement.parentElement) {
            this.element.appendChild(this.textElement);
        } else if (text === '' && this.textElement.parentElement) {
            this.element.removeChild(this.textElement);
        }
    }

    set_icon(icon_url, iconsize=null) {
        if (this.iconElement === null) {
            this.iconElement = document.createElement('img');
            this.iconElement.className = 'button-icon';
            // icon goes before text
            this.element.insertBefore(this.iconElement, this.element.firstChild);
        }
        this.iconElement.src = icon_url;
        if (iconsize !== null) {
            this.iconElement.style.width = iconsize[0] + 'px';
            this.iconElement.style.height = iconsize[1] + 'px';
        } else {
            this.iconElement.style.width = '';
            this.iconElement.style.height = '';
        }
    }

    set_color(bg=null, fg=null) {
        if (bg !== null) {
            this.element.style.backgroundColor = bg;
        }
        if (fg !== null) {
            this.element.style.color = fg;
        }
    }

    _cb_redirect(action) {
        if (action === 'clicked') {
            this.make_callback('activated');
        }
    }
}

export { Button };
