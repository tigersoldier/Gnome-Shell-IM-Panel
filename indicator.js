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

const Gio = imports.gi.Gio;
const IBus = imports.gi.IBus;
const DBus = imports.dbus;
const Lang = imports.lang;
const Signals = imports.signals;

const Extension = imports.ui.extensionSystem.extensions["gjsimp@tigersoldier"];
const SystemStatusLabelButton = Extension.panelMenu.SystemStatusLabelButton;
const Panel = Extension.panel;

const UIApplicationIface = {
    name: IBus.SERVICE_PANEL,
    methods: [],
    signals: [{ name: 'NameOwnerChanged',
                inSignature: 'sss',
                outSignature: ''
              },
              { name: 'NameLost',
                inSignature: 's',
                outSignature: ''
              },
              { name: 'NameAcquired',
                inSignature: 's',
                outSignature: ''
              }],
    properties: []
};

function UIApplication(indicator) {
    this._init(indicator);
}

UIApplication.prototype = {
    _init: function(indicator) {
        IBus.init();
        this._indicator = indicator;
        DBus.session.exportObject(IBus.PATH_PANEL,
                                  this);
        this._init_bus();
        this._init_panel();
    },

    _init_bus: function() {
        this._bus = new IBus.Bus();
        this._is_connected = false;
        this._bus.connect('connected',
                          Lang.bind(this, this._connected_cb));
        this._bus.connect('disconnected',
                          Lang.bind(this, this._disconnect_cb));
        if (this._bus.is_connected()) {
            this._connected_cb();
        }
    },

    _init_panel: function() {
        let match_rule = "type='signal',\
                         sender='org.freedesktop.IBus',\
                         path='/org/freedesktop/IBus'";
        this._bus.add_match(match_rule);
        match_rule = "type='signal',\
                     sender='org.freedesktop.IBus',\
                     member='NameLost',\
                     arg0='" + IBus.SERVICE_PANEL + "'";
        this._bus.add_match(match_rule);
        this._bus.request_name(IBus.SERVICE_PANEL,
                               IBus.BusNameFlag.ALLOW_REPLACEMENT |
                               IBus.BusNameFlag.REPLACE_EXISTING);
        if (this._bus.is_connected() == false) {
            log('RequestName ' + IBus.SERVICE_PANEL + ' is time out.');
            return;
        }

        if (this._panel) {
            this._panel.restart(this._bus);
        } else {
            this._panel = new Panel.Panel(this._bus, this._indicator);
        }

        this._bus.get_connection().signal_subscribe('org.freedesktop.DBus',
                                                    'org.freedesktop.DBus',
                                                    'NameLost',
                                                    '/org/freedesktop/DBus',
                                                    IBus.SERVICE_PANEL,
                                                    Gio.DBusSignalFlags.NONE,
                                                    Lang.bind(this, this._name_lost_cb),
                                                    null,
                                                    null);
        this._bus.get_connection().signal_subscribe('org.freedesktop.DBus',
                                                    'org.freedesktop.DBus',
                                                    'NameAcquired',
                                                    '/org/freedesktop/DBus',
                                                    IBus.SERVICE_PANEL,
                                                    Gio.DBusSignalFlags.NONE,
                                                    Lang.bind(this, this._name_acquired_cb),
                                                    null,
                                                    null);
    },

    _disconnect_cb: function() {
        this._is_connected = false;
        if (this._panel.is_restart()) {
            this.emit('restart');
            return;
        }
        this.emit('disconnected');
    },

    _name_lost_cb: function() {
        this.emit('name-lost');
    },

    _name_acquired_cb: function() {
        this.emit('name-acquired');
    },

    _connected_cb: function() {
        this._is_connected = true;
        this._init_panel();
        this.emit('connected');
    },

    is_connected: function() {
        return this._is_connected;
    },

    restart: function() {
        this._init_panel();
    },

};

Signals.addSignalMethods(UIApplication.prototype);
DBus.conformExport(UIApplication.prototype, UIApplicationIface);

function Indicator() {
    this._init.apply(this, arguments);
}

Indicator.prototype = {
    __proto__: SystemStatusLabelButton.prototype,

    _init: function() {
        SystemStatusLabelButton.prototype._init.call(this, null, 'dummy', null);
        this._uiapplication = new UIApplication(this);
        if (!this._uiapplication.is_connected()) {
            this.actor.hide();
            log('UIApplication not initialized');
        }
        this._uiapplication.connect('disconnected',
                                    Lang.bind(this, this._disconnect_cb));
        this._uiapplication.connect('restart',
                                    Lang.bind(this, this._restart_cb));
        this._uiapplication.connect('connected',
                                    Lang.bind(this, this._connected_cb));
        this._uiapplication.connect('name-lost',
                                    Lang.bind(this, this._name_lost_cb));
    },

    _disconnect_cb: function() {
        this.actor.hide();
        log('Got disconnected signal from DBus');
    },

    _restart_cb: function() {
        log('Restarting ibus panel');
        this.menu.close();
        this._uiapplication.restart();
    },

    _connected_cb: function() {
        this.actor.show();
        log('Connect to ibus panel');
    },

    _name_lost_cb: function() {
        this.actor.hide();
        log('Got NameLost signal from DBus');
    },
};
