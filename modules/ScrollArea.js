"use_strict";

import {ContainerWidget} from "./Widget.js";

/**
 * A scrollable container widget. Wraps a single child and provides
 * automatic scrollbars when the content overflows.
 * @extends ContainerWidget
 */
class ScrollArea extends ContainerWidget {

    /**
     * Creates a new ScrollArea widget.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = { }) {
        //containerId, contentId, containerWidth, containerHeight, contentWidth, contentHeight
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'scrollable';
        let style = this.element.style;
        style.overflow = 'auto';

        this.updateScrollbars = this.updateScrollbars.bind(this);

        this.init_style();

        //this.element.addEventListener('scroll', this.updateScrollbars);
        //this.element.addEventListener('resize', this.updateScrollbars);

        this.updateScrollbars();
    }
/*
    init_style() {
        //super.init_style();
        
        let style = this.element.style;
        style.overflow = 'scroll';
    }
*/
    /**
     * Updates scrollbar visibility based on whether the content overflows.
     */
    updateScrollbars() {
        let style = this.element.style;

        if (this.children.length == 0) {
            style.overflowX = 'hidden';
            style.overflowY = 'hidden';
            return;
        };

        let content = this.children[0].get_element();
        //const showHorizontalScrollbar = content.scrollWidth > this.element.clientWidth;  // offsetWidth ?
        //const showVerticalScrollbar = content.scrollHeight > this.element.clientHeight;  // offsetHeight ?
        console.log("scroll "+content.scrollWidth+", "+content.scrollHeight)
        console.log("client "+content.offsetWidth+", "+content.offsetHeight)
        var rect = content.getBoundingClientRect();
        console.log("rect "+rect.width+", "+rect.height)
        const showHorizontalScrollbar = content.scrollWidth > rect.width;
        const showVerticalScrollbar = content.scrollHeight > rect.height;

        console.log("scrollbars "+showHorizontalScrollbar+", "+showVerticalScrollbar)
        style.overflow = showHorizontalScrollbar | showVerticalScrollbar ? 'scroll' : 'hidden';
        style.overflowX = showHorizontalScrollbar ? 'scroll' : 'hidden';
        style.overflowY = showVerticalScrollbar ? 'scroll' : 'hidden';
    }

    /**
     * Sets the single child widget inside the scroll area. Replaces any existing child.
     * @param {Widget} child - The widget to display inside the scroll area.
     */
    set_widget(child) {
        let style = this.element.style;
        style.overflow = 'scroll';

        if (this.children.length > 0) {
            // scrollable can only have one child
            this.remove(this.children[0]);
        }

        super.add(child);
        //this.updateScrollbars();
    }
}

export { ScrollArea };
