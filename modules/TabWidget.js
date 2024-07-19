"use_strict";

import {ContainerWidget} from "./Widget.js";

class TabWidget extends ContainerWidget {

    constructor(options = { closable: false, reorderable: false, tab_position: 'top' }) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'tab-widget';
        this.tabs = [];
        this.tab_info = new Map();
        this.tab_id_counter = 0;
        this.current_tab_id = -1;
        this.closable = false;
        this.closable = this.get_option(options, 'closable', false);
        this.reorderable = this.get_option(options, 'reorderable', false);
        this.tabPos = this.get_option(options, 'tab_position', 'top');

        // JavaScript hack to bind "this" correctly for our methods
        this.addTab = this.addTab.bind(this);
        this.showTab = this.showTab.bind(this);
        this.closeTab = this.closeTab.bind(this);
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.set_index = this.set_index.bind(this);
        this.get_index = this.get_index.bind(this);
        this.add_widget = this.add_widget.bind(this);

        this.tabContentContainer = document.createElement('div');
        this.tabContentContainer.className = 'tab-content-container';

        if (this.tabPos === 'top' || this.tabPos === 'bottom') {
            this.element.classList.add('tab-widget');
        } else if (this.tabPos === 'left' || this.tabPos === 'right') {
            this.element.classList.add('tab-widget', 'vertical');
        }
        
        if (this.tabPos === 'none') {
            // no tab header desired--becomes a StackWidget
            this.element.classList.add('tab-widget');
            this.element.appendChild(this.tabContentContainer);
        } else {
            this.tabHeader = document.createElement('div');
            this.tabHeader.className = 'tab-header';

            if (this.tabPos === 'bottom') {
                this.element.classList.add('tab-header-bottom');
                this.element.appendChild(this.tabContentContainer);
                this.element.appendChild(this.tabHeader);
            } else if (this.tabPos === 'top') {
                this.element.appendChild(this.tabHeader);
                this.element.appendChild(this.tabContentContainer);
            } else if (this.tabPos === 'left') {
                this.element.classList.add('tab-header-left');
                this.element.appendChild(this.tabHeader);
                this.element.appendChild(this.tabContentContainer);
            } else if (this.tabPos === 'right') {
                this.element.classList.add('tab-header-right');
                this.element.appendChild(this.tabContentContainer);
                this.element.appendChild(this.tabHeader);
            }
        }
    }

    addTab(title, content) {
        const index = this.tabs.length;
        const tab_id = `tab_${this.tab_id_counter++}`;
        let tabButton = null;
        
        if (this.tabPos !== 'none') {
            tabButton = document.createElement('button');
            tabButton.textContent = title;

            if (this.closable) {
                const closeButton = document.createElement('span');
                closeButton.className = 'close';
                closeButton.textContent = '×';
                closeButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    this.closeTab(tab_id);
                });
                tabButton.appendChild(closeButton);
            }

            if (this.reorderable) {
                tabButton.setAttribute('draggable', true);
                tabButton.classList.add('draggable');
                tabButton.addEventListener('dragstart', (event) => this.handleDragStart(event, tab_id));
                tabButton.addEventListener('dragover', (event) => event.preventDefault());
                tabButton.addEventListener('drop', this.handleDrop);
            }

            tabButton.addEventListener('click', () => this.showTab(tab_id));
        
            this.tabHeader.appendChild(tabButton);
        }

        let tab_rec = { title, content, tabButton };
        this.tab_info.set(tab_id, tab_rec);
        this.tabs.push(tab_id);
      
        if (index === 0) {
            this.showTab(tab_id);
        }
    }

    showTab(tab_id) {
        const tab_rec = this.tab_info.get(tab_id);
        if (tab_rec && tab_id !== this.current_tab_id) {
            if (this.current_tab_id !== -1) {
                const cur_tab_rec = this.tab_info.get(this.current_tab_id);
                if (cur_tab_rec.tabButton !== null) {
                    cur_tab_rec.tabButton.classList.remove('active');
                }
                this.tabContentContainer.removeChild(cur_tab_rec.content);
            }

            this.current_tab_id = tab_id;
            if (tab_rec.tabButton !== null) {
                tab_rec.tabButton.classList.add('active');
            }
            this.tabContentContainer.appendChild(tab_rec.content);
        }
    }

    closeTab(tab_id) {
        const tab_rec = this.tab_info.get(tab_id);
        if (tab_rec) {
            if (tab_id === this.current_tab_id) {
                // closing the currently displayed tab
                this.tabContentContainer.removeChild(tab_rec.content);
                this.current_tab_id = -1;
            }

            // bye-bye tab
            const index = this.tabs.indexOf(tab_id);
            this.tabs.splice(index, 1);
            if (tab_rec.tabButton !== null) {
                this.tabHeader.removeChild(tab_rec.tabButton);
            }
            //this.tabContentContainer.removeChild(tab_rec.content);
            this.tab_info.delete(tab_id);

            // if there are any tabs left to show, show one
            if (this.tabs.length > 0) {
                const new_index = Math.min(index, this.tabs.length - 1);
                let new_tab_id = this.tabs[new_index];
                this.showTab(new_tab_id);
            }
        }
    }

    handleDragStart(event, tab_id) {
        event.dataTransfer.setData('text/plain', tab_id);
        event.target.classList.add('dragging');
    }

    handleDrop(event) {
        event.preventDefault();
        const tab_id = event.dataTransfer.getData('text/plain');
        const draggedIndex = this.tabs.indexOf(tab_id);
        const targetIndex = this.tabs.findIndex(tab_id => this.tab_info.get(tab_id).tabButton === event.target.closest('button'));

        console.log("dragged index == "+draggedIndex+", target_index="+targetIndex)
        if (draggedIndex !== -1 && targetIndex !== -1) {
            const tabBtnBefore = this.tab_info.get(this.tabs[targetIndex]).tabButton;
            const [removed] = this.tabs.splice(draggedIndex, 1);
            this.tabs.splice(targetIndex, 0, removed);

            const moved_tab_rec = this.tab_info.get(tab_id);
            this.tabHeader.removeChild(moved_tab_rec.tabButton);
            this.tabHeader.insertBefore(moved_tab_rec.tabButton, tabBtnBefore.nextSibling)
            this.set_index(targetIndex);
        }

        event.target.classList.remove('dragging');
    }

    add_widget(child, options = { title: "" }) {
        let tab = this.addTab(options.title, child.get_element());
        this.children.push(child);
    }
    
    set_index(index) {
        const tab_id = this.tabs[index];
        return this.showTab(tab_id);
    }

    get_index() {
        if (this.current_tab_id === -1) {
            return -1;
        }
        const index = this.tabs.indexOf(this.current_tab_id);
        return index;
    }

}

class StackWidget extends TabWidget {

    constructor(options = { }) {
        const element = this.get_option(options, 'element', null);
        super(options = { element: element, closable: false, reorderable: false,
                          tab_position: 'none' });
    }
}

export { TabWidget, StackWidget };
