"use strict";

class Widget {

    constructor () {
        this.element = null;
    }

    init_style() {
        let style = this.element.style;
        style.position = 'relative';
        style['flex-basis'] = 'auto';
        //style['flex-basis'] = 0;
        //style['flex-grow'] = 0;
        //style['flex-shrink'] = 1;
        //style['flex'] = '1 1 auto';

        style.overflow = 'hidden';
        style.margin = 0;
    }

    get_element() {
        return this.element;
    }

    set_border_width(width) {
        this.element.style['border-width'] = width + 'px';
    }

    set_border_color(color) {
        this.element.style['border-color'] = color;
    }

    set_size(width, height) {
        this.element.style.width = width + 'px';
        this.element.style.height = height + 'px';
    }
}

class ContainerWidget extends Widget {

    constructor () {
        super();

        this.children = [];
    }

    init_style() {
        super.init_style()

        let style = this.element.style;
        style.display = 'flex';
    }
    
    get_children() {
        return this.children;
    }

    add (child) {
        let idx = this.children.indexOf(child);
        if (idx == -1) {
            // only add if child is not already present
            this.children.push(child);
            this.element.appendChild(child.get_element());
        }
    }
    
    remove(child) {
        this.element.removeChild(child.get_element());
        let idx = this.children.indexOf(child);
        if (idx > -1) {
            this.children.splice(idx, 1);
        }
    }
}

var Widgets = {};
Widgets.Widget = Widget;
Widgets.ContainerWidget = ContainerWidget;

export { Widget, ContainerWidget, Widgets };

