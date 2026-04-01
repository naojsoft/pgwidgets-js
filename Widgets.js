"use_strict";

/*
 * Export all widgets
 */
import {Widget, ContainerWidget} from "./modules/Widget.js";
import {Box, VBox, HBox, ButtonBox} from "./modules/Box.js";
import {TopLevel} from "./modules/Top.js";
import {Scrollable} from "./modules/Scrollable.js";
import {MDIWidget} from "./modules/MDIWidget.js";
import {TabWidget, StackWidget} from "./modules/TabWidget.js";
import {Splitter} from "./modules/Splitter.js";
import {Expander} from "./modules/Expander.js";
import {Text, Label, TextArea} from "./modules/TextWidget.js";
import {Button} from "./modules/Button.js";
import {CheckBox} from "./modules/CheckBox.js";
import {ComboBox} from "./modules/ComboBox.js";
import {TextEntry} from "./modules/TextEntry.js";
import {Slider} from "./modules/Slider.js";
import {Canvas} from "./modules/Canvas.js";
import {Page} from "./modules/Page.js";


const Widgets = {Widget, ContainerWidget, Box, VBox, HBox, ButtonBox,
                 TopLevel, Scrollable, MDIWidget, Splitter, TabWidget,
                 StackWidget, Expander, Page, Text, Label, TextArea,
                 Button, CheckBox, ComboBox, TextEntry, Slider, Canvas};

export { Widgets };
