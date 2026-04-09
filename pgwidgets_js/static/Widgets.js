"use_strict";

/**
 * @module Widgets
 * @description Main entry point for the pgwidgets library.
 * Imports and re-exports all widget classes as a single Widgets namespace.
 */
import {Widget, ContainerWidget} from "./modules/Widget.js";
import {Box, VBox, HBox, ButtonBox} from "./modules/Box.js";
import {TopLevel} from "./modules/TopLevel.js";
import {ScrollArea} from "./modules/ScrollArea.js";
import {MDIWidget} from "./modules/MDIWidget.js";
import {TabWidget, StackWidget} from "./modules/TabWidget.js";
import {Splitter} from "./modules/Splitter.js";
import {Expander} from "./modules/Expander.js";
import {Text} from "./modules/TextWidget.js";
import {TextArea} from "./modules/TextArea.js";
import {TextSource} from "./modules/TextSource.js";
import {Label} from "./modules/Label.js";
import {Button} from "./modules/Button.js";
import {CheckBox} from "./modules/CheckBox.js";
import {ComboBox} from "./modules/ComboBox.js";
import {ComboBoxNative} from "./modules/ComboBoxNative.js";
import {TextEntry} from "./modules/TextEntry.js";
import {Slider} from "./modules/Slider.js";
import {Canvas} from "./modules/Canvas.js";
import {Page} from "./modules/Page.js";
import {SpinBox} from "./modules/SpinBox.js";
import {ToggleButton} from "./modules/ToggleButton.js";
import {RadioButton} from "./modules/RadioButton.js";
import {ProgressBar} from "./modules/ProgressBar.js";
import {Frame} from "./modules/Frame.js";
import {GridBox} from "./modules/GridBox.js";
import {Image} from "./modules/Image.js";
import {Dial} from "./modules/Dial.js";
import {MenuBar} from "./modules/MenuBar.js";
import {Menu} from "./modules/Menu.js";
import {MenuAction} from "./modules/MenuAction.js";
import {ToolBar} from "./modules/ToolBar.js";
import {ToolBarAction} from "./modules/ToolBarAction.js";
import {TextEntrySet} from "./modules/TextEntrySet.js";
import {Dialog} from "./modules/Dialog.js";
import {ColorDialog} from "./modules/ColorDialog.js";
import {ScrollBar} from "./modules/ScrollBar.js";
import {RemoteInterface} from "./modules/RemoteInterface.js";
import {TreeView} from "./modules/TreeView.js";
import {TableView} from "./modules/TableView.js";


const Widgets = {Widget, ContainerWidget, Box, VBox, HBox, ButtonBox,
                 TopLevel, ScrollArea, MDIWidget, Splitter, TabWidget,
                 StackWidget, Expander, Page, Text, Label, TextArea, TextSource,
                 Frame, GridBox, Button, ToggleButton, CheckBox,
                 RadioButton, ComboBox, ComboBoxNative, TextEntry,
                 Slider, Canvas, SpinBox, ProgressBar, Image, Dial,
                 MenuBar, Menu, MenuAction, ToolBar, ToolBarAction,
                 TextEntrySet, Dialog, ColorDialog, ScrollBar,
                 TreeView, TableView, RemoteInterface};

export { Widgets };
