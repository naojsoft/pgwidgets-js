"use strict";

import {Callback} from "./Callback.js";

/**
 * A non-visual widget that wraps the browser's native file picker.
 *
 * Modes:
 *   - `"file"` — pick one existing file
 *   - `"files"` — pick multiple existing files
 *   - `"save"` — trigger a file download
 *
 * For file/files mode, call `open()` to show the picker. When the
 * user selects file(s), the `activated` callback fires with a payload
 * of `{files: [{name, size, type, data}, ...]}` where `data` is an
 * `ArrayBuffer` of the file's raw bytes (the Python side receives
 * `bytes`).
 *
 * For save mode, call `save(filename, data, mime_type)` to trigger
 * a browser download.
 *
 * @extends Callback
 */
class FileDialog extends Callback {

    /**
     * @param {Object} [options]
     * @param {string} [options.mode="file"] — "file", "files", or "save"
     * @param {string} [options.accept=""] — file type filter
     *   (e.g. ".txt,.csv", "image/*", "application/json")
     */
    constructor(options = {}) {
        super();

        this._mode = this.get_option(options, 'mode', 'file');
        this._accept = this.get_option(options, 'accept', '');

        this.open = this.open.bind(this);
        this.save = this.save.bind(this);

        this.enable_callback('activated');
    }

    set_mode(mode) { this._mode = mode; }
    get_mode() { return this._mode; }

    set_accept(accept) { this._accept = accept; }
    get_accept() { return this._accept; }

    /** Alias for open() — consistent with other widget dialogs. */
    show() { this.open(); }

    /**
     * Alias for open() with the same signature as Dialog.popup so
     * calling code can treat all dialogs uniformly.  The x/y
     * arguments are ignored — the browser's native file picker is
     * positioned by the OS.
     */
    popup(x, y) { this.open(); }

    /**
     * Open the native file picker (file/files mode).
     * Selected files are read as ArrayBuffers and delivered via the
     * `activated` callback.
     */
    open() {
        if (this._mode === 'save') return;

        let input = document.createElement('input');
        input.type = 'file';
        input.style.display = 'none';
        if (this._accept) {
            input.accept = this._accept;
        }
        if (this._mode === 'files') {
            input.multiple = true;
        }

        input.addEventListener('change', () => {
            let files = input.files;
            if (files.length === 0) {
                document.body.removeChild(input);
                return;
            }
            this._readFiles(files, () => {
                document.body.removeChild(input);
            });
        });

        // Append to body so the click works, then trigger.
        document.body.appendChild(input);
        input.click();
    }

    /**
     * Read selected files as ArrayBuffers and fire the activated callback.
     * RemoteInterface ships the buffers as raw binary frames so the
     * server sees `bytes`, not a base64 data-URI string.
     * @private
     */
    _readFiles(files, cleanup) {
        let fileCount = files.length;
        let results = new Array(fileCount);
        let completed = 0;

        for (let i = 0; i < fileCount; i++) {
            let file = files[i];
            let reader = new FileReader();

            reader.onprogress = (pe) => {
                if (pe.lengthComputable) {
                    this.make_callback('progress', {
                        transferred_bytes: pe.loaded,
                        total_bytes: pe.total,
                        file_name: file.name,
                        file_index: i,
                        file_count: fileCount,
                    });
                }
            };

            reader.onload = () => {
                results[i] = {
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/octet-stream',
                    data: reader.result,
                };
                completed++;
                this.make_callback('progress', {
                    transferred_bytes: file.size,
                    total_bytes: file.size,
                    file_name: file.name,
                    file_index: i,
                    file_count: fileCount,
                });
                if (completed === fileCount) {
                    this.make_callback('activated', {files: results});
                    if (cleanup) cleanup();
                }
            };

            reader.onerror = () => {
                results[i] = {
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/octet-stream',
                    data: null,
                    error: reader.error?.message || 'read error',
                };
                completed++;
                if (completed === fileCount) {
                    this.make_callback('activated', {files: results});
                    if (cleanup) cleanup();
                }
            };

            reader.readAsArrayBuffer(file);
        }
    }

    /**
     * Trigger a file download in the browser (save mode).
     * @param {string} filename — suggested filename
     * @param {string} data — data URI or base64 string
     * @param {string} [mime_type] — MIME type (used if data is raw base64)
     */
    save(filename, data, mime_type) {
        // If data is raw base64 (not a data URI), wrap it.
        if (data && !data.startsWith('data:')) {
            mime_type = mime_type || 'application/octet-stream';
            data = `data:${mime_type};base64,${data}`;
        }

        // Convert data URI to blob for efficient download.
        let byteString = atob(data.split(',')[1]);
        let mimeString = data.split(':')[1].split(';')[0];
        let ab = new ArrayBuffer(byteString.length);
        let ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        let blob = new Blob([ab], {type: mimeString});
        let url = URL.createObjectURL(blob);

        let a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export { FileDialog };
