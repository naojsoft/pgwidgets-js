"use_strict";

import {ContainerWidget} from "./Widget.js";

class Expander extends ContainerWidget {

    constructor(options = {}) {
        super();
        this.title = options.title || '';
        //this.borderStyle = options.borderStyle || 'ridge';
        //this.borderWidth = options.borderWidth || '3px';
        //this.borderColor = options.borderColor || 'black';
        //this.borderRadius = options.borderRadius || '2px';
        this.collapsible = options.collapsible || false;
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
        //titleElement.innerText = this.title;
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

    set_widget(child) {
        //let style = this.element.style;
        //style.overflow = 'scroll';

        if (this.children.length > 0) {
            // expander can only have one child
            this.remove(this.children[0]);
        }

        super.add_child(child);
        this.contentContainer.appendChild(child.get_element());
    }
}

export { Expander };
