"use_strict";

import {Widget} from "./Widget.js";

/**
 * A canvas widget for custom drawing and event handling.
 * Wraps an HTML canvas element and dispatches pointer, mouse, keyboard,
 * focus, and drag-drop events through the callback system.
 * @extends Widget
 *
 * Callbacks:
 * - 'pointer-down', 'pointer-up', 'pointer-move', 'pointer-over', 'pointer-out'
 * - 'click', 'dblclick', 'wheel'
 * - 'keydown', 'keyup', 'keypress'
 * - 'focus', 'focusout'
 * - 'drop', 'dragover', 'contextmenu'
 */
class Canvas extends Widget {

    /**
     * Creates a new Canvas widget.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing canvas element to use.
     * @param {boolean} [options.use_animation_frame=false] - If true,
     *   allocate a hidden offscreen canvas the same size as the visible
     *   canvas. Drawing code obtained via get_draw_context() writes to
     *   the offscreen buffer, and update() schedules a
     *   requestAnimationFrame flip to the visible canvas for tear-free
     *   smooth updates.
     */
    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('canvas');
        }
        this.element.className = 'canvas-widget';

        this._useAnimationFrame = this.get_option(options, 'use_animation_frame', false);
        this._offscreen = null;
        this._rafId = null;
        if (this._useAnimationFrame) {
            this._offscreen = document.createElement('canvas');
            this._offscreen.width = this.element.width;
            this._offscreen.height = this.element.height;
        }

        // JavaScript hack to bind "this" correctly for our methods
        this._cb_redirect = this._cb_redirect.bind(this);
        this.draw_image = this.draw_image.bind(this);
        this.get_draw_context = this.get_draw_context.bind(this);
        this.update = this.update.bind(this);

        super.init_style();
        this.initialize_events();

        for (let name of ['activated', 'pointer-down', 'pointer-up',
                          'pointer-move', 'pointer-over', 'pointer-out',
                          'click', 'dblclick', 'wheel',
                          'keydown', 'keyup', 'keypress',
                          'focus', 'focusout',
                          'drop', 'dragover', 'contextmenu']) {
            this.enable_callback(name);
        }

        // Keep the canvas drawing-buffer size synced to its displayed
        // pixel size. An HTML canvas has two separate sizes — the CSS
        // box size and the internal bitmap size (the width/height
        // attributes). If they differ, the browser stretches the bitmap,
        // which blurs drawings. Register this first so it runs before any
        // user 'resize' callback, giving user redraw code a correctly
        // sized buffer to draw into.
        this.add_callback('resize', (widget, w, h) => {
            // Changing width/height attrs clears the canvas, which is
            // expected; the user's own resize handler runs after this
            // and should redraw.
            let cw = Math.max(0, Math.round(w));
            let ch = Math.max(0, Math.round(h));
            if (widget.element.width !== cw) widget.element.width = cw;
            if (widget.element.height !== ch) widget.element.height = ch;
            if (widget._offscreen) {
                if (widget._offscreen.width !== cw) widget._offscreen.width = cw;
                if (widget._offscreen.height !== ch) widget._offscreen.height = ch;
            }
        });
    }

    initialize_events() {
        const canvas = this.element;

        // make canvas focusable for keyboard events
        canvas.setAttribute('tabindex', '0');

        // pointer events
        canvas.addEventListener('pointerdown', (e) => this._cb_redirect('pointer-down', e));
        canvas.addEventListener('pointermove', (e) => this._cb_redirect('pointer-move', e));
        canvas.addEventListener('pointerup', (e) => this._cb_redirect('pointer-up', e));
        canvas.addEventListener('pointerover', (e) => this._cb_redirect('pointer-over', e));
        canvas.addEventListener('pointerout', (e) => this._cb_redirect('pointer-out', e));

        // mouse events
        canvas.addEventListener('wheel', (e) => this._cb_redirect('wheel', e));
        canvas.addEventListener('click', (e) => this._cb_redirect('click', e));
        canvas.addEventListener('dblclick', (e) => this._cb_redirect('dblclick', e));

        // drag-drop events
        canvas.addEventListener('drop', (e) => this._cb_redirect('drop', e));
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            this._cb_redirect('dragover', e);
        });

        // disable right-click context menu
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._cb_redirect('contextmenu', e);
        });

        // keyboard events
        canvas.addEventListener("keydown", (e) => this._cb_redirect('keydown', e), true);
        canvas.addEventListener("keyup", (e) => this._cb_redirect('keyup', e), true);
        canvas.addEventListener("keypress", (e) => this._cb_redirect('keypress', e), true);

        // focus events
        canvas.addEventListener("focus", (e) => this._cb_redirect('focus', e), true);
        canvas.addEventListener("focusout", (e) => this._cb_redirect('focusout', e), true);

        canvas.style.cursor = 'crosshair';
    }

    _cb_redirect(action, event) {
        this.make_callback(action, event);
    }

    /**
     * Returns the 2D drawing context. When use_animation_frame is
     * enabled, this returns the offscreen buffer's context — drawing
     * goes there and is only made visible when update() is called.
     * Otherwise this returns the visible canvas's context.
     * @returns {CanvasRenderingContext2D}
     */
    get_draw_context() {
        if (this._offscreen) {
            return this._offscreen.getContext('2d');
        }
        return this.element.getContext('2d');
    }

    /**
     * Request a frame update. When use_animation_frame is enabled, this
     * schedules a requestAnimationFrame that copies the offscreen buffer
     * to the visible canvas. Multiple calls within the same frame are
     * coalesced into a single flip. When use_animation_frame is false
     * this is a no-op (drawing already went to the visible canvas).
     */
    update() {
        if (!this._offscreen) return;
        if (this._rafId !== null) return;
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            let ctx = this.element.getContext('2d');
            // Clear then blit; offscreen is known to be the same size.
            ctx.clearRect(0, 0, this.element.width, this.element.height);
            ctx.drawImage(this._offscreen, 0, 0);
        });
    }

    /**
     * Draw an image onto the canvas at the given position. The image is
     * loaded asynchronously; drawing happens once the image has loaded.
     * When use_animation_frame is enabled the image is drawn to the
     * offscreen buffer and update() is called automatically to schedule
     * a flip to the visible canvas.
     * @param {Object} imgInfo
     * @param {string} imgInfo.src - Image URL.
     * @param {number} imgInfo.x - Destination x in canvas pixels.
     * @param {number} imgInfo.y - Destination y in canvas pixels.
     * @param {number} [imgInfo.wd] - Optional destination width.
     * @param {number} [imgInfo.ht] - Optional destination height.
     */
    draw_image(imgInfo) {
        let img = new Image();
        img.src = imgInfo.src;
        // Use a load listener so drawing doesn't happen before the image
        // is decoded (some browsers would silently render nothing).
        img.addEventListener("load", () => {
            let ctx = this.get_draw_context();
            if (imgInfo.wd != null && imgInfo.ht != null) {
                ctx.drawImage(img, imgInfo.x, imgInfo.y, imgInfo.wd, imgInfo.ht);
            } else {
                ctx.drawImage(img, imgInfo.x, imgInfo.y);
            }
            this.update();
        });
    }
}

export { Canvas };
