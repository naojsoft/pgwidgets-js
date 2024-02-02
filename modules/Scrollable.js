"use_strict";

import {Widgets, ContainerWidget} from "./Widget.js";

class Scrollable extends ContainerWidget {

    constructor() {
        //containerId, contentId, containerWidth, containerHeight, contentWidth, contentHeight
        super();
        this.element = document.createElement('div');
        this.element.className = 'scrollable';

        this.init_style();
    }

    init_style() {
        super.init_style();
        
        let style = this.element.style;
        style.overflow = 'auto';

        this.updateScrollbars = this.updateScrollbars.bind(this);

        this.element.addEventListener('scroll', this.updateScrollbars);
        this.element.addEventListener('resize', this.updateScrollbars);

        this.updateScrollbars();
    }

    updateScrollbars() {
        if (this.children.length == 0) {
            this.element.style.overflowX = 'hidden';
            this.element.style.overflowY = 'hidden';
            return;
        };
        let content = this.children[0].get_element();
        const showHorizontalScrollbar = content.scrollWidth > this.element.clientWidth;
        const showVerticalScrollbar = content.scrollHeight > this.element.clientHeight;

        this.element.style.overflowX = showHorizontalScrollbar ? 'scroll' : 'hidden';
        this.element.style.overflowY = showVerticalScrollbar ? 'scroll' : 'hidden';
    }

    set_widget(child) {
        if (this.children.length > 0) {
            // scrollable can only have one child
            this.remove(this.children[0]);
        }

        super.add(child);
        this.updateScrollbars();
    }
}

Widgets.Scrollable = Scrollable;

export { Scrollable };
