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
const St = imports.gi.St;
const Lang = imports.lang;
const Signals = imports.signals;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;

const Extension = imports.ui.extensionSystem.extensions["gjsimp@tigersoldier"];
const PropItem = Extension.propItem;
const Common = Extension.common;

function ShellMenu(prop) {
    this._init(prop);
}

ShellMenu.prototype = {
    __proto__ : PropItem.PropItem.prototype,

    _init: function(prop) {
        PropItem.PropItem.prototype._init.call(this, prop);

        this._menu = new PopupMenu.PopupSubMenuMenuItem(prop.get_label().get_text());
        this._create_items(this._prop.get_sub_props());
        Common.actor_set_sensitive(this._menu.actor,
                                   this._prop.get_sensitive(),
                                   this._menu.label);
    },

    _create_items: function(props) {
        let radio_group = [];
        let item = null;

        for (let i = 0; props.get(i) != null; i++) {
            let prop = props.get(i);
            if (prop.get_prop_type() == IBus.PropType.NORMAL) {
                item = new ImageShellMenuItem(prop);
            } else if (prop.get_prop_type() == IBus.PropType.TOGGLE) {
                item = new CheckShellMenuItem(prop);
            } else if (prop.get_prop_type() == IBus.PropType.RADIO) {
                item = new RadioShellMenuItem(radio_group, prop);
                radio_group[radio_group.length] = item;
                for (let j = 0; j < radio_group.length; j++) {
                    radio_group[j].set_group(radio_group);
                }
            } else if (prop.get_prop_type() == IBus.PropType.SEPARATOR) {
                item = new SeparatorShellMenuItem();
                radio_group = [];
            } else if (prop.get_prop_type() == IBus.PropType.MENU) {
                item = new ShellMenu(prop);
            } else {
                assert (false);
            }

            if (prop.get_tooltip()) {
                item.set_tooltip_text(prop.get_tooltip().get_text());
            }
            item.set_sensitive(prop.get_sensitive());
            if (prop.get_visible()) {
                item.show();
            } else {
                item.hide();
            }

            this._menu.menu.addMenuItem(item.get_raw());
            this._sub_items[this._sub_items.length] = item;

            if (prop.get_prop_type() != IBus.PropType.NORMAL &&
                prop.get_prop_type() != IBus.PropType.TOGGLE &&
                prop.get_prop_type() != IBus.PropType.RADIO) {
                continue;
            }
            item.connect('property-activate',
                         Lang.bind(this, this._on_item_property_activate));
        }
    },

    _property_clicked: function(item, prop) {
    },

    _on_item_property_activate: function (w, n, s) {
        this.emit('property-activate', n, s);
    },

    add_menu_item: function(menu_item) {
        this._box.add(menu_item.actor);
        menu_item._active_change_id = menu_item.connect('active-changed', Lang.bind(this, function (menu_item, active) {
            if (active && this._active_menu_item != menu_item) {
                if (this._active_menu_item)
                    this._active_menu_item.setActive(false);
                this._active_menu_item = menu_item;
                this.emit('active-changed', menu_item);
            } else if (!active && this._active_menu_item == menu_item) {
                this._active_menu_item = null;
                this.emit('active-changed', null);
            }
        }));
        menu_item._activate_id = menu_item.connect('activate', Lang.bind(this, function (menu_item, event) {
            this.emit('activate', menu_item);
            this.close();
        }));
        menu_item.connect('destroy', Lang.bind(this, function(emitter) {
            menu_item.disconnect(menu_item._activate_id);
            menu_item.disconnect(menu_item._active_change_id);
            if (menu_item == this._active_menu_item)
                this._active_menu_item = null;
        }));
    },

    get_raw: function() {
        return this._menu;
    },

    show: function() {
        this._menu.actor.show();
    },

    set_sensitive: function(sensitive) {
        Common.actor_set_sensitive(this._menu.actor,
                                   sensitive,
                                   this._menu.label);
    },
};

Signals.addSignalMethods(ShellMenu.prototype);

function ImageShellMenuItem(prop) {
    this._init(prop);
}

ImageShellMenuItem.prototype = {
    __proto__ : PropItem.PropItem.prototype,

    _init: function(prop) {
        PropItem.PropItem.prototype._init.call(this, prop);
        this._item = new PopupMenu.PopupImageMenuItem(this._prop.get_label().get_text(),
                                                      this._prop.get_icon());
        this._item.connect('activate', Lang.bind(this, this._on_activate));

        if (this._prop.get_visible()) {
            this._item.actor.show();
        } else {
            this._item.actor.hide();
        }
    },

    _on_activate: function() {
        this.emit('property-activate', this._prop.get_key(), this._prop.get_state());
    },

    property_changed: function() {
        Common.actor_set_sensitive(this._item.actor,
                                   this._prop.get_sensitive(),
                                   this._item.label);
        if (this._prop.get_visible()) {
            this._item.actor.show();
        } else {
            this._item.actor.hide();
        }
    },

    get_raw: function() {
        return this._item;
    },

    show: function() {
        this._item.actor.show();
    },

    hide: function() {
        this._item.actor.hide();
    },

    destroy: function() {
        this._item.destroy();
    },

    set_sensitive: function(sensitive) {
        Common.actor_set_sensitive(this._item.actor,
                                   sensitive,
                                   this._item.label);
    },

    set_tooltip_text: function(text) {
        /* Probably we do not need tooltip for clutter. */
        //this._item.actor.tooltip_text = text;
        //this._item.actor.has_tooltip = true;
    },

    set_submenu: function(submenu) {
        this._item.addActor(submenu.actor, null, null);
    },

    set_label: function(label) {
        this._item.label.set_text(label);
    },
};

Signals.addSignalMethods(ImageShellMenuItem.prototype);

function CheckShellMenuItem(prop) {
    this._init(prop);
}

CheckShellMenuItem.prototype = {
    __proto__ : PropItem.PropItem.prototype,

    _init: function(prop) {
        PropItem.PropItem.prototype._init.call(this, prop);
        this._item = new PopupMenu.PopupSwitchMenuItem(this._prop.get_label().get_text(),
                                                       this._prop.get_state() == IBus.PropState.CHECKED);

        this._item.connect('activate', Lang.bind(this, this._on_activate));

        if (this._prop.get_visible()) {
            this._item.actor.show();
        } else {
            this._item.actor.hide();
        }
    },

    _on_activate: function() {
        // Do not send property-activate to engine in case the event is
        // sent from engine.
        let do_emit = false;
        if (this._item.state) {
            if (this._prop.get_state() != IBus.PropState.CHECKED) {
                do_emit = true;
            }
            this._prop.set_state(IBus.PropState.CHECKED);
        } else {
            if (this._prop.get_state() != IBus.PropState.UNCHECKED) {
                do_emit = true;
            }
            this._prop.set_state(IBus.PropState.UNCHECKED);
        }
        if (do_emit) {
            this.emit('property-activate', this._prop.get_key(), this._prop.get_state());
        }
    },

    property_changed: function() {
        this._item.setToggleState(this._prop.get_state() == IBus.PropState.CHECKED);
        this._item.set_sensitive(this._prop.sensitive);
        if (this._prop.get_visible()) {
            this._item.actor.show();
        } else {
            this._item.actor.hide();
        }
    },

    get_raw: function() {
        return this._item;
    },

    show: function() {
        this._item.actor.show();
    },

    hide: function() {
        this._item.actor.hide();
    },

    destroy: function() {
        this._item.destroy();
    },

    set_sensitive: function(sensitive) {
        Common.actor_set_sensitive(this._item.actor,
                                   sensitive,
                                   this._item.label);
    },

    set_tooltip_text: function(text) {
        /* Probably we do not need tooltip for clutter. */
        //this._item.actor.tooltip_text = text;
        //this._item.actor.has_tooltip = true;
    },

    set_submenu: function(submenu) {
        this._item.addActor(submenu.actor, null, null);
    },

    set_label: function(label) {
        this._item.label.set_text(label);
    },
};

Signals.addSignalMethods(CheckShellMenuItem.prototype);

function RadioShellMenuItem(group, prop) {
    this._init(group, prop);
}

RadioShellMenuItem.prototype = {
    __proto__ : PropItem.PropItem.prototype,

    _init: function(group, prop) {
        PropItem.PropItem.prototype._init.call(this, prop);
        this._group = group;
        this._id = group.length;
        this._item = new PopupMenu.PopupMenuItem(this._prop.get_label().get_text());
        this._item.state = (this._prop.get_state() == IBus.PropState.CHECKED);
        this._item.setShowDot(this._item.state);
        this._item.connect('activate', Lang.bind(this, this._on_activate));

        if (prop.get_visible()) {
            this._item.actor.show();
        } else {
            this._item.actor.hide();
        }
    },

    _on_activate: function() {
        this._item.state = true;
        // Do not send property-activate to engine in case the event is
        // sent from engine.
        let do_emit = false;
        if (this._prop.get_state() != IBus.PropState.CHECKED) {
            do_emit = true;
        }
        this._prop.set_state(IBus.PropState.CHECKED);
        for (let i = 0; i < this._group.length; i++) {
            if (i != this._id) {
                this._group[i].set_state(false);
            }
        }
        if (do_emit) {
            this.emit('property-activate', this._prop.get_key(), this._prop.get_state());
        }
    },

    property_changed: function() {
        this._item.setToggleState(this._prop.get_state() == IBus.PropState.CHECKED);
        this._item.set_sensitive(this._prop.get_sensitive());
        if (this._prop.get_visible()) {
            this._item.actor.show();
        } else {
            this._item.actor.hide()
        }
    },

    get_raw: function() {
        return this._item;
    },

    show: function() {
        this._item.actor.show();
    },

    hide: function() {
        this._item.actor.hide();
    },

    destroy: function() {
        this._item.destroy();
    },

    set_sensitive: function(sensitive) {
        Common.actor_set_sensitive(this._item.actor,
                                   sensitive,
                                   this._item.label);
    },

    set_tooltip_text: function(text) {
        /* Probably we do not need tooltip for clutter. */
        //this._item.actor.tooltip_text = text;
        //this._item.actor.has_tooltip = true;
    },

    set_submenu: function(submenu) {
        this._item.addActor(submenu.actor, null, null);
    },

    set_label: function(label) {
        this._item.label.set_text(label);
    },

    set_group: function(group) {
        this._group = group;
    },

    set_state: function(state) {
        this._item.state = state;
        let do_emit = false;
        if (this._item.state) {
            if (this._prop.get_state() != IBus.PropState.CHECKED) {
                do_emit = true;
            }
            this._prop.set_state(IBus.PropState.CHECKED);
        } else {
            if (this._prop.get_state() != IBus.PropState.UNCHECKED) {
                do_emit = true;
            }
            this._prop.set_state(IBus.PropState.UNCHECKED);
        }
        if (do_emit) {
            this.emit('property-activate', this._prop.get_key(), this._prop.get_state());
        }
    },
};

Signals.addSignalMethods(RadioShellMenuItem.prototype);

function SeparatorShellMenuItem() {
    this._init();
}

SeparatorShellMenuItem.prototype = {
    __proto__ : PropItem.PropItem.prototype,

    _init: function() {
        PropItem.PropItem.prototype._init.call(this, null);
        this._item = new PopupMenu.PopupSeparatorMenuItem();
    },

    get_raw: function() {
        return this._item;
    },

    show: function() {
        this._item.actor.show();
    },

    destroy: function() {
        this._item.destroy();
    },
};


Signals.addSignalMethods(SeparatorShellMenuItem.prototype);
