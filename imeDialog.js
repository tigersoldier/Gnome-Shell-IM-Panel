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

const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const IBus = imports.gi.IBus;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Signals = imports.signals;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;

const Extension = imports.ui.extensionSystem.extensions["gjsimp@tigersoldier"];
const PropItem = Extension.propItem;
const Common = Extension.common;

function IMEDialog() {
    this._init();
}

IMEDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,
    _init: function() {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'run-dialog' });
        this.setButtons([{ label: 'Close',
                           action: Lang.bind(this, this._close),
                           key: Clutter.Return }]);
        this._actionKeys[Clutter.Escape] = Lang.bind(this, this._close);
    },

    _close: function() {
        this.close(global.get_current_time());
    }
}

function ImageShellMenuItem(parent, prop) {
    this._init(parent, prop);
}

/**
 * ImageShellMenuItem:
 * @parent: A parent dialog which shows this UI.
 * @prop: IBus.Property
 *
 * This class creates popupMenu.PopupImageMenuItem from @prop and
 * also emits the signal of 'property-activate' when it's clicked.
 */
ImageShellMenuItem.prototype = {
    __proto__ : PropItem.PropItem.prototype,

    _init: function(parent, prop) {
        PropItem.PropItem.prototype._init.call(this, prop);
        this._parent = parent;
        let label = this._prop.get_label().get_text();
        this.actor = new St.Button({ style_class: 'modal-dialog-button',
                                     reactive:    true,
                                     can_focus:   true,
                                     label:       label });
        if (this._prop.get_visible()) {
            this.actor.show();
        } else {
            this.actor.hide();
        }
        this._activateId = this.actor.connect('clicked',
                                              Lang.bind(this, this._onClicked))
        Common.actorSetSensitive(this.actor,
                                 this._prop.get_sensitive(),
                                 this.actor.label);
    },

    _onClicked: function() {
        this.emit('property-activate', this._prop.get_key(), this._prop.get_state());
        this._parent.close(global.get_current_time());
    },

    propertyChanged: function() {
        Common.actorSetSensitive(this.actor,
                                 this._prop.get_sensitive(),
                                 this.actor.label);
        if (this._prop.get_visible()) {
            this.actor.show();
        } else {
            this.actor.hide();
        }
    },

    show: function() {
        this.actor.show();
    },

    hide: function() {
        this.actor.hide();
    },

    destroy: function() {
        this.disconnect(this._activateId);
        this.actor.destroy();
    },

    setSensitive: function(sensitive) {
        Common.actorSetSensitive(this.actor,
                                 sensitive,
                                 this.actor.label);
    },

    setTooltipText: function(text) {
        this.actor.set_tooltip_text(text);
    },

    setLabel: function(label) {
        this.actor.label.set_text(label);
    }
};

Signals.addSignalMethods(ImageShellMenuItem.prototype);

function ToggleShellMenuItem(parent, prop) {
    this._init(parent, prop);
}

/**
 * ToggleShellMenuItem:
 * @parent: A parent dialog which shows this UI.
 * @prop: IBus.Property
 *
 * This class creates popupMenu.PopupSwitchMenuItem from @prop and
 * also emits the signal of 'property-activate' when it's activated.
 */
ToggleShellMenuItem.prototype = {
    __proto__ : PropItem.PropItem.prototype,

    _init: function(parent, prop) {
        PropItem.PropItem.prototype._init.call(this, prop);
        this._parent = parent;
        let label = this._prop.get_label().get_text();
        this.actor = new St.Button({ style_class: 'modal-dialog-button',
                                     reactive:    true,
                                     can_focus:   true,
                                     label:       label });
        this.actor.raw_text = label;
        this.actor.state = (this._prop.get_state() == IBus.PropState.CHECKED);
        this.setShowDot(this.actor.state);
        if (this._prop.get_visible()) {
            this.actor.show();
        } else {
            this.actor.hide();
        }
        this._activateId = this.actor.connect('clicked',
                                              Lang.bind(this, this._onClicked))
        Common.actorSetSensitive(this.actor,
                                 this._prop.get_sensitive(),
                                 this.actor.label);
    },

    _onClicked: function() {
        // Do not send property-activate to engine in case the event is
        // sent from engine.
        let do_emit = false;
        this.actor.state = !this.actor.state;
        if (this.actor.state) {
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
        this._parent.close(global.get_current_time());
    },

    propertyChanged: function() {
        this.actor.state = (this._prop.get_state() == IBus.PropState.CHECKED);
        this.setShowDot(this.actor.state);
        this.setSensitive(this._prop.get_sensitive());
        if (this._prop.get_visible()) {
            this.actor.show();
        } else {
            this.actor.hide();
        }
    },

    show: function() {
        this.actor.show();
    },

    hide: function() {
        this.actor.hide();
    },

    destroy: function() {
        this.disconnect(this._activateId);
        this.actor.destroy();
    },

    setSensitive: function(sensitive) {
        Common.actorSetSensitive(this.actor,
                                 this._prop.get_sensitive(),
                                 this.actor.label);
    },

    setTooltipText: function(text) {
        this.actor.set_tooltip_text(text);
    },

    setShowDot: function(show) {
        let text = this.actor.raw_text;
        if (show) {
            text = '\u2714  <span font_weight="bold">' + text + '</span>';
        } else {
            text = '    ' + text;
        }
        let label = this.actor.get_child();
        label.set_markup(text);
        this.actor.set_child(label);
    },

    setLabel: function(label) {
        this.actor.label.set_text(label);
        this.actor.raw_text = label;
        this.setShowDot(this.actor.state);
    }
};

Signals.addSignalMethods(ToggleShellMenuItem.prototype);

function RadioShellMenuItem(parent, group, prop) {
    this._init(parent, group, prop);
}

/**
 * RadioShellMenuItem:
 * @parent: A parent dialog which shows this UI.
 * @group: list of RadioShellMenuItem and the length is the radio index.
 * @prop: IBus.Property
 *
 * This class creates popupMenu.PopupMenuItem from @prop and
 * handles a dot as a radio button likes gtk.RadioMenuItem.
 * It also emits the signal of 'property-activate' when it's activated.
 */
RadioShellMenuItem.prototype = {
    __proto__ : PropItem.PropItem.prototype,

    _init: function(parent, group, prop) {
        PropItem.PropItem.prototype._init.call(this, prop);
        this._parent = parent;
        this._group = group;
        this._id = group.length;
        let label = this._prop.get_label().get_text();
        this.actor = new St.Button({ style_class: 'modal-dialog-button',
                                     reactive:    true,
                                     can_focus:   true,
                                     label:       label });
        this.actor.raw_text = label;
        this.actor.state = (this._prop.get_state() == IBus.PropState.CHECKED);
        this.setShowDot(this.actor.state);
        if (this._prop.get_visible()) {
            this.actor.show();
        } else {
            this.actor.hide();
        }
        this._activateId = this.actor.connect('clicked',
                                              Lang.bind(this, this._onClicked))
        Common.actorSetSensitive(this.actor,
                                 this._prop.get_sensitive(),
                                 this.actor.label);
    },

    _onClicked: function() {
        this.actor.state = true;
        // Do not send property-activate to engine in case the event is
        // sent from engine.
        let do_emit = false;
        if (this._prop.get_state() != IBus.PropState.CHECKED) {
            do_emit = true;
        }
        this._prop.set_state(IBus.PropState.CHECKED);
        for (let i = 0; i < this._group.length; i++) {
            if (i != this._id) {
                this._group[i].setState(false);
            }
        }
        if (do_emit) {
            this.emit('property-activate', this._prop.get_key(), this._prop.get_state());
        }
        this._parent.close(global.get_current_time());
    },

    propertyChanged: function() {
        this.setSensitive(this._prop.get_sensitive());
        if (this._prop.get_visible()) {
            this.actor.show();
        } else {
            this.actor.hide()
        }
    },

    show: function() {
        this.actor.show();
    },

    hide: function() {
        this.actor.hide();
    },

    destroy: function() {
        this.disconnect(this._activateId);
        this.actor.destroy();
    },

    setSensitive: function(sensitive) {
        Common.actorSetSensitive(this.actor,
                                 sensitive,
                                 this.actor.label);
    },

    setTooltipText: function(text) {
        this.actor.set_tooltip_text(text);
    },

    setLabel: function(label) {
        this.actor.label.set_text(label);
        this.actor.raw_text = label;
        this.setShowDot(this.actor.state);
    },

    setGroup: function(group) {
        this._group = group;
    },

    setShowDot: function(show) {
        let text = this.actor.raw_text;
        if (show) {
            text = '\u2714  <span font_weight="bold">' + text + '</span>';
        } else {
            text = '    ' + text;
        }
        let label = this.actor.get_child();
        label.set_markup(text);
        this.actor.set_child(label);
    },

    setState: function(state) {
        this.actor.state = state;
        let do_emit = false;
        if (this.actor.state) {
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
    }
};

Signals.addSignalMethods(RadioShellMenuItem.prototype);

function SeparatorShellMenuItem() {
    this._init();
}

/**
 * SeparatorShellMenuItem:
 *
 * This class creates popupMenu.PopupSeparatorMenuItem.
 */
SeparatorShellMenuItem.prototype = {
    __proto__ : PropItem.PropItem.prototype,

    _init: function() {
        PropItem.PropItem.prototype._init.call(this, null);
        this.actor = new Shell.GenericContainer({ style_class: 'popup-menu-item',
                                                  reactive: true,
                                                  track_hover: true,
                                                  can_focus: true });
        this._drawingArea = new St.DrawingArea({ style_class: 'popup-separator-menu-item' });
        this.actor.add_actor(this._drawingArea);
        this._drawingArea.connect('repaint', Lang.bind(this, this._onRepaint));
    },

    _onRepaint: function(area) {
        let cr = area.get_context();
        let themeNode = area.get_theme_node();
        let [width, height] = area.get_surface_size();
        let margin = themeNode.get_length('-margin-horizontal');
        let gradientHeight = themeNode.get_length('-gradient-height');
        let startColor = themeNode.get_color('-gradient-start');
        let endColor = themeNode.get_color('-gradient-end');

        let gradientWidth = (width - margin * 2);
        let gradientOffset = (height - gradientHeight) / 2;
        let pattern = new Cairo.LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight);
        pattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        pattern.addColorStopRGBA(0.5, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255);
        pattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        cr.setSource(pattern);
        cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight);
        cr.fill();
    },

    hide: function() {
        this.actor.hide();
    },

    show: function() {
        this.actor.show();
    },

    setTooltipText: function(text) {
        this.actor.set_tooltip_text(text);
    },

    destroy: function() {
        this.actor.destroy();
    }
};

Signals.addSignalMethods(SeparatorShellMenuItem.prototype);

function SubMenu(parent, prop) {
    this._init(parent, prop);
}

/**
 * SubMenu:
 * @parent: A parent dialog which has contentLayout
 * @prop: IBus.Property
 *
 * This class can be used to display the sub menu.
 * This class also forwards the signal of 'property-activate' from
 * the sub menu items.
 */
SubMenu.prototype = {
    __proto__: PropItem.PropItem.prototype,
    _init: function(parent, prop) {
        PropItem.PropItem.prototype._init.call(this, prop);
        this._parent = parent;
        this._item_pos = 0;
        let l = this._parent.contentLayout.get_children_list();
        if (l != null) {
            // contentLayout.add(SubMenuItem) is called after this instance
            // is generated.
            this._item_pos = l.length + 1;
        }
        this.actor = new St.ScrollView({ style_class: 'popup-sub-menu',
                                         hscrollbar_policy: Gtk.PolicyType.NEVER,
                                         vscrollbar_policy: Gtk.PolicyType.NEVER });
        this._vbox = new St.BoxLayout({ vertical: true });
        this.actor.add_actor(this._vbox);
        this._createItems(this._prop.get_sub_props());
        this.actor.hide();
    },

    _createItems: function(props) {
        let radioGroup = [];
        let item = null;

        for (let i = 0; props.get(i) != null; i++) {
            let prop = props.get(i);
            if (prop.get_prop_type() == IBus.PropType.NORMAL) {
                item = new ImageShellMenuItem(this._parent, prop);
            }
            else if (prop.get_prop_type() == IBus.PropType.TOGGLE) {
                item = new ToggleShellMenuItem(this._parent, prop);

            }
            else if (prop.get_prop_type() == IBus.PropType.RADIO) {
                item = new RadioShellMenuItem(this._parent, radioGroup, prop);
                radioGroup.push(item);
                for (let j = 0; j < radioGroup.length; j++) {
                    radioGroup[j].setGroup(radioGroup);
                }
            }
            else if (prop.get_prop_type() == IBus.PropType.SEPARATOR) {
                item = new SeparatorShellMenuItem();
                radioGroup = [];
            }
            else if (prop.get_prop_type() == IBus.PropType.MENU) {
                item = new SubMenuItem(this._parent, prop);
            }
            else {
                assert (false);
            }

            if (prop.get_tooltip()) {
                item.setTooltipText(prop.get_tooltip().get_text());
            }

            item.setSensitive(prop.get_sensitive());
            if (prop.get_visible()) {
                item.show();
            } else {
                item.hide();
            }

            let hbox = new St.BoxLayout({ vertical: false });
            let pad = new St.Label({ text: '\t' });
            hbox.add(pad);
            hbox.add(item.actor);
            this._vbox.add(hbox);
            this._subItems.push(item);

            if (prop.get_prop_type() != IBus.PropType.NORMAL &&
                prop.get_prop_type() != IBus.PropType.TOGGLE &&
                prop.get_prop_type() != IBus.PropType.RADIO) {
                continue;
            }
            item.connect('property-activate',
                         Lang.bind(this, this._onItemPropertyActivate));
        }
    },

    _onItemPropertyActivate: function (w, n, s) {
        this.emit('property-activate', n, s);
    },

    open: function() {
        if (this.isOpen) {
            return;
        }
        this._parent.contentLayout.add(this.actor);
        this._parent.contentLayout.move_child(this.actor, this._item_pos);
        this.isOpen = true;
        this.actor.show();
    },

    close: function() {
        if (!this.isOpen) {
            return;
        }
        this.actor.hide();
        this.isOpen = false;
        this._parent.contentLayout.remove_actor(this.actor);
    },

    toggle: function() {
        let retval = false;
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
            retval = true;
        }
        return retval;
    }
}

Signals.addSignalMethods(SubMenu.prototype);

function SubMenuItem(parent, prop) {
    this._init(parent, prop);
}

/**
 * SubMenuItem:
 * @parent: A parent dialog which has contentLayout
 * @prop: IBus.Property
 *
 * This class can be used to display the sub menu.
 * This class also forwards the signal of 'property-activate' from
 * the sub menu items.
 */
SubMenuItem.prototype = {
    __proto__: PropItem.PropItem.prototype,
    _init: function(parent, prop) {
        PropItem.PropItem.prototype._init.call(this, prop);
        this._parent = parent;
        this._parentList = null;
        let label = this._prop.get_label().get_text();
        this.actor = new St.Button({ style_class: 'modal-dialog-button',
                                     reactive:    true,
                                     can_focus:   true,
                                     label:       label });
        this.actor.raw_text = label;
        this.actor.set_label(this.actor.raw_text + '\t(+)');
        this.menu = new SubMenu(this._parent, this._prop);
        this.menu.connect('property-activate',
                          Lang.bind(this, this._onItemPropertyActivate));
        this.actor.connect('clicked',
                           Lang.bind(this, this._openSubMenu))
        Common.actorSetSensitive(this.actor,
                                 this._prop.get_sensitive(),
                                 this.actor.label);
    },

    _openSubMenu: function() {
        if (this.menu.toggle()) {
            this.actor.set_label(this.actor.raw_text + '\t(-)');
        } else {
            this.actor.set_label(this.actor.raw_text + '\t(+)');
        }
    },

    // Will delete this.
    /*
    _showProps: function() {
        this._parentList = this._parent.contentLayout.get_children_list();
        let l = this._parentList;
        for (let i = 0; l != null && l[i] != null; i++) {
            this._parent.contentLayout.remove_actor(l[i]);
            l[i].unparent();
        }
        let props = this._prop.get_sub_props();
        let radioGroup = [];
        for (let i = 0; props.get(i) != null; i++) {
            let prop = props.get(i);
            let item = null;
            if (prop.get_prop_type() == IBus.PropType.NORMAL) {
                item = new ImageShellMenuItem(this._parent, prop);
            }
            else if (prop.get_prop_type() == IBus.PropType.TOGGLE) {
                item = new ToggleShellMenuItem(this._parent, prop);
            }
            else if (prop.get_prop_type() == IBus.PropType.RADIO) {
                item = new RadioShellMenuItem(this._parent, radioGroup, prop);
                radioGroup.push(item);
                for (let j = 0; j < radioGroup.length; j++) {
                    radioGroup[j].setGroup(radioGroup);
                }
            }
            else if (prop.get_prop_type() == IBus.PropType.SEPARATOR) {
                item = new SeparatorShellMenuItem();
                radioGroup = null;
            }
            else if (prop.get_prop_type() == IBus.PropType.MENU) {
                item = new SubMenuItem(this._parent, prop);
            }
            else {
                IBusException('Unknown property type = ' + prop.get_prop_type());
            }
            this._parent.contentLayout.add(item.actor);
            item.connect('property-activate',
                         Lang.bind(this, this._onItemPropertyActivate));

        }
    },
    */

    _onItemPropertyActivate: function (w, n, s) {
        this.emit('property-activate', n, s);
    },

    hide: function() {
        this.actor.hide();
    },

    show: function() {
        this.actor.show();
    },

    setSensitive: function(sensitive) {
        Common.actorSetSensitive(this.actor,
                                 sensitive,
                                 this.actor.label);
    },

    setTooltipText: function(text) {
        this.actor.set_tooltip_text(text);
    }
}

Signals.addSignalMethods(SubMenuItem.prototype);
