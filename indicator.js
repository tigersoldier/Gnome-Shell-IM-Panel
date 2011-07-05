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
        this._bus = new IBus.Bus();
        this._indicator = indicator;
        this._has_inited = false;
        DBus.session.exportObject('/org/freedesktop/IBus/Panel',
                                  this);

        if (this._bus.is_connected() == false) {
            log('ibus-daemon is not running');
            return;
        }

        this._init_panel(false);
        this._has_inited = true;
    },

    _init_panel: function(is_restart) {
        this._bus.connect('disconnected',
                          Lang.bind(this, this._disconnect_cb));
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

        if (is_restart) {
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
    },

    _disconnect_cb: function() {
        this._has_inited = false;
        if (this._panel.is_restart()) {
            this.emit('restart');
            return;
        }
        this.emit('disconnected');
    },

    _name_lost_cb: function() {
        this.emit('name-lost');
    },

    _restart_connect_cb: function() {
        this._init_panel(true);
        this._has_inited = true;
        this.emit('restart-connected');
    },

    has_inited: function() {
        return this._has_inited;
    },

    restart: function() {
        if (this._bus) {
            this._bus.destroy();
        }
        this._bus = new IBus.Bus();

        if (this._bus.is_connected() == false) {
            this._bus.connect('connected',
                              Lang.bind(this, this._restart_connect_cb));
            return;
        }
        this._restart_connect_cb();
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
        if (!this._uiapplication.has_inited()) {
            this.actor.hide();
            log('UIApplication not initialized');
            return;
        }
        this._uiapplication.connect('disconnected',
                                    Lang.bind(this, this._disconnect_cb));
        this._uiapplication.connect('restart',
                                    Lang.bind(this, this._restart_cb));
        this._uiapplication.connect('restart-connected',
                                    Lang.bind(this, this._restart_connected_cb));
        this._uiapplication.connect('name-lost',
                                    Lang.bind(this, this._name_lost_cb));
    },

    _disconnect_cb: function() {
        log('Got disconnected signal from DBus');
    },

    _restart_cb: function() {
        log('Restarting ibus panel');
        this.menu.close();
        this._uiapplication.restart();
    },

    _restart_connected_cb: function() {
        log('Restarted ibus panel');
    },

    _name_lost_cb: function() {
        log('Got NameLost signal from DBus');
    },
};
