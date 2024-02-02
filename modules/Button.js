"use_strict";

import {Widget} from "./Widget.js";

class Button extends Widget {

    constructor(text='') {
        super();
        
        this.element = document.createElement('button');
        super.init_style();

        this.element.textContent = text;
    }

};    

export { Button };
