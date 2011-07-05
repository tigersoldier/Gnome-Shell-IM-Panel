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
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Lightbox = imports.ui.lightbox;
const Main = imports.ui.main;
const Util = imports.misc.util;

// const IBUS_PREFIX = imports.misc.config.IBUS_PREFIX;
const IBUS_PREFIX = '/usr';
// const IBUS_PKGDATADIR = imports.misc.config.IBUS_PKGDATADIR;

const Extension = imports.ui.extensionSystem.extensions["gjsimp@tigersoldier"];
const CandidatePanel = Extension.candidatePanel;
const LanguageBar = Extension.languageBar;
const PanelBase = Extension.panelBase;

const PopupImageMenuItemMarkup = Extension.popupMenu.PopupImageMenuItemMarkup;
const XKBLayout = Extension.xkbLayout;
const Common = Extension.common;
const _ = Extension.common._;

const ICON_KEYBOARD = 'input-keyboard-symbolic';
const ICON_ENGINE = 'ibus-engine';
const LIGHTBOX_FADE_TIME = 0.1


function Panel(bus, indicator) {
    this._init(bus, indicator);
}

Panel.prototype = {
    __proto__ : PanelBase.PanelBase.prototype,

    _init: function(bus, indicator) {
        this._indicator = indicator;
        this._setup_pid = -1;
        let prefix = IBUS_PREFIX;
        // let data_dir = IBUS_PKGDATADIR;
        // this._icons_dir = data_dir + '/icons';
        this._setup_cmd = prefix + '/bin/ibus-setup';
        this._is_restart = false;
        this._active_engine = null;

        if (!this._init_bus(bus)) {
            return;
        }
        // this._bus.config_add_watch('panel')

        this._language_bar = new LanguageBar.LanguageBar(indicator);
        this._language_bar.connect('property-activate',
                                   Lang.bind(this, this._on_language_bar_property_activate));
        this._candidate_panel = new CandidatePanel.CandidatePanel();
        this._candidate_panel.connect('cursor-up',
                                      Lang.bind(this, function(widget) {
                                          this.cursor_up();}));
        this._candidate_panel.connect('cursor-down',
                                      Lang.bind(this, function(widget) {
                                          this.cursor_down();}));
        this._candidate_panel.connect('page-up',
                                      Lang.bind(this, function(widget) {
                                          this.page_up();}));
        this._candidate_panel.connect('page-down',
                                      Lang.bind(this, function(widget) {
                                          this.page_down();}));
        this._candidate_panel.connect('candidate-clicked',
                                      Lang.bind(this, function(widget, index, button, state) {
                                          this.candidate_clicked(index, button, state);}));

        this._indicator.setIcon(ICON_KEYBOARD);
        this._indicator.actor.connect('button-press-event',
                                      Lang.bind(this, this._on_shell_panel_button_press_event));
    },

    _init_bus: function(bus) {
        this._bus = bus;
        this._config = this._bus.get_config();
        this._focus_ic = null;

        // connect bus signal
        if (this._config == null) {
            log('Could not get ibus-gconf.');
            return false;
        }

        PanelBase.PanelBase.prototype._init.call(this, bus);

        this._config.connect('value-changed', this._config_value_changed_cb)
        //this._config.connect('reloaded', this._config_reloaded_cb)
        this._bus.get_connection().signal_subscribe('org.freedesktop.DBus',
                                                    'org.freedesktop.DBus',
                                                    'NameOwnerChanged',
                                                    '/org/freedesktop/DBus',
                                                    IBus.SERVICE_PANEL,
                                                    Gio.DBusSignalFlags.NONE,
                                                    Lang.bind(this, this._name_owner_changed_cb),
                                                    null,
                                                    null);

        // init xkb
        this._default_layout = 'default';
        this._default_model = 'default';
        this._default_option = 'default';
        this._use_bridge_hotkey = false;
        try {
            this._use_bridge_hotkey = this._bus.use_bridge_hotkey();
        } catch (e) {
            // This feature is not available.
        }
        this._default_bridge_engine_name = null;
        if (this._use_bridge_hotkey) {
            this._default_bridge_engine_name = this._bus.get_default_bridge_engine_name();
        }
        this._disabled_engines = null;
        this._disabled_engines_id = -1;
        this._disabled_engines_prev_id = -1;
        this._disabled_engines_swapped = 0;
        this._xkb_group_id = -1;

        this._xkblayout = new XKBLayout.XKBLayout(this._config);
        /* Currently GLib.Variant is not implemented. bug #622344 */
        let use_xkb = true;
        /*
        let use_xkb = this._config.get_value('general',
                                             'use_system_keyboard_layout',
                                             false);
        */
        if (!use_xkb) {
            this._xkblayout.use_xkb(use_xkb);
        }
        let value = 'default';
        /*
        let value = this._config.get_value('general',
                                           'system_keyboard_layout',
                                           '') + '';
        */
        if (value == '') {
            value = 'default';
        }
        if (value != 'default') {
            if (value.indexOf('(') >= 0) {
                this._default_layout = value.split('(')[0];
                this._default_model = value.split('(')[1].split(')')[0];
            } else {
                this._default_layout = value;
                this._default_model = null;
            }
            this._xkblayout.set_default_layout(value);
        }
        /*
        value = this._config.get_value('general',
                                       'system_keyboard_option',
                                       '') + '';
        */
        if (value == '') {
            value = 'default';
        }
        if (value != 'default') {
            this._xkblayout.set_default_option(value);
        }

        return true;
    },

    _config_value_changed_cb: function(bus, section, name, value) {
        if (section != 'panel') {
            return;
        }
        if (name == 'lookup_table_orientation') {
            return;
        }
    },

    _config_reloaded_cb: function(bus) {
    },

    _name_owner_changed_cb: function(bus, name, oldname, newname) {
        this._config_reloaded_cb(this._bus);
    },

    _create_shell_menu_for_im: function() {
        if (this._focus_ic == null) {
            let item = new PopupMenu.PopupImageMenuItem(_("No input window"),
                                                        'dialog-information');
            this._indicator.menu.addMenuItem(item);
            return true;
        } else {
            this._language_bar.create_im_menu_shell();
            return this._create_im_menu_shell();
        }
    },

    _create_shell_menu_for_popup: function() {
        let item = new PopupMenu.PopupImageMenuItem(_("Preferences"),
                                                    'preferences-desktop');
        item.connect('activate',
                     Lang.bind(this, this._preferences_item_shell_activate_cb));
        this._indicator.menu.addMenuItem(item);
        let item = new PopupMenu.PopupImageMenuItem(_("Keyboard configuration"),
                                                    'preferences-desktop');
        item.connect('activate',
                     Lang.bind(this, this._g_c_c_item_shell_activate_cb));
        this._indicator.menu.addMenuItem(item);
        item = new PopupMenu.PopupImageMenuItem(_("Restart"), 'reload');
        item.connect('activate',
                     Lang.bind(this, this._restart_item_shell_activate_cb));
        this._indicator.menu.addMenuItem(item);
        item = new PopupMenu.PopupImageMenuItem(_("Quit"), 'exit');
        item.connect('activate',
                     Lang.bind(this, this._quit_item_shell_activate_cb));
        this._indicator.menu.addMenuItem(item);
    },

    _on_language_bar_property_activate: function(widget, prop_name, prop_state) {
        this.property_activate(prop_name, prop_state);
    },

    _on_shell_panel_button_press_event: function(actor, event) {
        this._indicator.menu.removeAll();
        if (this._create_shell_menu_for_im()) {
            this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }
        this._create_shell_menu_for_popup();
    },

    _change_bridge_engine_to_group_layouts: function(engines, current_engine) {
        for (let i = 0; i < engines.length; i++) {
            engines[i].is_bridge = false;
            engines[i].is_bold = false;
        }

        for (let i = 0; i < engines.length; i++) {
            if (this._use_bridge_hotkey &&
                engines[i].name == this._default_bridge_engine_name &&
                this._disabled_engines != null) {
                let array = [];
                for (let j = 0; this._disabled_engines[j] != null; j++) {
                    let kb_engine = this._disabled_engines[j];
                    kb_engine.is_bridge = true;
                    kb_engine.disabled_engines_id = j;
                    kb_engine.is_bold = (current_engine != null &&
                                         current_engine.name == engines[i].name &&
                                         j == this._disabled_engines_id) ?
                                        true : false;
                    array = engines.slice(0, i + j + 1).concat([kb_engine]);
                    array = array.concat(engines.slice(i + j + 1));
                    engines = array;
                }
                if (i == 0) {
                    array = [];
                } else {
                    array = engines.slice(0, i)
                }
                array = array.concat(engines.slice(i + 1));
                engines = array;
                break;
            }
        }

        for (let i = 0; i < engines.length; i++) {
            if (!engines[i].is_bridge) {
                engines[i].is_bold = (current_engine != null &&
                                      current_engine.name == engines[i].name) ?
                                     true : false;
            }
        }

        return engines;
    },

    _check_engines_have_duplicated_lang: function(engines) {
        for (let i = 0; i < engines.length; i++) {
            engines[i].has_duplicated_lang = false;
        }

        for (let i = 0; i < engines.length - 1; i++) {
            let engine_i = engines[i];
            if (engine_i == null) {
                continue;
            }

            let lang_i = IBus.get_language_name(engine_i.language);
            for (let j = i + 1; j < engines.length; j++) {
                let engine_j = engines[j];
                if (engine_j == null) {
                    continue;
                }
                let lang_j = IBus.get_language_name(engine_j.language);
                if (lang_i == lang_j) {
                    engine_i.has_duplicated_lang = true;
                    engine_j.has_duplicated_lang = true;
                }
            }
        }

        return engines;
    },

    _add_engine_in_menu: function(engine) {
        let item = null;
        let full_lang = engine.language;
        let lang = IBus.get_language_name(full_lang);
        if (lang == null) {
            full_lang = '+@';
            lang = _("Other");
        }
        let text = full_lang.substring(0,2) + '  ' + lang;
        if (engine.has_duplicated_lang) {
                text = text + ' (' + engine.longname + ')';
        }
        let icon = ICON_ENGINE;
        if (engine.icon != null) {
            icon = engine.icon;
        }
        if (engine.is_bold) {
            item = new PopupImageMenuItemMarkup('<b>' + text + '</b>', icon);
            item.setShowDot(true);
        } else {
            item = new PopupMenu.PopupImageMenuItem(text, icon);
            item.setShowDot(false);
        }
        item._engine = engine;
        item.connect('activate',
                     Lang.bind(this, this._im_menu_item_shell_activate_cb));
        this._indicator.menu.addMenuItem(item);
    },

    _add_im_off_menu_item: function() {
        let item = new PopupMenu.PopupImageMenuItem(_("Turn off input method"),
                                                    'window-close');
        item._engine = null;
        item.connect('activate',
                     Lang.bind(this, this._im_menu_item_shell_activate_cb));
        if (this._focus_ic == null || !this._focus_ic.is_enabled()) {
            Common.actor_set_sensitive(item.actor, false, item.label);
        } else {
            Common.actor_set_sensitive(item.actor, true, item.label);
        }
        this._indicator.menu.addMenuItem(item);
    },

    _create_im_menu_shell: function() {
        let engines = this._bus.list_active_engines();
        let current_engine = null;
        current_engine = (this._focus_ic != null && this._focus_ic.get_engine());
        if (current_engine == null) {
            current_engine = (engines && engines[0]);
        }
        engines = this._change_bridge_engine_to_group_layouts(engines,
                                                              current_engine);
        engines = this._check_engines_have_duplicated_lang(engines);
        for (let i = 0; i < engines.length; i++) {
            let engine = engines[i];
            if (engine == null) {
                continue;
            }
            this._add_engine_in_menu(engine);
        }
        if (engines.length == 0 || engines[0] == null) {
            return false;
        }
        if (!this._use_bridge_hotkey) {
            this._add_im_off_menu_item();
        }
        return true;
    },

    _im_menu_item_status_activate_cb: function(item) {
        /* this._focus_ic is null on gnome-shell because focus-in event is 
         * happened. So I moved set_engine in focus_in. */
        if (this._focus_ic == null) {
            if (item._engine != null) {
                this._active_engine = item._engine;
            }
            return;
        }
        if (item._engine != null) {
            if (this._use_bridge_hotkey && item._engine.is_bridge) {
                let engines = this._bus.list_active_engines();
                let current_engine = null;
                current_engine = (this._focus_ic != null && this._focus_ic.get_engine());
                if (current_engine == null) {
                    current_engine = (engines && engines[0]);
                }
                if (current_engine != null &&
                    current_engine.name == this._default_bridge_engine_name) {
                    this._disabled_engines_prev_id = this._disabled_engines_id;
                    this._disabled_engines_swapped = 0;
                } else {
                    this._disabled_engines_prev_id = -1;
                }
                this._disabled_engines_id = item._engine.disabled_engines_id;
                this._focus_ic.set_engine(this._default_bridge_engine_name);
            } else {
                this._disabled_engines_prev_id = -1;
                this._focus_ic.set_engine(item._engine.name);
            }
        } else {
            this._disabled_engines_prev_id = -1;
            this._focus_ic.disable();
        }
    },

    _im_menu_item_shell_activate_cb: function(item, event) {
        this._im_menu_item_status_activate_cb(item);
    },

    _child_setup_watch_cb: function(pid, status, data) {
        if (this._setup_pid == pid) {
            this._setup_pid = -1;
        }
    },

    _preferences_item_shell_activate_cb: function(item, event, user_data) {
        if (this._setup_pid != -1) {
            try {
                Util.trySpawnCommandLine('kill -10 ' + this._setup_pid.toString());
                return;

            } catch (e) {
                this._setup_pid = -1;
            }
        }
        let pid = GLib.spawn_async(null,
                                   [this._setup_cmd, 'ibus-setup'],
                                   null,
                                   GLib.SpawnFlags.DO_NOT_REAP_CHILD, null,
                                   null)[1];
        this._setup_pid = pid;
        GLib.child_watch_add(0, this._setup_pid,
                             Lang.bind(this, this._child_setup_watch_cb),
                             null);
    },

    _g_c_c_item_shell_activate_cb: function(item, event, user_data) {
        let app = Shell.AppSystem.get_default().get_app('gnome-region-panel.desktop');
        app.activate(-1);
    },

    _restart_item_shell_activate_cb: function(item, event, user_data) {
        this._is_restart = true;
        this._bus.exit(true);
    },

    _quit_item_shell_activate_cb: function(item, event, user_data) {
        this._bus.exit(false);
    },

    _set_im_icon: function(icon_name, label) {
        if (icon_name == null) {
            icon_name = ICON_ENGINE;
        }
        if (this._indicator != null) {
            if (icon_name[0] == '/') {
                let paths = null;
                let n_elements = 0;
                icon_name = GLib.path_get_basename(icon_name);
                if (icon_name.indexOf('.') >= 0) {
                    icon_name = icon_name.substr(0, icon_name.lastIndexOf('.'));
                }
            }
            if (label != null) {
                this._indicator.setLabel(label);
            } else {
                this._indicator.setIcon(icon_name);
            }
        } else {
            if (icon_name[0] == '/') {
                this._status_icon.set_from_file(icon_name);
            } else {
                this._status_icon.set_from_icon_name(icon_name);
            }
        }
    },

    _set_im_name: function(name) {
        this._language_bar.set_im_name(name);
    },

    _update_icon_with_property: function(prop) {
        if (prop.get_key() != "InputMode") {
            return;
        }
        let text = prop.get_label().get_text();
        if (text == null || text == '') {
            return;
        }
        this._set_im_icon(null, text);
    },

    _engine_get_layout_wrapper: function(engine, changed_state) {
        const xkb_prefix = 'xkb:layout:';
        if (engine.name != null &&
            engine.name.substring(0, xkb_prefix.length) == xkb_prefix &&
            !this._use_bridge_hotkey) {
            return engine.layout;
        } else if (engine.name != null &&
            engine.name.substring(0, xkb_prefix.length) == xkb_prefix &&
            this._use_bridge_hotkey &&
            engine.name != this._default_bridge_engine_name) {
            return engine.layout;
        } else if (this._use_bridge_hotkey &&
            this._disabled_engines_id >= 0 &&
            this._disabled_engines != null &&
            this._disabled_engines_id < this._disabled_engines.length) {
            if (changed_state && this._disabled_engines_prev_id != -1) {
                // state_changed is always called twice because we change
                // the engine. So the first two calls are ignored here.
                if (this._disabled_engines_swapped < 2) {
                    this._disabled_engines_swapped = 
                        this._disabled_engines_swapped + 1;
                } else {
                    let x = this._disabled_engines_prev_id;
                    this._disabled_engines_prev_id = this._disabled_engines_id;
                    this._disabled_engines_id = x;
                    this._disabled_engines_swapped = 1;
                }
            }
            let retval = this._disabled_engines[this._disabled_engines_id].layout
            return retval;
        } else {
            return 'default';
        }
    },

    _set_default_layout_engine: function() {
        let default_layout = this._default_layout;
        let default_model = this._default_model;

        if (default_layout == 'default') {
            default_layout = this._xkblayout.get_default_layout()[0];
            default_model = this._xkblayout.get_default_layout()[1];
        }
        if (default_model == 'default') {
            default_model = this._xkblayout.get_default_layout()[1];
        }

        let layouts = default_layout.split(',');
        let models = null;
        if (default_model != null && default_model != '') {
            models = default_model.split(',');
        }
        if (this._disabled_engines == null || this._disabled_engines == []) {
            this._disabled_engines = [];
            for (let i = 0; layouts[i] != null; i++) {
                let layout = layouts[i];
                let registry = new IBus.XKBConfigRegistry();
                let langs = registry.layout_lang_get_langs(layout);
                let lang = 'en';
                if (langs != null) {
                    lang = langs[0] + "";
                }
                let model = null;
                if (i == 0) {
                    layout = default_layout;
                    model = default_model;
                } else if (models != null && i < models.length) {
                    model = models[i];
                }
                if (model == '') {
                    model = null;
                }
                let model_desc = _("Default Layout");
                if (model != null) {
                    model_desc = model_desc + " (" + model + ")";
                }
                let engine = XKBLayout.engine_desc_new(lang,
                                                       layout,
                                                       _("Default Layout"),
                                                       model,
                                                       model_desc);
                this._disabled_engines[this._disabled_engines.length] = engine;
            }
            this._xkb_group_id = this._xkblayout.get_group();
            this._disabled_engines_id = this._xkb_group_id;
        }
        if (this._focus_ic == null) {
            return;
        }
        if (!this._focus_ic.is_enabled()) {
            this._focus_ic.set_engine(this._default_bridge_engine_name);
        }
    },

    _focus_in_bridge_hotkey: function(enabled, reset) {
        this._set_default_layout_engine();

        if (enabled == false) {
            if (reset) {
                this.reset();
            }
            this._set_im_icon(ICON_KEYBOARD, null);
            this._set_im_name(null);
            if (this._bus.get_use_sys_layout()) {
                this._xkblayout.set_layout();
            }
        } else {
            let engine = this._focus_ic.get_engine();
            if (engine) {
                let im_icon = engine.language.substring(0,2);
                if (engine.name == this._default_bridge_engine_name &&
                    this._disabled_engines != null &&
                    this._disabled_engines_id < this._disabled_engines.length) {
                    let id = this._disabled_engines_id;
                    im_icon = this._disabled_engines[id].language.substring(0,2);
                }
                if (engine.language == 'other') {
                    im_icon = '+@'
                }
                if (engine.symbol != undefined && engine.symbol != "") {
                    im_icon = engine.symbol;
                }
                this._set_im_icon(engine.icon, im_icon);
                this._set_im_name(engine.longname);
                if (this._bus.get_use_sys_layout()) {
                    this._xkblayout.set_layout(this._engine_get_layout_wrapper(engine, reset));
                }
            } else {
                this._set_im_icon(ICON_KEYBOARD, null);
                this._set_im_name(null);
                if (this._bus.get_use_sys_layout()) {
                    this._xkblayout.set_layout(this._engine_get_layout_wrapper(engine, reset));
                }
            }
        }
    },

    _focus_in_on_off_hotkey: function(enabled, reset) {
        if (enabled == false) {
            if (reset) {
                this.reset();
            }
            this._set_im_icon(ICON_KEYBOARD, null);
            this._set_im_name(null);
            if (this._bus.get_use_sys_layout()) {
                this._xkblayout.set_layout();
            }
        } else {
            let engine = this._focus_ic.get_engine();
            if (engine) {
                let im_icon = engine.language.substring(0,2);
                if (engine.language == 'other') {
                    im_icon = '+@'
                }
                if (engine.symbol != undefined && engine.symbol != "") {
                    im_icon = engine.symbol;
                }
                this._set_im_icon(engine.icon, im_icon);
                this._set_im_name(engine.longname);
                if (this._bus.get_use_sys_layout()) {
                    this._xkblayout.set_layout(this._engine_get_layout_wrapper(engine, false));
                }
            } else {
                this._set_im_icon(ICON_KEYBOARD, null);
                this._set_im_name(null);
                if (this._bus.get_use_sys_layout()) {
                    this._xkblayout.set_layout();
                }
            }
        }
    },

    set_cursor_location: function(panel, x, y, w, h) {
        this._candidate_panel.set_cursor_location(x, y, w, h);
    },

    update_preedit_text: function(panel, text, cursor_pos, visible) {
        this._candidate_panel.update_preedit_text(text, cursor_pos, visible);
    },

    show_preedit_text: function(panel) {
        this._candidate_panel.show_preedit_text();
    },

    hide_preedit_text: function(panel) {
        this._candidate_panel.hide_preedit_text();
    },

    update_auxiliary_text: function(panel, text, visible) {
        this._candidate_panel.update_auxiliary_text(text, visible);
    },

    show_auxiliary_text: function(panel) {
        this._candidate_panel.show_auxiliary_text();
    },

    hide_auxiliary_text: function(panel) {
        this._candidate_panel.hide_auxiliary_text();
    },

    update_lookup_table: function(panel, lookup_table, visible) {
        this._candidate_panel.update_lookup_table(lookup_table, visible);
    },

    show_lookup_table: function(panel) {
        this._candidate_panel.show_lookup_table();
    },

    hide_lookup_table: function(panel) {
        this._candidate_panel.hide_lookup_table();
    },

    page_up_lookup_table: function(panel) {
        this._candidate_panel.page_up_lookup_table();
    },

    page_down_lookup_table: function(panel) {
        this._candidate_panel.page_down_lookup_table();
    },

    cursor_up_lookup_table: function(panel) {
        this._candidate_panel.cursor_up_lookup_table();
    },

    cursor_down_lookup_table: function(panel) {
        this._candidate_panel.cursor_down_lookup_table();
    },

    show_candidate_window: function(panel) {
        this._candidate_panel.show_all();
    },

    hide_candidate_window: function(panel) {
        this._candidate_panel.hide_all();
    },

    register_properties: function(panel, props) {
        for (let i = 0; props.get(i) != null; i++) {
            this._update_icon_with_property(props.get(i));
        }
        this._language_bar.register_properties(props);
    },

    update_property: function(panel, prop) {
        this._update_icon_with_property(prop);
        this._language_bar.update_property(prop);
    },

    focus_in: function(panel, path) {
        this.reset();
        this._focus_ic = IBus.InputContext.get_input_context(path,
                                                             this._bus.get_connection());
        let enabled = this._focus_ic.is_enabled();
        this._language_bar.set_enabled(enabled);
        if (this._active_engine != null) {
            this._focus_ic.set_engine(this._active_engine.name);
            this._active_engine = null;
        }

        if (this._use_bridge_hotkey) {
            if (this._xkb_group_id != this._xkblayout.get_group()) {
                this._xkb_group_id = this._xkblayout.get_group();
                this._disabled_engines_id = this._xkb_group_id;
            }
            this._focus_in_bridge_hotkey(enabled, false);
        } else {
            this._focus_in_on_off_hotkey(enabled, false);
        }
    },

    focus_out: function(panel, path) {
        this.reset();
        this._focus_ic = null;
        this._language_bar.set_enabled(false);

        if (this._use_bridge_hotkey) {
            this._focus_in_bridge_hotkey(false, false);
        } else {
            this._focus_in_on_off_hotkey(false, false);
        }
    },

    state_changed: function(panel) {
        if (this._focus_ic == null) {
            return;
        }

        let enabled = this._focus_ic.is_enabled();
        this._language_bar.set_enabled(enabled);

        if (this._use_bridge_hotkey) {
            this._focus_in_bridge_hotkey(enabled, true);
        } else {
            this._focus_in_on_off_hotkey(enabled, true);
        }
    },

    is_restart: function() {
        return this._is_restart;
    },

    restart: function(bus) {
        this._init_bus(bus);
        this._is_restart = false;
    },

    reset: function(ic) {
        //this._candidate_panel.reset();
        //this._language_bar.reset();
    },
};
