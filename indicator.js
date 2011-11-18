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
const PanelMenu = Extension.panelMenu;
const IBusPanel = Extension.ibusPanel;


function UIApplication(indicator) {
    this._init(indicator);
}

UIApplication.prototype = {
    _init: function(indicator) {
        IBus.init();
        this._bus = new IBus.Bus();
        this._indicator = indicator;
        this._hasInited = false;
        DBus.session.exportObject('/org/freedesktop/IBus/Panel',
                                  this);

        if (this._bus.is_connected() == false) {
            log('ibus-daemon is not running');
            return;
        }

        this._initPanel(false);
        this._hasInited = true;
    },

    _initPanel: function(isRestart) {
        if (isRestart == false) {
            this._bus.connect('disconnected',
                              Lang.bind(this, this._disconnectCB));
            this._bus.connect('connected',
                              Lang.bind(this, this._connectCB));
        }
        let matchRule = "type='signal',\
                        sender='org.freedesktop.IBus',\
                        path='/org/freedesktop/IBus'";
        this._bus.add_match(matchRule);
        matchRule = "type='signal',\
                    sender='org.freedesktop.IBus',\
                    member='NameLost',\
                    arg0='" + IBus.SERVICE_PANEL + "'";
        this._bus.add_match(matchRule);
        this._bus.request_name(IBus.SERVICE_PANEL,
                               IBus.BusNameFlag.ALLOW_REPLACEMENT |
                               IBus.BusNameFlag.REPLACE_EXISTING);
        if (this._bus.is_connected() == false) {
            log('RequestName ' + IBus.SERVICE_PANEL + ' is time out.');
            return;
        }

        if (isRestart) {
            this._panel.restart(this._bus);
        } else {
            this._panel = new IBusPanel.IBusPanel(this._bus, this._indicator);
        }

        this._bus.get_connection().signal_subscribe('org.freedesktop.DBus',
                                                    'org.freedesktop.DBus',
                                                    'NameLost',
                                                    '/org/freedesktop/DBus',
                                                    IBus.SERVICE_PANEL,
                                                    Gio.DBusSignalFlags.NONE,
                                                    Lang.bind(this, this._nameLostCB),
                                                    null,
                                                    null);
    },

    _disconnectCB: function() {
        this._hasInited = false;
        if (this._panel.isRestart()) {
            this.emit('restart');
            return;
        }
        this.emit('disconnected');
    },

    /* If this receives the 'connected' signal from bus, it always
     * restarts the panel because all causes indicates the restart.
     *
     * Case#1: Click 'Quit' from ibus panel menu.
     * Result#1: No 'connected' signal.
     * Case#2: Click 'Restart' from ibus panel menu.
     * Result#2: 'connected' signal will be emitted after 'new IBus.Bus()'.
     * Case#3: Run 'ibus-daemon --xim --replace'
     * Result#3: 'connected' signal will be emitted after 'disconnected'
     *           signal is emitted.
     * Case#4: Run 'imsettings-switch -rnq'
     * Result#4: 'connected' signal will be emitted after 'disconnected'
     *           signal is emitted.
     * Case#5: Run 'imsettings-switch ibus' after 'imsettings-switch none'
     * Result#5: 'connected' signal will be emitted after 'disconnected'
     *           signal is emitted.
     */
    _connectCB: function() {
        this.emit('connected');
        this._initPanel(true);
        this._hasInited = true;
        this.emit('restart-connected');
    },

    _nameLostCB: function() {
        this.emit('name-lost');
    },

    hasInited: function() {
        return this._hasInited;
    },

    restart: function() {
        if (this._bus) {
            this._bus.destroy();
        }
        this._bus = new IBus.Bus();

        this._bus.connect('connected',
                          Lang.bind(this, this._connectCB));
        this._bus.connect('disconnected',
                          Lang.bind(this, this._disconnectCB));
        if (this._bus.is_connected() == false) {
            return;
        }
        this._connectCB();
    }
};

Signals.addSignalMethods(UIApplication.prototype);

function Indicator() {
    this._init();
}

Indicator.prototype = {
    __proto__: PanelMenu.SystemStatusLabelButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusLabelButton.prototype._init.call(this, null,
                                                               'dummy', null);
        this._uiapplication = new UIApplication(this);
        if (!this._uiapplication.hasInited()) {
            this.actor.hide();
            return;
        }
        this._address = IBus.get_address();
        this._uiapplication.connect('connected',
                                    Lang.bind(this, this._connectCB));
        this._uiapplication.connect('disconnected',
                                    Lang.bind(this, this._disconnectCB));
        this._uiapplication.connect('restart',
                                    Lang.bind(this, this._restartCB));
        this._uiapplication.connect('restart-connected',
                                    Lang.bind(this, this._restartConnectedCB));
        this._uiapplication.connect('name-lost',
                                    Lang.bind(this, this._nameLostCB));
    },

    _connectCB: function() {
        log('Got connected signal from DBus');
        this.actor.show();
    },

    _disconnectCB: function() {
        log('Got disconnected signal from DBus');
        this.menu.close();
        this.actor.hide();
    },

    _restartCB: function() {
        log('Restarting ibus panel');
        this.menu.close();
        this._uiapplication.restart();
    },

    _restartConnectedCB: function() {
        log('Restarted ibus panel');
    },

    _nameLostCB: function() {
        log('Got NameLost signal from DBus');
    }
};
