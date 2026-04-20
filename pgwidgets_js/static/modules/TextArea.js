"use_strict";

import {Widget} from "./Widget.js";
import {ScrollBar} from "./ScrollBar.js";

/**
 * A multi-line editable text area widget.
 *
 * Uses a native <textarea> for editing but wraps it in a grid container
 * so pgwidgets ScrollBar widgets can be used for horizontal and vertical
 * scrolling (matching the look of other pgwidgets).
 *
 * @extends Widget
 */
class TextArea extends Widget {

    /**
     * Creates a new TextArea widget.
     * @param {string} [text=''] - Initial text content.
     * @param {Object} [options] - Configuration options.
     * @param {boolean} [options.wrap=false] - Whether to enable word wrapping.
     * @param {boolean} [options.editable=true] - Whether the text area is editable.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(text='', options={}) {
        if (text === null || text === undefined) text = '';
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'textarea-widget';

        // Method bindings
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this.append_text = this.append_text.bind(this);
        this.clear = this.clear.bind(this);
        this.set_editable = this.set_editable.bind(this);
        this.set_wrap = this.set_wrap.bind(this);
        this.set_limit = this.set_limit.bind(this);
        this.set_scroll_position = this.set_scroll_position.bind(this);
        this._syncScrollbars = this._syncScrollbars.bind(this);
        this._syncFromScroll = this._syncFromScroll.bind(this);

        this._scrollTimer = null;
        this._scrollReady = false;

        super.init_style();

        // Inner <textarea> for actual editing
        this._textarea = document.createElement('textarea');
        this._textarea.className = 'textarea-text';
        this._textarea.readOnly = ! this.get_option(options, 'editable', true);
        this._textarea.wrap = this.get_option(options, 'wrap', false) ? 'soft' : 'off';

        // ScrollBar widgets
        this._vScrollBar = new ScrollBar({orientation: 'vertical'});
        this._hScrollBar = new ScrollBar({orientation: 'horizontal'});
        this._vScrollBar.get_element().classList.add('textarea-vbar');
        this._hScrollBar.get_element().classList.add('textarea-hbar');

        this._corner = document.createElement('div');
        this._corner.className = 'textarea-corner';

        this.element.appendChild(this._textarea);
        this.element.appendChild(this._vScrollBar.get_element());
        this.element.appendChild(this._hScrollBar.get_element());
        this.element.appendChild(this._corner);

        // Drive textarea scroll from the ScrollBars
        this._vScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._textarea.scrollHeight - this._textarea.clientHeight;
            this._textarea.scrollTop = Math.max(0, pct * maxScroll);
            this._syncFromScroll();
        });
        this._hScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._textarea.scrollWidth - this._textarea.clientWidth;
            this._textarea.scrollLeft = Math.max(0, pct * maxScroll);
            this._syncFromScroll();
        });

        // Keep scrollbars in sync when the textarea scrolls natively
        this._textarea.addEventListener('scroll', () => this._syncFromScroll());
        this._textarea.addEventListener('input', () => this._syncScrollbars());

        this._resizeObserver = new ResizeObserver(() => this._syncScrollbars());
        this._resizeObserver.observe(this._textarea);

        if (text) {
            this.set_text(text);
        }
        requestAnimationFrame(() => {
            this._syncScrollbars();
            this._scrollReady = true;
        });
    }

    set_text(text) {
        this._textarea.value = text;
        this._syncScrollbars();
    }

    get_text() {
        return this._textarea.value;
    }

    append_text(text) {
        this._textarea.value += text;
        this._syncScrollbars();
    }

    clear() {
        this._textarea.value = '';
        this._syncScrollbars();
    }

    set_editable(tf) {
        this._textarea.readOnly = !tf;
    }

    set_wrap(tf) {
        this._textarea.wrap = tf ? 'soft' : 'off';
        this._syncScrollbars();
    }

    set_limit(numlines) {
        this._textarea.rows = numlines;
    }

    // -----------------------------------------------------------------
    // Scrollbar sync
    // -----------------------------------------------------------------

    _syncScrollbars() {
        let vw = this._textarea.clientWidth;
        let vh = this._textarea.clientHeight;
        let cw = this._textarea.scrollWidth;
        let ch = this._textarea.scrollHeight;

        let showH = cw > vw + 1;
        let showV = ch > vh + 1;

        this._hScrollBar.get_element().style.display = showH ? '' : 'none';
        this._vScrollBar.get_element().style.display = showV ? '' : 'none';
        this._corner.style.display = (showH && showV) ? '' : 'none';

        if (showH) {
            this._hScrollBar.set_thumb_percent(Math.min(1, vw / Math.max(1, cw)));
        }
        if (showV) {
            this._vScrollBar.set_thumb_percent(Math.min(1, vh / Math.max(1, ch)));
        }
        this._syncFromScroll();
    }

    /**
     * Sets the scroll position using percentages (0–1).
     * @param {number} h_pct - Horizontal scroll percentage.
     * @param {number} v_pct - Vertical scroll percentage.
     */
    set_scroll_position(h_pct, v_pct) {
        let maxX = this._textarea.scrollWidth - this._textarea.clientWidth;
        let maxY = this._textarea.scrollHeight - this._textarea.clientHeight;
        if (maxX > 0) this._textarea.scrollLeft = h_pct * maxX;
        if (maxY > 0) this._textarea.scrollTop = v_pct * maxY;
        this._scrollSilent = true;
        this._syncFromScroll();
        this._scrollSilent = false;
    }

    /**
     * Returns the current scroll position as [h_pct, v_pct] (0–1).
     * @returns {number[]}
     */
    get_scroll_position() {
        let maxX = this._textarea.scrollWidth - this._textarea.clientWidth;
        let maxY = this._textarea.scrollHeight - this._textarea.clientHeight;
        return [
            maxX > 0 ? this._textarea.scrollLeft / maxX : 0,
            maxY > 0 ? this._textarea.scrollTop / maxY : 0,
        ];
    }

    _syncFromScroll() {
        let maxX = this._textarea.scrollWidth - this._textarea.clientWidth;
        let maxY = this._textarea.scrollHeight - this._textarea.clientHeight;

        let hPct = maxX > 0 ? this._textarea.scrollLeft / maxX : 0;
        let vPct = maxY > 0 ? this._textarea.scrollTop / maxY : 0;

        if (maxX > 0) this._hScrollBar.set_scroll_percent(hPct);
        if (maxY > 0) this._vScrollBar.set_scroll_percent(vPct);

        if (this._scrollTimer) clearTimeout(this._scrollTimer);
        if (this._scrollReady && !this._scrollSilent) {
            this._scrollTimer = setTimeout(() => {
                this._scrollTimer = null;
                this.make_callback('scrolled', hPct, vPct);
            }, 150);
        }
    }

}

export { TextArea };
