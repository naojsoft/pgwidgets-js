"use_strict";

import {ContainerWidget} from "./Widget.js";

class Box extends ContainerWidget {

    constructor(orientation='horizontal') {
        super();
        this.orientation = orientation;

        //style="display: flex; flex-grow: 1; flex-shrink: 1; align-items: stretch; align-content: stretch; box-sizing: border-box; flex-direction: row; flex-wrap: nowrap; height: 100vh;"
        this.element = document.createElement('div');
        this.element.className = 'box';

        this.init_style();
    }

    init_style() {
        super.init_style();

        let style = this.element.style;
        // assigned in super classes
        //style.position = 'relative';
        //style.display = 'flex';
        if (this.orientation === 'vertical') {
            //style.height = '100vh';
            style.height = '100%';
            //style.width = '100vw';
            style['flex-direction'] = 'column';
        }
        else {
            //style.width = '100vw';
            style.width = '100%';
            //style.height = '100vh';
            style['flex-direction'] = 'row';
        };
        //style['flex-grow'] = 1;
        //style['flex-shrink'] = 1;
        style['flex-basis'] = 'auto';
        //style['flex-basis'] = 0;
        //style['flex'] = '1 1 auto';
        style['flex-wrap'] = 'nowrap';
        style['align-items'] = 'flex-start';
        style.overflow = 'hidden';
        style.margin = 0;
    }
    
    add_widget(child, stretch=0) {
        super.add(child);

        let elt = child.get_element();
        elt.style['flex-grow'] = stretch;
        elt.style['flex-basis'] = 'auto';
        //elt.style['flex-basis'] = 0;
    }

};    

class VBox extends Box {

    constructor() {
        super('vertical');
    }
}

class HBox extends Box {

    constructor() {
        super('horizontal');
    }
}

class ButtonBox extends Box {

    constructor(orientation='horizontal') {
        super(orientation);
    }

    init_style() {
        super.init_style();

        let style = this.element.style;
        style['flex-grow'] = 0;
        style['flex-shrink'] = 1;
        style['flex-basis'] = 0;
        style['justify-content'] = 'space-evenly';
        //style['width'] = '200px';
    }
    
}

export { Box, HBox, VBox, ButtonBox };

