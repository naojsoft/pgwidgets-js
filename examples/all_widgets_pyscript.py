"""
All Widgets demo -- PyScript version.

This is the Python equivalent of all_widgets.html, loaded and run
in the browser via PyScript. See all_widgets_pyscript.html for the
HTML loader.
"""

import sys
if '/' not in sys.path:
    sys.path.insert(0, '/')

from js import window, document
from pgwidgets_js.pyodide import Widgets

# Remove the loading indicator
el = document.getElementById('loading')
if el:
    el.remove()

# --- Full-page TopLevel with MDI workspace ---
top = Widgets.TopLevel(title="All Widgets Demo (PyScript)", resizable=True)
top.resize(int(window.innerWidth) - 4, int(window.innerHeight) - 4)

vbox = Widgets.VBox()

# --- Menu bar ---
menubar = Widgets.MenuBar()
windows_menu = Widgets.Menu()
cascade_action = windows_menu.add_name("Cascade")
tile_action = windows_menu.add_name("Tile")
menubar.add_menu(windows_menu, "Windows")
vbox.add_widget(menubar, 0)

# --- MDI area ---
mdi = Widgets.MDIWidget()
vbox.add_widget(mdi, 1)

cascade_action.on("activated", lambda: mdi.cascade_windows())
tile_action.on("activated", lambda: mdi.tile_windows())

# --- Picker ---
picker_content = Widgets.VBox(spacing=6, padding=8)
picker_label = Widgets.TextEntry(text="Pick a widget:", editable=False)
picker_content.add_widget(picker_label, 0)

widget_names = [
    "Button", "CheckBox", "ColorWidget", "ComboBox", "Dial",
    "Expander", "Frame", "GridBox", "Image", "Label",
    "ProgressBar", "RadioButton", "ScrollArea", "ScrollBar",
    "Slider", "SpinBox", "Splitter",
    "TextArea", "TextEntry", "TextEntrySet", "TextSource",
    "ToggleButton", "ToolBar", "TreeView", "VBox/HBox",
]

picker = Widgets.ComboBox(dropdown_limit=8)
for name in widget_names:
    picker.append_text(name)
picker.set_index(0)
picker_content.add_widget(picker, 0)

go_btn = Widgets.Button("Go!")
picker_content.add_widget(go_btn, 0)
picker_content.add_widget(Widgets.Label(""), 1)

picker_win = mdi.add_widget(picker_content,
                            {"title": "Widget Picker",
                             "width": 220, "height": 150})

# --- Status label ---
status = Widgets.Label("Select a widget from the picker to see a demo.")
status.set_padding([6, 4, 6, 4])
vbox.add_widget(status, 0)

# --- Demo creation ---
demo_count = 0


def next_position():
    global demo_count
    demo_count += 1
    return (40 + (demo_count % 6) * 25, 20 + (demo_count % 6) * 25)


def make_demo(name):
    pos = next_position()
    content = None
    subwin = None

    if name == "Button":
        content = Widgets.VBox(spacing=6, padding=8)
        hbox = Widgets.HBox(spacing=6)
        lbl = Widgets.Label("")
        btn_a = Widgets.Button("Button A")
        btn_a.on("activated", lambda: lbl.set_text("Button A clicked"))
        btn_b = Widgets.Button("Button B")
        btn_b.on("activated", lambda: lbl.set_text("Button B clicked"))
        btn_icon = Widgets.Button("With Icon")
        btn_icon.set_icon("../pgwidgets_js/static/icons/pgicon.svg",
                          [16, 16])
        btn_icon.on("activated",
                     lambda: lbl.set_text("Icon button clicked"))
        hbox.add_widget(btn_a, 0)
        hbox.add_widget(btn_b, 0)
        hbox.add_widget(btn_icon, 0)
        content.add_widget(hbox, 0)
        content.add_widget(lbl, 1)
        subwin = mdi.add_widget(content,
                                {"title": "Button",
                                 "width": 350, "height": 120})

    elif name == "CheckBox":
        content = Widgets.VBox(spacing=4, padding=8)
        lbl = Widgets.Label("")
        cb1 = Widgets.CheckBox("Option 1")
        cb1.on("activated",
               lambda val: lbl.set_text(
                   f"Option 1: {'ON' if val else 'OFF'}"))
        cb2 = Widgets.CheckBox("Option 2")
        cb2.on("activated",
               lambda val: lbl.set_text(
                   f"Option 2: {'ON' if val else 'OFF'}"))
        cb3 = Widgets.CheckBox("Option 3")
        cb3.on("activated",
               lambda val: lbl.set_text(
                   f"Option 3: {'ON' if val else 'OFF'}"))
        content.add_widget(cb1, 0)
        content.add_widget(cb2, 0)
        content.add_widget(cb3, 0)
        content.add_widget(lbl, 1)
        subwin = mdi.add_widget(content,
                                {"title": "CheckBox",
                                 "width": 250, "height": 160})

    elif name == "ComboBox":
        content = Widgets.VBox(spacing=6, padding=8)
        lbl = Widgets.Label("")
        content.add_widget(Widgets.Label("Pick-only:"), 0)
        combo1 = Widgets.ComboBox()
        for f in ["Apple", "Banana", "Cherry", "Date", "Elderberry"]:
            combo1.append_text(f)
        combo1.set_index(0)
        combo1.on("activated",
                  lambda idx, text: lbl.set_text(f"Picked: {text}"))
        content.add_widget(combo1, 0)
        content.add_widget(Widgets.Label("Editable:"), 0)
        combo2 = Widgets.ComboBox(editable=True, dropdown_limit=5)
        for f in ["Red", "Orange", "Yellow", "Green", "Blue",
                   "Indigo", "Violet"]:
            combo2.append_text(f)
        combo2.on("activated",
                  lambda idx, text: lbl.set_text(f"Entered: {text}"))
        content.add_widget(combo2, 0)
        content.add_widget(lbl, 1)
        subwin = mdi.add_widget(content,
                                {"title": "ComboBox",
                                 "width": 280, "height": 200})

    elif name == "ColorWidget":
        cw = Widgets.ColorWidget(color="#3366cc")
        cw.on("pick",
              lambda color: status.set_text(f"Picking: {color}"))
        subwin = mdi.add_widget(cw,
                                {"title": "ColorWidget",
                                 "width": 420, "height": 240})

    elif name == "Dial":
        content = Widgets.HBox(spacing=8, padding=8)
        lbl = Widgets.Label("50")
        dial1 = Widgets.Dial(min=0, max=100, value=50, track=True)
        dial1.on("activated", lambda val: lbl.set_text(str(val)))
        dial2 = Widgets.Dial(min=0, max=100, value=25)
        dial2.on("activated", lambda val: lbl.set_text(str(val)))
        content.add_widget(dial1, 0)
        content.add_widget(dial2, 0)
        content.add_widget(lbl, 1)
        subwin = mdi.add_widget(content,
                                {"title": "Dial",
                                 "width": 320, "height": 160})

    elif name == "Expander":
        content = Widgets.VBox(spacing=4, padding=8)
        exp1 = Widgets.Expander(title="Section A", collapsible=True)
        exp1.set_widget(Widgets.Label("Content of section A."))
        exp2 = Widgets.Expander(title="Section B", collapsible=True)
        exp2.set_widget(Widgets.Label("Content of section B."))
        content.add_widget(exp1, 0)
        content.add_widget(exp2, 0)
        content.add_widget(Widgets.Label(""), 1)
        subwin = mdi.add_widget(content,
                                {"title": "Expander",
                                 "width": 280, "height": 180})

    elif name == "Frame":
        content = Widgets.VBox(spacing=6, padding=8)
        frame1 = Widgets.Frame(title="Titled Frame")
        frame1.set_widget(Widgets.Label("Content inside a frame."))
        frame2 = Widgets.Frame(title="Another Frame")
        frame2.set_widget(Widgets.Label("More framed content."))
        content.add_widget(frame1, 1)
        content.add_widget(frame2, 1)
        subwin = mdi.add_widget(content,
                                {"title": "Frame",
                                 "width": 280, "height": 200})

    elif name == "GridBox":
        content = Widgets.VBox(padding=8, spacing=6)
        lbl = Widgets.Label("")
        grid = Widgets.GridBox(rows=3, columns=3)
        for r in range(3):
            for c in range(3):
                btn = Widgets.Button(f"({r},{c})")
                btn.on("activated",
                       lambda _r=r, _c=c: lbl.set_text(
                           f"Clicked row={_r} col={_c}"))
                grid.add_widget(btn, r, c)
        content.add_widget(grid, 1)
        content.add_widget(lbl, 0)
        subwin = mdi.add_widget(content,
                                {"title": "GridBox",
                                 "width": 280, "height": 200})

    elif name == "Image":
        img = Widgets.Image(url="../pgwidgets_js/static/icons/pgwidgets-logo.svg")
        subwin = mdi.add_widget(img,
                                {"title": "Image",
                                 "width": 360, "height": 240})

    elif name == "Label":
        content = Widgets.VBox(spacing=6, padding=8)
        lbl1 = Widgets.Label("Default label")
        lbl2 = Widgets.Label("Centered, colored")
        lbl2.set_halign("center")
        lbl2.set_color("#eef", "darkblue")
        lbl3 = Widgets.Label("Monospace, bold")
        lbl3.set_font("monospace", 12, "bold")
        content.add_widget(lbl1, 0)
        content.add_widget(lbl2, 0)
        content.add_widget(lbl3, 0)
        content.add_widget(Widgets.Label(""), 1)
        subwin = mdi.add_widget(content,
                                {"title": "Label",
                                 "width": 260, "height": 150})

    elif name == "ProgressBar":
        content = Widgets.VBox(spacing=6, padding=8)
        pb = Widgets.ProgressBar()
        pb.set_value(0.65)
        slider = Widgets.Slider(min=0, max=100, value=65, track=True)
        slider.on("activated", lambda val: pb.set_value(val / 100))
        content.add_widget(Widgets.Label("Drag slider to change progress:"), 0)
        content.add_widget(slider, 0)
        content.add_widget(pb, 0)
        content.add_widget(Widgets.Label(""), 1)
        subwin = mdi.add_widget(content,
                                {"title": "ProgressBar",
                                 "width": 320, "height": 150})

    elif name == "RadioButton":
        content = Widgets.VBox(spacing=4, padding=8)
        lbl = Widgets.Label("")
        rb1 = Widgets.RadioButton("Choice A")
        rb1.on("activated",
               lambda val: lbl.set_text("Selected: A") if val else None)
        rb2 = Widgets.RadioButton("Choice B", group=rb1)
        rb2.on("activated",
               lambda val: lbl.set_text("Selected: B") if val else None)
        rb3 = Widgets.RadioButton("Choice C", group=rb1)
        rb3.on("activated",
               lambda val: lbl.set_text("Selected: C") if val else None)
        rb1.set_state(True)
        content.add_widget(rb1, 0)
        content.add_widget(rb2, 0)
        content.add_widget(rb3, 0)
        content.add_widget(lbl, 1)
        subwin = mdi.add_widget(content,
                                {"title": "RadioButton",
                                 "width": 250, "height": 160})

    elif name == "ScrollArea":
        big_content = Widgets.VBox(spacing=4, padding=8)
        for i in range(30):
            row = Widgets.HBox(spacing=4)
            for j in range(8):
                lbl = Widgets.Label(f"Item {i * 8 + j}")
                lbl.set_padding([2, 6, 2, 6])
                lbl.set_color("#f8f8f8" if i % 2 == 0 else "#fff", "#333")
                row.add_widget(lbl, 0)
            big_content.add_widget(row, 0)
        scroll = Widgets.ScrollArea()
        scroll.set_widget(big_content)
        subwin = mdi.add_widget(scroll,
                                {"title": "ScrollArea",
                                 "width": 320, "height": 200})

    elif name == "ScrollBar":
        content = Widgets.VBox(spacing=8, padding=8)
        lbl = Widgets.Label("0%")
        content.add_widget(Widgets.Label("Horizontal:"), 0)
        hsb = Widgets.ScrollBar(orientation="horizontal")
        hsb.set_thumb_percent(0.2)
        hsb.on("activated",
               lambda pct: lbl.set_text(f"{int(pct * 100)}%"))
        content.add_widget(hsb, 0)
        hbox = Widgets.HBox(spacing=8)
        hbox.add_widget(Widgets.Label("Vertical:"), 0)
        vsb = Widgets.ScrollBar(orientation="vertical")
        vsb.set_thumb_percent(0.3)
        vsb.on("activated",
               lambda pct: lbl.set_text(f"{int(pct * 100)}%"))
        hbox.add_widget(vsb, 0)
        hbox.add_widget(lbl, 1)
        content.add_widget(hbox, 1)
        subwin = mdi.add_widget(content,
                                {"title": "ScrollBar",
                                 "width": 280, "height": 200})

    elif name == "Slider":
        content = Widgets.VBox(spacing=6, padding=8)
        lbl = Widgets.Label("")
        sl1 = Widgets.Slider(min=0, max=100, value=50)
        sl1.on("activated",
               lambda val: lbl.set_text(f"Integer: {val}"))
        sl2 = Widgets.Slider(min=0, max=1, step=0.01, value=0.5,
                     dtype="float", track=True)
        sl2.on("activated",
               lambda val: lbl.set_text(f"Float: {val}"))
        content.add_widget(Widgets.Label("Integer (0-100):"), 0)
        content.add_widget(sl1, 0)
        content.add_widget(Widgets.Label("Float tracking (0-1):"), 0)
        content.add_widget(sl2, 0)
        content.add_widget(lbl, 1)
        subwin = mdi.add_widget(content,
                                {"title": "Slider",
                                 "width": 320, "height": 180})

    elif name == "SpinBox":
        content = Widgets.VBox(spacing=6, padding=8)
        lbl = Widgets.Label("")
        content.add_widget(Widgets.Label("Integer (0-100):"), 0)
        sp1 = Widgets.SpinBox(min=0, max=100, step=1, value=50)
        sp1.on("activated", lambda val: lbl.set_text(f"Int: {val}"))
        content.add_widget(sp1, 0)
        content.add_widget(Widgets.Label("Float (0-1):"), 0)
        sp2 = Widgets.SpinBox(min=0, max=1, step=0.05, value=0.5, dtype="float")
        sp2.on("activated", lambda val: lbl.set_text(f"Float: {val}"))
        content.add_widget(sp2, 0)
        content.add_widget(lbl, 1)
        subwin = mdi.add_widget(content,
                                {"title": "SpinBox",
                                 "width": 280, "height": 180})

    elif name == "Splitter":
        content = Widgets.VBox(padding=2, spacing=4)
        lbl = Widgets.Label("Drag the handles to resize panes.")
        hsplit = Widgets.Splitter(orientation="horizontal")
        hsplit.set_border_width(1)
        hsplit.set_border_color("black")
        pane1 = Widgets.Label("Left")
        pane1.set_halign("center")
        pane1.set_color("#e8f0fe", "#333")
        pane2 = Widgets.Label("Center")
        pane2.set_halign("center")
        pane2.set_color("#fef7e0", "#333")
        pane3 = Widgets.Label("Right")
        pane3.set_halign("center")
        pane3.set_color("#e8fee8", "#333")
        hsplit.add_widget(pane1)
        hsplit.add_widget(pane2)
        hsplit.add_widget(pane3)
        content.add_widget(hsplit, 1)
        content.add_widget(lbl, 0)
        subwin = mdi.add_widget(content,
                                {"title": "Splitter",
                                 "width": 360, "height": 180})

    elif name == "TextArea":
        ta = Widgets.TextArea("This is a multi-line text area.\n\n"
                      "You can type freely here.\n"
                      "Resize the window to see it adapt.")
        subwin = mdi.add_widget(ta,
                                {"title": "TextArea",
                                 "width": 320, "height": 200})

    elif name == "TextSource":
        initial = (
            "// TextSource widget demo\n"
            "function hello(name) {\n"
            "    console.log('Hello, ' + name + '!');\n"
            "}\n"
            "\n"
            "hello('world');\n"
            "\n"
            "// Line numbers, icon gutter, tags, undo/redo.\n"
        )
        src = Widgets.TextSource(initial, wrap="none",
                                 line_numbers=True, icon_gutter=True)
        src.create_tag("comment", {"foreground": "#888", "italic": True})
        src.create_tag("keyword", {"foreground": "#0066cc", "bold": True})
        src.create_tag("string",  {"foreground": "#a31515"})
        text = src.get_text()
        line_start = 0
        for line in text.split("\n"):
            if line.startswith("//"):
                src.apply_tag("comment", line_start, line_start + len(line))
            line_start += len(line) + 1
        fn = text.find("function")
        if fn >= 0:
            src.apply_tag("keyword", fn, fn + len("function"))
        for s in ("'Hello, '", "'!'", "'world'"):
            i = text.find(s)
            if i >= 0:
                src.apply_tag("string", i, i + len(s))
        subwin = mdi.add_widget(src,
                                {"title": "TextSource",
                                 "width": 420, "height": 260})

    elif name == "TextEntry":
        content = Widgets.VBox(spacing=6, padding=8)
        lbl = Widgets.Label("Press Enter to activate.")
        entry = Widgets.TextEntry(text="Type here", linehistory=10)
        entry.on("activated",
                 lambda text: lbl.set_text(f"Entered: {text}"))
        content.add_widget(entry, 0)
        content.add_widget(Widgets.Label("Password:"), 0)
        pw_entry = Widgets.TextEntry(password=True)
        pw_entry.on("activated",
                    lambda text: lbl.set_text(f"Password: {text}"))
        content.add_widget(pw_entry, 0)
        content.add_widget(lbl, 1)
        subwin = mdi.add_widget(content,
                                {"title": "TextEntry",
                                 "width": 300, "height": 160})

    elif name == "TextEntrySet":
        content = Widgets.VBox(spacing=6, padding=8)
        lbl = Widgets.Label("Press Enter or click Set.")
        tes = Widgets.TextEntrySet(text="Set", value="Hello", linehistory=5)
        tes.on("activated",
               lambda text: lbl.set_text(f"Value: {text}"))
        content.add_widget(tes, 0)
        content.add_widget(lbl, 1)
        subwin = mdi.add_widget(content,
                                {"title": "TextEntrySet",
                                 "width": 300, "height": 120})

    elif name == "TreeView":
        fi = "../pgwidgets_js/static/icons/folder.svg"
        di = "../pgwidgets_js/static/icons/file.svg"
        content = Widgets.VBox(spacing=4)
        lbl = Widgets.Label("")
        tree = Widgets.TreeView(
            columns=[
                {"label": "Name", "key": "NAME", "type": "string"},
                {"label": "",     "key": "ICON", "type": "icon",
                 "icon_size": 16},
                {"label": "Type", "key": "TYPE", "type": "string"},
                {"label": "Size (KB)", "key": "SIZE", "type": "integer"},
            ],
            selection_mode="multiple",
            alternate_row_colors=True,
            sortable=True,
        )
        tree.set_tree({
            "Documents": {
                "__values__": {"ICON": fi, "TYPE": "Folder"},
                "report.pdf": {"ICON": di, "TYPE": "PDF",  "SIZE": 2400},
                "notes.txt":  {"ICON": di, "TYPE": "Text", "SIZE": 12},
                "Slides": {
                    "__values__": {"ICON": fi, "TYPE": "Folder"},
                    "deck.pptx": {"ICON": di, "TYPE": "PPTX", "SIZE": 5100},
                },
            },
            "Pictures": {
                "__values__": {"ICON": fi, "TYPE": "Folder"},
                "photo1.jpg": {"ICON": di, "TYPE": "JPEG", "SIZE": 3200},
                "photo2.png": {"ICON": di, "TYPE": "PNG",  "SIZE": 1800},
            },
            "readme.txt": {"ICON": di, "TYPE": "Text", "SIZE": 1},
        })

        def on_tree_selected(items):
            if len(items) == 1:
                lbl.set_text(f"Selected: {items[0]['path']}")
            elif len(items) > 1:
                lbl.set_text(f"Selected: {len(items)} items")
        tree.on("selected", on_tree_selected)
        tree.on("activated",
                lambda vals, path: lbl.set_text(f"Activated: {path}"))
        content.add_widget(tree, 1)
        content.add_widget(lbl, 0)
        subwin = mdi.add_widget(content,
                                {"title": "TreeView",
                                 "width": 420, "height": 280})

    elif name == "ToggleButton":
        content = Widgets.VBox(spacing=6, padding=8)
        lbl = Widgets.Label("")
        content.add_widget(Widgets.Label("Independent toggles:"), 0)
        hbox1 = Widgets.HBox(spacing=4)
        tb1 = Widgets.ToggleButton("Bold")
        tb1.on("activated",
               lambda st: lbl.set_text(
                   f"Bold: {'on' if st else 'off'}"))
        tb2 = Widgets.ToggleButton("Italic")
        tb2.on("activated",
               lambda st: lbl.set_text(
                   f"Italic: {'on' if st else 'off'}"))
        hbox1.add_widget(tb1, 0)
        hbox1.add_widget(tb2, 0)
        content.add_widget(hbox1, 0)
        content.add_widget(Widgets.Label("Grouped (exclusive):"), 0)
        hbox2 = Widgets.HBox(spacing=4)
        tg1 = Widgets.ToggleButton("Left")
        tg2 = Widgets.ToggleButton("Center", group=tg1)
        tg3 = Widgets.ToggleButton("Right", group=tg1)
        tg1.on("activated",
               lambda st: lbl.set_text("Align: Left") if st else None)
        tg2.on("activated",
               lambda st: lbl.set_text("Align: Center") if st else None)
        tg3.on("activated",
               lambda st: lbl.set_text("Align: Right") if st else None)
        hbox2.add_widget(tg1, 0)
        hbox2.add_widget(tg2, 0)
        hbox2.add_widget(tg3, 0)
        content.add_widget(hbox2, 0)
        content.add_widget(lbl, 1)
        subwin = mdi.add_widget(content,
                                {"title": "ToggleButton",
                                 "width": 300, "height": 180})

    elif name == "ToolBar":
        content = Widgets.VBox()
        lbl = Widgets.Label("Click toolbar items.")
        lbl.set_padding(8)
        tb = Widgets.ToolBar()
        act1 = tb.add_action({"text": "New"})
        act1.on("activated", lambda: lbl.set_text("New clicked"))
        act2 = tb.add_action({"text": "Open"})
        act2.on("activated", lambda: lbl.set_text("Open clicked"))
        act3 = tb.add_action({"text": "Save"})
        act3.on("activated", lambda: lbl.set_text("Save clicked"))
        tb.add_separator()
        tog1 = tb.add_action({"text": "B", "toggle": True})
        tog1.on("activated",
                lambda st: lbl.set_text(
                    f"Bold: {'on' if st else 'off'}"))
        tog2 = tb.add_action({"text": "I", "toggle": True})
        tog2.on("activated",
                lambda st: lbl.set_text(
                    f"Italic: {'on' if st else 'off'}"))
        content.add_widget(tb, 0)
        content.add_widget(lbl, 1)
        subwin = mdi.add_widget(content,
                                {"title": "ToolBar",
                                 "width": 350, "height": 120})

    elif name == "VBox/HBox":
        content = Widgets.VBox(spacing=6, padding=8)
        lbl = Widgets.Label("stretch=0 keeps natural size, stretch=1 fills space")
        hbox = Widgets.HBox(spacing=4)
        fixed1 = Widgets.Button("Fixed (0)")
        stretch1 = Widgets.Label("Stretch (1)")
        stretch1.set_color("#e8f0fe", "#333")
        stretch1.set_halign("center")
        fixed2 = Widgets.Button("Fixed (0)")
        hbox.add_widget(fixed1, 0)
        hbox.add_widget(stretch1, 1)
        hbox.add_widget(fixed2, 0)
        content.add_widget(Widgets.Label("HBox - horizontal:"), 0)
        content.add_widget(hbox, 0)
        inner_vbox = Widgets.VBox(spacing=4)
        top_label = Widgets.Label("Top (stretch=0)")
        top_label.set_color("#fef7e0", "#333")
        top_label.set_halign("center")
        mid_label = Widgets.Label("Middle (stretch=1)")
        mid_label.set_color("#e8fee8", "#333")
        mid_label.set_halign("center")
        bot_label = Widgets.Label("Bottom (stretch=0)")
        bot_label.set_color("#fee8e8", "#333")
        bot_label.set_halign("center")
        inner_vbox.add_widget(top_label, 0)
        inner_vbox.add_widget(mid_label, 1)
        inner_vbox.add_widget(bot_label, 0)
        content.add_widget(Widgets.Label("VBox - vertical:"), 0)
        content.add_widget(inner_vbox, 1)
        content.add_widget(lbl, 0)
        subwin = mdi.add_widget(content,
                                {"title": "VBox / HBox",
                                 "width": 360, "height": 280})

    else:
        return

    if subwin is not None:
        subwin._call("set_position", pos[0], pos[1])


def on_go():
    text = picker.get_text()
    if text:
        make_demo(text)
        status.set_text(f"Opened demo: {text}")


go_btn.on("activated", on_go)

top.set_widget(vbox)
top.show()

print("All Widgets PyScript demo ready!")
