"use_strict";

import {ContainerWidget} from "./Widget.js";

/**
 * A tabbed container widget similar to Qt's QTabWidget.
 * Displays child widgets as selectable tabs with support for closable tabs,
 * drag-to-reorder, and configurable tab positions (top, bottom, left, right).
 * @extends ContainerWidget
 *
 * Callbacks:
 * - 'page-switch': fired when the active tab changes.
 * - 'page-close': fired when a tab close button is clicked.
 */
class TabWidget extends ContainerWidget {

    /**
     * Creates a new TabWidget.
     * @param {Object} [options] - Configuration options.
     * @param {boolean} [options.closable=false] - Whether tabs have close buttons.
     * @param {boolean} [options.reorderable=false] - Whether tabs can be reordered by dragging.
     * @param {string} [options.tab_position='top'] - Position of tabs: 'top', 'bottom', 'left', 'right', or 'none'.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
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

        this.tabContentContainer = document.createElement('div');
        this.tabContentContainer.className = 'tab-content-container';

        if (this.tabPos !== 'none') {
            this.tabHeader = document.createElement('div');
            this.tabHeader.className = 'tab-header';
        }

        this.set_tab_position(this.tabPos);

        for (let name of ['page-switch', 'page-close']) {
            this.enable_callback(name);
        }
    }

    /**
     * Returns the tab record for the given tab ID.
     * @param {string} tab_id - The internal tab identifier.
     * @returns {Object|null} The tab record {title, content, tabButton, child}, or null.
     */
    get_child(tab_id) {
        for (let [_tab_id, tab_rec] of this.tab_info.entries()) {
            if (_tab_id === tab_id) {
                return tab_rec;
            }
        }
        return null;
    }
    
    /**
     * Returns the internal tab ID for the given child widget.
     * @param {Widget} child - The child widget to look up.
     * @returns {string|null} The tab ID, or null if not found.
     */
    get_tab_id(child) {
        for (let [tab_id, tab_rec] of this.tab_info.entries()) {
            if (tab_rec.child == child) {
                return tab_id;
            }
        }
        return null;
    }
    
    _addTab(title, child) {
        const index = this.tabs.length;
        const tab_id = `tab_${this.tab_id_counter++}`;
        let tabButton = null;
        let content = child.get_element();
        
        if (this.tabPos !== 'none') {
            tabButton = document.createElement('button');
            tabButton.textContent = title;

            if (this.closable) {
                const closeButton = document.createElement('span');
                closeButton.className = 'tab-close';
                closeButton.innerHTML =
                    '<svg viewBox="0 0 10 10">' +
                    '<line x1="1" y1="1" x2="9" y2="9"/>' +
                    '<line x1="9" y1="1" x2="1" y2="9"/>' +
                    '</svg>';
                closeButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    this.signal_close(tab_id);
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

            tabButton.addEventListener('click', () => this._showTab(tab_id));
        
            this.tabHeader.appendChild(tabButton);
        }

        let tab_rec = { title, content, tabButton, child };
        this.tab_info.set(tab_id, tab_rec);
        this.tabs.push(tab_id);

        if (index === 0) {
            this._showTab(tab_id);
        }
    }

    _showTab(tab_id) {
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

            const tab_index = this.tabs.indexOf(tab_id);
            this.make_callback('page-switch', tab_rec.child, tab_index);
        }
    }

    _closeTab(tab_id) {
        const tab_rec = this.tab_info.get(tab_id);
        if (tab_rec) {
            if (tab_id === this.current_tab_id) {
                this.current_tab_id = -1;
            }

            // remove content and tab button from the DOM
            const index = this.tabs.indexOf(tab_id);
            this.tabs.splice(index, 1);
            if (tab_rec.tabButton !== null) {
                this.tabHeader.removeChild(tab_rec.tabButton);
            }
            this.tabContentContainer.removeChild(tab_rec.content);
            this.tab_info.delete(tab_id);

            // if there are any tabs left to show, show one
            if (this.tabs.length > 0) {
                const new_index = Math.min(index, this.tabs.length - 1);
                let new_tab_id = this.tabs[new_index];
                this._showTab(new_tab_id);
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

    /**
     * Fires the 'page-close' callback for the given tab.
     * @param {string} tab_id - The tab to signal close for.
     */
    signal_close(tab_id) {
        const close_rec = this.tab_info.get(tab_id);
        if (close_rec) {
            this.make_callback('page-close', close_rec.child);
        }
    }

    /**
     * Adds a child widget as a new tab.
     * @param {Widget} child - The widget to add.
     * @param {Object} [options] - Tab options.
     * @param {string} [options.title=''] - The title shown on the tab header.
     */
    add_widget(child, options = { title: "" }) {
        let tab = this._addTab(options.title, child);
        this.children.push(child);
        this.make_callback('child-added', child);
    }
    
    /**
     * Switches to the tab containing the given child widget.
     * @param {Widget} child - The child widget to display.
     */
    show_widget(child) {
        const tab_id = this.get_tab_id(child);
        if (tab_id !== null) {
            this._showTab(tab_id);
        }
    }
    
    /**
     * Closes (removes) the tab containing the given child widget.
     * @param {Widget} child - The child widget whose tab to close.
     */
    /**
     * Removes a child widget from the tab widget, cleaning up the
     * tab button and metadata.
     * @param {Widget} child - The child widget to remove.
     * @param {boolean} [destroy=false] - If true, also destroy the child.
     */
    remove(child, destroy=false) {
        const tab_id = this.get_tab_id(child);
        if (tab_id !== null) {
            this._closeTab(tab_id);
        }
        super.remove(child, destroy);
    }

    close_widget(child) {
        this.remove(child);
    }

    /**
     * Switches to the tab at the given index.
     * @param {number} index - The 0-based tab index to display.
     */
    set_index(index) {
        const tab_id = this.tabs[index];
        this._showTab(tab_id);
    }

    /**
     * Returns the index of the currently displayed tab.
     * @returns {number} The 0-based tab index, or -1 if no tab is shown.
     */
    get_index() {
        if (this.current_tab_id === -1) {
            return -1;
        }
        const index = this.tabs.indexOf(this.current_tab_id);
        return index;
    }

    /**
     * Highlights the tab for the given child widget with a background color.
     * Pass null to restore the default background.
     * @param {Widget} child - The child widget whose tab to highlight.
     * @param {string|null} bgcolor - CSS background color, or null to clear.
     */
    highlight_tab(child, bgcolor) {
        const tab_id = this.get_tab_id(child);
        if (tab_id === null) return;
        const tab_rec = this.tab_info.get(tab_id);
        if (tab_rec && tab_rec.tabButton) {
            tab_rec.tabButton.style.backgroundColor = bgcolor !== null ? bgcolor : '';
        }
    }

    /**
     * Returns the child widget at the given tab index, or null if out of range.
     * @param {number} index - The 0-based tab index.
     * @returns {Widget|null} The child widget, or null.
     */
    index_to_widget(index) {
        if (index < 0 || index >= this.tabs.length) {
            return null;
        }
        const tab_id = this.tabs[index];
        const tab_rec = this.tab_info.get(tab_id);
        return tab_rec ? tab_rec.child : null;
    }

    /**
     * Returns the tab index of the given child widget.
     * @param {Widget} child - The child widget to look up.
     * @returns {number} The 0-based tab index, or -1 if not found.
     */
    index_of(child) {
        const tab_id = this.get_tab_id(child);
        if (tab_id === null) {
            return -1;
        }
        return this.tabs.indexOf(tab_id);
    }

    /**
     * Sets the tab header position. Rearranges the DOM and updates CSS classes.
     * @param {string} tabpos - Position: 'top', 'bottom', 'left', or 'right'.
     */
    set_tab_position(tabpos) {
        this.tabPos = tabpos;

        // remove position-related classes
        this.element.classList.remove('vertical', 'tab-header-bottom',
                                     'tab-header-left', 'tab-header-right');

        // detach header and content so we can reorder them
        if (this.tabHeader && this.tabHeader.parentElement) {
            this.element.removeChild(this.tabHeader);
        }
        if (this.tabContentContainer.parentElement) {
            this.element.removeChild(this.tabContentContainer);
        }

        if (tabpos === 'none') {
            this.element.appendChild(this.tabContentContainer);
        } else if (tabpos === 'bottom') {
            this.element.classList.add('tab-header-bottom');
            this.element.appendChild(this.tabContentContainer);
            this.element.appendChild(this.tabHeader);
        } else if (tabpos === 'left') {
            this.element.classList.add('vertical', 'tab-header-left');
            this.element.appendChild(this.tabHeader);
            this.element.appendChild(this.tabContentContainer);
        } else if (tabpos === 'right') {
            this.element.classList.add('vertical', 'tab-header-right');
            this.element.appendChild(this.tabContentContainer);
            this.element.appendChild(this.tabHeader);
        } else {
            // 'top' (default)
            this.element.appendChild(this.tabHeader);
            this.element.appendChild(this.tabContentContainer);
        }
    }

}

/**
 * A stack of widgets where only one is visible at a time (no tab headers).
 * Equivalent to a TabWidget with tab_position='none'.
 * @extends TabWidget
 */
class StackWidget extends TabWidget {

    /**
     * Creates a new StackWidget.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        const element = options.element || null;
        super({ element: element, closable: false, reorderable: false,
                tab_position: 'none' });
    }
}

export { TabWidget, StackWidget };
