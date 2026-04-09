"use strict";

import {Widget} from "./Widget.js";

/**
 * A one-shot countdown timer. Not a visual widget — it has no rendered
 * presence in the DOM — but it participates in the standard pgwidgets
 * callback system so you can subscribe with add_callback just like any
 * other widget.
 *
 * Callbacks:
 *   'expired'   — fired when the timer runs out naturally, as
 *                 (timer, duration_seconds)
 *   'cancelled' — fired when cancel() is called, as
 *                 (timer, elapsed_seconds)
 *
 * @extends Widget
 */
class Timer extends Widget {

    /**
     * @param {Object} [options]
     * @param {number} [options.duration=0] - Default duration in seconds.
     *   The timer is NOT started by the constructor; call start() to begin.
     */
    constructor(options = {}) {
        super();
        // Timer has no DOM presence. Leaving this.element null is fine:
        // the base-class ResizeObserver install is a no-op when element
        // is null, and the Widget wid/registry still work.

        this.duration = this.get_option(options, 'duration', 0);
        this._startTime = 0;      // performance.now() when start() was called
        this._running = false;
        this._timeoutId = null;

        this.enable_callback('expired');
        this.enable_callback('cancelled');

        // JavaScript hack to bind "this" correctly for our methods
        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
        this.cancel = this.cancel.bind(this);
        this.is_set = this.is_set.bind(this);
        this.elapsed_time = this.elapsed_time.bind(this);
        this.time_left = this.time_left.bind(this);
        this.set_duration = this.set_duration.bind(this);
        this.get_duration = this.get_duration.bind(this);
    }

    /**
     * Start (or restart) the timer. If a previous timer is still running
     * it is stopped first (no 'cancelled' callback is fired).
     * @param {number|null} [duration=null] - Duration in seconds. If null,
     *   the currently configured duration is used.
     */
    start(duration = null) {
        if (this._timeoutId !== null) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }
        if (duration != null) {
            this.duration = duration;
        }
        this._startTime = performance.now();
        this._running = true;
        let ms = Math.max(0, this.duration * 1000);
        this._timeoutId = setTimeout(() => {
            this._timeoutId = null;
            this._running = false;
            this.make_callback('expired', this.duration);
        }, ms);
    }

    /**
     * Stop the timer without firing a callback.
     */
    stop() {
        if (this._timeoutId !== null) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }
        this._running = false;
    }

    /**
     * Stop the timer and fire the 'cancelled' callback with the elapsed
     * time (seconds) at the moment of cancellation.
     */
    cancel() {
        let elapsed = this.elapsed_time();
        if (this._timeoutId !== null) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }
        this._running = false;
        this.make_callback('cancelled', elapsed);
    }

    /**
     * @returns {boolean} True if the timer is currently running.
     */
    is_set() {
        return this._running;
    }

    /**
     * @returns {number} Seconds elapsed since start() was called. Returns
     *   0 if the timer is not running.
     */
    elapsed_time() {
        if (!this._running) return 0;
        return (performance.now() - this._startTime) / 1000;
    }

    /**
     * @returns {number} Seconds remaining until expiration, or 0 if the
     *   timer is not running.
     */
    time_left() {
        if (!this._running) return 0;
        return Math.max(0, this.duration - this.elapsed_time());
    }

    /**
     * Update the default duration (does not start or restart the timer).
     * @param {number} duration - Duration in seconds.
     */
    set_duration(duration) {
        this.duration = duration;
    }

    /**
     * @returns {number} The currently configured duration in seconds.
     */
    get_duration() {
        return this.duration;
    }

    /**
     * Cancel any pending timeout and tear down. No 'cancelled' callback
     * is fired.
     */
    destroy() {
        if (this._destroyed) return;
        if (this._timeoutId !== null) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }
        this._running = false;
        super.destroy();
    }
}

export { Timer };
