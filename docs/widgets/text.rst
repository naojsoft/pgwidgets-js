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

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``set_text(text)`` / ``get_text()``
     - Set or get text content.
   * - ``get_length()``
     - Return text length.
   * - ``insert_text(offset, text, tags)``
     - Insert text at offset with optional tags.
   * - ``delete_range(start, end)``
     - Delete text between offsets.
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
   * - ``set_icon(line, icon_url)``
     - Set an icon on a line.
   * - ``get_cursor()`` / ``set_cursor(offset)``
     - Get or set cursor position.
   * - ``get_selection()`` / ``set_selection(start, end)``
     - Get or set selection range.
   * - ``create_tag(name, attrs)``
     - Create a named style tag.
   * - ``remove_tag_def(name)``
     - Remove a tag definition.
   * - ``apply_tag(name, start, end)``
     - Apply a tag to a text range.
   * - ``remove_tag(name, start, end)``
     - Remove a tag from a range.
   * - ``get_tags_at(offset)``
     - Return tags at offset.
   * - ``create_ref(offset, gravity)``
     - Create a live reference at offset.
   * - ``remove_ref(ref)``
     - Remove a live reference.
   * - ``undo()`` / ``redo()``
     - Undo or redo.
   * - ``can_undo()`` / ``can_redo()``
     - Check undo/redo availability.
   * - ``find(query, opts)``
     - Find next match.
   * - ``find_all(query, opts)``
     - Find all matches.
   * - ``replace(query, replacement, opts)``
     - Find and replace.
   * - ``scroll_to(ref_or_offset)``
     - Scroll to a position.
   * - ``scroll_to_cursor()``
     - Scroll to cursor position.

**Callbacks:**

- ``changed`` -- text content changed.
- ``cursor_moved`` -- cursor position changed.
- ``line_clicked`` -- a line number was clicked.
- ``icon_clicked`` -- a gutter icon was clicked.

.. code-block:: javascript

   let editor = new Widgets.TextSource("", {
       line_numbers: true,
       editable: true,
       font_family: "monospace",
       font_size: 14
   });
   editor.create_tag("keyword", {color: "blue", fontWeight: "bold"});
   editor.add_callback('changed', (w) => console.log("Modified"));
