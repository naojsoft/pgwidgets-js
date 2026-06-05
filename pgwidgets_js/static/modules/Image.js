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
        // For animation-frame mode the public ``this.element`` is a
        // wrapper ``<div>`` and the canvas lives in ``this._canvas``
        // as a child of that div.  Wrapping is the only reliable way
        // to keep the canvas's bitmap dimensions (the ``width`` /
        // ``height`` attributes, which on a canvas double as its
        // *intrinsic* size) out of the layout algorithm -- CSS
        // ``contain: size`` doesn't fully cut that path because the
        // intrinsic size of a replaced element isn't "contents".
        // For plain ``<img>`` mode, ``this.element`` is the ``<img>``
        // directly and ``this._canvas`` is null.
        this._canvas = null;

        let preExisting = this.get_option(options, 'element', null);
        if (preExisting != null) {
            this.element = preExisting;
            if (this._useAnimationFrame) {
                // Back-compat: a caller-supplied <canvas> is used
                // as-is (no extra wrapper).  Bitmap-feedback loops
                // are then the caller's problem to avoid -- the
                // wrapper is only inserted on the default path.
                this._canvas = (preExisting.tagName === 'CANVAS')
                    ? preExisting
                    : preExisting.querySelector('canvas');
            }
        } else if (this._useAnimationFrame) {
            this.element = document.createElement('div');
            this._canvas = document.createElement('canvas');
            this.element.appendChild(this._canvas);
        } else {
            this.element = document.createElement('img');
        }
        this.element.className = 'image-widget';

        if (!this._useAnimationFrame) {
            // Disable the browser's native image drag so the element can
            // act as a drop target instead of a drag source.
            this.element.draggable = false;
        }

        if (this._useAnimationFrame && this._canvas) {
            this._offscreen = document.createElement('canvas');
            this._offscreen.width = this._canvas.width;
            this._offscreen.height = this._canvas.height;
        }

        if (this.get_option(options, 'interactive', false)) {
            this._initInteractiveEvents({focusable: true});
        }

        if (this._useAnimationFrame) {
            // When NO image has been loaded yet, sync the canvas's
            // drawing-buffer to its displayed pixel size so any
            // direct drawing (Canvas-style use) gets crisp pixels.
            //
            // Once an image is loaded, the bitmap is pinned to the
            // image's natural size (see set_image / set_binary_image)
            // and the browser handles the CSS-box scaling itself —
            // otherwise drawImage(img, 0, 0, css_w, css_h) would
            // distort the image whenever the canvas's CSS box and
            // the image's natural aspect don't match.
            this.add_callback('resize', (widget, evt) => {
                if (widget._lastImage) return;
                if (!widget._canvas) return;
                let cw = Math.max(0, Math.round(evt.width));
                let ch = Math.max(0, Math.round(evt.height));
                // One-way sync from wrapper's CSS box -> canvas
                // bitmap.  The canvas is a child of the wrapper
                // div, sized via width/height: 100% in Image.css;
                // its bitmap attrs are write-only from the layout
                // algorithm's perspective, so this can't feed
                // back through ``evt`` on a subsequent fire.
                if (widget._canvas.width !== cw) widget._canvas.width = cw;
                if (widget._canvas.height !== ch) widget._canvas.height = ch;
                if (widget._offscreen) {
                    if (widget._offscreen.width !== cw) {
                        widget._offscreen.width = cw;
                    }
                    if (widget._offscreen.height !== ch) {
                        widget._offscreen.height = ch;
                    }
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
            this._lastImage = img;
            this._drawImage(img);
        });
    }

    /**
     * Set the image from a raw ArrayBuffer received over a binary
     * WebSocket frame.  Used by the Python side's set_binary_image
     * to avoid base64 framing.  Argument order matches the Python
     * API: data first, format second.
     *
     * @param {ArrayBuffer|Uint8Array|Blob} buffer - Raw image bytes.
     * @param {string} format - Image format ('jpeg', 'png', 'webp', 'gif').
     */
    set_binary_image(buffer, format) {
        let blob = new Blob([buffer], {type: 'image/' + format});
        let url = URL.createObjectURL(blob);

        if (!this._useAnimationFrame) {
            // Plain <img>: keep the object URL alive until the next
            // image replaces it, then revoke the previous one.
            if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
            this._objectUrl = url;
            this.element.src = url;
            return;
        }

        // Animation-frame canvas mode: decode, draw to offscreen,
        // flip to visible canvas, then revoke immediately — the
        // canvas owns the pixels at that point.
        let img = new globalThis.Image();
        img.addEventListener("load", () => {
            this._lastImage = img;
            this._drawImage(img);
            URL.revokeObjectURL(url);
        });
        img.addEventListener("error", () => {
            URL.revokeObjectURL(url);
        });
        img.src = url;
    }

    /** @private
     * Pin the canvas drawing-buffer to the image's natural size, draw
     * the image at native resolution (no scaling), and schedule an
     * rAF flip from offscreen to visible.  Shared by set_image and
     * set_binary_image.
     *
     * The "image is already the right size" invariant: callers
     * generate or fetch images sized to match the widget's reported
     * size (via the 'map' or 'resize' callback), so drawImage runs
     * at natural scale and never distorts.  If the canvas's CSS box
     * later drifts from the bitmap (e.g., a layout settle), the
     * browser handles display scaling without us re-encoding pixels.
     */
    _drawImage(img) {
        if (!this._useAnimationFrame) return;
        if (!this._canvas) return;
        let nw = img.naturalWidth;
        let nh = img.naturalHeight;
        if (nw <= 0 || nh <= 0) return;
        // Pin the canvas (and offscreen) drawing-buffer to the image's
        // natural size so the image renders at native resolution.  The
        // canvas's CSS box is whatever the layout gave it; the browser
        // scales the canvas display from bitmap to CSS box on its own,
        // which preserves the image's data without us having to
        // pre-distort it inside drawImage().
        if (this._canvas.width !== nw) this._canvas.width = nw;
        if (this._canvas.height !== nh) this._canvas.height = nh;
        if (this._offscreen) {
            if (this._offscreen.width !== nw) this._offscreen.width = nw;
            if (this._offscreen.height !== nh) this._offscreen.height = nh;
        }
        let ctx = this.get_draw_context();
        if (!ctx) return;
        ctx.clearRect(0, 0, nw, nh);
        ctx.drawImage(img, 0, 0);
        this.update();
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
        if (this._canvas) {
            return this._canvas.getContext('2d');
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
        if (!this._canvas) return;
        if (this._rafId !== null) return;
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            if (this._canvas.width === 0 || this._canvas.height === 0) return;
            let ctx = this._canvas.getContext('2d');
            ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
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
        if (this._objectUrl) {
            URL.revokeObjectURL(this._objectUrl);
            this._objectUrl = null;
        }
        this._offscreen = null;
        super.destroy();
    }
}

export { Image };
