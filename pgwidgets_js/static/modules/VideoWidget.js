"use strict";

import {Widget} from "./Widget.js";

/**
 * A video display widget with playback controls.
 *
 * Can play video from a URL (``set_url``) or from a WebRTC / getUserMedia
 * MediaStream (``set_stream``).  Provides play, pause, mute, volume,
 * and fullscreen controls.
 *
 * @extends Widget
 */
class VideoWidget extends Widget {

    /**
     * Creates a new VideoWidget.
     * @param {Object} [options] - Configuration options.
     * @param {string|null} [options.url=null] - Initial video URL.
     * @param {boolean} [options.autoplay=false] - Start playback automatically.
     * @param {boolean} [options.controls=false] - Show native browser controls.
     * @param {boolean} [options.muted=false] - Start muted.
     * @param {boolean} [options.loop=false] - Loop playback.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing
     *     DOM element to use as the outer container.
     */
    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'video-widget';

        for (let name of ['play', 'pause', 'ended', 'error',
                          'timeupdate', 'volumechange']) {
            this.enable_callback(name);
        }

        // Inner <video> element
        this._video = document.createElement('video');
        this._video.className = 'video-widget-element';
        this._video.playsInline = true;

        let autoplay = this.get_option(options, 'autoplay', false);
        let controls = this.get_option(options, 'controls', false);
        let muted = this.get_option(options, 'muted', false);
        let loop = this.get_option(options, 'loop', false);

        this._video.autoplay = autoplay;
        this._video.controls = controls;
        this._video.muted = muted;
        this._video.loop = loop;

        // Wire up video events to pgwidgets callbacks
        this._video.addEventListener('play', () => {
            this.make_callback('play');
        });
        this._video.addEventListener('pause', () => {
            this.make_callback('pause');
        });
        this._video.addEventListener('ended', () => {
            this.make_callback('ended');
        });
        this._video.addEventListener('error', () => {
            let err = this._video.error;
            this.make_callback('error',
                err ? err.message || err.code : 'unknown');
        });
        this._video.addEventListener('timeupdate', () => {
            this.make_callback('timeupdate',
                this._video.currentTime, this._video.duration);
        });
        this._video.addEventListener('volumechange', () => {
            this.make_callback('volumechange',
                this._video.volume, this._video.muted);
        });

        this.element.appendChild(this._video);

        let url = this.get_option(options, 'url', null);
        if (url !== null) {
            this.set_url(url);
        }
    }

    /**
     * Sets the video source URL.
     * @param {string} url - Video URL (mp4, webm, etc.) or data URI.
     */
    set_url(url) {
        this._video.srcObject = null;
        this._video.src = url;
    }

    /**
     * Sets a MediaStream as the video source (e.g. from WebRTC or
     * getUserMedia).
     * @param {MediaStream} stream - The media stream to display.
     */
    set_stream(stream) {
        this._video.src = '';
        this._video.srcObject = stream;
    }

    /**
     * Returns the underlying <video> DOM element, for direct access
     * to the HTMLVideoElement API.
     * @returns {HTMLVideoElement} The video element.
     */
    get_video_element() {
        return this._video;
    }

    /** Start playback. */
    play() {
        this._video.play();
    }

    /** Pause playback. */
    pause() {
        this._video.pause();
    }

    /** Stop playback and reset to the beginning. */
    stop() {
        this._video.pause();
        this._video.currentTime = 0;
    }

    /**
     * Set the muted state.
     * @param {boolean} tf - True to mute.
     */
    set_muted(tf) {
        this._video.muted = tf;
    }

    /**
     * Returns the muted state.
     * @returns {boolean}
     */
    get_muted() {
        return this._video.muted;
    }

    /**
     * Set the volume.
     * @param {number} vol - Volume level, 0.0 to 1.0.
     */
    set_volume(vol) {
        this._video.volume = Math.max(0, Math.min(1, vol));
    }

    /**
     * Returns the current volume.
     * @returns {number} Volume level, 0.0 to 1.0.
     */
    get_volume() {
        return this._video.volume;
    }

    /**
     * Set whether playback loops.
     * @param {boolean} tf - True to loop.
     */
    set_loop(tf) {
        this._video.loop = tf;
    }

    /**
     * Returns the loop state.
     * @returns {boolean}
     */
    get_loop() {
        return this._video.loop;
    }

    /**
     * Show or hide the native browser playback controls.
     * @param {boolean} tf - True to show controls.
     */
    set_controls(tf) {
        this._video.controls = tf;
    }

    /**
     * Returns whether native controls are shown.
     * @returns {boolean}
     */
    get_controls() {
        return this._video.controls;
    }

    /**
     * Seek to a position in the video.
     * @param {number} seconds - Position in seconds.
     */
    set_current_time(seconds) {
        this._video.currentTime = seconds;
    }

    /**
     * Returns the current playback position.
     * @returns {number} Position in seconds.
     */
    get_current_time() {
        return this._video.currentTime;
    }

    /**
     * Returns the total duration of the video.
     * @returns {number} Duration in seconds (NaN if unknown).
     */
    get_duration() {
        return this._video.duration;
    }

    /**
     * Returns whether playback is paused.
     * @returns {boolean}
     */
    get_paused() {
        return this._video.paused;
    }

    /**
     * Request fullscreen display of the video.
     */
    fullscreen() {
        if (this._video.requestFullscreen) {
            this._video.requestFullscreen();
        } else if (this._video.webkitRequestFullscreen) {
            this._video.webkitRequestFullscreen();
        }
    }

}

export { VideoWidget };
