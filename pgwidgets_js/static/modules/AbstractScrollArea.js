"use_strict";

import {ContainerWidget} from "./Widget.js";
import {ScrollBar} from "./ScrollBar.js";

/**
 * A scroll area whose scrollbars are driven entirely by the child widget.
 * The child sets thumb sizes and scroll positions via the API; the
 * AbstractScrollArea just manages the scrollbar layout and fires callbacks
 * when the user interacts with the scrollbars.
 *
 * Callbacks:
 *   - 'scrolled'    (widget, h_pct, v_pct) — user dragged/clicked/wheeled a scrollbar
 *   - 'area-resize' (widget, width, height, vbar_width, hbar_height) — container resized
 *
 * @extends ContainerWidget
 */
class AbstractScrollArea extends ContainerWidget {

    /**
     * @param {Object} [options]
     * @param {HTMLElement} [options.element=null]
     * @param {number} [options.thickness=15] - Scrollbar thickness in pixels.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'abstractscrollarea-widget';

        this._thickness = this.get_option(options, 'thickness', 15);

        // child area — the child widget goes here
        this._childArea = document.createElement('div');
        this._childArea.className = 'abstractscrollarea-child';
        this.element.appendChild(this._childArea);

        // scrollbars
        this._hScrollBar = new ScrollBar({
            orientation: 'horizontal', thickness: this._thickness,
        });
        this._vScrollBar = new ScrollBar({
            orientation: 'vertical', thickness: this._thickness,
        });

        this._hScrollBar.get_element().classList.add('abstractscrollarea-hbar');
        this._vScrollBar.get_element().classList.add('abstractscrollarea-vbar');

        // corner fill
        this._corner = document.createElement('div');
        this._corner.className = 'abstractscrollarea-corner';
        this._corner.style.width = this._thickness + 'px';
        this._corner.style.height = this._thickness + 'px';

        this.element.appendChild(this._hScrollBar.get_element());
        this.element.appendChild(this._vScrollBar.get_element());
        this.element.appendChild(this._corner);

        // visibility state
        this._hVisibility = 'auto';
        this._vVisibility = 'auto';

        // bind public methods
        this.set_widget = this.set_widget.bind(this);
        this.set_thumb_percent = this.set_thumb_percent.bind(this);
        this.get_thumb_percent = this.get_thumb_percent.bind(this);
        this.set_scroll_percent = this.set_scroll_percent.bind(this);
        this.get_scroll_percent = this.get_scroll_percent.bind(this);
        this.set_scroll_bar_visibility = this.set_scroll_bar_visibility.bind(this);

        // scrollbar user interaction -> 'scrolled' callback
        this._hScrollBar.add_callback('activated', (w, pct) => {
            this._fireScrolled();
        });
        this._vScrollBar.add_callback('activated', (w, pct) => {
            this._fireScrolled();
        });

        // observe our own size for area-resize callback
        this._resizeObserver = new ResizeObserver(() => {
            this._fireAreaResize();
        });
        this._resizeObserver.observe(this.element);

        this.enable_callback('scrolled');
        this.enable_callback('area-resize');

        this._updateVisibility();
    }

    /**
     * Sets the single child widget.
     * @param {Widget} child
     */
    set_widget(child) {
        if (this.children.length > 0) {
            let old = this.children[0];
            this.children.splice(0, 1);
            this._childArea.removeChild(old.get_element());
        }

        this.children.push(child);
        this._childArea.appendChild(child.get_element());
    }

    /**
     * Sets the thumb sizes for both scrollbars.
     * @param {number} h_pct - Horizontal thumb fraction (0–1).
     * @param {number} v_pct - Vertical thumb fraction (0–1).
     */
    set_thumb_percent(h_pct, v_pct) {
        this._hScrollBar.set_thumb_percent(h_pct);
        this._vScrollBar.set_thumb_percent(v_pct);
        this._updateVisibility();
    }

    /**
     * Returns the current thumb sizes as [h_pct, v_pct].
     * @returns {number[]}
     */
    get_thumb_percent() {
        return [
            this._hScrollBar.get_thumb_percent(),
            this._vScrollBar.get_thumb_percent(),
        ];
    }

    /**
     * Sets the scroll positions for both scrollbars (no callback fired).
     * @param {number} h_pct - Horizontal position (0–1).
     * @param {number} v_pct - Vertical position (0–1).
     */
    set_scroll_percent(h_pct, v_pct) {
        this._hScrollBar.set_scroll_percent(h_pct);
        this._vScrollBar.set_scroll_percent(v_pct);
    }

    /**
     * Returns the current scroll positions as [h_pct, v_pct].
     * @returns {number[]}
     */
    get_scroll_percent() {
        return [
            this._hScrollBar.get_scroll_percent(),
            this._vScrollBar.get_scroll_percent(),
        ];
    }

    /**
     * Sets scrollbar visibility policy.
     * @param {string} horizontal - 'on', 'off', or 'auto' (default 'auto').
     * @param {string} vertical - 'on', 'off', or 'auto' (default 'auto').
     */
    set_scroll_bar_visibility(horizontal, vertical) {
        if (horizontal !== undefined) this._hVisibility = horizontal;
        if (vertical !== undefined) this._vVisibility = vertical;
        this._updateVisibility();
    }

    /** @private */
    _shouldShow(visibility, thumbPct) {
        if (visibility === 'on') return true;
        if (visibility === 'off') return false;
        // 'auto': hide when thumb is full-size (all content visible)
        return thumbPct < 1.0;
    }

    /** @private */
    _updateVisibility() {
        let showH = this._shouldShow(
            this._hVisibility, this._hScrollBar.get_thumb_percent());
        let showV = this._shouldShow(
            this._vVisibility, this._vScrollBar.get_thumb_percent());

        this._hScrollBar.get_element().style.display = showH ? '' : 'none';
        this._vScrollBar.get_element().style.display = showV ? '' : 'none';
        this._corner.style.display = (showH && showV) ? '' : 'none';
    }

    /** @private */
    _fireScrolled() {
        this.make_callback('scrolled',
            this._hScrollBar.get_scroll_percent(),
            this._vScrollBar.get_scroll_percent());
    }

    /** @private */
    _fireAreaResize() {
        let w = this.element.clientWidth;
        let h = this.element.clientHeight;
        let vbarW = this._vScrollBar.get_element().style.display !== 'none'
            ? this._thickness : 0;
        let hbarH = this._hScrollBar.get_element().style.display !== 'none'
            ? this._thickness : 0;
        this.make_callback('area-resize', w, h, vbarW, hbarH);
    }
}

export { AbstractScrollArea };
