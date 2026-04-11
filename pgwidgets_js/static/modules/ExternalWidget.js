"use strict";

import {Widget} from "./Widget.js";

/**
 * A widget that provides a DOM element for embedding third-party
 * content (e.g. Plotly charts, Bokeh plots, Leaflet maps).
 *
 * ExternalWidget participates in pgwidgets layout like any other
 * widget (stretch factors, containers, resize callbacks) but its
 * content area is managed by external code.
 *
 * The base Widget class already installs a ResizeObserver that fires
 * a 'resize' callback whenever the element changes size, so
 * third-party libraries that need explicit resize notification can
 * listen for it.
 *
 * @extends Widget
 */
class ExternalWidget extends Widget {

    /**
     * Creates a new ExternalWidget.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing
     *     DOM element to use as the container.
     */
    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'external-widget';

        this.set_content = this.set_content.bind(this);
        this.get_content_element = this.get_content_element.bind(this);
        this.clear = this.clear.bind(this);

        // Inner div where external content is rendered.
        this._content = document.createElement('div');
        this._content.className = 'external-widget-content';
        this.element.appendChild(this._content);
    }

    /**
     * Returns the inner content element that external libraries should
     * render into.  Use this instead of get_element() so that the
     * outer wrapper styling is preserved.
     * @returns {HTMLElement} The content container element.
     */
    get_content_element() {
        return this._content;
    }

    /**
     * Sets the inner HTML of the content element directly.
     * @param {string} html - HTML string to set as content.
     */
    set_content(html) {
        this._content.innerHTML = html;
    }

    /**
     * Removes all content from the widget.
     */
    clear() {
        this._content.innerHTML = '';
    }

}

export { ExternalWidget };
