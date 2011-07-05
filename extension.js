const Gtk = imports.gi.Gtk;
const Panel = imports.ui.panel;

const Extension = imports.ui.extensionSystem.extensions["gjsimp@tigersoldier"];
const Indicator = Extension.indicator;

function main() {
    Panel.STANDARD_TRAY_ICON_ORDER.unshift('gjsimp');
    Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['gjsimp'] = Indicator.Indicator;
    // let _uiapplication = new Indicator.UIApplication(_indicator);
    // _uiapplication.connect('disconnected', disconnect_cb);
    // _uiapplication.connect('name-lost', name_lost_cb);
    // Gtk.main();
}
