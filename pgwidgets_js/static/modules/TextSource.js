"use_strict";

import {Widget} from "./Widget.js";
import {ScrollBar} from "./ScrollBar.js";


/**
 * A live reference to a position in a TextSource buffer.
 * The position automatically updates as text is inserted or deleted.
 *
 * Gravity controls behavior when text is inserted exactly AT the
 * ref's position:
 *   - 'right' (default): the ref moves with the inserted text (i.e. it
 *     ends up after the new text)
 *   - 'left': the ref stays before the inserted text
 *
 * If a delete range covers the ref's position, the ref snaps to the
 * start of the deleted range.
 */
class TextBufferRef {
    constructor(buffer, offset, gravity = 'right') {
        this._buffer = buffer;
        this._offset = offset;
        this._gravity = gravity;
        this._valid = true;
    }
    /** Current character offset of this ref. */
    get_offset() { return this._offset; }
    get_gravity() { return this._gravity; }
    is_valid() { return this._valid; }
    /** Returns [line, column] (both 0-based) of this ref's offset. */
    get_line_column() {
        let text = this._buffer.get_text();
        let line = 0;
        let lastNl = -1;
        for (let i = 0; i < this._offset && i < text.length; i++) {
            if (text[i] === '\n') {
                line++;
                lastNl = i;
            }
        }
        return [line, this._offset - lastNl - 1];
    }
}


/**
 * A multi-line rich text editor widget, inspired by GtkSourceView.
 *
 * Features (Phase 1):
 *   - optional left icon gutter (one icon per line)
 *   - optional line number gutter
 *   - three wrap modes: 'none', 'hard', 'word'
 *   - custom pgwidgets ScrollBar widgets for horizontal/vertical scrolling
 *   - canonical text model (source of truth) rendered into contenteditable
 *
 * Additional features (tags, TextBufferRef, undo/redo, find/replace)
 * will be added in subsequent phases.
 *
 * @extends Widget
 */
class TextSource extends Widget {

    /**
     * @param {string} [text=''] - Initial text content.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.wrap='none'] - 'none', 'hard', or 'word'.
     * @param {boolean} [options.line_numbers=false] - Show line numbers.
     * @param {boolean} [options.icon_gutter=false] - Show icon gutter.
     * @param {boolean} [options.editable=true] - Whether text is editable.
     * @param {string} [options.font_family='monospace']
     * @param {number} [options.font_size=13]
     */
    constructor(text = '', options = {}) {
        if (text === null || text === undefined) text = '';
        super();

        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'textsource-widget';

        // -- method bindings --
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this.insert_text = this.insert_text.bind(this);
        this.delete_range = this.delete_range.bind(this);
        this.get_length = this.get_length.bind(this);
        this.clear = this.clear.bind(this);
        this.set_editable = this.set_editable.bind(this);
        this.set_wrap = this.set_wrap.bind(this);
        this.set_line_numbers = this.set_line_numbers.bind(this);
        this.set_icon_gutter = this.set_icon_gutter.bind(this);
        this.set_icon = this.set_icon.bind(this);
        this.get_cursor = this.get_cursor.bind(this);
        this.set_cursor = this.set_cursor.bind(this);
        this.get_selection = this.get_selection.bind(this);
        this.set_selection = this.set_selection.bind(this);
        this._render = this._render.bind(this);
        this.set_scroll_position = this.set_scroll_position.bind(this);
        this._syncScrollbars = this._syncScrollbars.bind(this);
        this._syncFromScroll = this._syncFromScroll.bind(this);

        this._scrollTimer = null;
        this._scrollReady = false;

        super.init_style();

        // -- enable callbacks --
        for (let name of ['changed', 'cursor_moved',
                          'line_clicked', 'icon_clicked']) {
            this.enable_callback(name);
        }

        // -- options and state --
        this._wrap = this.get_option(options, 'wrap', 'none');
        this._showLineNumbers = this.get_option(options, 'line_numbers', false);
        this._showIconGutter = this.get_option(options, 'icon_gutter', false);
        this._editable = this.get_option(options, 'editable', true);
        this._fontFamily = this.get_option(options, 'font_family', 'monospace');
        this._fontSize = this.get_option(options, 'font_size', 13);

        // Canonical text model: a plain string. Lines are '\n'-separated.
        this._text = '';
        // Per-line icon URLs: index -> url (or undefined)
        this._lineIcons = {};
        // Cursor offset and selection (offsets into _text)
        this._cursor = 0;
        this._selStart = 0;
        this._selEnd = 0;

        // -- live refs and tags --
        // Set of TextBufferRef instances we are tracking
        this._refs = new Set();
        // name -> attribute object (background, foreground, bold, etc.)
        this._tagDefs = new Map();
        // Active tag intervals: { name, start, end, seq }
        this._tags = [];
        this._tagSeq = 0;

        // -- undo/redo --
        this._undoStack = [];
        this._redoStack = [];
        this._undoLimit = 500;
        this._inUndoRedo = false;

        // -- build DOM --
        this._buildDOM();

        // Set initial text (this also renders)
        if (text) {
            this.set_text(text);
        } else {
            this._render();
        }
    }

    // -----------------------------------------------------------------
    // DOM construction
    // -----------------------------------------------------------------

    _buildDOM() {
        // Grid: main area + vertical scrollbar, and horizontal scrollbar row
        this._bodyArea = document.createElement('div');
        this._bodyArea.className = 'textsource-body-area';
        this.element.appendChild(this._bodyArea);

        // Main area: icon gutter | number gutter | edit wrap
        this._main = document.createElement('div');
        this._main.className = 'textsource-main';
        this._bodyArea.appendChild(this._main);

        // Icon gutter
        this._iconGutter = document.createElement('div');
        this._iconGutter.className = 'textsource-icon-gutter';
        if (!this._showIconGutter) this._iconGutter.style.display = 'none';
        this._main.appendChild(this._iconGutter);

        // Line number gutter
        this._numberGutter = document.createElement('div');
        this._numberGutter.className = 'textsource-number-gutter';
        if (!this._showLineNumbers) this._numberGutter.style.display = 'none';
        this._main.appendChild(this._numberGutter);

        // Edit wrapper (clips content)
        this._editWrap = document.createElement('div');
        this._editWrap.className = 'textsource-edit-wrap';
        this._main.appendChild(this._editWrap);

        // Contenteditable edit element
        this._edit = document.createElement('div');
        this._edit.className = 'textsource-edit';
        this._edit.contentEditable = this._editable ? 'true' : 'false';
        this._edit.spellcheck = false;
        this._edit.style.fontFamily = this._fontFamily;
        this._edit.style.fontSize = this._fontSize + 'px';
        this._editWrap.appendChild(this._edit);

        // Apply wrap-mode-specific CSS
        this._applyWrapMode();

        // -- ScrollBars (pgwidgets) --
        this._vScrollBar = new ScrollBar({orientation: 'vertical'});
        this._hScrollBar = new ScrollBar({orientation: 'horizontal'});
        this._vScrollBar.get_element().classList.add('textsource-vbar');
        this._hScrollBar.get_element().classList.add('textsource-hbar');

        this._corner = document.createElement('div');
        this._corner.className = 'textsource-corner';

        this._bodyArea.appendChild(this._vScrollBar.get_element());
        this._bodyArea.appendChild(this._hScrollBar.get_element());
        this._bodyArea.appendChild(this._corner);

        // Scrollbar callbacks drive the main/edit scroll positions
        this._vScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._main.scrollHeight - this._main.clientHeight;
            this._main.scrollTop = Math.max(0, pct * maxScroll);
            this._syncFromScroll();
        });
        this._hScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._edit.scrollWidth - this._editWrap.clientWidth;
            this._editWrap.scrollLeft = Math.max(0, pct * maxScroll);
            this._syncFromScroll();
        });

        // Mouse wheel
        this._editWrap.addEventListener('wheel', (e) => {
            e.preventDefault();
            this._main.scrollTop += e.deltaY;
            this._editWrap.scrollLeft += e.deltaX;
            this._syncFromScroll();
        });

        // Keep scrollbars in sync when native scrolling happens
        // (e.g. keyboard navigation moving caret out of view)
        this._main.addEventListener('scroll', () => this._syncFromScroll());
        this._editWrap.addEventListener('scroll', () => this._syncFromScroll());

        // Observe size changes
        this._resizeObserver = new ResizeObserver(() => this._syncScrollbars());
        this._resizeObserver.observe(this._main);
        this._resizeObserver.observe(this._edit);
        this._resizeObserver.observe(this._editWrap);

        // -- input handling --
        // We intercept beforeinput so all edits go through the model first.
        this._edit.addEventListener('beforeinput', (e) => this._onBeforeInput(e));
        this._edit.addEventListener('keydown', (e) => this._onKeyDown(e));
        this._edit.addEventListener('cut', (e) => this._onCut(e));
        this._edit.addEventListener('copy', (e) => this._onCopy(e));
        // Keep cursor/selection in sync
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === this._edit) {
                this._captureSelection();
            }
        });
        requestAnimationFrame(() => { this._scrollReady = true; });
    }

    // -----------------------------------------------------------------
    // Public API - text content
    // -----------------------------------------------------------------

    /** Replaces all text with the given string. */
    set_text(text) {
        this._text = text == null ? '' : String(text);
        this._cursor = 0;
        this._selStart = 0;
        this._selEnd = 0;
        // Reset tags and invalidate refs - this is a destructive replace.
        this._tags = [];
        for (let ref of this._refs) {
            ref._offset = 0;
            ref._valid = false;
        }
        this._refs.clear();
        this._render();
        this.make_callback('changed');
    }

    /** Returns the current text as a plain UTF-8 string. */
    get_text() {
        return this._text;
    }

    /** Returns the number of characters in the buffer. */
    get_length() {
        return this._text.length;
    }

    /**
     * Inserts text at the given offset.
     * @param {number} offset - Character offset (0..length).
     * @param {string} text - The text to insert.
     */
    insert_text(offset, text, tags = null) {
        if (text == null || text === '') return;
        offset = this._clampOffset(offset);
        this._replaceRange(offset, offset, text, { tags });
    }

    /**
     * Deletes a range of text.
     * @param {number} start - Start offset (inclusive).
     * @param {number} end - End offset (exclusive).
     */
    delete_range(start, end) {
        start = this._clampOffset(start);
        end = this._clampOffset(end);
        if (start > end) [start, end] = [end, start];
        if (start === end) return;
        this._replaceRange(start, end, '');
    }

    /**
     * The single mutation primitive. Replaces [start, end) with newText
     * and updates refs, tags, cursor/selection, and the undo stack.
     */
    _replaceRange(start, end, newText, opts = {}) {
        let oldText = this._text.slice(start, end);
        if (oldText === '' && newText === '') return;
        let cursorBefore = [this._cursor, this._selStart, this._selEnd];

        this._text = this._text.slice(0, start) + newText + this._text.slice(end);

        // Update refs/tags: first delete [start,end), then insert newText
        if (end > start) {
            this._updateRefsOnDelete(start, end);
            this._updateTagsOnDelete(start, end);
            let n = end - start;
            let adjust = (o) => {
                if (o <= start) return o;
                if (o >= end) return o - n;
                return start;
            };
            this._cursor = adjust(this._cursor);
            this._selStart = adjust(this._selStart);
            this._selEnd = adjust(this._selEnd);
        }
        if (newText.length > 0) {
            let n = newText.length;
            this._updateRefsOnInsert(start, n);
            this._updateTagsOnInsert(start, n);
            if (this._cursor > start || this._cursor === start) {
                // keep cursor right of the insert (typical typing behavior)
            }
        }
        // Position cursor after the inserted text
        let newPos = start + newText.length;
        this._cursor = newPos;
        this._selStart = newPos;
        this._selEnd = newPos;

        if (opts.tags) {
            for (let name of opts.tags) {
                this._addTagInterval(name, start, start + newText.length);
            }
        }

        if (!this._inUndoRedo && opts.pushUndo !== false) {
            this._undoStack.push({
                start, oldText, newText,
                cursorBefore,
                cursorAfter: [this._cursor, this._selStart, this._selEnd],
            });
            if (this._undoStack.length > this._undoLimit) {
                this._undoStack.shift();
            }
            this._redoStack = [];
        }

        this._render();
        this.make_callback('changed');
    }

    // -----------------------------------------------------------------
    // Public API - undo / redo
    // -----------------------------------------------------------------

    can_undo() { return this._undoStack.length > 0; }
    can_redo() { return this._redoStack.length > 0; }

    undo() {
        let rec = this._undoStack.pop();
        if (!rec) return false;
        this._inUndoRedo = true;
        try {
            this._replaceRange(rec.start, rec.start + rec.newText.length,
                               rec.oldText, { pushUndo: false });
            [this._cursor, this._selStart, this._selEnd] = rec.cursorBefore;
            this._applySelectionToDOM();
        } finally {
            this._inUndoRedo = false;
        }
        this._redoStack.push(rec);
        return true;
    }

    redo() {
        let rec = this._redoStack.pop();
        if (!rec) return false;
        this._inUndoRedo = true;
        try {
            this._replaceRange(rec.start, rec.start + rec.oldText.length,
                               rec.newText, { pushUndo: false });
            [this._cursor, this._selStart, this._selEnd] = rec.cursorAfter;
            this._applySelectionToDOM();
        } finally {
            this._inUndoRedo = false;
        }
        this._undoStack.push(rec);
        return true;
    }

    // -----------------------------------------------------------------
    // Public API - find / replace
    // -----------------------------------------------------------------

    /**
     * Find `query` in the buffer.
     * @param {string} query
     * @param {Object} [opts]
     * @param {number} [opts.start=0] - Offset to start searching from.
     * @param {boolean} [opts.case_insensitive=false]
     * @returns {?[number, number]} [start, end] match, or null.
     */
    find(query, opts = {}) {
        if (!query) return null;
        let start = opts.start != null ? opts.start : 0;
        let hay = this._text, needle = query;
        if (opts.case_insensitive) {
            hay = hay.toLowerCase();
            needle = needle.toLowerCase();
        }
        let i = hay.indexOf(needle, start);
        return i === -1 ? null : [i, i + query.length];
    }

    /** Return all non-overlapping match ranges for query. */
    find_all(query, opts = {}) {
        let out = [];
        let from = 0;
        while (true) {
            let m = this.find(query, { ...opts, start: from });
            if (!m) break;
            out.push(m);
            from = m[1] > m[0] ? m[1] : m[0] + 1;
        }
        return out;
    }

    /**
     * Replace occurrences of `query` with `replacement`.
     * @param {string} query
     * @param {string} replacement
     * @param {Object} [opts]
     * @param {boolean} [opts.all=false] - Replace all (else first from start).
     * @param {boolean} [opts.case_insensitive=false]
     * @param {number} [opts.start=0]
     * @returns {number} Number of replacements performed.
     */
    replace(query, replacement, opts = {}) {
        if (!query) return 0;
        let matches = opts.all
            ? this.find_all(query, opts)
            : (() => {
                let m = this.find(query, opts);
                return m ? [m] : [];
            })();
        // Apply from the end so earlier offsets stay valid.
        for (let i = matches.length - 1; i >= 0; i--) {
            let [s, e] = matches[i];
            this._replaceRange(s, e, replacement);
        }
        return matches.length;
    }

    /** Clears all text content. */
    clear() {
        this.set_text('');
    }

    // -----------------------------------------------------------------
    // Public API - cursor and selection
    // -----------------------------------------------------------------

    get_cursor() {
        return this._cursor;
    }

    set_cursor(offset) {
        offset = this._clampOffset(offset);
        this._cursor = offset;
        this._selStart = offset;
        this._selEnd = offset;
        this._applySelectionToDOM();
        this.make_callback('cursor_moved', offset);
    }

    /** Returns [start, end] or null if no selection. */
    get_selection() {
        if (this._selStart === this._selEnd) return null;
        return [Math.min(this._selStart, this._selEnd),
                Math.max(this._selStart, this._selEnd)];
    }

    set_selection(start, end) {
        start = this._clampOffset(start);
        end = this._clampOffset(end);
        this._selStart = start;
        this._selEnd = end;
        this._cursor = end;
        this._applySelectionToDOM();
    }

    // -----------------------------------------------------------------
    // Public API - options
    // -----------------------------------------------------------------

    set_editable(tf) {
        this._editable = !!tf;
        this._edit.contentEditable = this._editable ? 'true' : 'false';
    }

    set_wrap(mode) {
        if (!['none', 'hard', 'word'].includes(mode)) {
            throw new Error(`Invalid wrap mode: ${mode}`);
        }
        this._wrap = mode;
        this._applyWrapMode();
        this._render();
    }

    set_line_numbers(tf) {
        this._showLineNumbers = !!tf;
        this._numberGutter.style.display = this._showLineNumbers ? '' : 'none';
        this._render();
    }

    set_icon_gutter(tf) {
        this._showIconGutter = !!tf;
        this._iconGutter.style.display = this._showIconGutter ? '' : 'none';
        this._render();
    }

    /**
     * Set (or clear) the icon for a given 0-based line index.
     * @param {number} line - Line index.
     * @param {string|null} iconUrl - URL of the icon, or null to clear.
     */
    set_icon(line, iconUrl) {
        if (iconUrl == null) {
            delete this._lineIcons[line];
        } else {
            this._lineIcons[line] = iconUrl;
        }
        this._renderIconGutter();
    }

    // -----------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------

    _applyWrapMode() {
        if (this._wrap === 'none') {
            this._edit.style.whiteSpace = 'pre';
            this._edit.style.wordBreak = 'normal';
            this._edit.style.width = 'max-content';
            this._edit.style.minWidth = '';
        } else if (this._wrap === 'hard') {
            // hard wrap: break at any character
            this._edit.style.whiteSpace = 'pre-wrap';
            this._edit.style.wordBreak = 'break-all';
            this._edit.style.width = '';
            this._edit.style.minWidth = '';
        } else { // word wrap
            this._edit.style.whiteSpace = 'pre-wrap';
            this._edit.style.wordBreak = 'normal';
            this._edit.style.width = '';
            this._edit.style.minWidth = '';
        }
    }

    /** Re-render the edit area, line numbers, and icon gutter from the model. */
    _render() {
        this._renderEdit();
        this._renderLineNumbers();
        this._renderIconGutter();
        this._applySelectionToDOM();
        requestAnimationFrame(() => this._syncScrollbars());
    }

    _renderEdit() {
        this._edit.innerHTML = '';
        let text = this._text;
        let lineStart = 0;
        let lineIndex = 0;
        for (let i = 0; i <= text.length; i++) {
            if (i === text.length || text[i] === '\n') {
                let lineEnd = i;
                let div = document.createElement('div');
                div.className = 'textsource-line';
                div.dataset.lineIndex = String(lineIndex);
                if (lineEnd === lineStart) {
                    div.appendChild(document.createElement('br'));
                } else if (this._tags.length === 0) {
                    div.textContent = text.slice(lineStart, lineEnd);
                } else {
                    let segs = this._segmentsForRange(lineStart, lineEnd);
                    for (let seg of segs) {
                        let chunk = text.slice(seg.start, seg.end);
                        if (seg.tags.length === 0) {
                            div.appendChild(document.createTextNode(chunk));
                        } else {
                            let span = document.createElement('span');
                            span.textContent = chunk;
                            this._applyStyleToSpan(span, this._mergedStyle(seg.tags));
                            div.appendChild(span);
                        }
                    }
                }
                this._edit.appendChild(div);
                lineIndex++;
                lineStart = i + 1;
            }
        }
    }

    _renderLineNumbers() {
        if (!this._showLineNumbers) return;
        this._numberGutter.innerHTML = '';
        let numLines = this._text.split('\n').length;
        // Width sized to fit the largest line number
        let maxDigits = String(numLines).length;
        this._numberGutter.style.minWidth = (maxDigits * 0.6 + 1.2) + 'em';
        for (let i = 0; i < numLines; i++) {
            let cell = document.createElement('div');
            cell.className = 'textsource-line-number';
            cell.textContent = String(i + 1);
            cell.addEventListener('click', () => {
                this.make_callback('line_clicked', i);
            });
            this._numberGutter.appendChild(cell);
        }
    }

    _renderIconGutter() {
        if (!this._showIconGutter) return;
        this._iconGutter.innerHTML = '';
        let numLines = this._text.split('\n').length;
        for (let i = 0; i < numLines; i++) {
            let cell = document.createElement('div');
            cell.className = 'textsource-icon-cell';
            if (this._lineIcons[i]) {
                let img = document.createElement('img');
                img.src = this._lineIcons[i];
                img.className = 'textsource-line-icon';
                cell.appendChild(img);
            }
            cell.addEventListener('click', () => {
                this.make_callback('icon_clicked', i);
            });
            this._iconGutter.appendChild(cell);
        }
    }

    // -----------------------------------------------------------------
    // Input handling
    // -----------------------------------------------------------------

    _onBeforeInput(e) {
        if (!this._editable) {
            e.preventDefault();
            return;
        }
        // Figure out the current selection in model offsets
        this._captureSelection();
        let selStart = Math.min(this._selStart, this._selEnd);
        let selEnd = Math.max(this._selStart, this._selEnd);

        let handled = true;
        let insertData = null;
        switch (e.inputType) {
            case 'insertText':
            case 'insertCompositionText':
            case 'insertFromPaste':
            case 'insertFromDrop':
            case 'insertReplacementText':
                insertData = e.data != null ? e.data :
                    (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
                break;
            case 'insertParagraph':
            case 'insertLineBreak':
                insertData = '\n';
                break;
            case 'deleteContentBackward':
            case 'deleteWordBackward':
            case 'deleteSoftLineBackward':
            case 'deleteHardLineBackward':
                if (selStart === selEnd && selStart > 0) {
                    selStart = selStart - 1;
                }
                insertData = '';
                break;
            case 'deleteContentForward':
            case 'deleteWordForward':
            case 'deleteSoftLineForward':
            case 'deleteHardLineForward':
                if (selStart === selEnd && selStart < this._text.length) {
                    selEnd = selStart + 1;
                }
                insertData = '';
                break;
            case 'deleteByCut':
            case 'deleteByDrag':
                // Clipboard/drag payload is handled by the 'cut'/drag event;
                // here we just need to delete the selection through the model.
                insertData = '';
                break;
            default:
                handled = false;
        }
        if (handled) {
            e.preventDefault();
            if (selStart !== selEnd) {
                this.delete_range(selStart, selEnd);
            }
            if (insertData) {
                this.insert_text(selStart, insertData);
            } else {
                this._cursor = selStart;
                this._selStart = selStart;
                this._selEnd = selStart;
                this._applySelectionToDOM();
            }
        }
    }

    _onCopy(e) {
        this._captureSelection();
        let sel = this.get_selection();
        if (!sel) return;
        e.preventDefault();
        let data = this._text.slice(sel[0], sel[1]);
        if (e.clipboardData) e.clipboardData.setData('text/plain', data);
    }

    _onCut(e) {
        this._captureSelection();
        let sel = this.get_selection();
        if (!sel) return;
        e.preventDefault();
        let data = this._text.slice(sel[0], sel[1]);
        if (e.clipboardData) e.clipboardData.setData('text/plain', data);
        if (this._editable) {
            this._replaceRange(sel[0], sel[1], '');
        }
    }

    _onKeyDown(e) {
        // Backspace: handle explicitly so a non-empty selection is
        // deleted, otherwise remove the char before the cursor.
        if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (!this._editable) return;
            e.preventDefault();
            this._captureSelection();
            let s = Math.min(this._selStart, this._selEnd);
            let ee = Math.max(this._selStart, this._selEnd);
            if (s !== ee) {
                this._replaceRange(s, ee, '');
            } else if (s > 0) {
                this._replaceRange(s - 1, s, '');
            }
            return;
        }
        // Undo / redo
        let mod = e.ctrlKey || e.metaKey;
        if (mod && !e.altKey) {
            let key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
                return;
            }
            if ((key === 'z' && e.shiftKey) || key === 'y') {
                e.preventDefault();
                this.redo();
                return;
            }
        }
        // Let the browser handle arrows, home, end, page up/down, etc.
    }

    // -----------------------------------------------------------------
    // DOM <-> model selection mapping
    // -----------------------------------------------------------------

    /** Compute the model offset of a given DOM (node, offset) point. */
    _pointToOffset(node, nodeOffset) {
        // Walk the edit tree, summing text lengths until we hit node.
        let offset = 0;
        let lineDivs = this._edit.children;
        for (let i = 0; i < lineDivs.length; i++) {
            let line = lineDivs[i];
            if (line.contains(node) || line === node) {
                // find offset inside this line
                if (node === line) {
                    // nodeOffset is child index; count text up to it
                    for (let j = 0; j < nodeOffset; j++) {
                        offset += (line.childNodes[j].textContent || '').length;
                    }
                } else {
                    // node is (usually) a text node inside the line
                    offset += this._textBefore(line, node) + nodeOffset;
                }
                return offset;
            }
            // add this line's length plus the newline
            offset += (line.textContent || '').length + 1;
        }
        // fallback: end of text
        return this._text.length;
    }

    _textBefore(container, node) {
        // count text content before `node` within `container`
        let total = 0;
        let walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            if (walker.currentNode === node) return total;
            total += walker.currentNode.textContent.length;
        }
        return total;
    }

    /** Find the DOM (node, offset) point for a given model offset. */
    _offsetToPoint(offset) {
        offset = this._clampOffset(offset);
        let lineDivs = this._edit.children;
        let remaining = offset;
        for (let i = 0; i < lineDivs.length; i++) {
            let line = lineDivs[i];
            let lineLen = (line.textContent || '').length;
            if (remaining <= lineLen) {
                // descend into the line's text node
                let textNode = this._firstTextNode(line);
                if (textNode) {
                    return { node: textNode,
                             offset: Math.min(remaining, textNode.textContent.length) };
                }
                return { node: line, offset: 0 };
            }
            remaining -= (lineLen + 1); // +1 for newline
        }
        // fallback: end of last line
        let last = lineDivs[lineDivs.length - 1];
        if (last) {
            let textNode = this._firstTextNode(last);
            if (textNode) {
                return { node: textNode, offset: textNode.textContent.length };
            }
            return { node: last, offset: 0 };
        }
        return { node: this._edit, offset: 0 };
    }

    _firstTextNode(node) {
        let walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        return walker.nextNode();
    }

    _captureSelection() {
        let sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        let range = sel.getRangeAt(0);
        if (!this._edit.contains(range.startContainer)) return;
        this._selStart = this._pointToOffset(range.startContainer, range.startOffset);
        this._selEnd = this._pointToOffset(range.endContainer, range.endOffset);
        this._cursor = this._selEnd;
    }

    _applySelectionToDOM() {
        let start = this._offsetToPoint(this._selStart);
        let end = this._offsetToPoint(this._selEnd);
        let sel = window.getSelection();
        if (!sel) return;
        try {
            let range = document.createRange();
            range.setStart(start.node, start.offset);
            range.setEnd(end.node, end.offset);
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) {
            // selection can fail transiently during rendering; ignore
        }
    }

    // -----------------------------------------------------------------
    // Scrollbar sync
    // -----------------------------------------------------------------

    _syncScrollbars() {
        let vw = this._editWrap.clientWidth;
        let vh = this._main.clientHeight;
        let cw = this._edit.scrollWidth;
        let ch = this._main.scrollHeight;

        let showH = this._wrap === 'none' && cw > vw + 1;
        let showV = ch > vh + 1;

        this._hScrollBar.get_element().style.display = showH ? '' : 'none';
        this._vScrollBar.get_element().style.display = showV ? '' : 'none';
        this._corner.style.display = (showH && showV) ? '' : 'none';

        if (showH) {
            this._hScrollBar.set_thumb_width(Math.min(1, vw / Math.max(1, cw)));
        }
        if (showV) {
            this._vScrollBar.set_thumb_width(Math.min(1, vh / Math.max(1, ch)));
        }
        this._syncFromScroll();
    }

    /**
     * Sets the scroll position using percentages (0–1).
     * @param {number} h_pct - Horizontal scroll percentage.
     * @param {number} v_pct - Vertical scroll percentage.
     */
    set_scroll_position(h_pct, v_pct) {
        let maxX = this._edit.scrollWidth - this._editWrap.clientWidth;
        let maxY = this._main.scrollHeight - this._main.clientHeight;
        if (maxX > 0) this._editWrap.scrollLeft = h_pct * maxX;
        if (maxY > 0) this._main.scrollTop = v_pct * maxY;
        this._scrollSilent = true;
        this._syncFromScroll();
        this._scrollSilent = false;
    }

    /**
     * Returns the current scroll position as [h_pct, v_pct] (0–1).
     * @returns {number[]}
     */
    get_scroll_position() {
        let maxX = this._edit.scrollWidth - this._editWrap.clientWidth;
        let maxY = this._main.scrollHeight - this._main.clientHeight;
        return [
            maxX > 0 ? this._editWrap.scrollLeft / maxX : 0,
            maxY > 0 ? this._main.scrollTop / maxY : 0,
        ];
    }

    _syncFromScroll() {
        let maxX = this._edit.scrollWidth - this._editWrap.clientWidth;
        let maxY = this._main.scrollHeight - this._main.clientHeight;

        let hPct = maxX > 0 ? this._editWrap.scrollLeft / maxX : 0;
        let vPct = maxY > 0 ? this._main.scrollTop / maxY : 0;

        if (maxX > 0) this._hScrollBar.set_scroll_percent(hPct);
        if (maxY > 0) this._vScrollBar.set_scroll_percent(vPct);

        if (this._scrollTimer) clearTimeout(this._scrollTimer);
        if (this._scrollReady && !this._scrollSilent) {
            this._scrollTimer = setTimeout(() => {
                this._scrollTimer = null;
                this.make_callback('scrolled', hPct, vPct);
            }, 150);
        }
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    // -----------------------------------------------------------------
    // Public API - live refs (TextBufferRef)
    // -----------------------------------------------------------------

    /**
     * Create a live reference to an offset that updates as the buffer
     * is edited.
     * @param {number} offset
     * @param {string} [gravity='right'] - 'left' or 'right'
     * @returns {TextBufferRef}
     */
    create_ref(offset, gravity = 'right') {
        offset = this._clampOffset(offset);
        let ref = new TextBufferRef(this, offset, gravity);
        this._refs.add(ref);
        return ref;
    }

    /** Stop tracking a ref. */
    remove_ref(ref) {
        this._refs.delete(ref);
        ref._valid = false;
    }

    _updateRefsOnInsert(offset, n) {
        for (let ref of this._refs) {
            if (ref._offset > offset ||
                (ref._offset === offset && ref._gravity === 'right')) {
                ref._offset += n;
            }
        }
    }

    _updateRefsOnDelete(start, end) {
        let n = end - start;
        for (let ref of this._refs) {
            if (ref._offset <= start) continue;
            if (ref._offset >= end) {
                ref._offset -= n;
            } else {
                ref._offset = start;
            }
        }
    }

    // -----------------------------------------------------------------
    // Public API - tags
    // -----------------------------------------------------------------

    /**
     * Define (or redefine) a named tag.
     * @param {string} name
     * @param {Object} attrs - Any of: background, foreground, bold,
     *   italic, underline, strikethrough, font_family, font_size.
     */
    create_tag(name, attrs = {}) {
        this._tagDefs.set(name, Object.assign({}, attrs));
        this._render();
    }

    /** Remove a tag definition and all of its applied intervals. */
    remove_tag_def(name) {
        this._tagDefs.delete(name);
        this._tags = this._tags.filter(t => t.name !== name);
        this._render();
    }

    /** Apply a previously-defined tag to a range. */
    apply_tag(name, start, end) {
        if (!this._tagDefs.has(name)) {
            throw new Error(`Unknown tag: ${name}`);
        }
        start = this._clampOffset(start);
        end = this._clampOffset(end);
        if (start > end) [start, end] = [end, start];
        if (start === end) return;
        this._addTagInterval(name, start, end);
        this._render();
    }

    _addTagInterval(name, start, end) {
        this._tags.push({ name, start, end, seq: ++this._tagSeq });
    }

    /** Remove (clip out) a tag from the given range. */
    remove_tag(name, start, end) {
        start = this._clampOffset(start);
        end = this._clampOffset(end);
        if (start > end) [start, end] = [end, start];
        let next = [];
        for (let t of this._tags) {
            if (t.name !== name || t.end <= start || t.start >= end) {
                next.push(t);
                continue;
            }
            if (t.start < start) {
                next.push({ name: t.name, start: t.start, end: start, seq: t.seq });
            }
            if (t.end > end) {
                next.push({ name: t.name, start: end, end: t.end, seq: t.seq });
            }
        }
        this._tags = next;
        this._render();
    }

    /** Returns an array of tag names active at the given offset. */
    get_tags_at(offset) {
        let names = new Set();
        for (let t of this._tags) {
            if (t.start <= offset && offset < t.end) names.add(t.name);
        }
        return Array.from(names);
    }

    _updateTagsOnInsert(offset, n) {
        for (let t of this._tags) {
            if (t.start >= offset) t.start += n;
            if (t.end > offset || (t.end === offset && t.start === t.end)) {
                t.end += n;
            } else if (t.end > offset) {
                t.end += n;
            }
        }
        // Cleanup pass: ensure end >= start
        for (let t of this._tags) if (t.end < t.start) t.end = t.start;
    }

    _updateTagsOnDelete(start, end) {
        let n = end - start;
        let next = [];
        for (let t of this._tags) {
            let s = t.start, e = t.end;
            if (e <= start) { next.push(t); continue; }
            if (s >= end) {
                next.push({ name: t.name, start: s - n, end: e - n, seq: t.seq });
                continue;
            }
            // overlap
            let ns = s < start ? s : start;
            let ne = e > end ? e - n : start;
            if (ne > ns) {
                next.push({ name: t.name, start: ns, end: ne, seq: t.seq });
            }
        }
        this._tags = next;
    }

    // -----------------------------------------------------------------
    // Styled rendering helpers
    // -----------------------------------------------------------------

    /**
     * For a given line span [lineStart, lineEnd) (in absolute offsets),
     * return an array of segments [{start, end, names: [...]}, ...]
     * covering the entire range.
     */
    _segmentsForRange(lineStart, lineEnd) {
        // Collect tag boundary points within the line
        let points = new Set([lineStart, lineEnd]);
        let active = [];
        for (let t of this._tags) {
            if (t.end <= lineStart || t.start >= lineEnd) continue;
            active.push(t);
            points.add(Math.max(t.start, lineStart));
            points.add(Math.min(t.end, lineEnd));
        }
        let sorted = Array.from(points).sort((a, b) => a - b);
        let segs = [];
        for (let i = 0; i < sorted.length - 1; i++) {
            let s = sorted[i], e = sorted[i + 1];
            if (s >= e) continue;
            // Find tags covering this segment, ordered by seq (last wins).
            let inSeg = active.filter(t => t.start <= s && t.end >= e);
            inSeg.sort((a, b) => a.seq - b.seq);
            segs.push({ start: s, end: e, tags: inSeg.map(t => t.name) });
        }
        return segs;
    }

    /** Compute merged CSS style object for a list of tag names. */
    _mergedStyle(tagNames) {
        let merged = {};
        for (let name of tagNames) {
            let attrs = this._tagDefs.get(name);
            if (!attrs) continue;
            for (let k of Object.keys(attrs)) merged[k] = attrs[k];
        }
        return merged;
    }

    _applyStyleToSpan(span, attrs) {
        if (attrs.background != null) span.style.background = attrs.background;
        if (attrs.foreground != null) span.style.color = attrs.foreground;
        if (attrs.bold) span.style.fontWeight = 'bold';
        if (attrs.italic) span.style.fontStyle = 'italic';
        let deco = [];
        if (attrs.underline) deco.push('underline');
        if (attrs.strikethrough) deco.push('line-through');
        if (deco.length) span.style.textDecoration = deco.join(' ');
        if (attrs.font_family != null) span.style.fontFamily = attrs.font_family;
        if (attrs.font_size != null) span.style.fontSize = attrs.font_size + 'px';
    }

    // -----------------------------------------------------------------
    // Scroll-to helpers
    // -----------------------------------------------------------------

    /** Scroll the view so that the given ref (or offset) is visible. */
    scroll_to(refOrOffset) {
        let offset = (refOrOffset && typeof refOrOffset.get_offset === 'function')
            ? refOrOffset.get_offset() : refOrOffset;
        offset = this._clampOffset(offset);
        // Determine line index of offset
        let line = 0;
        for (let i = 0; i < offset; i++) {
            if (this._text[i] === '\n') line++;
        }
        let lineDiv = this._edit.children[line];
        if (lineDiv && lineDiv.scrollIntoView) {
            lineDiv.scrollIntoView({ block: 'nearest' });
            this._syncFromScroll();
        }
    }

    /** Scroll so the cursor is visible. */
    scroll_to_cursor() {
        this.scroll_to(this._cursor);
    }

    _clampOffset(offset) {
        if (offset < 0) return 0;
        if (offset > this._text.length) return this._text.length;
        return offset;
    }
}

export { TextSource, TextBufferRef };
