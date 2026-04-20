"use_strict";

import {AbstractScrollArea} from "./AbstractScrollArea.js";

/**
 * A scrollable container widget. Wraps a single child and provides
 * custom scrollbars when content overflows. Extends AbstractScrollArea
 * with automatic overflow detection and native scroll synchronization.
 * @extends AbstractScrollArea
 */
class ScrollArea extends AbstractScrollArea {

    /**
     * Creates a new ScrollArea widget.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element.
     * @param {string} [options.hscrollbar='auto'] - Horizontal scrollbar policy: 'on', 'off', or 'auto'.
     * @param {string} [options.vscrollbar='auto'] - Vertical scrollbar policy: 'on', 'off', or 'auto'.
     */
    constructor(options = {}) {
        super(options);

        // override class name for backward compat styling
        this.element.classList.add('scrollarea-widget');

        // Map legacy values: 'always' -> 'on', 'overflow' -> 'auto'
        let hPolicy = this.get_option(options, 'hscrollbar', 'auto');
        let vPolicy = this.get_option(options, 'vscrollbar', 'auto');
        if (hPolicy === 'always') hPolicy = 'on';
        else if (hPolicy === 'overflow') hPolicy = 'auto';
        if (vPolicy === 'always') vPolicy = 'on';
        else if (vPolicy === 'overflow') vPolicy = 'auto';
        this.set_scroll_bar_visibility(hPolicy, vPolicy);

        // create a content wrapper inside the child area for natural sizing
        this._content = document.createElement('div');
        this._content.className = 'scrollarea-content';
        this._childArea.classList.add('scrollarea-viewport');
        this._childArea.appendChild(this._content);

        this._scrollReady = false;

        // bind
        this.set_scroll_position = this.set_scroll_position.bind(this);

        // when the user interacts with a scrollbar, scroll the viewport
        this.add_callback('scrolled', (w, hPct, vPct) => {
            let maxX = this._content.scrollWidth - this._childArea.clientWidth;
            let maxY = this._content.scrollHeight - this._childArea.clientHeight;
            if (maxX > 0) this._childArea.scrollLeft = hPct * maxX;
            if (maxY > 0) this._childArea.scrollTop = vPct * maxY;
        });

        // native scroll (e.g. touch, programmatic) -> sync scrollbars
        this._childArea.addEventListener('scroll', () => this._syncFromScroll());

        // observe content size changes
        this._contentObserver = new ResizeObserver(() => this._syncScrollbars());
        this._contentObserver.observe(this._childArea);

        this._syncScrollbars();
        requestAnimationFrame(() => { this._scrollReady = true; });
    }

    /**
     * Sets the single child widget inside the scroll area.
     * @param {Widget} child
     */
    set_widget(child) {
        // remove old child from content wrapper
        if (this.children.length > 0) {
            let old = this.children[0];
            this.children.splice(0, 1);
            this._content.removeChild(old.get_element());
        }

        this.children.push(child);
        this._content.appendChild(child.get_element());

        // observe content element for size changes
        this._contentObserver.observe(this._content);

        requestAnimationFrame(() => this._syncScrollbars());
    }

    /**
     * Sets the scroll position using percentages (0–1).
     * @param {number} h_pct
     * @param {number} v_pct
     */
    set_scroll_position(h_pct, v_pct) {
        let maxX = this._content.scrollWidth - this._childArea.clientWidth;
        let maxY = this._content.scrollHeight - this._childArea.clientHeight;
        if (maxX > 0) this._childArea.scrollLeft = h_pct * maxX;
        if (maxY > 0) this._childArea.scrollTop = v_pct * maxY;
        this._scrollSilent = true;
        this._syncFromScroll();
        this._scrollSilent = false;
    }

    /**
     * Returns the current scroll position as [h_pct, v_pct] (0–1).
     * @returns {number[]}
     */
    get_scroll_position() {
        let maxX = this._content.scrollWidth - this._childArea.clientWidth;
        let maxY = this._content.scrollHeight - this._childArea.clientHeight;
        return [
            maxX > 0 ? this._childArea.scrollLeft / maxX : 0,
            maxY > 0 ? this._childArea.scrollTop / maxY : 0,
        ];
    }

    /**
     * Syncs scrollbar thumb sizes and visibility from content overflow.
     * @private
     */
    _syncScrollbars() {
        let vw = this._childArea.clientWidth;
        let vh = this._childArea.clientHeight;
        let cw = this._content.scrollWidth;
        let ch = this._content.scrollHeight;

        this.set_thumb_percent(
            Math.min(1, vw / Math.max(1, cw)),
            Math.min(1, vh / Math.max(1, ch))
        );

        this._syncFromScroll();
    }

    /**
     * Syncs scrollbar positions from the viewport's current scroll offset.
     * Fires the 'scrolled' callback for user-initiated scrolls only.
     * @private
     */
    _syncFromScroll() {
        let maxX = this._content.scrollWidth - this._childArea.clientWidth;
        let maxY = this._content.scrollHeight - this._childArea.clientHeight;

        let hPct = maxX > 0 ? this._childArea.scrollLeft / maxX : 0;
        let vPct = maxY > 0 ? this._childArea.scrollTop / maxY : 0;

        // update scrollbar positions without firing callback
        this._hScrollBar.set_scroll_percent(hPct);
        this._vScrollBar.set_scroll_percent(vPct);

        // fire scrolled only for user-initiated native scrolls
        if (this._scrollReady && !this._scrollSilent) {
            if (this._scrollTimer) clearTimeout(this._scrollTimer);
            this._scrollTimer = setTimeout(() => {
                this._scrollTimer = null;
                this.make_callback('scrolled', hPct, vPct);
            }, 150);
        }
    }
}

export { ScrollArea };
