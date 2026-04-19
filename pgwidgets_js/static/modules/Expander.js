"use_strict";

import {ContainerWidget} from "./Widget.js";

/**
 * A collapsible/expandable container widget with an optional title and shadow.
 * When collapsible, clicking the title bar toggles content visibility.
 * @extends ContainerWidget
 */
class Expander extends ContainerWidget {

    /**
     * Creates a new Expander widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.title=''] - Title text displayed in the header.
     * @param {boolean} [options.collapsible=true] - Whether the content can be collapsed.
     * @param {boolean} [options.shadow=false] - Whether to apply a drop shadow.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        super();
        this.title = options.title || '';
        //this.borderStyle = options.borderStyle || 'ridge';
        //this.borderWidth = options.borderWidth || '3px';
        //this.borderColor = options.borderColor || 'black';
        //this.borderRadius = options.borderRadius || '2px';
        this.collapsible = this.get_option(options, 'collapsible', true);
        this.collapsed = this.collapsible;
        this.shadow = options.shadow || false;

        // Create the frame element
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'expander-widget';

        // Create the title element
        const titleElement = document.createElement('div');
        titleElement.className = 'expander-title';
        let bgColor = this.get_option(options, 'bg_color', null);
        if (bgColor) {
            titleElement.style.backgroundColor = bgColor;
        }
        this.element.appendChild(titleElement);

        if (this.collapsible) {
            const toggleButton = document.createElement('span');
            toggleButton.className = 'expander-toggle';
            toggleButton.innerHTML = '&#9654;'; // Right-facing triangle
            titleElement.appendChild(toggleButton);

            titleElement.addEventListener('click', () => this.toggleContent());
        }

        if (this.title) {
            const titleText = document.createElement('span');
            titleText.innerText = this.title;
            titleElement.appendChild(titleText);
        }

        // Create content container
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'expander-content';
        this.element.appendChild(this.contentContainer);
        if (!this.collapsible) {
            this.contentContainer.style.display = 'block'; // Show content by default
        }
        this.applyStyles();
    }

    applyStyles() {
        //this.element.style.borderStyle = this.borderStyle;
        //this.element.style.borderWidth = this.borderWidth;
        //this.element.style.borderColor = this.borderColor;
        //this.element.style.borderRadius = this.borderRadius;

        if (this.shadow) {
            this.element.classList.add('shadow');
        }
    }

    /** Sets the collapsed state explicitly. */
    set_collapsed(collapsed) {
        if (collapsed !== this.collapsed) {
            this.toggleContent();
        }
    }

    /** Returns the current collapsed state. */
    get_collapsed() {
        return this.collapsed;
    }

    /** Toggles the content container between visible and hidden states. */
    toggleContent() {
        const toggleButton = this.element.querySelector('.expander-toggle');
        if (this.collapsed) {
            this.contentContainer.style.display = 'block';
            toggleButton.innerHTML = '&#9660;'; // Down-facing triangle
        } else {
            this.contentContainer.style.display = 'none';
            toggleButton.innerHTML = '&#9654;'; // Right-facing triangle
        }
        this.collapsed = !this.collapsed;
    }

    /**
     * Sets the single child widget inside the expander. Replaces any existing child.
     * @param {Widget} child - The widget to display inside the expander content area.
     */
    set_widget(child) {
        //let style = this.element.style;
        //style.overflow = 'scroll';

        if (this.children.length > 0) {
            // expander can only have one child
            let old = this.children[0];
            this.remove_child(old);
            this.contentContainer.removeChild(old.get_element());
        }

        super.add_child(child);
        this.contentContainer.appendChild(child.get_element());
    }
}

export { Expander };
