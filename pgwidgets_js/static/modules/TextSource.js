"use_strict";

import {Widget} from "./Widget.js";
import {ScrollBar} from "./ScrollBar.js";

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
        this._syncScrollbars = this._syncScrollbars.bind(this);
        this._syncFromScroll = this._syncFromScroll.bind(this);

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
        });
        this._hScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._edit.scrollWidth - this._editWrap.clientWidth;
            this._editWrap.scrollLeft = Math.max(0, pct * maxScroll);
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

        // -- input handling --
        // We intercept beforeinput so all edits go through the model first.
        this._edit.addEventListener('beforeinput', (e) => this._onBeforeInput(e));
        this._edit.addEventListener('keydown', (e) => this._onKeyDown(e));
        // Keep cursor/selection in sync
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === this._edit) {
                this._captureSelection();
            }
        });
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
    insert_text(offset, text) {
        if (text == null || text === '') return;
        offset = this._clampOffset(offset);
        this._text = this._text.slice(0, offset) + text +
                     this._text.slice(offset);
        // shift cursor/selection if the insert was at or before it
        let n = text.length;
        if (this._cursor >= offset) this._cursor += n;
        if (this._selStart >= offset) this._selStart += n;
        if (this._selEnd >= offset) this._selEnd += n;
        this._render();
        this.make_callback('changed');
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
        this._text = this._text.slice(0, start) + this._text.slice(end);
        let n = end - start;
        // update cursor/selection
        let adjust = (o) => {
            if (o <= start) return o;
            if (o >= end) return o - n;
            return start;
        };
        this._cursor = adjust(this._cursor);
        this._selStart = adjust(this._selStart);
        this._selEnd = adjust(this._selEnd);
        this._render();
        this.make_callback('changed');
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
            this._edit.style.minWidth = '100%';
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
        // Split text into lines and render each as a separate div for
        // predictable line heights and line-number alignment.
        this._edit.innerHTML = '';
        let lines = this._text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            let div = document.createElement('div');
            div.className = 'textsource-line';
            div.dataset.lineIndex = String(i);
            if (lines[i] === '') {
                // Empty line - use a <br> so the line has measurable height
                div.appendChild(document.createElement('br'));
            } else {
                div.textContent = lines[i];
            }
            this._edit.appendChild(div);
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
        switch (e.inputType) {
            case 'insertText':
            case 'insertCompositionText':
            case 'insertFromPaste':
            case 'insertFromDrop':
            case 'insertReplacementText': {
                let data = e.data != null ? e.data :
                           (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
                if (selStart !== selEnd) {
                    this._text = this._text.slice(0, selStart) +
                                 data + this._text.slice(selEnd);
                } else {
                    this._text = this._text.slice(0, selStart) + data +
                                 this._text.slice(selStart);
                }
                let newPos = selStart + data.length;
                this._cursor = newPos;
                this._selStart = newPos;
                this._selEnd = newPos;
                break;
            }
            case 'insertParagraph':
            case 'insertLineBreak': {
                this._text = this._text.slice(0, selStart) + '\n' +
                             this._text.slice(selEnd);
                let newPos = selStart + 1;
                this._cursor = newPos;
                this._selStart = newPos;
                this._selEnd = newPos;
                break;
            }
            case 'deleteContentBackward': {
                if (selStart !== selEnd) {
                    this._text = this._text.slice(0, selStart) +
                                 this._text.slice(selEnd);
                    this._cursor = selStart;
                } else if (selStart > 0) {
                    this._text = this._text.slice(0, selStart - 1) +
                                 this._text.slice(selStart);
                    this._cursor = selStart - 1;
                }
                this._selStart = this._cursor;
                this._selEnd = this._cursor;
                break;
            }
            case 'deleteContentForward': {
                if (selStart !== selEnd) {
                    this._text = this._text.slice(0, selStart) +
                                 this._text.slice(selEnd);
                    this._cursor = selStart;
                } else if (selStart < this._text.length) {
                    this._text = this._text.slice(0, selStart) +
                                 this._text.slice(selStart + 1);
                    this._cursor = selStart;
                }
                this._selStart = this._cursor;
                this._selEnd = this._cursor;
                break;
            }
            case 'deleteWordBackward':
            case 'deleteWordForward':
            case 'deleteSoftLineBackward':
            case 'deleteSoftLineForward':
            case 'deleteHardLineBackward':
            case 'deleteHardLineForward': {
                // For now, fall back to simple character delete
                if (selStart !== selEnd) {
                    this._text = this._text.slice(0, selStart) +
                                 this._text.slice(selEnd);
                    this._cursor = selStart;
                }
                this._selStart = this._cursor;
                this._selEnd = this._cursor;
                break;
            }
            default:
                handled = false;
        }
        if (handled) {
            e.preventDefault();
            this._render();
            this.make_callback('changed');
        }
    }

    _onKeyDown(e) {
        // Let the browser handle arrows, home, end, page up/down, etc.
        // Cut/copy/paste: let the browser do cut/copy natively;
        // paste goes through beforeinput (insertFromPaste).
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

    _syncFromScroll() {
        let maxX = this._edit.scrollWidth - this._editWrap.clientWidth;
        let maxY = this._main.scrollHeight - this._main.clientHeight;
        if (maxX > 0) {
            this._hScrollBar.set_scroll_percent(this._editWrap.scrollLeft / maxX);
        }
        if (maxY > 0) {
            this._vScrollBar.set_scroll_percent(this._main.scrollTop / maxY);
        }
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    _clampOffset(offset) {
        if (offset < 0) return 0;
        if (offset > this._text.length) return this._text.length;
        return offset;
    }
}

export { TextSource };
