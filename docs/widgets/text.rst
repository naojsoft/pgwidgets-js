Text Widgets
============

.. _widget-label:

Label
-----

Static text with alignment, color, and font options.

**Constructor:** ``new Widgets.Label(text, {halign})``

**Options:**

- ``halign`` -- horizontal alignment (``"left"``, ``"center"``, ``"right"``)

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_text(text)``
     - Set label text.
   * - ``get_text()``
     - Return current text.
   * - ``set_color(bg, fg)``
     - Set background and foreground colors.
   * - ``set_halign(align)``
     - Set horizontal alignment.

**Callbacks:** None.

.. code-block:: javascript

   let label = new Widgets.Label("Status: OK", {halign: "left"});
   label.set_color(null, "green");

.. _widget-textentry:

TextEntry
---------

Single-line text input with optional line history.

**Constructor:** ``new Widgets.TextEntry({text, editable, linehistory, password})``

**Options:**

- ``text`` -- initial text
- ``editable`` -- whether text is editable
- ``linehistory`` -- enable up/down arrow line history
- ``password`` -- mask input as password

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_text(text)``
     - Set text content.
   * - ``get_text()``
     - Return current text.
   * - ``clear()``
     - Clear the text field.
   * - ``set_length(numchars)``
     - Set display width in characters.

**Callbacks:**

- ``activated`` -- fired when Enter is pressed.

.. code-block:: javascript

   let entry = new Widgets.TextEntry({linehistory: true});
   entry.add_callback('activated', (w) => {
       console.log("Entered:", w.get_text());
       w.clear();
   });

.. _widget-textentryset:

TextEntrySet
------------

Text entry with a submit button.

**Constructor:** ``new Widgets.TextEntrySet({text, value, editable, linehistory})``

**Options:**

- ``text`` -- button label text
- ``value`` -- initial entry text
- ``editable`` -- whether text is editable
- ``linehistory`` -- enable line history

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_button_text(text)``
     - Set the button label.
   * - ``set_text(text)``
     - Set entry text.
   * - ``get_text()``
     - Return current text.
   * - ``clear()``
     - Clear the text field.
   * - ``set_length(numchars)``
     - Set display width in characters.

**Callbacks:**

- ``activated`` -- fired when the button is pressed or Enter is pressed.

.. _widget-textarea:

TextArea
--------

Multi-line text editor.

**Constructor:** ``new Widgets.TextArea(text, {wrap, editable})``

**Options:**

- ``wrap`` -- enable text wrapping
- ``editable`` -- whether text is editable

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_text(text)``
     - Set text content.
   * - ``get_text()``
     - Return current text.
   * - ``append_text(text)``
     - Append text at the end.
   * - ``clear()``
     - Clear all text.
   * - ``set_editable(tf)``
     - Set editable state.
   * - ``set_wrap(tf)``
     - Set word-wrap mode.
   * - ``set_limit(numlines)``
     - Limit visible lines (scrollback).

**Callbacks:** None.

.. code-block:: javascript

   let log = new Widgets.TextArea("", {wrap: true, editable: false});
   log.set_limit(1000);
   log.append_text("Application started.\n");

.. _widget-htmlview:

HtmlView
--------

Read-only rich HTML content display with pgwidgets-style scrollbars.

**Constructor:** ``new Widgets.HtmlView(html)``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_html(html)``
     - Set HTML content, replacing existing content.
   * - ``get_html()``
     - Return current HTML content.
   * - ``append_html(html)``
     - Append HTML to existing content.
   * - ``clear()``
     - Remove all content.
   * - ``scroll_to_top()``
     - Scroll to the top.
   * - ``scroll_to_bottom()``
     - Scroll to the bottom.

**Callbacks:** None.

.. code-block:: javascript

   let view = new Widgets.HtmlView("<h1>Hello</h1><p>Rich content here.</p>");
   vbox.add_widget(view, 1);

   // Update content dynamically
   view.set_html("<h2>Updated</h2><p>New content.</p>");
   view.append_html("<p>Another paragraph.</p>");

.. _widget-textsource:

TextSource
----------

Source code editor with line numbers, syntax highlighting support, tags,
undo/redo, and find/replace.

**Constructor:** ``new Widgets.TextSource(text, {wrap, line_numbers, icon_gutter, editable, font_family, font_size})``

**Options:**

- ``wrap`` -- wrap mode
- ``line_numbers`` -- show line numbers
- ``icon_gutter`` -- show icon gutter
- ``editable`` -- whether text is editable
- ``font_family`` -- font family name
- ``font_size`` -- font size

Positions in the buffer are expressed as ``TextBufferRef`` instances —
live references that automatically track edits.  The only place a
caller deals in raw integer offsets is when minting a ref via
``create_ref(offset, gravity)``.  Every other position-taking or
position-returning method on the public API uses refs.

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``set_text(text)`` / ``get_text()``
     - Set or get text content.  ``set_text`` invalidates all
       outstanding refs.
   * - ``get_length()``
     - Return text length (characters).
   * - ``insert_text(ref, text, tags)``
     - Insert text at the position of *ref* with optional tag names.
   * - ``delete_range(start_ref, end_ref)``
     - Delete the text between two refs.
   * - ``clear()``
     - Clear all text.
   * - ``set_editable(tf)``
     - Set editable state.
   * - ``set_wrap(mode)``
     - Set wrap mode.
   * - ``set_line_numbers(tf)``
     - Show/hide line numbers.
   * - ``set_icon_gutter(tf)``
     - Show/hide icon gutter.
   * - ``set_icon(ref, icon_url)``
     - Anchor an icon to *ref*; it follows the ref's line as the
       buffer is edited.  ``icon_url = null`` removes the icon for
       that ref.
   * - ``get_cursor()`` → ref / ``set_cursor(ref)``
     - Get a live ref at the cursor, or move the cursor to a ref.
   * - ``get_selection_range()`` → ``[start_ref, end_ref]`` or null
       / ``set_selection_range(start_ref, end_ref)``
     - Get or set the selection range as a pair of live refs.
   * - ``create_tag(name, attrs)``
     - Create a named style tag.
   * - ``remove_tag_def(name)``
     - Remove a tag definition.
   * - ``apply_tag(name, start_ref, end_ref)``
     - Apply a tag to a range.
   * - ``remove_tag(name, start_ref, end_ref)``
     - Remove a tag from a range.
   * - ``get_tags_at(ref)``
     - Return tag names active at the position of *ref*.
   * - ``get_tags_range(start_ref, end_ref)``
     - Return tag names active anywhere in the range.
   * - ``create_ref(offset, gravity)``
     - Create a live ``TextBufferRef`` at *offset*.  ``gravity`` is
       ``'left'`` or ``'right'`` (default ``'right'``).  This is the
       only API that takes a raw integer offset.
   * - ``remove_ref(ref)``
     - Stop tracking *ref*.
   * - ``undo()`` / ``redo()``
     - Undo or redo.
   * - ``can_undo()`` / ``can_redo()``
     - Check undo/redo availability.
   * - ``find(query, {start_ref, case_insensitive})``
     - Find next match; returns ``[start_ref, end_ref]`` or null.
   * - ``find_all(query, {start_ref, case_insensitive})``
     - Find all non-overlapping matches; returns an array of ref pairs.
   * - ``replace(query, replacement, {all, start_ref, case_insensitive})``
     - Find and replace; returns the number of replacements.
   * - ``scroll_to_ref(ref)``
     - Scroll the view so the line containing *ref* is visible.
   * - ``scroll_to_cursor()``
     - Scroll to cursor position.

**Callbacks:**

- ``changed`` -- text content changed.
- ``cursor_moved`` -- cursor position changed; fires with a fresh
  ``TextBufferRef`` at the new cursor position.
- ``line_clicked`` -- a line number was clicked; fires with the line
  index.
- ``icon_clicked`` -- a gutter icon was clicked; fires with
  ``(line, ref)``, where ``ref`` is the registered ref that owns the
  icon (or ``null`` if the click was on a line with no icon).

.. code-block:: javascript

   let editor = new Widgets.TextSource("", {
       line_numbers: true,
       editable: true,
       font_family: "monospace",
       font_size: 14
   });
   editor.create_tag("keyword", {color: "blue", fontWeight: "bold"});
   editor.add_callback('changed', (w) => console.log("Modified"));
