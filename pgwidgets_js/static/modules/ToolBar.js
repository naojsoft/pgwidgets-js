"use_strict";

import {Widget} from "./Widget.js";
import {ToolBarAction} from "./ToolBarAction.js";

/**
 * A toolbar widget that arranges actions and other widgets in a
 * horizontal or vertical strip. Supports buttons, toggle actions,
 * separators, and spacers.
 * @extends Widget
 */
class ToolBar extends Widget {

    /**
     * Creates a new ToolBar widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.orientation='horizontal'] - 'horizontal' or 'vertical'.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'toolbar-widget';

        this.orientation = this.get_option(options, 'orientation', 'horizontal');
        if (this.orientation === 'vertical') {
            this.element.classList.add('vertical');
        } else {
            this.element.classList.add('horizontal');
        }

        // JavaScript hack to bind "this" correctly for our methods
        this.add_widget = this.add_widget.bind(this);
        this.add_separator = this.add_separator.bind(this);
        this.add_spacer = this.add_spacer.bind(this);
        this.add_action = this.add_action.bind(this);
    }

    /**
     * Adds a widget to the toolbar.
     * @param {Widget} child - The widget to add.
     */
    add_widget(child) {
        let elt = child.get_element();
        elt.classList.add('toolbar-child');
        this.element.appendChild(elt);
    }

    /**
     * Adds a separator line to the toolbar.
     */
    add_separator() {
        let sep = document.createElement('div');
        sep.className = 'toolbar-separator';
        this.element.appendChild(sep);
    }

    /**
     * Adds stretchable space at the current position.
     */
    add_spacer() {
        let spacer = document.createElement('div');
        spacer.className = 'toolbar-spacer';
        spacer.style.flex = '1';
        this.element.appendChild(spacer);
    }

    /**
     * Creates and adds a ToolBarAction to the toolbar.
     * @param {Object} [options] - Configuration options.
     * @param {string|null} [options.text=null] - Label text.
     * @param {string|null} [options.icon_url=null] - URL of an icon image.
     * @param {number[]|null} [options.iconsize=null] - Icon size as [width, height] in pixels.
     * @param {boolean} [options.toggle=false] - If true, behaves as a toggle action.
     * @returns {ToolBarAction} The newly created action.
     */
    add_action(options = {}) {
        let action = new ToolBarAction(options);
        this.add_widget(action);
        return action;
    }
}

export { ToolBar };
