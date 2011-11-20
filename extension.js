/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;
const Extension = imports.ui.extensionSystem.extensions["gjsimp@tigersoldier"];
const Indicator = Extension.indicator;

let indicator = null;
let menus = null;

function init() {
}

function main() {
    // The gettext is fixed in gnome-shell 3.1.4 or later at least.
    if (window._ == undefined) {
        const Shell = imports.gi.Shell;
        const Gettext = imports.gettext;
        window.global = Shell.Global.get();
        window._ = Gettext.gettext;
        window.C_ = Gettext.pgettext;
        window.ngettext = Gettext.ngettext;
    }
}

function enable() {
    if (!indicator) {
        indicator = new Indicator.Indicator();
    }
    Main.panel.addToStatusArea('ibus', indicator, 0);
}

function disable() {
    if (indicator) {
        indicator.destroy();
        indicator = null;
    }
}
