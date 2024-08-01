"use_strict";

/*
 * Export all widgets
 */
import {Widget, ContainerWidget} from "./modules/Widget.js";
import {Box, VBox, HBox, ButtonBox} from "./modules/Box.js";
import {TopLevel} from "./modules/Top.js";
import {Scrollable} from "./modules/Scrollable.js";
import {MDIWidget} from "./modules/MDIWidget.js";
import {TabWidget} from "./modules/TabWidget.js";
import {Splitter} from "./modules/Splitter.js";
//import {Splitter2} from "./modules/Splitter2.js";
import {Text} from "./modules/TextWidget.js";
import {Button} from "./modules/Button.js";
import {CheckBox} from "./modules/CheckBox.js";
import {ComboBox} from "./modules/ComboBox.js";


const Widgets = {Widget, ContainerWidget, Box, VBox, HBox, ButtonBox,
                 TopLevel, Scrollable, MDIWidget, Splitter, TabWidget,
                 Text, Button, CheckBox, ComboBox} ;

export { Widgets };
