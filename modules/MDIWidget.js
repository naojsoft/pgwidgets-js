"use strict";

import {ContainerWidget} from "./Widget.js";

const default_icon_url = "../icons/ginga.svg";


class MDISubWindow extends ContainerWidget {

    constructor(mdi_widget, child, title, width, height, icon_url) {
        super();
        // the MDI window we belong to
        this.mdi_widget = mdi_widget
        //this.mdi_widget = null;
        
        // JavaScript hack to bind "this" correctly for our methods
        this.update_state = this.update_state.bind(this);
        this.get_state = this.get_state.bind(this);
        this.makeDraggable = this.makeDraggable.bind(this);
        this.makeResizable = this.makeResizable.bind(this);
        this.toggle_minimize = this.toggle_minimize.bind(this);
        this.toggle_maximize = this.toggle_maximize.bind(this);
        this.raise_ = this.raise_.bind(this);
        this.lower_ = this.lower.bind(this);
        this.close = this.close.bind(this);

        this.element = document.createElement('div');
        this.element.className = 'mdi-window';
        let style = this.element.style;
        style.width = width + 'px';
        style.height = height + 'px';
        style.zIndex = 1;
        
        this.titleBar = document.createElement('div');
        this.titleBar.className = 'mdi-title-bar';

        this.icon = document.createElement('img');
        if (icon_url) {
            this.icon.src = icon_url;
            this.icon.width = 20;
        }

        this.titleText = document.createElement('span');
        this.titleText.innerHTML = title;

        this.buttons = document.createElement('div');
        this.buttons.className = 'mdi-buttons';

        this.lowerButton = document.createElement('div');
        this.lowerButton.className = 'mdi-button';
        this.lowerButton.innerHTML = '▼';
        this.lowerButton.onclick = () => this.lower();

        this.minimizeButton = document.createElement('div');
        this.minimizeButton.className = 'mdi-button';
        this.minimizeButton.innerHTML = '—';
        this.minimizeButton.onclick = () => this.toggle_minimize();

        this.maximizeButton = document.createElement('div');
        this.maximizeButton.className = 'mdi-button';
        this.maximizeButton.innerHTML = '□';
        this.maximizeButton.onclick = () => this.toggle_maximize();

        this.closeButton = document.createElement('div');
        this.closeButton.className = 'mdi-button';
        this.closeButton.innerHTML = '✕';
        this.closeButton.onclick = () => this.close();

        this.buttons.appendChild(this.lowerButton);
        this.buttons.appendChild(this.minimizeButton);
        this.buttons.appendChild(this.maximizeButton);
        this.buttons.appendChild(this.closeButton);

        this.child_container = document.createElement('div');
        this.child_container.className = 'mdi-child-container';
        this.child_container.appendChild(child.get_element());
        
        this.titleBar.appendChild(this.icon);
        this.titleBar.appendChild(this.titleText);
        this.titleBar.appendChild(this.buttons);
        
        this.element.appendChild(this.titleBar);
        this.element.appendChild(this.child_container);
        this.children.push(child);

        // Random placement of subwindow
        style.left = Math.random() * (this.element.innerWidth - width) + 'px';
        style.top = Math.random() * (this.element.innerHeight - height) + 'px';

        //this.mdi_widget.add_widget(this);

        this.makeDraggable(this.element, this.titleBar);
        this.makeResizable(this.element);

        // Add click event to bring the window to the top when
        // title bar is clicked
        this.titleBar.addEventListener('mousedown', () => this.raise_());

        this.update_state(this.get_state());
    }

    update_state(rec) {
        let style = this.element.style;
        rec.width = style.width;
        rec.height = style.height;
        rec.left = style.left;
        rec.top = style.top;
        return rec;
    }
    
    get_state() {
        const rec = this.mdi_widget.windowStateMap.get(this.element);
        if (rec) {
            return rec;
        } else {
            // create record and store window's state
            let newrec = this.update_state({state: 'normal'});
            this.mdi_widget.windowStateMap.set(this.element, newrec);
            return newrec;
        }
    };
    
    makeDraggable(element, handle) {
        let baseX, baseY;
        let offsetX, offsetY;
        let isMoving = false;
        let rec = this.get_state();

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            baseX = Math.floor(this.mdi_widget.element.getBoundingClientRect().left);
            baseY = Math.floor(this.mdi_widget.element.getBoundingClientRect().top);
            offsetX = Math.floor(e.x - this.element.getBoundingClientRect().left);
            offsetY = Math.floor(e.y - this.element.getBoundingClientRect().top);
            isMoving = true;
        });

        this.handleDrag = (e) => {
            if (isMoving) {
                const x = Math.floor(e.x - offsetX - baseX);
                const y = Math.floor(e.y - offsetY - baseY);

                element.style.left = x + 'px';
                element.style.top = y + 'px';
                this.update_state(rec);

                // Bring the window to the top while dragging
                this.raise_();
            };
        };

        this.mdi_widget.element.addEventListener('mousemove', this.handleDrag);
        this.mdi_widget.element.addEventListener('mouseup', () => {
            isMoving = false;
        });
    }
    
    makeResizable(element) {
        const handle = document.createElement('div');
        handle.className = 'mdi-resize-handle';
        element.appendChild(handle);

        let isResizing = false;
        let rec = this.get_state();

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;

            document.addEventListener('mousemove', this.handleResize);
            document.addEventListener('mouseup', () => {
                isResizing = false;
                document.removeEventListener('mousemove', this.handleResize);
            });
        });

        this.handleResize = (e) => {
            if (isResizing) {
                const width = e.clientX - element.getBoundingClientRect().left;
                const height = e.clientY - element.getBoundingClientRect().top;

                element.style.width = width + 'px';
                element.style.height = height + 'px';
                this.update_state(rec);
                rec.state = 'normal';

                // Bring the window to the top while resizing
                this.raise_();
            }
        };
    }

    toggle_minimize() {
        // Check if the window is already minimized
        const rec = this.get_state();
        let style = this.element.style;
        if (rec.state === 'minimized') {
            // Restore the window to its previous state
            style.display = 'block';
            style.width = rec.width;
            style.height = rec.height;
            style.left = rec.left;
            style.top = rec.top;
            rec.state = 'normal';
        } else {
            // Minimize the window and store its state
            if (rec.state === 'normal') {
                this.update_state(rec);
            };
            //style.display = 'none';
            style.display = 'block';
            style.width = 'auto';
            style.height = 'auto';
            style.left = 'unset';
            style.top = 'unset';
            rec.state = 'minimized';
        }

        // Bring the window to the top when minimized or restored
        this.raise_();
    }

    toggle_maximize() {
        const workspace = this.mdi_widget.element;
        let style = this.element.style;
        const pad = 5;
        // Check if the window is currently maximized
        const rec = this.get_state();
        if (rec.state === 'maximized') {
            // Restore the window to its previous state
            style.width = rec.width;
            style.height = rec.height;
            style.left = rec.left;
            style.top = rec.top;
            rec.state = 'normal';
        } else {
            // Maximize the window and store its state
            if (rec.state === 'normal') {
                this.update_state(rec);
            };
            let width = Math.floor(workspace.clientWidth - pad);
            let height = Math.floor(workspace.clientHeight - pad);
            style.width = width + 'px';
            style.height = height + 'px';
            style.left = '0';
            style.top = '0';
            rec.state = 'maximized';
        }
        
        // Bring the window to the top when maximized or restored
        this.raise_();
    }
    
    raise_() {
        let num_children = this.mdi_widget.children.length;
        this.element.style.zIndex = num_children;
        for (let subwin of this.mdi_widget.children) {
            if (subwin != this) {
                let win_elt = subwin.get_element();
                if (win_elt.style.zIndex == num_children) {
                    win_elt.style.zIndex--;
                }
            }
        }
    }
    
    lower() {
        this.element.style.zIndex = 1;
        for (let subwin of this.mdi_widget.children) {
            if (subwin != this) {
                let win_elt = subwin.get_element();
                if (win_elt.style.zIndex == 1) {
                    win_elt.style.zIndex++;
                }
            }
        }
    }
    
    close() {
        // TODO: needs to raise an event
        this.element.remove();
    }
}
    
class MDIWidget extends ContainerWidget {

    constructor(options = { }) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'mdi-widget';
        let style = this.element.style;
        style.position = 'relative';
        style.overflow = 'scroll';

        this.windowStateMap = new Map();

        // JavaScript hack to bind "this" correctly for our methods
        this.add_widget = this.add_widget.bind(this);
        this.cascade_windows = this.cascade_windows.bind(this);
        this.tile_windows = this.tile_windows.bind(this);
    }

    add_widget(child, options = { title: "", width: 300, height: 300, icon_url: null }) {
        const title = this.get_option(options, 'title', '');
        const width = this.get_option(options, 'width', 300);
        const height = this.get_option(options, 'height', 300);
        const icon_url = this.get_option(options, 'icon_url', default_icon_url);

        const subwin = new MDISubWindow(this, child, title, width, height, icon_url);
        this.children.push(subwin);
        this.element.appendChild(subwin.get_element());

        subwin.raise_()
    }
    
    cascade_windows() {
        let offsetX = 0;
        let offsetY = 0;

        for (let subwin of this.children) {
            let win_elt = subwin.get_element();
            let rec = subwin.get_state();
            win_elt.style.left = offsetX + 'px';
            win_elt.style.top = offsetY + 'px';
            subwin.update_state(rec);
            rec.state = "normal";

            offsetX += 20;
            offsetY += 20;

            if (offsetX + win_elt.clientWidth > this.element.innerWidth) {
                offsetX = 0;
            }
            if (offsetY + win_elt.clientHeight > this.element.innerHeight) {
                offsetY = 0;
            }
        }
    }

    tile_windows() {
        const containerWidth = this.element.clientWidth;
        const containerHeight = this.element.clientHeight;
        const columns = Math.ceil(Math.sqrt(this.children.length));
        const rows = Math.ceil(this.children.length / columns);
        const tileWidth = containerWidth / columns;
        const tileHeight = containerHeight / rows;

        let row = 0;
        let col = 0;
        
        for (let subwin of this.children) {
            let win_elt = subwin.get_element();
            let rec = subwin.get_state();
            win_elt.style.width = tileWidth + 'px';
            win_elt.style.height = tileHeight + 'px';
            win_elt.style.left = col * tileWidth + 'px';
            win_elt.style.top = row * tileHeight + 'px';
            subwin.update_state(rec);
            rec.state = "normal";

            col++;
            if (col >= columns) {
                col = 0;
                row++;
            }
        }
    }
}

export { MDISubWindow, MDIWidget };

