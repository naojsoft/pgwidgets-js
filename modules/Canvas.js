"use_strict";

import {Widget} from "./Widget.js";

class Canvas extends Widget {

    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('canvas');
        }
        this.element.className = 'canvas-widget';

        // JavaScript hack to bind "this" correctly for our methods
        this._cb_redirect = this._cb_redirect.bind(this);

        super.init_style();
        this.initialize_events();

        for (let name of ['activated', 'pointer-down', 'pointer-up',
                          'pointer-move', 'pointer-over', 'pointer-out',
                          'click', 'dblclick', 'wheel',
                          'keydown', 'keyup', 'keypress',
                          'focus', 'focusout',
                          'drop', 'dragover', 'contextmenu']) {
            this.enable_callback(name);
        }
    }

    initialize_events() {
        const canvas = this.element;

        // make canvas focusable for keyboard events
        canvas.setAttribute('tabindex', '0');

        // pointer events
        canvas.addEventListener('pointerdown', (e) => this._cb_redirect('pointer-down', e));
        canvas.addEventListener('pointermove', (e) => this._cb_redirect('pointer-move', e));
        canvas.addEventListener('pointerup', (e) => this._cb_redirect('pointer-up', e));
        canvas.addEventListener('pointerover', (e) => this._cb_redirect('pointer-over', e));
        canvas.addEventListener('pointerout', (e) => this._cb_redirect('pointer-out', e));

        // mouse events
        canvas.addEventListener('wheel', (e) => this._cb_redirect('wheel', e));
        canvas.addEventListener('click', (e) => this._cb_redirect('click', e));
        canvas.addEventListener('dblclick', (e) => this._cb_redirect('dblclick', e));

        // drag-drop events
        canvas.addEventListener('drop', (e) => this._cb_redirect('drop', e));
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            this._cb_redirect('dragover', e);
        });

        // disable right-click context menu
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._cb_redirect('contextmenu', e);
        });

        // keyboard events
        canvas.addEventListener("keydown", (e) => this._cb_redirect('keydown', e), true);
        canvas.addEventListener("keyup", (e) => this._cb_redirect('keyup', e), true);
        canvas.addEventListener("keypress", (e) => this._cb_redirect('keypress', e), true);

        // focus events
        canvas.addEventListener("focus", (e) => this._cb_redirect('focus', e), true);
        canvas.addEventListener("focusout", (e) => this._cb_redirect('focusout', e), true);

        canvas.style.cursor = 'crosshair';
    }

    _cb_redirect(action, event) {
        this.make_callback(action, event);
    }
}

export { Canvas };
