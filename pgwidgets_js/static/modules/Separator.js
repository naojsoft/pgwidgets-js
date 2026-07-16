"use_strict";

import {Widget} from "./Widget.js";

/**
 * A thin separator rule (like an HTML <hr>).  Rendered as a 1px border on
 * one edge of a zero-thickness div so it takes essentially no space along
 * its thin axis while stretching along the other.
 * @extends Widget
 */
class Separator extends Widget {

    /**
     * @param {string} [orientation='horizontal'] - 'horizontal' or 'vertical'.
     * @param {Object} [options]
     */
    constructor(orientation='horizontal', options={}) {
        super();
        // orientation may arrive positionally or in the options dict
        if (orientation != null && typeof orientation === 'object') {
            options = orientation;
            orientation = null;
        }
        this._orientation = orientation
            || this.get_option(options, 'orientation', 'horizontal');

        this.element = document.createElement('div');
        this.element.className = 'separator-widget';
        this._applyOrientation();

        super.init_style();
    }

    _applyOrientation() {
        let s = this.element.style;
        s.borderTop = s.borderLeft = '';
        s.width = s.height = '';
        if (this._orientation === 'vertical') {
            s.width = '0px';
            s.height = '100%';
            s.borderLeft = '1px solid #888';
        } else {
            s.height = '0px';
            s.width = '100%';
            s.borderTop = '1px solid #888';
        }
    }

    set_orientation(orientation) {
        this._orientation = orientation || 'horizontal';
        this._applyOrientation();
    }
}

export { Separator };
