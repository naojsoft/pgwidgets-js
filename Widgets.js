"use_strict";

/*
 * Export all widgets
 */
import {Widget, ContainerWidget} from "./modules/Widget.js";
import {Box, VBox, HBox, ButtonBox} from "./modules/Box.js";
import {TopLevel} from "./modules/Top.js";
import {ScrollArea} from "./modules/ScrollArea.js";
import {MDIWidget} from "./modules/MDIWidget.js";
import {TabWidget, StackWidget} from "./modules/TabWidget.js";
import {Splitter} from "./modules/Splitter.js";
import {Expander} from "./modules/Expander.js";
import {Text, TextArea} from "./modules/TextWidget.js";
import {Label} from "./modules/Label.js";
import {Button} from "./modules/Button.js";
import {CheckBox} from "./modules/CheckBox.js";
import {ComboBox} from "./modules/ComboBox.js";
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


const Widgets = {Widget, ContainerWidget, Box, VBox, HBox, ButtonBox,
                 TopLevel, ScrollArea, MDIWidget, Splitter, TabWidget,
                 StackWidget, Expander, Page, Text, Label, TextArea,
                 Frame, GridBox, Button, ToggleButton, CheckBox,
                 RadioButton, ComboBox, TextEntry, Slider, Canvas,
                 SpinBox, ProgressBar};

export { Widgets };
