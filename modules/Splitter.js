"use_strict";

class Splitter {

    constructor(orientation) {
        this.orientation = orientation;
        this.isDragging = false;
        this.handles = [];
        this.panes = [];
        
        this.element = document.createElement('div');
        this.element.className = 'splitter';
        this.element.style.position = 'relative';
        this.element.style.display = 'flex';
        //this.element.style.width = width + 'px';
        //this.element.style.height = height + 'px';
        if (orientation === 'vertical') {
            this.element.style.height = '100%';
            this.element.style.width = '100vw';
            this.element.style['flex-direction'] = 'column';
        }
        else {
            this.element.style.width = '100%';
            this.element.style.height = '100vh';
            this.element.style['flex-direction'] = 'row';
        };
        this.element.style.flex = '1';
        this.element.style.backgroundColor = 'lightblue';
        this.element.style.border = '2px solid green';
        this.element.style.overflow = 'hidden';
        this.element.style.margin = 0;

        this.children = [];
        this.windowStateMap = new Map();
    }

    get_element() {
        return this.element;
    }

    add_widget(child) {
        let handle = null;
        if (this.panes.length > 0) {
            // adding a second child, add a divider
            handle = this.add_divider()
            this.handles.push(handle);
            let lastPane = this.panes[this.panes.length - 1]
            handle.addEventListener('mousedown',
                                    (e) => this.onMouseDown(e, lastPane));
        };
        const pane = document.createElement('div');
        pane.className = 'splitter-pane';
        pane.style.overflow = 'hidden';
        pane.appendChild(child)
        //this.children.push(child);
        //this.element.appendChild(child.get_element());
        this.element.appendChild(pane);
        this.panes.push(pane);
    }

    add_divider() {
        let handle = document.createElement('div');
        if (this.orientation === 'vertical') {
            handle.style.width = '100%';
            handle.style.height = '10px';
            handle.className = 'splitter-handle-vertical';
        }
        else {
            handle.style.height = '100%';
            handle.style.width = '10px';
            handle.className = 'splitter-handle-horizontal';
        };
        handle.style.cursor = 'ew-resize';
        handle.style['background-color'] = '#ddd';
        handle.style['box-sizing'] = 'border-box';

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
            const pane_rect = pane.getBoundingClientRect();
            if (this.orientation === 'vertical') {
                const panePos = e.clientY - pane_rect.top;
                const widgetLen = widget_rect.height;
                if (panePos > 0 && panePos < widgetLen) {
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

