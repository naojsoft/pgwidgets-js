"use_strict";

import {ContainerWidget} from "./Widget.js";
import {ScrollBar} from "./ScrollBar.js";

/**
 * A scrollable container widget. Wraps a single child and provides
 * custom scrollbars (using the ScrollBar widget) when content overflows.
 * @extends ContainerWidget
 */
class ScrollArea extends ContainerWidget {

    /**
     * Creates a new ScrollArea widget.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     * @param {string} [options.hscrollbar='overflow'] - Horizontal scrollbar policy: 'always' or 'overflow'.
     * @param {string} [options.vscrollbar='overflow'] - Vertical scrollbar policy: 'always' or 'overflow'.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'scrollarea-widget';

        this._hPolicy = this.get_option(options, 'hscrollbar', 'overflow');
        this._vPolicy = this.get_option(options, 'vscrollbar', 'overflow');

        // viewport clips the content
        this._viewport = document.createElement('div');
        this._viewport.className = 'scrollarea-viewport';
        this.element.appendChild(this._viewport);

        // content wrapper - holds the child, sized naturally
        this._content = document.createElement('div');
        this._content.className = 'scrollarea-content';
        this._viewport.appendChild(this._content);

        // scrollbars
        this._hScrollBar = new ScrollBar({orientation: 'horizontal'});
        this._vScrollBar = new ScrollBar({orientation: 'vertical'});

        this._hScrollBar.get_element().classList.add('scrollarea-hbar');
        this._vScrollBar.get_element().classList.add('scrollarea-vbar');

        // corner fill where the two scrollbars meet
        this._corner = document.createElement('div');
        this._corner.className = 'scrollarea-corner';

        this.element.appendChild(this._hScrollBar.get_element());
        this.element.appendChild(this._vScrollBar.get_element());
        this.element.appendChild(this._corner);

        // JavaScript hack to bind "this" correctly for our methods
        this.set_widget = this.set_widget.bind(this);
        this._syncScrollbars = this._syncScrollbars.bind(this);

        // scrollbar callbacks - scroll the content
        this._hScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._content.scrollWidth - this._viewport.clientWidth;
            this._viewport.scrollLeft = pct * maxScroll;
        });

        this._vScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._content.scrollHeight - this._viewport.clientHeight;
            this._viewport.scrollTop = pct * maxScroll;
        });

        // mouse wheel on the viewport
        this._viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            this._viewport.scrollTop += e.deltaY;
            this._viewport.scrollLeft += e.deltaX;
            this._syncFromScroll();
        });

        // observe content size changes
        this._resizeObserver = new ResizeObserver(() => this._syncScrollbars());
        this._resizeObserver.observe(this._viewport);

        this._syncScrollbars();
    }

    /**
     * Sets the single child widget inside the scroll area.
     * @param {Widget} child - The widget to display.
     */
    set_widget(child) {
        if (this.children.length > 0) {
            let old = this.children[0];
            this.children.splice(0, 1);
            this._content.removeChild(old.get_element());
        }

        this.children.push(child);
        let elt = child.get_element();
        this._content.appendChild(elt);

        // also observe the content element for size changes
        this._resizeObserver.observe(this._content);

        // defer sync to let layout settle
        requestAnimationFrame(() => this._syncScrollbars());
    }

    /**
     * Updates scrollbar thumb sizes and visibility based on content vs viewport size.
     * @private
     */
    _syncScrollbars() {
        let vw = this._viewport.clientWidth;
        let vh = this._viewport.clientHeight;
        let cw = this._content.scrollWidth;
        let ch = this._content.scrollHeight;

        let showH = this._hPolicy === 'always' || cw > vw + 1;
        let showV = this._vPolicy === 'always' || ch > vh + 1;

        // show/hide scrollbars
        this._hScrollBar.get_element().style.display = showH ? '' : 'none';
        this._vScrollBar.get_element().style.display = showV ? '' : 'none';
        this._corner.style.display = (showH && showV) ? '' : 'none';

        // update thumb widths
        if (showH) {
            this._hScrollBar.set_thumb_width(Math.min(1, vw / Math.max(1, cw)));
        }
        if (showV) {
            this._vScrollBar.set_thumb_width(Math.min(1, vh / Math.max(1, ch)));
        }

        this._syncFromScroll();
    }

    /**
     * Syncs scrollbar positions from the viewport's current scroll offset.
     * @private
     */
    _syncFromScroll() {
        let maxScrollX = this._content.scrollWidth - this._viewport.clientWidth;
        let maxScrollY = this._content.scrollHeight - this._viewport.clientHeight;

        if (maxScrollX > 0) {
            this._hScrollBar.set_scroll_percent(this._viewport.scrollLeft / maxScrollX);
        }
        if (maxScrollY > 0) {
            this._vScrollBar.set_scroll_percent(this._viewport.scrollTop / maxScrollY);
        }
    }
}

export { ScrollArea };
