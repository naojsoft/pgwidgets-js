"use_strict";

import {Callback} from "./Callback.js";
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
class TextBufferRef extends Callback {
    constructor(buffer, offset, gravity = 'right') {
        super();
        this._buffer = buffer;
        this._offset = buffer._clampOffset(offset);
        this._gravity = gravity;
        this._valid = true;
        this.enable_callback('invalidated');
        // Auto-track in the buffer's weak ref set.  Doing this in the
        // constructor (rather than only in buffer.create_ref) means
        // refs minted via the remote-interface ``create`` message —
        // which calls ``new TextBufferRef(...)`` directly — also get
        // tracked.  The WeakRef wrapper does not pin the ref alive;
        // a FinalizationRegistry on the buffer prunes dead WeakRef
        // shells once the underlying ref is GC'd.
        let weakRef = new WeakRef(this);
        this._weakRef = weakRef;
        buffer._refs.add(weakRef);
        buffer._refRegistry.register(this, weakRef, this);
    }

    // -----------------------------------------------------------------
    // Inspection
    // -----------------------------------------------------------------

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

    /** Returns the 0-based line number this ref is on. */
    get_line() {
        return this._buffer._lineOfOffset(this._offset);
    }

    // -----------------------------------------------------------------
    // Mutation — position
    // -----------------------------------------------------------------

    /**
     * Set this ref to *offset* in the buffer.  Out-of-range values
     * are clamped to ``[0, length]``.
     * @param {number} offset
     */
    set_offset(offset) {
        this._checkValid();
        this._setOffset(offset);
    }

    /**
     * Set this ref to the start of line *lineno* (0-based).  Past
     * the last line clamps to the end of the buffer; negative
     * values clamp to 0.
     * @param {number} lineno
     */
    set_line(lineno) {
        this._checkValid();
        this._setOffset(this._offsetOfLineStart(lineno));
    }

    /**
     * Move this ref to the same offset as *other*.  Both refs must
     * belong to the same buffer.
     * @param {TextBufferRef} other
     */
    to_ref(other) {
        this._checkValid();
        if (!(other instanceof TextBufferRef)) {
            throw new TypeError("to_ref requires a TextBufferRef");
        }
        if (other._buffer !== this._buffer) {
            throw new Error(
                "TextBufferRef belongs to a different TextSource");
        }
        if (!other._valid) {
            throw new Error(
                "Source TextBufferRef has been invalidated");
        }
        this._setOffset(other._offset);
    }

    /**
     * Returns a new live ref pointing at this ref's current offset
     * with the same gravity.  The new ref is tracked by the buffer
     * — caller should ``remove_ref(...)`` it when done.
     * @returns {TextBufferRef}
     */
    copy() {
        this._checkValid();
        return this._buffer.create_ref(this._offset, this._gravity);
    }

    // -----------------------------------------------------------------
    // Mutation — relative movement
    // -----------------------------------------------------------------

    /** Move to the start of the line this ref is on. */
    to_line_start() {
        this._checkValid();
        this._setOffset(this._offsetOfLineStart(this.get_line()));
    }

    /**
     * Move to the end of the line this ref is on (the offset of the
     * trailing ``\n``, or the buffer length on the last line).
     */
    to_line_end() {
        this._checkValid();
        let text = this._buffer.get_text();
        let i = text.indexOf('\n', this._offset);
        if (i === -1) i = text.length;
        this._setOffset(i);
    }

    /**
     * Move to the start of the next line.  No-op if already on the
     * last line.
     */
    to_next_line() {
        this._checkValid();
        let text = this._buffer.get_text();
        let i = text.indexOf('\n', this._offset);
        if (i === -1) return;
        this._setOffset(i + 1);
    }

    /**
     * Move to the start of the previous line.  No-op if already on
     * the first line.
     */
    to_prev_line() {
        this._checkValid();
        let line = this.get_line();
        if (line === 0) return;
        this._setOffset(this._offsetOfLineStart(line - 1));
    }

    /** Move forward one character.  Clamped at the buffer end. */
    to_next_char() {
        this._checkValid();
        this._setOffset(this._offset + 1);
    }

    /** Move backward one character.  Clamped at 0. */
    to_prev_char() {
        this._checkValid();
        this._setOffset(this._offset - 1);
    }

    // -----------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------

    /** @private */
    _checkValid() {
        if (!this._valid) {
            throw new Error("TextBufferRef has been invalidated");
        }
    }

    /**
     * Update offset (clamped to [0, length]).  If this ref carries
     * an icon, re-render the gutter so the icon follows.
     * @private
     */
    _setOffset(newOffset) {
        let len = this._buffer.get_length();
        if (newOffset < 0) newOffset = 0;
        if (newOffset > len) newOffset = len;
        if (newOffset === this._offset) return;
        this._offset = newOffset;
        if (this._buffer._iconRefs.has(this)) {
            this._buffer._renderIconGutter();
        }
    }

    /**
     * Returns the absolute offset of the start of line *lineno*
     * (0-based).  Delegates to the buffer's helper so the two
     * implementations stay in sync.
     * @private
     */
    _offsetOfLineStart(lineno) {
        return this._buffer._offsetOfLineStart(lineno);
    }

    /**
     * Mark the ref invalid and fire ``'invalidated'``.  Called by
     * the owning buffer's removal / reset paths; not part of the
     * public API.
     * @private
     */
    _invalidate() {
        if (!this._valid) return;
        this._valid = false;
        this.make_callback('invalidated');
    }

    /**
     * Tear down the ref: detach from the buffer's tracking sets and
     * unregister from the Callback registry.  After ``destroy()``
     * the ref is unusable; this is the entry point that the
     * remote-interface uses when a Python wrapper goes away.
     */
    destroy() {
        if (this._destroyed) return;
        if (this._buffer && this._valid) {
            this._buffer.remove_ref(this);
        }
        super.destroy();
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
        this.get_selection_range = this.get_selection_range.bind(this);
        this.set_selection_range = this.set_selection_range.bind(this);
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
        // Icon registrations: Map<TextBufferRef, url>.  A ref's
        // current offset → line drives the displayed icon, so icons
        // follow their ref as text is inserted/deleted before them.
        this._iconRefs = new Map();
        // Cursor offset and selection (offsets into _text)
        this._cursor = 0;
        this._selStart = 0;
        this._selEnd = 0;

        // -- live refs and tags --
        // Universal tracking set for TextBufferRef instances.  Each
        // entry is a WeakRef wrapper so refs the user no longer
        // holds (and that nothing else in the buffer is anchoring,
        // such as _namedRefs or _iconRefs) become eligible for GC
        // without an explicit remove_ref call.  A
        // FinalizationRegistry callback prunes dead WeakRef shells
        // after the underlying ref is collected.
        this._refs = new Set();
        this._refRegistry = new FinalizationRegistry((weakRef) => {
            this._refs.delete(weakRef);
        });
        // Named refs: name -> TextBufferRef.  Each named ref is also
        // a member of _refs (so it participates in edit tracking).
        // The Map holds its values strongly, so a named ref stays
        // alive until remove_named_ref / set_text drops the binding
        // — even if the user no longer has their own reference to it.
        this._namedRefs = new Map();
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
        for (let weakRef of this._refs) {
            let ref = weakRef.deref();
            if (ref == null) continue;
            ref._offset = 0;
            // Drop the registry entry so the finalizer doesn't fire
            // later and try to delete an already-cleared bucket.
            this._refRegistry.unregister(ref);
            ref._invalidate();
        }
        this._refs.clear();
        // Drop named-ref bindings; the underlying refs were just
        // invalidated above.  Caller must re-create any named refs
        // they need after a destructive set_text.
        this._namedRefs.clear();
        // Drop icon registrations along with the refs that anchored
        // them; the user must re-register icons against fresh refs
        // after a destructive set_text.
        this._iconRefs.clear();
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
     * Returns the buffer text between *startRef* and *endRef* as a
     * plain string.  The smaller offset becomes the start, the
     * larger the end.
     * @param {TextBufferRef} startRef
     * @param {TextBufferRef} endRef
     * @returns {string}
     */
    get_text_range(startRef, endRef) {
        let start = this._offsetOf(startRef);
        let end = this._offsetOf(endRef);
        if (start > end) [start, end] = [end, start];
        return this._text.slice(start, end);
    }

    /**
     * Resolve a TextBufferRef to its current offset.  Throws if
     * *ref* is not a TextBufferRef belonging to this buffer or has
     * been invalidated.  Internal entry point for every ref-taking
     * method on the public API.
     * @private
     * @param {TextBufferRef} ref
     * @returns {number}
     */
    _offsetOf(ref) {
        if (!(ref instanceof TextBufferRef)) {
            throw new TypeError(
                "TextSource API requires a TextBufferRef "
                + "(got " + typeof ref + ")");
        }
        if (ref._buffer !== this) {
            throw new Error(
                "TextBufferRef belongs to a different TextSource");
        }
        if (!ref._valid) {
            throw new Error("TextBufferRef has been invalidated");
        }
        return this._clampOffset(ref._offset);
    }

    /**
     * Inserts text at the given ref position.  The ref's own offset
     * may shift after the call according to its gravity (right-
     * gravity refs end up after the inserted text).
     * @param {TextBufferRef} ref - Position at which to insert.
     * @param {string} text - The text to insert.
     * @param {string[]} [tags] - Tag names to apply to the inserted
     *   range.
     */
    insert_text(ref, text, tags = null) {
        if (text == null || text === '') return;
        let offset = this._offsetOf(ref);
        this._replaceRange(offset, offset, text, { tags });
    }

    /**
     * Deletes the text between *startRef* and *endRef* (the smaller
     * offset becomes the start, the larger the end).
     * @param {TextBufferRef} startRef
     * @param {TextBufferRef} endRef
     */
    delete_range(startRef, endRef) {
        let start = this._offsetOf(startRef);
        let end = this._offsetOf(endRef);
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
     * Find ``query`` in the buffer.
     * @param {string} query
     * @param {Object} [opts]
     * @param {TextBufferRef} [opts.start] - Position to start
     *   searching from.  Defaults to the start of the buffer.
     * @param {boolean} [opts.case_insensitive=false]
     * @returns {?[TextBufferRef, TextBufferRef]} ``[startRef, endRef]``
     *   for the match, or ``null`` if no match was found.  The
     *   returned refs are live and tracked by this buffer.
     */
    find(query, opts = {}) {
        if (!query) return null;
        let m = this._findOffset(query, opts);
        if (m === null) return null;
        return [this.create_ref(m[0], 'right'),
                this.create_ref(m[1], 'right')];
    }

    /**
     * Internal find that returns offsets — used by replace() and as
     * the building block for find()/find_all().  Avoids the cost of
     * minting refs for matches that callers will only consume as
     * offsets (replace operates on offsets).
     * @private
     */
    _findOffset(query, opts = {}) {
        if (!query) return null;
        let start = 0;
        if (opts.start != null) start = this._offsetOf(opts.start);
        let hay = this._text, needle = query;
        if (opts.case_insensitive) {
            hay = hay.toLowerCase();
            needle = needle.toLowerCase();
        }
        let i = hay.indexOf(needle, start);
        return i === -1 ? null : [i, i + query.length];
    }

    /**
     * Return all non-overlapping matches for ``query`` as ref pairs.
     * @returns {Array<[TextBufferRef, TextBufferRef]>}
     */
    find_all(query, opts = {}) {
        let offsets = this._findAllOffsets(query, opts);
        return offsets.map(([s, e]) =>
            [this.create_ref(s, 'right'), this.create_ref(e, 'right')]);
    }

    /** @private */
    _findAllOffsets(query, opts = {}) {
        let out = [];
        let from = 0;
        if (opts.start != null) from = this._offsetOf(opts.start);
        let hay = this._text, needle = query;
        let ci = !!opts.case_insensitive;
        if (ci) {
            hay = hay.toLowerCase();
            needle = needle.toLowerCase();
        }
        while (true) {
            if (!needle) break;
            let i = hay.indexOf(needle, from);
            if (i === -1) break;
            out.push([i, i + query.length]);
            from = i + query.length > i ? i + query.length : i + 1;
        }
        return out;
    }

    /**
     * Replace occurrences of ``query`` with ``replacement``.
     * @param {string} query
     * @param {string} replacement
     * @param {Object} [opts]
     * @param {boolean} [opts.all=false] - Replace all (else first from start).
     * @param {boolean} [opts.case_insensitive=false]
     * @param {TextBufferRef} [opts.start] - Position to start
     *   searching from.  Defaults to the start of the buffer.
     * @returns {number} Number of replacements performed.
     */
    replace(query, replacement, opts = {}) {
        if (!query) return 0;
        let matches = opts.all
            ? this._findAllOffsets(query, opts)
            : (() => {
                let m = this._findOffset(query, opts);
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

    /**
     * Return a fresh, live ref to the current cursor position.
     * @returns {TextBufferRef}
     */
    get_cursor() {
        return this.create_ref(this._cursor, 'right');
    }

    /**
     * Move the cursor (and clear any selection) to the position of
     * *ref*.
     * @param {TextBufferRef} ref
     */
    set_cursor(ref) {
        let offset = this._offsetOf(ref);
        this._cursor = offset;
        this._selStart = offset;
        this._selEnd = offset;
        this._applySelectionToDOM();
        this.make_callback('cursor_moved', this.create_ref(offset, 'right'));
    }

    /**
     * Returns ``[startRef, endRef]`` for the current selection (smaller
     * offset first), or ``null`` if there is no selection.  Both refs
     * are fresh and tracked.
     * @returns {?[TextBufferRef, TextBufferRef]}
     */
    get_selection_range() {
        if (this._selStart === this._selEnd) return null;
        let s = Math.min(this._selStart, this._selEnd);
        let e = Math.max(this._selStart, this._selEnd);
        return [this.create_ref(s, 'right'),
                this.create_ref(e, 'right')];
    }

    /**
     * Set the selection to span ``[startRef, endRef]``.  The cursor
     * lands at *endRef*'s position.
     * @param {TextBufferRef} startRef
     * @param {TextBufferRef} endRef
     */
    set_selection_range(startRef, endRef) {
        let start = this._offsetOf(startRef);
        let end = this._offsetOf(endRef);
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
     * Set (or clear) the icon associated with a TextBufferRef.  The
     * icon is displayed on the line that contains the ref's current
     * offset, so it follows the ref as text is inserted or deleted
     * before it.  Pass ``iconUrl = null`` to remove the icon for a
     * previously-registered ref.
     *
     * Multiple refs may map to the same line; the most recently
     * registered ref's icon wins for that line.
     *
     * @param {TextBufferRef} ref
     * @param {string|null} iconUrl
     */
    set_icon(ref, iconUrl) {
        if (!(ref instanceof TextBufferRef)) {
            throw new TypeError("set_icon requires a TextBufferRef");
        }
        if (ref._buffer !== this) {
            throw new Error(
                "TextBufferRef belongs to a different TextSource");
        }
        if (iconUrl == null) {
            this._iconRefs.delete(ref);
        } else {
            this._iconRefs.set(ref, iconUrl);
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
        // Resolve each registered ref to a (line, url) pair.  Refs
        // are visited in insertion order; later registrations on the
        // same line replace earlier ones, so the most recent ref
        // wins.  We also track which ref is "active" on each line so
        // the click callback can pass it to the user.
        let urlPerLine = {};
        let refPerLine = {};
        for (let [ref, url] of this._iconRefs) {
            if (!ref._valid) continue;
            let line = this._lineOfOffset(ref._offset);
            urlPerLine[line] = url;
            refPerLine[line] = ref;
        }
        let numLines = this._text.split('\n').length;
        for (let i = 0; i < numLines; i++) {
            let cell = document.createElement('div');
            cell.className = 'textsource-icon-cell';
            if (urlPerLine[i] != null) {
                let img = document.createElement('img');
                img.src = urlPerLine[i];
                img.className = 'textsource-line-icon';
                cell.appendChild(img);
            }
            // Capture the current line index in a closure variable so
            // the click handler reports the line at click time, not
            // re-render time.
            let line = i;
            cell.addEventListener('click', () => {
                let activeRef = refPerLine[line] || null;
                this.make_callback('icon_clicked', line, activeRef);
            });
            this._iconGutter.appendChild(cell);
        }
    }

    /** @private Compute the 0-based line number of a buffer offset. */
    _lineOfOffset(offset) {
        let line = 0;
        let n = Math.min(offset, this._text.length);
        for (let i = 0; i < n; i++) {
            if (this._text[i] === '\n') line++;
        }
        return line;
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

    /**
     * Internal helper: return the current selection as an offset
     * pair [start, end] (smaller offset first), or null if there's
     * no selection.  The public ``get_selection_range`` returns refs
     * — internal callers (input handlers, copy/cut) want raw offsets.
     * @private
     */
    _selectionOffsets() {
        if (this._selStart === this._selEnd) return null;
        return [Math.min(this._selStart, this._selEnd),
                Math.max(this._selStart, this._selEnd)];
    }

    _onCopy(e) {
        this._captureSelection();
        let sel = this._selectionOffsets();
        if (!sel) return;
        e.preventDefault();
        let data = this._text.slice(sel[0], sel[1]);
        if (e.clipboardData) e.clipboardData.setData('text/plain', data);
    }

    _onCut(e) {
        this._captureSelection();
        let sel = this._selectionOffsets();
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
            this._hScrollBar.set_thumb_percent(Math.min(1, vw / Math.max(1, cw)));
        }
        if (showV) {
            this._vScrollBar.set_thumb_percent(Math.min(1, vh / Math.max(1, ch)));
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
        // Registration with this._refs / _refRegistry happens in the
        // TextBufferRef constructor so refs minted via the remote-
        // interface ``create`` path are tracked the same way.
        return new TextBufferRef(this, offset, gravity);
    }

    /** Stop tracking a ref.  Fires ``'invalidated'`` on the ref. */
    remove_ref(ref) {
        if (!ref._valid) return;
        if (ref._weakRef) {
            this._refs.delete(ref._weakRef);
            this._refRegistry.unregister(ref);
        }
        // If this ref happens to be a named ref, drop the binding so
        // get_named_ref doesn't return an invalidated handle.  The
        // common case (no named refs) skips the loop after the first
        // bucket check.
        if (this._namedRefs.size > 0) {
            for (let [name, r] of this._namedRefs) {
                if (r === ref) {
                    this._namedRefs.delete(name);
                    break;
                }
            }
        }
        ref._invalidate();
    }

    /**
     * Create a tracked ref bound to *name*.  If a ref with that name
     * already exists, it is removed (and invalidated) first so the
     * binding always resolves to the new position.
     *
     * Named refs participate in edit tracking exactly like anonymous
     * refs from ``create_ref``; the only difference is that the
     * buffer remembers them by name and you can look them up later
     * with ``get_named_ref(name)``.
     *
     * @param {string} name
     * @param {number} offset
     * @param {string} [gravity='right']
     * @returns {TextBufferRef}
     */
    create_named_ref(name, offset, gravity = 'right') {
        // Replace any existing binding so the name always resolves
        // to the new ref.  Use remove_ref so the old ref is also
        // invalidated, preventing dangling handles in user code.
        let existing = this._namedRefs.get(name);
        if (existing != null) {
            this.remove_ref(existing);
        }
        let ref = this.create_ref(offset, gravity);
        this._namedRefs.set(name, ref);
        return ref;
    }

    /**
     * Look up a previously-named ref.
     * @param {string} name
     * @returns {?TextBufferRef} The ref, or ``null`` if none is
     *   bound to *name*.
     */
    get_named_ref(name) {
        let ref = this._namedRefs.get(name);
        return ref == null ? null : ref;
    }

    /**
     * Remove the named binding (if any) and invalidate the ref it
     * points at.  No-op if no ref is bound to *name*.
     * @param {string} name
     */
    remove_named_ref(name) {
        let ref = this._namedRefs.get(name);
        if (ref == null) return;
        this._namedRefs.delete(name);
        // Drop the WeakRef bookkeeping then fire 'invalidated'.
        if (ref._weakRef) {
            this._refs.delete(ref._weakRef);
            this._refRegistry.unregister(ref);
        }
        ref._invalidate();
    }

    /** Returns a fresh live ref pointing at offset 0. */
    get_ref_start() {
        return this.create_ref(0, 'right');
    }

    /** Returns a fresh live ref pointing at the end of the buffer. */
    get_ref_end() {
        return this.create_ref(this._text.length, 'right');
    }

    /**
     * Returns ``[startRef, endRef]`` covering the entire buffer.
     * Both refs are fresh and tracked.
     * @returns {[TextBufferRef, TextBufferRef]}
     */
    get_ref_bounds() {
        return [this.get_ref_start(), this.get_ref_end()];
    }

    /**
     * Returns a fresh live ref at the start of line *lineno*
     * (0-based).  Past the last line the ref is clamped to the end
     * of the buffer; negative *lineno* clamps to 0.
     * @param {number} lineno
     * @returns {TextBufferRef}
     */
    get_ref_line_start(lineno) {
        return this.create_ref(this._offsetOfLineStart(lineno), 'right');
    }

    /**
     * Returns a fresh live ref at the end of line *lineno* (the
     * offset of the trailing newline, or the buffer length on the
     * last line).
     * @param {number} lineno
     * @returns {TextBufferRef}
     */
    get_ref_line_end(lineno) {
        let start = this._offsetOfLineStart(lineno);
        let nl = this._text.indexOf('\n', start);
        let end = nl === -1 ? this._text.length : nl;
        return this.create_ref(end, 'right');
    }

    /**
     * @private Offset of the start of line *lineno* (0-based).
     * Past the last line returns the buffer length; negative
     * values return 0.  Used by get_ref_line_start/end and by
     * TextBufferRef navigation helpers.
     */
    _offsetOfLineStart(lineno) {
        if (lineno <= 0) return 0;
        let off = 0;
        for (let i = 0; i < lineno; i++) {
            let nl = this._text.indexOf('\n', off);
            if (nl === -1) return this._text.length;
            off = nl + 1;
        }
        return off;
    }

    _updateRefsOnInsert(offset, n) {
        for (let weakRef of this._refs) {
            let ref = weakRef.deref();
            if (ref == null) continue;
            if (ref._offset > offset ||
                (ref._offset === offset && ref._gravity === 'right')) {
                ref._offset += n;
            }
        }
    }

    _updateRefsOnDelete(start, end) {
        let n = end - start;
        for (let weakRef of this._refs) {
            let ref = weakRef.deref();
            if (ref == null) continue;
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

    /**
     * Returns true if any interval of *name* is currently applied
     * anywhere in the buffer.  This is an O(n) scan of the tag-
     * interval list, not a search of the buffer text — fast even
     * on large documents.
     * @param {string} name
     * @returns {boolean}
     */
    has_tag(name) {
        return this._tags.some(t => t.name === name);
    }

    /**
     * Apply a previously-defined tag to the range [startRef, endRef).
     * @param {string} name
     * @param {TextBufferRef} startRef
     * @param {TextBufferRef} endRef
     */
    apply_tag(name, startRef, endRef) {
        if (!this._tagDefs.has(name)) {
            throw new Error(`Unknown tag: ${name}`);
        }
        let start = this._offsetOf(startRef);
        let end = this._offsetOf(endRef);
        if (start > end) [start, end] = [end, start];
        if (start === end) return;
        this._addTagInterval(name, start, end);
        this._render();
    }

    _addTagInterval(name, start, end) {
        this._tags.push({ name, start, end, seq: ++this._tagSeq });
    }

    /**
     * Replace the entire applied-tag interval list with *intervals*
     * (an array of ``{name, start, end}``).  Used by the remote-
     * interface reconstruction path: rather than mint throwaway
     * refs and call ``apply_tag`` per interval, the Python side
     * pushes the full list once.  Each interval gets a fresh
     * ``seq``.  Existing intervals are dropped.  Tag *definitions*
     * are unaffected — call ``create_tag`` for those first.
     * @private
     * @param {Array<{name: string, start: number, end: number}>} intervals
     */
    _restoreTagIntervals(intervals) {
        this._tags = [];
        for (let it of intervals) {
            if (!this._tagDefs.has(it.name)) continue;
            let s = this._clampOffset(it.start);
            let e = this._clampOffset(it.end);
            if (s >= e) continue;
            this._tags.push({name: it.name, start: s, end: e,
                             seq: ++this._tagSeq});
        }
        this._render();
    }

    /**
     * Bind *name* to an existing tracked ref, without minting a new
     * one.  Used by the reconstruction path so a ref recreated via
     * the ``create`` handshake (which preserves its original wid)
     * can be re-attached to its name.  Mirrors what the second half
     * of ``create_named_ref`` does.  No-op for a ref that doesn't
     * belong to this buffer.
     * @private
     * @param {string} name
     * @param {TextBufferRef} ref
     */
    _bindNamedRef(name, ref) {
        if (!(ref instanceof TextBufferRef)) return;
        if (ref._buffer !== this) return;
        if (!ref._valid) return;
        // Drop any pre-existing ref with this name (the
        // reconstruction caller is responsible for not re-using a
        // name they're also rebinding to a different ref).
        let existing = this._namedRefs.get(name);
        if (existing != null && existing !== ref) {
            this.remove_ref(existing);
        }
        this._namedRefs.set(name, ref);
    }

    /**
     * Remove (clip out) a tag from the range [startRef, endRef).
     * @param {string} name
     * @param {TextBufferRef} startRef
     * @param {TextBufferRef} endRef
     */
    remove_tag(name, startRef, endRef) {
        let start = this._offsetOf(startRef);
        let end = this._offsetOf(endRef);
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

    /**
     * Returns an array of tag names active at the position of *ref*.
     * @param {TextBufferRef} ref
     * @returns {string[]}
     */
    get_tags_at(ref) {
        let offset = this._offsetOf(ref);
        let names = new Set();
        for (let t of this._tags) {
            if (t.start <= offset && offset < t.end) names.add(t.name);
        }
        return Array.from(names);
    }

    /**
     * Returns an array of tag names that are active at any offset
     * within [startRef, endRef).  A tag is included if its interval
     * overlaps the queried range at all.
     * @param {TextBufferRef} startRef
     * @param {TextBufferRef} endRef
     * @returns {string[]}
     */
    get_tags_range(startRef, endRef) {
        let start = this._offsetOf(startRef);
        let end = this._offsetOf(endRef);
        if (start > end) [start, end] = [end, start];
        let names = new Set();
        for (let t of this._tags) {
            if (t.end <= start || t.start >= end) continue;
            names.add(t.name);
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

    /**
     * Scroll the view so that the line containing *ref* is visible.
     * @param {TextBufferRef} ref
     */
    scroll_to_ref(ref) {
        let offset = this._offsetOf(ref);
        let line = this._lineOfOffset(offset);
        let lineDiv = this._edit.children[line];
        if (lineDiv && lineDiv.scrollIntoView) {
            lineDiv.scrollIntoView({ block: 'nearest' });
            this._syncFromScroll();
        }
    }

    /** Scroll so the cursor is visible. */
    scroll_to_cursor() {
        let line = this._lineOfOffset(this._cursor);
        let lineDiv = this._edit.children[line];
        if (lineDiv && lineDiv.scrollIntoView) {
            lineDiv.scrollIntoView({ block: 'nearest' });
            this._syncFromScroll();
        }
    }

    _clampOffset(offset) {
        if (offset < 0) return 0;
        if (offset > this._text.length) return this._text.length;
        return offset;
    }
}

export { TextSource, TextBufferRef };
