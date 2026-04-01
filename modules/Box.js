"use_strict";

import {ContainerWidget} from "./Widget.js";

class Box extends ContainerWidget {

    constructor(options = { orientation: 'horizontal' }) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'box-widget';
        this.orientation = this.get_option(options, 'orientation', 'horizontal');

        // JavaScript hack to bind "this" correctly for our methods
        this.add_widget = this.add_widget.bind(this);
        this.set_spacing = this.set_spacing.bind(this);
        this.init_style = this.init_style.bind(this);

        this.init_style();
    }

    init_style() {
        super.init_style();

        let style = this.element.style;
        // assigned in super classes
        //style.position = 'relative';
        //style.display = 'flex';
        if (this.orientation === 'vertical') {
            this.element.classList.add('vertical');
            //style.height = '100vh';
            //style.height = '100%';
            //style.width = '100vw';
            //style['flex-direction'] = 'column';
        }
        else {
            this.element.classList.add('horizontal');
            //style.width = '100vw';
            //style.width = '100%';
            //style.height = '100vh';
            //style['flex-direction'] = 'row';
        };
        //style['flex-grow'] = 1;
        //style['flex-shrink'] = 1;
        //style['flex-basis'] = 'auto';
        //style['flex-basis'] = 0;
        //style['flex'] = '1 1 auto';
        //style['flex-wrap'] = 'nowrap';
        //style['align-items'] = 'flex-start';
        //style.overflow = 'hidden';
        //style.margin = 0;
    }
    
    add_widget(child, stretch=0) {
        super.add(child);

        let elt = child.get_element();
        elt.classList.add('box-child');

        // main axis: stretch=0 means natural size, stretch>0 means
        // distribute extra space proportionally (like Qt's stretch factor)
        if (stretch > 0) {
            elt.style.flex = stretch + ' 1 0px';
        } else {
            elt.style.flex = '0 0 auto';
        }

        // cross axis: always fill (like Qt)
        if (this.orientation === 'vertical') {
            elt.style.width = '100%';
        } else {
            elt.style.height = '100%';
        }
        elt.style.minWidth = '0';
        elt.style.minHeight = '0';
    }

    set_spacing(gap=0) {
        let style = this.element.style;
        style['gap'] = gap + "px";
    }

};    

class VBox extends Box {

    constructor() {
        super({orientation: 'vertical'});
    }
}

class HBox extends Box {

    constructor() {
        super({orientation: 'horizontal'});
    }
}

class ButtonBox extends Box {

    constructor(options = { orientation: 'horizontal' }) {
        super(options);
    }

    init_style() {
        super.init_style();

        let style = this.element.style;
        style['flex-grow'] = 1;
        //style['flex-shrink'] = 1;
        style['flex-basis'] = 0;
        //style['justify-content'] = 'space-evenly';
        //style['width'] = '200px';
    }
    
}

export { Box, HBox, VBox, ButtonBox };

