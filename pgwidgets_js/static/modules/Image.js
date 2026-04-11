"use_strict";

import {Widget} from "./Widget.js";

/**
 * An image display widget with optional interactive event support.
 * When use_animation_frame is enabled, uses a canvas element internally
 * for double-buffered rendering, with get_draw_context() and update()
 * for custom drawing on top of the image.
 * @extends Widget
 */
class Image extends Widget {

    /**
     * Creates a new Image widget.
     * @param {Object} [options] - Configuration options.
     * @param {string|null} [options.url=null] - URL of the image to display.
     * @param {boolean} [options.interactive=false] - If true, wire up
     *   pointer, mouse, keyboard, focus, and drag-drop events.
     * @param {boolean} [options.use_animation_frame=false] - If true,
     *   use a canvas element internally with an offscreen buffer for
     *   double-buffered rendering. Drawing via get_draw_context() writes
     *   to the offscreen buffer, and update() schedules a
     *   requestAnimationFrame flip to the visible canvas.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options={}) {
        super();
        this._useAnimationFrame = this.get_option(options, 'use_animation_frame', false);
        this._offscreen = null;
        this._rafId = null;

        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            if (this._useAnimationFrame) {
                this.element = document.createElement('canvas');
            } else {
                this.element = document.createElement('img');
            }
        }
        this.element.className = 'image-widget';

        if (!this._useAnimationFrame) {
            // Disable the browser's native image drag so the element can
            // act as a drop target instead of a drag source.
            this.element.draggable = false;
        }

        if (this._useAnimationFrame) {
            this._offscreen = document.createElement('canvas');
            this._offscreen.width = this.element.width;
            this._offscreen.height = this.element.height;
        }

        // JavaScript hack to bind "this" correctly for our methods
        this.set_image = this.set_image.bind(this);
        this.get_draw_context = this.get_draw_context.bind(this);
        this.update = this.update.bind(this);

        if (this.get_option(options, 'interactive', false)) {
            this._initInteractiveEvents({focusable: true});
        }

        if (this._useAnimationFrame) {
            // Keep the canvas drawing-buffer size synced to its displayed
            // pixel size, just like Canvas widget.
            this.add_callback('resize', (widget, evt) => {
                let cw = Math.max(0, Math.round(evt.width));
                let ch = Math.max(0, Math.round(evt.height));
                if (widget.element.width !== cw) widget.element.width = cw;
                if (widget.element.height !== ch) widget.element.height = ch;
                if (widget._offscreen) {
                    if (widget._offscreen.width !== cw) widget._offscreen.width = cw;
                    if (widget._offscreen.height !== ch) widget._offscreen.height = ch;
                }
            });
        }

        let url = this.get_option(options, 'url', null);
        if (url !== null) {
            this.set_image(url);
        }
    }

    /**
     * Sets the image source. In plain mode, sets the img src attribute.
     * In use_animation_frame mode, loads the image and draws it onto
     * the canvas, filling the canvas area.
     * @param {string} url - URL of the image to display.
     */
    set_image(url) {
        if (!this._useAnimationFrame) {
            this.element.src = url;
            return;
        }
        let img = new globalThis.Image();
        img.src = url;
        img.addEventListener("load", () => {
            let ctx = this.get_draw_context();
            ctx.clearRect(0, 0,
                          this._offscreen ? this._offscreen.width : this.element.width,
                          this._offscreen ? this._offscreen.height : this.element.height);
            ctx.drawImage(img, 0, 0, this.element.width, this.element.height);
            this.update();
        });
    }

    /**
     * Returns the 2D drawing context. When use_animation_frame is
     * enabled, returns the offscreen buffer's context. Otherwise
     * returns null (plain img mode has no drawing context).
     * @returns {CanvasRenderingContext2D|null}
     */
    get_draw_context() {
        if (this._offscreen) {
            return this._offscreen.getContext('2d');
        }
        if (this.element.tagName === 'CANVAS') {
            return this.element.getContext('2d');
        }
        return null;
    }

    /**
     * Request a frame update. When use_animation_frame is enabled,
     * schedules a requestAnimationFrame that copies the offscreen buffer
     * to the visible canvas. No-op in plain img mode.
     */
    update() {
        if (!this._offscreen) return;
        if (this._rafId !== null) return;
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            let ctx = this.element.getContext('2d');
            ctx.clearRect(0, 0, this.element.width, this.element.height);
            ctx.drawImage(this._offscreen, 0, 0);
        });
    }

    /**
     * Cancel any pending animation-frame flip and drop the offscreen
     * buffer before the base class tears down the visible element.
     */
    destroy() {
        if (this._destroyed) return;
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._offscreen = null;
        super.destroy();
    }
}

export { Image };
