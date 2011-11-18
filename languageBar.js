/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2011 Red Hat, Inc.
 * Copyright 2011 Peng Huang <shawn.p.huang@gmail.com>
 * Copyright 2011 Takao Fujiwara <tfujiwar@redhat.com>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 2.1 of
 * the License, or (at your option) any later version.
 * 
 * This program is distributed in the hope it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

const IBus = imports.gi.IBus;
const Lang = imports.lang;
const Signals = imports.signals;

const Extension = imports.ui.extensionSystem.extensions["gjsimp@tigersoldier"];
const ShellMenu = Extension.shellMenu;

function LanguageBar(indicator) {
    this._init(indicator);
}

LanguageBar.prototype = {
    _init: function(indicator) {
        this._enabled = false;
        this._imName = null;
        this._props = null;
        this._indicator = indicator;
        this._menuItems = [];
    },

    _replaceProperty: function(old_prop, new_prop) {
        old_prop.set_label(new_prop.get_label());
        old_prop.set_icon(new_prop.get_icon());
        old_prop.set_tooltip(new_prop.get_tooltip());
        old_prop.set_sensitive(new_prop.get_sensitive());
        old_prop.set_visible(new_prop.get_visible());
        old_prop.set_state(new_prop.get_state());
        old_prop.set_sub_props(new_prop.get_sub_props());
    },

    _onItemPropertyActivate: function(w, n, s) {
        this.emit('property-activate', n, s);
    },

    _onItemShowEngineAbout: function(w, n, s) {
        this.emit('show-engine-about');
    },

    setIMName: function(text) {
        this._imName = text
    },

    setEnabled: function(enabled) {
        this._enabled = enabled;
    },

    isEnabled: function() {
        return this._enabled;
    },

    registerProperties: function(props) {
        this._props = props;
    },

    updateProperty: function(prop) {
        if (this._props) {
            for (let i = 0; this._props.get(i) != null; i++) {
                let p = this._props.get(i);
                if (p.get_key() == prop.get_key() && p.get_prop_type() == prop.get_prop_type()) {
                    this._replaceProperty(p, prop);
                    break;
                }
            }
        }
        for (let i = 0; i < this._menuItems.length; i++) {
            this._menuItems[i].updateProperty(prop);
        }
    },

    createIMMenuShell: function() {
        if (!this._enabled) {
            return;
        }

        let props = this._props;
        if (!props) {
            return;
        }

        // Do not have to init this._menuItems here because panel always
        // calls _indicator.menu.removeAll.

        let item = null;
        let prop = null;
        let radioGroup = [];

        for (let i = 0; props.get(i) != null; i++) {
            prop = props.get(i);
            if (prop.get_prop_type() == IBus.PropType.NORMAL) {
                item = new ShellMenu.ImageShellMenuItem(prop);
            }
            else if (prop.get_prop_type() == IBus.PropType.TOGGLE) {
                item = new ShellMenu.CheckShellMenuItem(prop);
            }
            else if (prop.get_prop_type() == IBus.PropType.RADIO) {
                item = new ShellMenu.RadioShellMenuItem(radioGroup, prop);
                radioGroup.push(item);
                for (let j = 0; j < radioGroup.length; j++) {
                    radioGroup[j].setGroup(radioGroup);
                }
            }
            else if (prop.get_prop_type() == IBus.PropType.SEPARATOR) {
                item = new ShellMenu.SeparatorShellMenuItem();
                radioGroup = null;
            }
            else if (prop.get_prop_type() == IBus.PropType.MENU) {
                let submenu = new ShellMenu.ShellMenu(prop);
                submenu.connect('property-activate',
                                Lang.bind(this, this._onItemPropertyActivate));
                item = submenu;
            }
            else {
                IBusException('Unknown property type = %d' % prop.get_prop_type());
            }

            item.setSensitive(prop.get_sensitive());

            if (prop.get_visible()) {
                item.show();
            } else {
                item.hide();
            }

            this._menuItems.push(item);
            this._indicator.menu.addMenuItem(item.getRaw());
            item.connect('property-activate',
                         Lang.bind(this, this._onItemPropertyActivate));
        }

        if (props.get(0) != null) {
            this._indicator.menu.addMenuItem(new ShellMenu.SeparatorShellMenuItem().getRaw());
        }
    }
};

Signals.addSignalMethods(LanguageBar.prototype);
