"use strict";

import {Widget} from "./Widget.js";
import {ScrollBar} from "./ScrollBar.js";

/**
 * A widget for displaying rich HTML content with pgwidgets-style
 * scrollbars.  Content is rendered inside a <div> and is read-only.
 *
 * @extends Widget
 */
class HtmlView extends Widget {

    /**
     * Creates a new HtmlView widget.
     * @param {string} [html=''] - Initial HTML content.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing
     *     DOM element to use as the outer container.
     */
    constructor(html='', options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'htmlview-widget';

        this.set_html = this.set_html.bind(this);
        this.get_html = this.get_html.bind(this);
        this.append_html = this.append_html.bind(this);
        this.clear = this.clear.bind(this);
        this.scroll_to_top = this.scroll_to_top.bind(this);
        this.scroll_to_bottom = this.scroll_to_bottom.bind(this);
        this._syncScrollbars = this._syncScrollbars.bind(this);
        this._syncFromScroll = this._syncFromScroll.bind(this);

        super.init_style();

        // Inner content div
        this._content = document.createElement('div');
        this._content.className = 'htmlview-content';

        // ScrollBar widgets
        this._vScrollBar = new ScrollBar({orientation: 'vertical'});
        this._hScrollBar = new ScrollBar({orientation: 'horizontal'});
        this._vScrollBar.get_element().classList.add('htmlview-vbar');
        this._hScrollBar.get_element().classList.add('htmlview-hbar');

        this._corner = document.createElement('div');
        this._corner.className = 'htmlview-corner';

        this.element.appendChild(this._content);
        this.element.appendChild(this._vScrollBar.get_element());
        this.element.appendChild(this._hScrollBar.get_element());
        this.element.appendChild(this._corner);

        // Drive content scroll from the ScrollBars
        this._vScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._content.scrollHeight - this._content.clientHeight;
            this._content.scrollTop = Math.max(0, pct * maxScroll);
        });
        this._hScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._content.scrollWidth - this._content.clientWidth;
            this._content.scrollLeft = Math.max(0, pct * maxScroll);
        });

        // Keep scrollbars in sync when content scrolls natively
        this._content.addEventListener('scroll', () => this._syncFromScroll());

        this._resizeObserver = new ResizeObserver(() => this._syncScrollbars());
        this._resizeObserver.observe(this._content);

        if (html) {
            this.set_html(html);
        }
        requestAnimationFrame(() => this._syncScrollbars());
    }

    /**
     * Sets the HTML content, replacing any existing content.
     * @param {string} html - HTML string to render.
     */
    set_html(html) {
        this._content.innerHTML = html;
        this._syncScrollbars();
    }

    /**
     * Returns the current HTML content.
     * @returns {string} The inner HTML.
     */
    get_html() {
        return this._content.innerHTML;
    }

    /**
     * Appends HTML to the existing content.
     * @param {string} html - HTML string to append.
     */
    append_html(html) {
        this._content.insertAdjacentHTML('beforeend', html);
        this._syncScrollbars();
    }

    /**
     * Removes all content.
     */
    clear() {
        this._content.innerHTML = '';
        this._syncScrollbars();
    }

    /**
     * Scrolls to the top of the content.
     */
    scroll_to_top() {
        this._content.scrollTop = 0;
        this._syncFromScroll();
    }

    /**
     * Scrolls to the bottom of the content.
     */
    scroll_to_bottom() {
        this._content.scrollTop = this._content.scrollHeight;
        this._syncFromScroll();
    }

    // -----------------------------------------------------------------
    // Scrollbar sync
    // -----------------------------------------------------------------

    /** @private */
    _syncScrollbars() {
        let vw = this._content.clientWidth;
        let vh = this._content.clientHeight;
        let cw = this._content.scrollWidth;
        let ch = this._content.scrollHeight;

        let showH = cw > vw + 1;
        let showV = ch > vh + 1;

        this._hScrollBar.get_element().style.display = showH ? '' : 'none';
        this._vScrollBar.get_element().style.display = showV ? '' : 'none';
        this._corner.style.display = (showH && showV) ? '' : 'none';

        if (showH) {
            this._hScrollBar.set_thumb_width(Math.min(1, vw / Math.max(1, cw)));
        }
        if (showV) {
            this._vScrollBar.set_thumb_width(Math.min(1, vh / Math.max(1, ch)));
        }
        this._syncFromScroll();
    }

    /** @private */
    _syncFromScroll() {
        let maxX = this._content.scrollWidth - this._content.clientWidth;
        let maxY = this._content.scrollHeight - this._content.clientHeight;
        if (maxX > 0) {
            this._hScrollBar.set_scroll_percent(this._content.scrollLeft / maxX);
        }
        if (maxY > 0) {
            this._vScrollBar.set_scroll_percent(this._content.scrollTop / maxY);
        }
    }

}

export { HtmlView };
