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

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const IBus = imports.gi.IBus;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Lightbox = imports.ui.lightbox;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Config = imports.misc.config;

const Extension = imports.ui.extensionSystem.extensions["gjsimp@tigersoldier"];
const CandidatePanel = Extension.candidatePanel;
const LanguageBar = Extension.languageBar;
const IPopupMenu = Extension.popupMenu;
const XKBLayout = Extension.xkbLayout;
const Common = Extension.common;

const ICON_ENGINE = 'ibus-engine';


function IBusPanel(bus, indicator) {
    this._init(bus, indicator);
}

IBusPanel.prototype = {
    _init: function(bus, indicator) {
        this._indicator = indicator;
        this._setupPid = -1;
        this._useSysLayoutSystem = false;
        let prefix = '/usr';
        let dataDir = '/usr/share/ibus';
        this._setupCmd = prefix + '/bin/ibus-setup';
        this._isRestart = false;
        this._activeEngine = null;
        this._duplicatedEngineList = [];

        if (!this._initBus(bus)) {
            return;
        }

        this._languageBar = new LanguageBar.LanguageBar(indicator);
        this._languageBar.connect('property-activate',
                                  Lang.bind(this, this._onLanguageBarPropertyActivate));
        this._candidatePanel = new CandidatePanel.CandidatePanel();
        this._candidatePanel.connect('cursor-up',
                                     Lang.bind(this, function(widget) {
                                         this.cursorUp();}));
        this._candidatePanel.connect('cursor-down',
                                     Lang.bind(this, function(widget) {
                                         this.cursorDown();}));
        this._candidatePanel.connect('page-up',
                                     Lang.bind(this, function(widget) {
                                         this.pageUp();}));
        this._candidatePanel.connect('page-down',
                                     Lang.bind(this, function(widget) {
                                         this.pageDown();}));
        this._candidatePanel.connect('candidate-clicked',
                                     Lang.bind(this,
                                               function(widget, index, button, state) {
                                         this.candidateClicked(index, button, state);}));

        this._indicator.setIcon(XKBLayout.ICON_KEYBOARD);
        this._indicator.actor.connect('button-press-event',
                                      Lang.bind(this, this._onShellPanelButtonPressEvent));

        this._configLoadLookupTableOrientation();
    },

    _initBus: function(bus) {
        this._bus = bus;
        this._focusIC = null;

        // connect bus signal
        this._config = this._bus.get_config();
        if (this._config == null) {
            log('Could not get ibus-gconf.');
            return false;
        }

        this._initSignals();

        this._config.connect('value-changed',
                             Lang.bind(this, this._configValueChangedCB));
        // this._config.connect('reloaded', this._configReloadedCB);

        this._bus.get_connection().signal_subscribe('org.freedesktop.DBus',
                                                    'org.freedesktop.DBus',
                                                    'NameOwnerChanged',
                                                    '/org/freedesktop/DBus',
                                                    IBus.SERVICE_PANEL,
                                                    Gio.DBusSignalFlags.NONE,
                                                    Lang.bind(this, this._nameOwnerChangedCB),
                                                    null,
                                                    null);

        // init xkb
        this._useSysLayoutUser = true;
        this._defaultLayout = 'default';
        this._defaultModel = 'default';
        this._defaultOption = 'default';
        this._useBridgeHotkeySystem = false;
        try {
            this._useBridgeHotkeySystem = IBus.use_bridge_hotkey();
        } catch (e) {
            // This feature is not available.
        }
        this._useBridgeHotkeyUser = true;
        try {
            this._useBridgeHotkeyUser = this._config.get_value(
                'general/hotkey',
                'use_bridge_hotkey',
                GLib.Variant.new_boolean(true)).get_boolean();
        } catch (e) {
            // This feature is not available.
        }
        this._defaultBridgeEngineName = XKBLayout.DEFAULT_BRIDGE_ENGINE_NAME;
        try {
            this._defaultBridgeEngineName = IBus.get_default_bridge_engine_name();
        } catch (e) {
            // This feature is not available.
        }
        this._disabledEngines = [];
        this._disabledEnginesID = -1;
        this._disabledEnginesPrevID = -1;
        this._disabledEnginesSwapped = 0;
        this._xkbGroupID = -1;
        
        if (!this._useSysLayoutSystem) {
            this._useSysLayoutUser = false;
            return true;
        }
        let useXkb = this._config.get_value(
            'general',
            'use_system_keyboard_layout',
            GLib.Variant.new_boolean(false)).get_boolean();
        if (!useXkb) {
            this._useSysLayoutUser = false;
            this._xkblayout.useXkb(false);
        }
        let value = this._config.get_value(
            'general',
            'system_keyboard_layout',
            GLib.Variant.new_string('')).dup_string()[0];
        if (value == '') {
            value = 'default';
        }
        if (value != 'default') {
            if (value.indexOf('(') >= 0) {
                this._defaultLayout = value.split('(')[0];
                this._defaultModel = value.split('(')[1].split(')')[0];
            } else {
                this._defaultLayout = value;
                this._defaultModel = null;
            }
            this._xkblayout.setDefaultLayout(value);
        }
        value = this._config.get_value(
            'general',
            'system_keyboard_option',
            GLib.Variant.new_string('')).dup_string()[0];
        if (value == '') {
            value = 'default';
        }
        if (value != 'default') {
            this._xkblayout.setDefaultOption(value);
        }

        return true;
    },

    _initSignals: function() {
        this._panel = IBus.PanelService.new(this._bus.get_connection());
        this._panel.connect('set-cursor-location',
                            Lang.bind(this, this.setCursorLocation));
        this._panel.connect('update-preedit-text',
                            Lang.bind(this, this.updatePreeditText));
        this._panel.connect('show-preedit-text',
                            Lang.bind(this, this.showPreeditText));
        this._panel.connect('hide-preedit-text',
                            Lang.bind(this, this.hidePreeditText));
        this._panel.connect('update-auxiliary-text',
                            Lang.bind(this, this.updateAuxiliaryText));
        this._panel.connect('show-auxiliary-text',
                            Lang.bind(this, this.showAuxiliaryText));
        this._panel.connect('hide-auxiliary-text',
                            Lang.bind(this, this.hideAuxiliaryText));
        this._panel.connect('update-lookup-table',
                            Lang.bind(this, this.updateLookupTable));
        this._panel.connect('show-lookup-table',
                            Lang.bind(this, this.showLookupTable));
        this._panel.connect('hide-lookup-table',
                            Lang.bind(this, this.hideLookupTable));
        this._panel.connect('page-up-lookup-table',
                            Lang.bind(this, this.pageUpLookupTable));
        this._panel.connect('cursor-up-lookup-table',
                            Lang.bind(this, this.cursorUpLookupTable));
        this._panel.connect('cursor-down-lookup-table',
                            Lang.bind(this, this.cursorDownLookupTable));
        this._panel.connect('focus-in', Lang.bind(this, this.focusIn));
        this._panel.connect('focus-out', Lang.bind(this, this.focusOut));
        this._panel.connect('register-properties',
                            Lang.bind(this, this.registerProperties));
        this._panel.connect('update-property',
                            Lang.bind(this, this.updateProperty));
        this._panel.connect('state-changed',
                            Lang.bind(this, this.stateChanged));
    },

    _useSysLayout: function() {
        if (!this._useSysLayoutSystem) {
            return false;
        }
        return this._useSysLayoutUser;
    },

    _useBridgeHotkey: function() {
        if (!this._useBridgeHotkeySystem) {
            return false;
        }
        return this._useBridgeHotkeyUser;
    },

    _configValueChangedCB: function(bus, section, name, value) {
        global.log ('config changed:' + section + '-' + name + ':' + value);
        if (section != 'panel') {
            return;
        }
        if (name == 'lookup_table_orientation') {
            this._configLoadLookupTableOrientation();
        }
    },

    _configLoadLookupTableOrientation: function() {
        let value = this._config.get_value('panel', 'lookup_table_orientation',
                                           GLib.Variant.new_int32(0)).get_int32();
        let orientation = Common.ORIENTATION_VERTICAL;
        if (value in [Common.ORIENTATION_HORIZONTAL,
                      Common.ORIENTATION_VERTICAL])
            orientation = value;
        if (this._candidatePanel)
            this._candidatePanel.setOrientation(orientation);
    },

    _configReloadedCB: function(bus) {
    },

    _nameOwnerChangedCB: function(bus, name, oldname, newname) {
        this._configReloadedCB(this._bus);
    },

    _createShellMenuForIM: function() {
        if (this._focusIC == null) {
            let item = new PopupMenu.PopupImageMenuItem(_("No input window"),
                                                        'dialog-information');
            this._indicator.menu.addMenuItem(item);
            this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        } else {
            if (this._createIMMenuShell()) {
                this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }
            this._languageBar.createIMMenuShell();
        }
    },

    _createShellMenuForPopup: function() {
        let item = new PopupMenu.PopupImageMenuItem(_("Preferences"),
                                                    'preferences-desktop');
        item.connect('activate',
                     Lang.bind(this, this._preferencesItemShellActivateCB));
        this._indicator.menu.addMenuItem(item);
        this._indicator.menu.addSettingsAction(_("Region and Language Settings"),
                                               'gnome-region-panel.desktop');
        this._indicator.menu.addAction(_("Show Keyboard Layout"),
                                       Lang.bind(this, function() {
            Main.overview.hide();
            let xkbGroupID = this._xkbGroupID;
            if (xkbGroupID < 0) {
                xkbGroupID = 0;
            }
            Util.spawn(['gkbd-keyboard-display', '-g', String(xkbGroupID + 1)]);
        }));
        item = new PopupMenu.PopupImageMenuItem(_("Restart"), 'reload');
        item.connect('activate',
                     Lang.bind(this, this._restartItemShellActivateCB));
        this._indicator.menu.addMenuItem(item);
        item = new PopupMenu.PopupImageMenuItem(_("Quit"), 'exit');
        item.connect('activate',
                     Lang.bind(this, this._quitItemShellActivateCB));
        this._indicator.menu.addMenuItem(item);
    },

    _onLanguageBarPropertyActivate: function(widget, prop_name, prop_state) {
        this.propertyActivate(prop_name, prop_state);
    },

    _onShellPanelButtonPressEvent: function(actor, event) {
        this._indicator.menu.removeAll();
        this._createShellMenuForIM();
        this._createShellMenuForPopup();
    },

    _getDisabledEngine: function(engine) {
        if (this._disabledEngines.length == 0) {
            return null;
        }

        engine.disabledEnginesID = -1
        let kbEngine = null;

        for (let j = 0; j < this._disabledEngines.length; j++) {
            kbEngine = this._disabledEngines[j];
            if (engine.name == kbEngine.name) {
                engine.disabledEnginesID = j;
                break;
            }
        }

        if (engine.disabledEnginesID == -1) {
            return null;
        }

        kbEngine = this._disabledEngines[engine.disabledEnginesID];
        kbEngine.disabledEnginesID = engine.disabledEnginesID;
        return kbEngine;
    },

    _getDuplicatedEngineId: function(engine) {
        if (engine == null) {
            return null;
        }
        for (let i = 0; i < this._duplicatedEngineList.length; i+=2) {
            if (engine.name == this._duplicatedEngineList[i]) {
                return this._duplicatedEngineList[i + 1];
            }
        }
        return null;
    },

    _getLanguageWithDisabledEngine: function(engine) {
        let lang = engine.language;
        if (this._useBridgeHotkey() &&
            engine.name != null &&
            engine.name.substring(0, this._defaultBridgeEngineName.length)
                == this._defaultBridgeEngineName) {
            let kbEngine = this._getDisabledEngine(engine);
            if (kbEngine != null) {
                lang = kbEngine.language;
            }
        }
        return lang;
    },

    _checkEnginesHaveDuplicatedLang: function(engines) {
        this._duplicatedEngineList = [];
        for (let i = 0; i < engines.length; i++) {
            engines[i].hasDuplicatedLang = false;
        }

        for (let i = 0; i < engines.length - 1; i++) {
            let engine_i = engines[i];
            let cnt = 0;
            if (engine_i == null) {
                continue;
            }
            if (this._getDuplicatedEngineId(engine_i) != null) {
                continue;
            }

            let lang_i = this._getLanguageWithDisabledEngine(engine_i);
            if (engine_i.symbol != undefined && engine_i.symbol != '') {
                lang_i = engine_i.symbol;
            }
            for (let j = i + 1; j < engines.length; j++) {
                let engine_j = engines[j];
                if (engine_j == null) {
                    continue;
                }
                let lang_j = this._getLanguageWithDisabledEngine(engine_j);
                if (engine_j.symbol != undefined && engine_j.symbol != '') {
                    lang_j = engine_j.symbol;
                }
                if (lang_i == lang_j) {
                    engine_i.hasDuplicatedLang = true;
                    engine_j.hasDuplicatedLang = true;
                    this._duplicatedEngineList.push(engine_j.name);
                    cnt++;
                    // U+2081 SUBSCRIPT ONE
                    this._duplicatedEngineList.push(String.fromCharCode(0x2081 + cnt));
                }
            }
        }

        return engines;
    },

    _addEngineInMenu: function(engine) {
        let fullLang = engine.language;
        let lang = IBus.get_language_name(fullLang);
        if (lang == null) {
            fullLang = '+@';
            lang = _("Other");
        }
        let shortName = fullLang.substring(0,2);
        if (engine.symbol != undefined && engine.symbol != '') {
            shortName = engine.symbol;
        }
        let suffix = this._getDuplicatedEngineId(engine);
        if (suffix != null) {
            shortName += suffix;
        }
        let shortLabel = new St.Label({ text: shortName });
        let text = lang;
        if (engine.hasDuplicatedLang) {
                text = text + ' (' + engine.longname + ')';
        }
        shortLabel._icon_name = ICON_ENGINE;
        if (engine.icon != null) {
            shortLabel._icon_name = engine.icon;
        }
        let item = new IPopupMenu.PopupActorMenuItem(text, shortLabel);
        if (engine.isBold) {
            item.setShowDot(true);
        } else {
            item.setShowDot(false);
        }
        item._engine = engine;
        item.connect('activate',
                     Lang.bind(this, this._imMenuItemShellActivateCB));
        this._indicator.menu.addMenuItem(item);
    },

    _addIMOffMenuItem: function() {
        let item = new PopupMenu.PopupImageMenuItem(_("Turn off input method"),
                                                    'window-close');
        item._engine = 'none';
        item.connect('activate',
                     Lang.bind(this, this._imMenuItemShellActivateCB));
        if (this._focusIC == null || !this._focusIC.is_enabled()) {
            Common.actorSetSensitive(item.actor, false, item.label);
        } else {
            Common.actorSetSensitive(item.actor, true, item.label);
        }
        this._indicator.menu.addMenuItem(item);
    },

    _createIMMenuShell: function() {
        let engines = this._bus.list_active_engines();
        let currentEngine = null;
        currentEngine = (this._focusIC != null && this._focusIC.get_engine());
        if (currentEngine == null) {
            currentEngine = (engines && engines[0]);
        }
        engines = this._checkEnginesHaveDuplicatedLang(engines);
        for (let i = 0; i < engines.length; i++) {
            let engine = engines[i];
            if (engine == null) {
                continue;
            }
            let kbEngine = null;
            if (engine.name != null &&
                engine.name.substring(0, this._defaultBridgeEngineName.length)
                    == this._defaultBridgeEngineName) {
                if (this._useBridgeHotkey()) {
                    kbEngine = this._getDisabledEngine(engine);
                    if (kbEngine == null) {
                        continue;
                    }
                } else {
                    continue;
                }
            }
            if (kbEngine != null) {
                kbEngine.isBridge = true;
                kbEngine.hasDuplicatedLang = engine.hasDuplicatedLang;
                kbEngine.isBold = (currentEngine != null &&
                                   currentEngine.name == engine.name) ?
                                  true : false;
                this._addEngineInMenu(kbEngine);
                continue;
            }
            engine.isBridge = false;
            engine.isBold = (currentEngine != null &&
                             currentEngine.name == engine.name) ?
                            true : false;
            this._addEngineInMenu(engine);
        }
        if (engines.length == 0 || engines[0] == null) {
            return false;
        }
        if (!this._useBridgeHotkey()) {
            this._addIMOffMenuItem();
        }
        return true;
    },

    _imMenuItemStatusActivateReal: function(engine) {
        if (typeof engine.valueOf() == 'object') {
            if (this._disabledEngines.length > 0 &&
                this._useBridgeHotkey() &&
                engine.isBridge) {
                let engines = this._bus.list_active_engines();
                let currentEngine = null;
                currentEngine = (this._focusIC != null && this._focusIC.get_engine());
                if (currentEngine == null) {
                    currentEngine = (engines && engines[0]);
                }
                if (currentEngine != null &&
                    currentEngine.name != null &&
                    currentEngine.name.substring(0, this._defaultBridgeEngineName.length)
                        ==  this._defaultBridgeEngineName) {
                    this._disabledEnginesPrevID = this._disabledEnginesID;
                    this._disabledEnginesSwapped = 2;
                } else {
                    this._disabledEnginesPrevID = -1;
                }
                this._disabledEnginesID = engine.disabledEnginesID;
                this._focusIC.set_engine(this._disabledEngines[this._disabledEnginesID].name);
            } else {
                this._disabledEnginesPrevID = -1;
                this._focusIC.set_engine(engine.name);
            }
        } else {
            this._disabledEnginesPrevID = -1;
            this._focusIC.disable();
        }
    },

    _imMenuItemStatusActivateCB: function(item) {
        /* this._focusIC is null on gnome-shell because focus-in event is 
         * happened. So I moved set_engine in focusIn. */
        if (this._focusIC == null) {
            this._activeEngine = item._engine;
            return;
        }
        this._imMenuItemStatusActivateReal(item._engine);
    },

    _imMenuItemShellActivateCB: function(item, event) {
        this._imMenuItemStatusActivateCB(item);
    },

    _childSetupWatchCB: function(pid, status, data) {
        if (this._setupPid == pid) {
            this._setupPid = -1;
        }
    },

    _preferencesItemShellActivateCB: function(item, event, user_data) {
        if (this._setupPid != -1) {
            try {
                Util.trySpawnCommandLine('kill -10 ' + this._setupPid.toString());
                return;

            } catch (e) {
                this._setupPid = -1;
            }
        }
        let pid = GLib.spawn_async(null,
                                   [this._setupCmd, 'ibus-setup'],
                                   null,
                                   GLib.SpawnFlags.DO_NOT_REAP_CHILD, null,
                                   null)[1];
        this._setupPid = pid;
        GLib.child_watch_add(0, this._setupPid,
                             Lang.bind(this, this._childSetupWatchCB),
                             null);
    },

    _restartItemShellActivateCB: function(item, event, user_data) {
        this._isRestart = true;
        this._bus.exit(true);
    },

    _quitItemShellActivateCB: function(item, event, user_data) {
        this._bus.exit(false);
    },

    _setIMIcon: function(iconName, label) {
        if (this._indicator == null) {
            return;
        }
        if (iconName == null) {
            iconName = ICON_ENGINE;
        }
        if (iconName[0] == '/') {
            let paths = null;
            let n_elements = 0;
            iconName = GLib.path_get_basename(iconName);
            if (iconName.indexOf('.') >= 0) {
                iconName = iconName.substr(0, iconName.lastIndexOf('.'));
            }
        }
        if (label != null) {
            this._indicator.setLabel(label);
        } else {
            this._indicator.setIcon(iconName);
        }
    },

    _setIMName: function(name) {
        this._languageBar.setIMName(name);
    },

    _updateIconWithProperty: function(prop) {
        if (prop.get_key() != 'InputMode') {
            return;
        }
        let text = prop.get_label().get_text();
        if (text == null || text == '') {
            return;
        }
        this._setIMIcon(null, text);
    },

    _getModelFromLayout: function(layout) {
        let leftBracket = layout.indexOf('(');
        let rightBracket = layout.indexOf(')');
        if (leftBracket >= 0 && rightBracket > leftBracket) {
            return [layout.substring(0, leftBracket) + layout.substring(rightBracket + 1, layout.length),
                    layout.substring(leftBracket + 1, rightBracket)];
        }
        return [layout, 'default'];
    },

    _getOptionFromLayout: function(layout) {
        let leftBracket = layout.indexOf('[');
        let rightBracket = layout.indexOf(']');
        if (leftBracket >= 0 && rightBracket > leftBracket) {
            return [layout.substring(0, leftBracket) + layout.substring(rightBracket + 1, layout.length),
                    layout.substring(leftBracket + 1, rightBracket)];
        }
        return [layout, 'default'];
    },

    _mergeModelsAndOptions: function(curLayout, engineLayout) {
        let origLayout = curLayout;
        let engineModel = 'default';
        let engineOption = 'default';
        [engineLayout, engineModel] =
            this._getModelFromLayout(engineLayout);
        [engineLayout, engineOption] =
            this._getOptionFromLayout(engineLayout);
        if ((engineModel == null || engineModel == 'default') &&
            (engineOption == null || engineOption == 'default')) {
            return curLayout;
        }
        let curModel = 'default';
        let curOption = 'default';
        [curLayout, curModel] =
            this._getModelFromLayout(curLayout);
        [curLayout, curOption] =
            this._getOptionFromLayout(curLayout);
        // Currently implemented options only.
        // Merging layouts and models are a little complicated.
        // e.g. ja,ru + ja(kana) == ja,ru,ja(,,kana)
        if (engineOption != null && engineOption != 'default') {
            if (curOption == null || curOption == 'default') {
                curOption = engineOption;
            }
            else if (curOption != null && curOption != 'default') {
                curOption = curOption + ',' + engineOption;
            }
            if (curModel != null && curModel != 'default') {
                curLayout = curLayout + '(' + curModel + ')';
            }
            if (curOption != null && curOption != 'default') {
                curLayout = curLayout + '[' + curOption + ']';
            }
            return curLayout
        }
        return origLayout
    },

    _engineGetLayoutWrapper: function(engine, changedState) {
        const xkbPrefix = 'xkb:layout:';
        if (engine.name != null &&
            engine.name.substring(0, xkbPrefix.length) == xkbPrefix &&
            !this._useBridgeHotkey()) {
            return engine.layout;
        } else if (engine.name != null &&
            engine.name.substring(0, xkbPrefix.length) == xkbPrefix &&
            this._useBridgeHotkey() &&
            engine.name != null &&
            engine.name.substring(0, this._defaultBridgeEngineName.length)
                != this._defaultBridgeEngineName) {
            return engine.layout;
        } else if (this._useBridgeHotkey() &&
            this._disabledEnginesID >= 0 &&
            this._disabledEngines.length > 0 &&
            this._disabledEnginesID < this._disabledEngines.length) {
            if (changedState && this._disabledEnginesPrevID != -1) {
                /* stateChanged is always called triple because we change
                 * the engine. So the first two calls are ignored here.
                 * Since this._disabledEnginesPrevID needs to be reseted
                 * to -1 and and stateChanged is called multiple times.
                 * engine.layout is not used.
                 *
                 * When stateChanged is called by Control + Space,
                 * this._disabledEnginesID and this._disabledEnginesPrevID
                 * are toggled because this._disabledEnginesID is the
                 * current XKB group id and this._disabledEnginesPrevID
                 * is the next XKB group id.
                 *
                 * When stateChanged is called by ibus activate menu,
                 * this._disabledEnginesID is the XKB group id.
                 *
                 * FIXME: If this._activeEngine is used, focusIn event is
                 * called by either choosing ibus menu item or switching
                 * input contexts.
                 * So there is a bug: After XKB group is switched by
                 * ibus menu, if the input contexts are switched, 
                 * the next toggled input method has next XKB group keymap
                 * instead of the current XKB group keymap.
                 * focusIn event don't know either choosing ibus menu or 
                 * switching input contexts are happened.
                 */
                if (this._disabledEnginesSwapped < 2) {
                    let x = this._disabledEnginesPrevID;
                    this._disabledEnginesPrevID = this._disabledEnginesID;
                    this._disabledEnginesID = x;
                    this._disabledEnginesSwapped = 
                        (this._disabledEnginesSwapped == 0) ? 1 : 0;
                } else {
                    this._disabledEnginesSwapped = 
                        (this._disabledEnginesSwapped < 4) ?
                        this._disabledEnginesSwapped + 1 : 0;
                }
            }
            let retval = this._disabledEngines[this._disabledEnginesID].layout;
            /* engine is an input-method or a keymap and if engine is
             * a keymap, the layout is not 'default'.
             * if engine is an input-method, the layout is merged with the
             * current XKB keymap here.
             */
            if (engine.layout != null && 
                engine.layout.substring(0, 'default'.length) == 'default') {
                return this._mergeModelsAndOptions(retval, engine.layout);
            }
            return retval;
        } else if (engine.layout != null && 
                   engine.layout.substring(0, 'default'.length) == 'default') {
            return engine.layout;
        } else {
            return 'default';
        }
    },

    _registryGetLangFromLayout: function(registry, layout, model) {
        let langs = null;
        let lang = 'en';
        let label = null;
        if (model == '') {
            model = null;
        }
        if (model != null) {
            label = layout + '(' + model + ')';
            langs = registry.layout_lang_get_langs(label);
        }
        if (langs == null || langs.length == 0) {
            label = layout;
            langs = registry.layout_lang_get_langs(label);
        }
        if (langs != null && langs.length > 0) {
            lang = langs[0] + '';
        }
        return lang;
    },

    _setDefaultLayoutEngine: function(useBridgeHotkey) {
        if (!this._useSysLayout()) {
            return;
        }

        let defaultLayout = this._defaultLayout;
        let defaultModel = this._defaultModel;

        if (defaultLayout == 'default') {
            defaultLayout = this._xkblayout.getDefaultLayout()[0];
            defaultModel = this._xkblayout.getDefaultLayout()[1];
        }
        if (defaultModel == 'default') {
            defaultModel = this._xkblayout.getDefaultLayout()[1];
        }

        let layouts = defaultLayout.split(',');
        let models = null;
        if (defaultModel != null && defaultModel != '') {
            models = defaultModel.split(',');
        }
        if (this._disabledEngines.length == 0) {
            for (let i = 0; layouts[i] != null; i++) {
                let layout = layouts[i];
                let registry = new IBus.XKBConfigRegistry();
                let model = null;
                if (models != null && i < models.length) {
                    model = models[i];
                }
                let lang = this._registryGetLangFromLayout(registry,
                                                           layout,
                                                           model);
                model = null;
                if (i == 0) {
                    layout = defaultLayout;
                    model = defaultModel;
                } else if (models != null && i < models.length) {
                    model = models[i];
                }
                if (model == '') {
                    model = null;
                }
                let modelDesc = _("Default Layout");
                if (i == 0) {
                    let len = 0;
                    // layout 'in' and model 'eng' is English layout.
                    if (model != 'eng') {
                        for (let j = 0; models && j < models.length; j++) {
                            len += models[j].length;
                        }
                    }
                    if (len != 0) {
                        modelDesc = modelDesc + ' (' + model + ')';
                    }
                } else if (model != null) {
                    modelDesc = modelDesc + ' (' + model + ')';
                }
                let name = this._defaultBridgeEngineName
                    + '#' + i.toString();
                let engine = XKBLayout.engineDescNew(lang,
                                                     layout,
                                                     _("Default Layout"),
                                                     model,
                                                     modelDesc,
                                                     name);
                this._disabledEngines.push(engine);
            }
            this._xkbGroupID = this._xkblayout.getGroup();
            this._disabledEngines_id = this._xkbGroupID;
            if (useBridgeHotkey && this._disabledEngines.length > 0) {
                this._focusIC.set_xkb_engines(this._disabledEngines);
            }
        }
        if (!useBridgeHotkey) {
            return;
        }
        if (this._disabledEngines.length > 0) {
            if (!this._focusIC == null) {
                return;
            }
            let engine = this._focusIC.get_engine();
            if (engine == null) {
                if (this._disabledEnginesID < 0) {
                    this._disabledEnginesID = 0;
                }
                if (this._disabledEnginesID < this._disabledEngines.length) {
                    this._focusIC.focus_in();
                    this._focusIC.set_engine(this._disabledEngines[this._disabledEnginesID].name);
                }
            } else if (engine != null && !this._focusIC.is_enabled()) {
                this._focusIC.focus_in();
                this._focusIC.enable();
            }
        }
    },

    _focusInBridgeHotkey: function(enabled, reset) {
        if (enabled == false) {
            if (reset) {
                this.reset();
            }
            this._setIMIcon(XKBLayout.ICON_KEYBOARD, null);
            this._setIMName(null);
            if (this._useSysLayout()) {
                this._xkblayout.setLayout();
            }
        } else {
            let engine = this._focusIC.get_engine();
            if (engine) {
                let kbEngine = null;
                if (this._useBridgeHotkey() &&
                    engine.name != null &&
                    engine.name.substring(0, this._defaultBridgeEngineName.length)
                        == this._defaultBridgeEngineName) {
                    kbEngine = this._getDisabledEngine(engine);
                }
                if (kbEngine != null) {
                    engine = kbEngine;
                }
                let imIcon = engine.language.substring(0,2);
                if (engine.language == 'other') {
                    imIcon = '+@';
                }
                if (engine.symbol != undefined && engine.symbol != '') {
                    imIcon = engine.symbol;
                }
                let suffix = this._getDuplicatedEngineId(engine);
                if (suffix != null) {
                    imIcon += suffix;
                }
                this._setIMIcon(engine.icon, imIcon);
                this._setIMName(engine.longname);
                if (this._useSysLayout()) {
                    this._xkblayout.setLayout(this._engineGetLayoutWrapper(engine, reset));
                }
            } else {
                this._setIMIcon(XKBLayout.ICON_KEYBOARD, null);
                this._setIMName(null);
                if (this._useSysLayout()) {
                    this._xkblayout.setLayout(this._engineGetLayoutWrapper(engine, reset));
                }
            }
        }
    },

    _focusInOnOffHotkey: function(enabled, reset) {
        if (enabled == false) {
            if (reset) {
                this.reset();
            }
            this._setIMIcon(XKBLayout.ICON_KEYBOARD, null);
            this._setIMName(null);
            if (this._useSysLayout()) {
                this._xkblayout.setLayout();
            }
        } else {
            let engine = this._focusIC.get_engine();
            if (engine) {
                let imIcon = engine.language.substring(0,2);
                if (engine.language == 'other') {
                    imIcon = '+@';
                }
                if (engine.symbol != undefined && engine.symbol != '') {
                    imIcon = engine.symbol;
                }
                let suffix = this._getDuplicatedEngineId(engine);
                if (suffix != null) {
                    imIcon += suffix;
                }
                this._setIMIcon(engine.icon, imIcon);
                this._setIMName(engine.longname);
                if (this._useSysLayout()) {
                    this._xkblayout.setLayout(this._engineGetLayoutWrapper(engine, false));
                }
            } else {
                this._setIMIcon(XKBLayout.ICON_KEYBOARD, null);
                this._setIMName(null);
                if (this._useSysLayout()) {
                    this._xkblayout.setLayout();
                }
            }
        }
    },

    setCursorLocation: function(panel, x, y, w, h) {
        this._candidatePanel.setCursorLocation(x, y, w, h);
    },

    updatePreeditText: function(panel, text, cursorPos, visible) {
        this._candidatePanel.updatePreeditText(text, cursorPos, visible);
    },

    showPreeditText: function(panel) {
        this._candidatePanel.showPreeditText();
    },

    hidePreeditText: function(panel) {
        this._candidatePanel.hidePreeditText();
    },

    updateAuxiliaryText: function(panel, text, visible) {
        this._candidatePanel.updateAuxiliaryText(text, visible);
    },

    showAuxiliaryText: function(panel) {
        this._candidatePanel.showAuxiliaryText();
    },

    hideAuxiliaryText: function(panel) {
        this._candidatePanel.hideAuxiliaryText();
    },

    updateLookupTable: function(panel, lookupTable, visible) {
        this._candidatePanel.updateLookupTable(lookupTable, visible);
    },

    showLookupTable: function(panel) {
        this._candidatePanel.showLookupTable();
    },

    hideLookupTable: function(panel) {
        this._candidatePanel.hideLookupTable();
    },

    pageUpLookupTable: function(panel) {
        this._candidatePanel.pageUpLookupTable();
    },

    pageDownLookupTable: function(panel) {
        this._candidatePanel.pageDownLookupTable();
    },

    cursorUpLookupTable: function(panel) {
        this._candidatePanel.cursorUpLookupTable();
    },

    cursorDownLookupTable: function(panel) {
        this._candidatePanel.cursorDownLookupTable();
    },

    showCandidateWindow: function(panel) {
        this._candidatePanel.showAll();
    },

    hideCandidateWindow: function(panel) {
        this._candidatePanel.hideAll();
    },

    registerProperties: function(panel, props) {
        for (let i = 0; props.get(i) != null; i++) {
            this._updateIconWithProperty(props.get(i));
        }
        this._languageBar.registerProperties(props);
    },

    updateProperty: function(panel, prop) {
        this._updateIconWithProperty(prop);
        this._languageBar.updateProperty(prop);
    },

    focusIn: function(panel, path) {
        this.reset();
        this._focusIC = IBus.InputContext.get_input_context(path,
                                                            this._bus.get_connection());
        let enabled = this._focusIC.is_enabled();
        this._languageBar.setEnabled(enabled);
        if (this._activeEngine != null) {
            this._imMenuItemStatusActivateReal(this._activeEngine);
            this._activeEngine = null;
        }
        if (this._activeIBusProperties != null) {
            for (let i = 0; i < this._activeIBusProperties.length; i++) {
                this._panel.property_activate(this._activeIBusProperties[i][0],
                                              this._activeIBusProperties[i][1]);
            }
            this._activeIBusProperties = null;
        }

        let useBridgeHotkey = this._useBridgeHotkey();
        this._setDefaultLayoutEngine(useBridgeHotkey);
        if (useBridgeHotkey) {
            if (this._useSysLayout() &&
                this._xkbGroupID != this._xkblayout.getGroup()) {
                this._xkbGroupID = this._xkblayout.getGroup();
                this._disabledEnginesID = this._xkbGroupID;
            }
            this._focusInBridgeHotkey(enabled, false);
        } else {
            this._focusInOnOffHotkey(enabled, false);
        }
    },

    focusOut: function(panel, path) {
        this.reset();
        this._focusIC = null;
        this._languageBar.setEnabled(false);

        if (this._useBridgeHotkey()) {
            this._focusInBridgeHotkey(false, false);
        } else {
            this._focusInOnOffHotkey(false, false);
        }
    },

    stateChanged: function(panel) {
        if (this._focusIC == null) {
            return;
        }

        let enabled = this._focusIC.is_enabled();
        this._languageBar.setEnabled(enabled);

        if (this._useBridgeHotkey()) {
            this._focusInBridgeHotkey(enabled, true);
        } else {
            this._focusInOnOffHotkey(enabled, true);
        }
    },

    reset: function(ic) {
        this._candidatePanel.reset();
    },

    pageUp: function() {
        this._panel.page_up();
    },

    pageDown: function() {
        this._panel.page_down();
    },

    cursorUp: function() {
        this._panel.cursor_up();
    },

    cursorDown: function() {
        this._panel.cursor_down();
    },

    candidateClicked: function(index, button, state) {
        this._panel.candidate_clicked(index, button, state);
    },

    propertyActivate: function(propName, propState) {
        /* this._focusIC is null on gnome-shell because focus-in event is 
         * happened. So I moved property_activate in focusIn. */
        if (this._focusIC == null) {
            if (this._activeIBusProperties == null) {
                this._activeIBusProperties = [];
            }
            this._activeIBusProperties.push([propName, propState]);
            return;
        }
        this._panel.property_activate(propName, propState);
    },

    propertyShow: function(propName) {
        propName = new DBus.String(propName);
        this._panel.property_show(propName);
    },

    propertyHide: function(prop_name) {
        propName = new DBus.String(propName);
        this._panel.property_hide(propName);
    },

    isRestart: function() {
        return this._isRestart;
    },

    restart: function(bus) {
        this._initBus(bus);
        this._isRestart = false;
    }
};
