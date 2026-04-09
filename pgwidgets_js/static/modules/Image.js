"use_strict";

import {Widget} from "./Widget.js";

/**
 * An image display widget with full interactive event support.
 * Dispatches pointer, mouse, keyboard, focus, and drag-drop events
 * through the callback system, just like Canvas.
 * @extends Widget
 */
class Image extends Widget {

    /**
     * Creates a new Image widget.
     * @param {Object} [options] - Configuration options.
     * @param {string|null} [options.url=null] - URL of the image to display.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('img');
        }
        this.element.className = 'image-widget';

        // JavaScript hack to bind "this" correctly for our methods
        this.set_image = this.set_image.bind(this);

        this._initInteractiveEvents();

        let url = this.get_option(options, 'url', null);
        if (url !== null) {
            this.set_image(url);
        }
    }

    /**
     * Sets the image source URL.
     * @param {string} url - URL of the image to display.
     */
    set_image(url) {
        this.element.src = url;
    }
}

export { Image };
