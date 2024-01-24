"use strict";

class MDISubWindow {

    constructor(mdi_widget, child, title, width, height) {
        // the MDI window we belong to
        this.mdi_widget = mdi_widget
        //this.mdi_widget = null;
        
        this.element = document.createElement('div');
        this.element.className = 'mdi-child';
        this.element.style.width = width + 'px';
        this.element.style.height = height + 'px';
        this.element.style.zIndex = this.mdi_widget.zIndexCounter++;
        
        this.titleBar = document.createElement('div');
        this.titleBar.className = 'mdi-title-bar';
        this.titleBar.innerHTML = title;

        this.buttons = document.createElement('div');
        this.buttons.className = 'mdi-buttons';

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

        this.buttons.appendChild(this.minimizeButton);
        this.buttons.appendChild(this.maximizeButton);
        this.buttons.appendChild(this.closeButton);

        this.titleBar.appendChild(this.buttons);
        this.element.appendChild(this.titleBar);
        // TODO: child.get_element()
        this.element.appendChild(child)

        // Random placement of subwindow
        this.element.style.left = Math.random() * (this.element.innerWidth - width) + 'px';
        this.element.style.top = Math.random() * (this.element.innerHeight - height) + 'px';

        //this.mdi_widget.add_widget(this);

        this.makeDraggable(this.element, this.titleBar);
        this.makeResizable(this.element);

        // Add click event to bring the window to the top when
        // title bar is clicked
        this.titleBar.addEventListener('mousedown', () => this.raise_());

        this.update_state(this.get_state());
    }

    get_element() {
        return this.element;
    }

    update_state(rec) {
        rec.width = this.element.style.width;
        rec.height = this.element.style.height;
        rec.left = this.element.style.left;
        rec.top = this.element.style.top;
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
        if (rec.state === 'minimized') {
            // Restore the window to its previous state
            this.element.style.display = 'block';
            this.element.style.width = rec.width;
            this.element.style.height = rec.height;
            this.element.style.left = rec.left;
            this.element.style.top = rec.top;
            rec.state = 'normal';
        } else {
            // Minimize the window and store its state
            if (rec.state === 'normal') {
                this.update_state(rec);
            };
            //this.element.style.display = 'none';
            this.element.style.display = 'block';
            this.element.style.width = 'auto';
            this.element.style.height = 'auto';
            this.element.style.left = 'unset';
            this.element.style.top = 'unset';
            rec.state = 'minimized';
        }

        // Bring the window to the top when minimized or restored
        this.raise_();
    }

    toggle_maximize() {
        const workspace = this.mdi_widget.element;
        const pad = 5;
        // Check if the window is currently maximized
        const rec = this.get_state();
        if (rec.state === 'maximized') {
            // Restore the window to its previous state
            this.element.style.width = rec.width;
            this.element.style.height = rec.height;
            this.element.style.left = rec.left;
            this.element.style.top = rec.top;
            rec.state = 'normal';
        } else {
            // Maximize the window and store its state
            if (rec.state === 'normal') {
                this.update_state(rec);
            };
            let width = Math.floor(workspace.clientWidth - pad);
            let height = Math.floor(workspace.clientHeight - pad);
            this.element.style.width = width + 'px';
            this.element.style.height = height + 'px';
            this.element.style.left = '0';
            this.element.style.top = '0';
            rec.state = 'maximized';
        }
        
        // Bring the window to the top when maximized or restored
        this.raise_();
    }
    
    raise_() {
        this.element.style.zIndex = this.mdi_widget.zIndexCounter++;
    }
    
    close() {
        // TODO: needs to raise an event
        this.element.remove();
    }
}
    
class MDIWidget {

    constructor(width, height) {
        this.element = document.createElement('div');
        this.element.className = 'mdi-container';
        this.element.style.position = 'relative';
        //this.element.style.width = width + 'px';
        //this.element.style.height = height + 'px';
        this.element.style.width = '100%';
        this.element.style.height = '100%';
        this.element.style.flex = '1';
        this.element.style.backgroundColor = 'lightblue';
        this.element.style.border = '2px solid green';
        this.element.style.overflow = 'scroll';

        this.children = [];
        this.zIndexCounter = 1;
        this.windowStateMap = new Map();
    }

    get_element() {
        return this.element;
    }

    add_widget(child, title, width, height) {
        const subwin = new MDISubWindow(this, child, title, width, height);
        //subwin.mdi_widget = this;
        this.children.push(subwin);
        this.element.appendChild(subwin.get_element());
    }
    
    cascade_windows() {
        let offsetX = 0;
        let offsetY = 0;

        for (let subwin of this.children) {
            let child = subwin.get_element();
            let rec = subwin.get_state();
            child.style.left = offsetX + 'px';
            child.style.top = offsetY + 'px';
            subwin.update_state(rec);
            rec.state = "normal";

            offsetX += 20;
            offsetY += 20;

            if (offsetX + child.clientWidth > this.element.innerWidth) {
                offsetX = 0;
            }
            if (offsetY + child.clientHeight > this.element.innerHeight) {
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
            let child = subwin.get_element();
            let rec = subwin.get_state();
            child.style.width = tileWidth + 'px';
            child.style.height = tileHeight + 'px';
            child.style.left = col * tileWidth + 'px';
            child.style.top = row * tileHeight + 'px';
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

