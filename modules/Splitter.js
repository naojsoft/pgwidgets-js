"use_strict";

import {ContainerWidget} from "./Widget.js";

class Splitter extends ContainerWidget {

    constructor(options = {orientation: 'horizontal'}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'splitter';
        this.orientation = this.get_option(options, 'orientation', 'horizontal');

        let style = this.element.style;
        style.position = 'relative';
        style.display = 'flex';

        if (this.orientation === 'vertical') {
            this.element.classList.add('vertical');
            style.height = '100%';
            //style.width = '100vw';
            style['flex-direction'] = 'column';
        }
        else {
            this.element.classList.add('horizontal');
            style.width = '100%';
            //style.height = '100vh';
            style['flex-direction'] = 'row';
        };
        //style.flex = '1';
        style.overflow = 'hidden';
        style.gap = '2px';

        this.isDragging = false;
        this.handles = [];
        this.panes = [];
        this.sizes = [];
        
        // JavaScript hack to bind "this" correctly for our methods
        this.add_widget = this.add_widget.bind(this);
        this.add_divider = this.add_divider.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
    }

    update_sizes() {
        for (const i = 0; i < this.sizes.length; ++i) {
            let pane = this.panes[i];
            let size = this.sizes[i];
            if (this.orientation === 'vertical') {
                pane.style.height = size + 'px';
            } else {
                pane.style.width = size + 'px';
            }
        }
    }
    
    add_widget(child) {
        const widget_rect = this.element.getBoundingClientRect();
        let handle = null;
        if (this.panes.length > 0) {
            // adding a second child, add a divider
            handle = this.add_divider()
            this.handles.push(handle);
            let lastPane = this.panes[this.panes.length - 1]
            handle.addEventListener('mousedown',
                                    (e) => this.onMouseDown(e, lastPane));
        } else {
            if (this.orientation === 'vertical') {
                const len = widget_rect.bottom - widget_rect.top;
            } else {
                const len = widget_rect.right - widget_rect.left;
            }
            this.sizes.push(len);
        }
        const pane = document.createElement('div');
        pane.className = 'splitter-pane';
        pane.style.overflow = 'hidden';
        pane.appendChild(child.get_element());
        this.element.appendChild(pane);
        this.panes.push(pane);
        this.children.push(child);

        this.update_sizes();
    }

    add_divider() {
        let handle = document.createElement('div');
        handle.className = 'splitter-handle';
        let image = document.createElement('img');
        // prevent divider image from interfering with dragging 
        image.addEventListener('dragstart', (event) => event.preventDefault());

        if (this.orientation === 'vertical') {
            handle.classList.add('vertical');
            image.width = 24;
            image.src = "../icons/hdots.svg";
        }
        else {
            handle.classList.add('horizontal');
            image.height = 24;
            image.src = "../icons/vdots.svg";
        };
        handle.appendChild(image);

        this.element.appendChild(handle);
        return handle;
    }

    onMouseDown(e, pane) {
        this.isDragging = true;
        this.element.addEventListener('mousemove',
                                      (e) => this.onMouseMove(e, pane));
        this.element.addEventListener('mouseup',
                                      (e) => this.onMouseUp(e));
    }

    onMouseMove(e, pane) {
        if (this.isDragging) {
            const widget_rect = this.element.getBoundingClientRect();
            console.log("widget size is " + widget_rect.bottom);
            const index = this.panes.findIndex(obj => obj === pane);
            let next_pane = null;
            let move_limit = 0;
            if (index < this.panes.length - 1) {
                next_pane = this.panes[index + 1];
                const next_pane_rect = pane.getBoundingClientRect();
                move_limit = next_pane_rect.top;
            } else {
                move_limit = widget_rect.bottom;
            }
            const pane_rect = pane.getBoundingClientRect();
            if (this.orientation === 'vertical') {
                const panePos = e.clientY - pane_rect.top;
                console.log("pane " + index + " position is " + panePos); 
                const widgetLen = widget_rect.height;
                if (panePos > 0 && panePos < move_limit) {
                    const ht = Math.floor((panePos / widgetLen) * widgetLen);
                    pane.style.height = ht + 'px';
                }
            }
            else {
                // horizontal orientation
                const panePos = e.clientX - pane_rect.left;
                const widgetLen = widget_rect.width;
                if (panePos > 0 && panePos < widgetLen) {
                    const wd = Math.floor((panePos / widgetLen) * widgetLen);
                    pane.style.width = wd + 'px';
                }
            }
            //pane.style.flex = newPosition + '%';
        }
    }

  onMouseUp(e) {
      this.isDragging = false;
      this.element.removeEventListener('mousemove', this.onMouseMove);
      this.element.removeEventListener('mouseup', this.onMouseUp);
  }
    
};    

export { Splitter };

