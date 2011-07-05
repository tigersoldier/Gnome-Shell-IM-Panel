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
        this._im_name = null;
        this._props = null;
        this._indicator = indicator;

        this._properties = [];
    },

    _remove_properties: function() {
        // reset all properties
        for (let i = 0; i < this._properties.length; i++) {
            this._properties[i].destroy();
        }
        this._properties = [];
    },

    _replace_property: function(old_prop, new_prop) {
        old_prop.set_label(new_prop.get_label());
        old_prop.set_icon(new_prop.get_icon());
        old_prop.set_tooltip(new_prop.get_tooltip());
        old_prop.set_sensitive(new_prop.get_sensitive());
        old_prop.set_visible(new_prop.get_visible());
        old_prop.set_state(new_prop.get_state());
        old_prop.set_sub_props(new_prop.get_sub_props());
    },

    _on_item_property_activate: function(w, n, s) {
        this.emit('property-activate', n, s);
    },

    _on_item_show_engine_about: function(w, n, s) {
        this.emit('show-engine-about');
    },

    set_im_name: function(text) {
        this._im_name = text
    },

    reset: function() {
        this._remove_properties();
    },

    set_enabled: function(enabled) {
        this._enabled = enabled;
    },

    is_enabled: function() {
        return this._enabled;
    },

    register_properties: function(props) {
        this._props = props;
    },

    update_property: function(prop) {
        if (this._props) {
            for (let i = 0; this._props.get(i) != null; i++) {
                let p = this._props.get(i);
                if (p.get_key() == prop.get_key() && p.get_prop_type() == prop.get_prop_type()) {
                    this._replace_property(p, prop);
                    break;
                }
            }
        }
        for (let i = 0; i < this._properties.length; i++) {
            this._properties[i].update_property(prop);
        }
    },

    create_im_menu_shell: function() {
        if (!this._enabled) {
            return;
        }

        let props = this._props;
        if (!props) {
            return;
        }

        this._remove_properties();
        let item = null;
        let prop = null;
        let radio_group = [];

        for (let i = 0; props.get(i) != null; i++) {
            prop = props.get(i);
            if (prop.get_prop_type() == IBus.PropType.NORMAL) {
                item = new ShellMenu.ImageShellMenuItem(prop);
            }
            else if (prop.get_prop_type() == IBus.PropType.TOGGLE) {
                item = new ShellMenu.CheckShellMenuItem(prop);
            }
            else if (prop.get_prop_type() == IBus.PropType.RADIO) {
                item = new ShellMenu.RadioShellMenuItem(radio_group, prop);
                radio_group[radio_group.length] = item;
                for (let j = 0; j < radio_group.length; j++) {
                    radio_group[j].set_group(radio_group);
                }
            }
            else if (prop.get_prop_type() == IBus.PropType.SEPARATOR) {
                item = new ShellMenu.SeparatorShellMenuItem();
                radio_group = null;
            }
            else if (prop.get_prop_type() == IBus.PropType.MENU) {
                let submenu = new ShellMenu.ShellMenu(prop);
                submenu.connect('property-activate',
                                Lang.bind(this, this._on_item_property_activate));
                item = submenu;
            }
            else {
                IBusException('Unknown property type = %d' % prop.get_prop_type());
            }

            item.set_sensitive(prop.get_sensitive());

            if (prop.get_visible()) {
                item.show();
            } else {
                item.hide();
            }

            //this._properties[this._properties.length] = item;
            //menu.insert(item.get_raw(), 0);
            this._indicator.menu.addMenuItem(item.get_raw());
            item.connect('property-activate',
                         Lang.bind(this, this._on_item_property_activate));
        }

        if (props.get(0) != null) {
            this._indicator.menu.addMenuItem(new ShellMenu.SeparatorShellMenuItem().get_raw());
        }
    },
};

Signals.addSignalMethods(LanguageBar.prototype);
