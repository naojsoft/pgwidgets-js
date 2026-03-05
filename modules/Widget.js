"use strict";

class Widget {

    constructor () {
        this.element = null;

        // JavaScript hack to bind "this" correctly for our methods
        this.get_element = this.get_element.bind(this);
        this.set_border_width = this.set_border_width.bind(this);
        this.set_border_color = this.set_border_color.bind(this);
        this.init_style = this.init_style.bind(this);
        this.resize = this.resize.bind(this);
        this.enable_callback = this.enable_callback.bind(this);
        this.add_callback = this.add_callback.bind(this);
        this.clear_callback = this.clear_callback.bind(this);
        this.remove_callback = this.remove_callback.bind(this);
        this.make_callback = this.make_callback.bind(this);

        this.cb = {}

        for (let name of ['resize']) {
            this.enable_callback(name);
        }
        //this.element.addEventListener('resize',
        //                              (e) => this.make_callback('resize', e.clientWidth, e.clientHeight));

    }

    init_style() {
        let style = this.element.style;
        style.position = 'relative';
        style['flex-basis'] = 'auto';
        //style['flex-basis'] = 0;
        //style['flex-grow'] = 0;
        //style['flex-shrink'] = 1;
        //style['flex'] = '1 1 auto';

        //style.overflow = 'hidden';
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
/*
    set_size(width, height) {
        this.element.style.width = width + 'px';
        this.element.style.height = height + 'px';
    }
*/
    resize(width, height) {
        this.element.style.width = width + 'px';
        this.element.style.height = height + 'px';
    }

    /* CALLBACK HANDLING */

    enable_callback(action) {
        if (!(action in this.cb)) {
            this.cb[action] = [];
        }
    }

    add_callback(action, cb_fn) {
        if (!(action in this.cb)) {
            // TODO: raise an error
            this.cb[action] = [];
        }
        let cb_list = this.cb[action];
        let idx = cb_list.indexOf(cb_fn);
        if (idx == -1) {
            // only add if cb_fn is not already present
            cb_list.push(cb_fn);
        }
    }

    remove_callback(action, cb_fn) {
        if (!(action in this.cb)) {
            return
        }
        let cb_list = this.cb[action];
        let idx = cb_list.indexOf(cb_fn);
        if (idx > -1) {
            cb_list.splice(idx, 1);
        }
    }

    clear_callback(action) {
        if (!(action in this.cb)) {
            return
        }
        this.cb[action] = [];
    }

    make_callback(action, ...args) {
        let cb_list = this.cb[action];
        let params = [...args];  // shallow copy
        for (let cb_fn of cb_list) {
            // catch exceptions and log them but continue to invoke callbacks
            try {
                //console.log("making callback '"+action+"' cb_fn="+cb_fn);
                (cb_fn)(this, ...params);
            } catch (error) {
                console.error(error);
            }
        }
    }

    /* UTILITY FUNCTIONS */
    
    get_option(obj, key, default_value) {
        if (key in obj) {
            return obj[key];
        }
        return default_value;
    }

}

class ContainerWidget extends Widget {

    constructor () {
        super();

        this.children = [];

        // JavaScript hack to bind "this" correctly for our methods
        this.get_children = this.get_children.bind(this);
        this.add = this.add.bind(this);
        this.add_child = this.add_child.bind(this);
        this.remove = this.remove.bind(this);
        this.remove_child = this.remove_child.bind(this);
    }
/*
    init_style() {
        super.init_style()

        let style = this.element.style;
        style.display = 'flex';
    }
*/
    
    get_children() {
        return this.children;
    }

    add_child(child) {
        let idx = this.children.indexOf(child);
        if (idx == -1) {
            // only add if child is not already present
            this.children.push(child);
        }
        return idx;
    }
    
    add(child) {
        let idx = this.add_child(child);
        if (idx == -1) {
            this.element.appendChild(child.get_element());
        }
    }
    
    remove_child(child) {
        let idx = this.children.indexOf(child);
        if (idx > -1) {
            this.children.splice(idx, 1);
        }
        return idx;
    }

    remove(child) {
        let idx = this.remove_child(child);
        if (idx > -1) {
            this.element.removeChild(child.get_element());
        }
    }
}

export { Widget, ContainerWidget };

