"use_strict";

import {Widget} from "./Widget.js";

/**
 * A scrollbar widget with a draggable thumb.
 * Fires 'activated' callback with the current scroll position (0-1)
 * when the user drags the thumb or clicks the track.
 * @extends Widget
 */
class ScrollBar extends Widget {

    /**
     * Creates a new ScrollBar widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.orientation='horizontal'] - 'horizontal' or 'vertical'.
     * @param {number} [options.thickness=15] - Cross-axis size in pixels.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'scrollbar-widget';

        this._orientation = this.get_option(options, 'orientation', 'horizontal');
        this._thickness = this.get_option(options, 'thickness', 15);
        this._scrollPct = 0;
        this._thumbPct = 0.2;

        this.element.style.setProperty('--scrollbar-thickness', this._thickness + 'px');
        if (this._orientation === 'vertical') {
            this.element.classList.add('vertical');
        } else {
            this.element.classList.add('horizontal');
        }

        // thumb element
        this._thumb = document.createElement('div');
        this._thumb.className = 'scrollbar-thumb';
        this.element.appendChild(this._thumb);

        // drag handling
        this._setupDrag();

        // click on track to jump
        this.element.addEventListener('mousedown', (e) => {
            if (e.target === this.element) {
                e.preventDefault();
                this._jumpToPosition(e);
            }
        });

        // mouse wheel scrolling
        this.element.addEventListener('wheel', (e) => {
            e.preventDefault();
            let delta = this._orientation === 'vertical' ? e.deltaY : (e.deltaX || e.deltaY);
            let step = 0.05;
            let dir = delta > 0 ? 1 : -1;
            this._scrollPct = Math.max(0, Math.min(1, this._scrollPct + dir * step));
            this._updateThumb();
            this.make_callback('activated', this._scrollPct);
        });

        this.enable_callback('activated');
        this._updateThumb();
    }

    /**
     * Sets the scroll position.
     * @param {number} pct - Position between 0 and 1.
     */
    set_scroll_percent(pct) {
        this._scrollPct = Math.max(0, Math.min(1, pct));
        this._updateThumb();
    }

    /**
     * Returns the current scroll position.
     * @returns {number} Position between 0 and 1.
     */
    get_scroll_percent() {
        return this._scrollPct;
    }

    /**
     * Sets the thumb length as a fraction of the track length.
     * @param {number} pct - Thumb size between 0 and 1.
     */
    set_thumb_percent(pct) {
        this._thumbPct = Math.max(0.01, Math.min(1, pct));
        this._updateThumb();
    }

    /**
     * Returns the thumb length as a fraction of the track length.
     * @returns {number} Thumb size between 0 and 1.
     */
    get_thumb_percent() {
        return this._thumbPct;
    }

    // backward compat alias
    set_thumb_width(pct) { this.set_thumb_percent(pct); }

    /** @private */
    _updateThumb() {
        let thumbSize = (this._thumbPct * 100) + '%';
        let maxTravel = 1 - this._thumbPct;
        let offset = (this._scrollPct * maxTravel * 100) + '%';

        if (this._orientation === 'vertical') {
            this._thumb.style.height = thumbSize;
            this._thumb.style.width = '100%';
            this._thumb.style.top = offset;
            this._thumb.style.left = '0';
        } else {
            this._thumb.style.width = thumbSize;
            this._thumb.style.height = '100%';
            this._thumb.style.left = offset;
            this._thumb.style.top = '0';
        }
    }

    /** @private */
    _setupDrag() {
        let dragStart = 0;
        let startPct = 0;
        let isDragging = false;

        const onMouseMove = (e) => {
            if (!isDragging) return;
            let trackLen = this._getTrackLength();
            let maxTravel = 1 - this._thumbPct;
            if (trackLen <= 0 || maxTravel <= 0) return;

            let delta = this._orientation === 'vertical'
                ? e.clientY - dragStart
                : e.clientX - dragStart;
            let deltaPct = delta / (trackLen * maxTravel);
            this._scrollPct = Math.max(0, Math.min(1, startPct + deltaPct));
            this._updateThumb();
            this.make_callback('activated', this._scrollPct);
        };

        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        this._thumb.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            dragStart = this._orientation === 'vertical' ? e.clientY : e.clientX;
            startPct = this._scrollPct;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    /** @private */
    _jumpToPosition(e) {
        let rect = this.element.getBoundingClientRect();
        let trackLen = this._getTrackLength();
        let maxTravel = 1 - this._thumbPct;
        if (trackLen <= 0 || maxTravel <= 0) return;

        let pos = this._orientation === 'vertical'
            ? e.clientY - rect.top
            : e.clientX - rect.left;
        // center the thumb on the click position
        let thumbLen = this._thumbPct * trackLen;
        let offset = pos - thumbLen / 2;
        this._scrollPct = Math.max(0, Math.min(1, offset / (trackLen * maxTravel)));
        this._updateThumb();
        this.make_callback('activated', this._scrollPct);
    }

    /** @private */
    _getTrackLength() {
        if (this._orientation === 'vertical') {
            return this.element.clientHeight;
        }
        return this.element.clientWidth;
    }
}

export { ScrollBar };
