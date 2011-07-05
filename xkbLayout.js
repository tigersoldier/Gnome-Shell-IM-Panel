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
const IBus = imports.gi.IBus;
const Main = imports.ui.main;

const Config = imports.misc.config;
const Util = imports.misc.util;

const Extension = imports.ui.extensionSystem.extensions["gjsimp@tigersoldier"];
const _ = Extension.common._;

const XKB_SESSION_TIME_OUT = 30.0;

function _trySpawnWithPipes(argv) {
    let retval = [false, null, null, -1];

    try {
        retval = GLib.spawn_sync(null, argv, null,
                                 GLib.SpawnFlags.SEARCH_PATH,
                                 null, null);
    } catch (err) {
        if (err.code == GLib.SpawnError.G_SPAWN_ERROR_NOENT) {
            err.message = _("Command not found");
        } else {
            // The exception from gjs contains an error string like:
            //   Error invoking GLib.spawn_command_line_async: Failed to
            //   execute child process "foo" (No such file or directory)
            // We are only interested in the part in the parentheses. (And
            // we can't pattern match the text, since it gets localized.)
            err.message = err.message.replace(/.*\((.+)\)/, '$1');
        }

        throw err;
    }
    return retval;
}

function _handleSpawnError(command, err) {
    let title = _("Execution of '%s' failed:").format(command);
    Main.notifyError(title, err.message);
}

function _spawn_with_pipes(argv) {
    try {
        return _trySpawnWithPipes(argv);
    } catch (err) {
        _handleSpawnError(argv[0], err);
        return [false, null, err.message, -1];
    }
}

function XKBLayout(config, command) {
    this._init(config, command);
}

XKBLayout.prototype = {
    _init: function(config, command) {
        this._config = null;
        this._command = Config.IBUS_XKB;
        this._use_xkb = Config.HAVE_IBUS_XKB;

        if (config != undefined) {
            this._config = config;
        }
        if (command != undefined) {
            this._command = command;
        }
        if (this._command == null) {
            this._use_xkb = false;
        }
        this._default_layout = this.get_layout();
        this._default_model = this.get_model();
        this._default_option = this.get_option();
        this._time_lag_session_xkb_layout = true;
        this._time_lag_session_xkb_option = true;
        this._time_lag_session_xkb_timer = 0;
        GLib.test_timer_start();
        this._xkb_latin_layouts = [];
        /* Currently GLib.Variant is not implemented. bug #622344 */
        /*
        if (this._config != null) {
            this._xkb_latin_layouts = this._config.get_value('general',
                                                             'xkb_latin_layouts',
                                                             []);
        }
        */
    },

    _get_model_from_layout: function(layout) {
        let left_bracket = layout.indexOf('(');
        let right_bracket = layout.indexOf(')');
        if (left_bracket >= 0 && right_bracket > left_bracket) {
            return [layout.substring(0, left_bracket),
                    layout.substring(left_bracket + 1, right_bracket)];
        }
        return [layout, 'default'];
    },

    _get_output_from_cmdline: function(arg, str) {
        let retval = null;
        let basename = GLib.path_get_basename(this._command);
        let argv = [this._command, basename, arg];
        let [result, output, std_err, status] = _spawn_with_pipes(argv);
        if (!result) {
            return null;
        }
        let lines = output.split('\n');
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.substring(0, str.length) == str) {
                retval = line.substring(str.length);
                break;
            }
        }
        return retval;
    },

    use_xkb: function(enable) {
        if (this._command == null) {
            return;
        }
        this._use_xkb = enable;
    },

    get_layout: function() {
        if (!this._use_xkb) {
            return null;
        }
        return this._get_output_from_cmdline('--get', 'layout: ');
    },

    get_model: function() {
        if (!this._use_xkb) {
            return null;
        }
        return this._get_output_from_cmdline('--get', 'model: ');
    },

    get_option: function() {
        if (!this._use_xkb) {
            return null;
        }
        return this._get_output_from_cmdline('--get', 'option: ');
    },

    get_group: function() {
        if (!this._use_xkb) {
            return 0;
        }
        return this._get_output_from_cmdline('--get-group', 'group: ');
    },

    set_layout: function(layout, model, option) {
        if (!this._use_xkb) {
            return;
        }
        if (layout == undefined) {
            layout = 'default';
        }
        if (model == undefined) {
            model = 'default';
        }
        if (option == undefined) {
            option = 'default';
        }
        if (layout == null) {
            return;
        }
        if (this._default_layout == null) {
            // Maybe opening display was failed in constructor.
            this.reload_default_layout();
        }
        if (this._default_layout == null) {
            return;
        }
        layout = layout + '';
        // if set_default_layout() is not default, the default layout is
        // pulled from the current XKB. But it's possible gnome-settings-daemon
        // does not run yet. I added XKB_SESSION_TIME_OUT for the timer.
        if (this._time_lag_session_xkb_layout == true) {
            this._default_layout = this.get_layout();
            this._default_model = this.get_model();
        }
        if (this._time_lag_session_xkb_option == true) {
            this._default_option = this.get_option();
        }
        if ((this._time_lag_session_xkb_layout == true ||
             this._time_lag_session_xkb_option == true) &&
            (GLib.test_timer_elapsed() - this._time_lag_session_xkb_timer
             > XKB_SESSION_TIME_OUT)) {
            this._time_lag_session_xkb_layout = false;
            this._time_lag_session_xkb_option = false;
        }
        let is_default_layout = false;
        if (layout == 'default') {
            is_default_layout = true;
            layout = this._default_layout;
        } else {
            this._time_lag_session_xkb_layout = false;
        }
        if (model != null) {
            model = model + '';
            if (model == 'default') {
                [layout, model] = this._get_model_from_layout(layout);
            }
            if (model == 'default') {
                if (is_default_layout) {
                    model = this._default_model;
                } else {
                    model = null;
                }
            } else {
                this._time_lag_session_xkb_layout = false;
            }
        }
        if (option != null) {
            option = option + '';
            if (option == 'default') {
                option = this._default_option;
            } else {
                this._time_lag_session_xkb_option = false;
            }
        }
        let need_us_layout = false;
        for (let latin_layout in this._xkb_latin_layouts) {
            latin_layout = latin_layout + '';
            if (layout == latin_layout) {
                need_us_layout = true;
                break;
            }
            if (model != null && layout + '(' + model + ')' == latin_layout) {
                need_us_layout = true;
                break;
            }
        }
        if (need_us_layout) {
            layout = layout + ',us';
            if (model != null) {
                model = model + ',';
            }
        }
        if (layout == this.get_layout() &&
            model == this.get_model() &&
            option == this.get_option()) {
            return;
        }
        let args = [];
        args[args.length] = this._command;
        args[args.length] = GLib.path_get_basename(this._command);
        args[args.length] = '--layout';
        args[args.length] = layout;
        if (model != null) {
            args[args.length] = '--model';
            args[args.length] = model;
        }
        if (option != null) {
            args[args.length] = '--option';
            args[args.length] = option;
        }
        Util.spawn(args);
    },

    get_default_layout: function() {
        return [this._default_layout, this._default_model];
    },

    get_default_option: function() {
        return this._default_option;
    },

    set_default_layout: function(layout, model) {
        if (!this._use_xkb) {
            return;
        }
        if (layout == undefined) {
            layout = 'default';
        }
        if (model == undefined) {
            model = 'default';
        }
        if (layout == null) {
            log('ibus.xkblayout: None layout');
            return;
        }
        if (model == null) {
            log('ibus.xkblayout: None model');
            return;
        }
        if (layout == 'default') {
            this._default_layout = this.get_layout();
            this._default_model = this.get_model();
        } else {
            if (model == 'default') {
                [layout, model] = this._get_model_from_layout(layout);
            }
            this._default_layout = layout;
            this._time_lag_session_xkb_layout = false;
            if (model == 'default') {
                this._default_model = null;
            } else {
                this._default_model = model;
            }
        }
    },

    set_default_option: function(option) {
        if (!this._use_xkb) {
            return;
        }
        if (option == undefined) {
            option = 'default';
        }
        if (option == null) {
            log('ibus.xkblayout: None option');
            return;
        }
        if (option == 'default') {
            this._default_option = self.get_option();
        } else {
            this._default_option = option;
            this._time_lag_session_xkb_option = false;
        }
    },

    reload_default_layout: function() {
        if (!this._use_xkb) {
            return;
        }
        this._default_layout = self.get_layout();
        this._default_model = self.get_model();
        this._default_option = self.get_option();
    },
};

function engine_desc_new(lang, layout, layout_desc, variant, variant_desc) {
    let name = null;
    let longname = layout;
    let desc = null;
    let engine_layout = null;
    let engine = null;

    if (layout_desc == undefined) {
        layout_desc = null;
    }
    if (variant == undefined) {
        variant = null;
    }
    if (variant_desc == undefined) {
        variant_desc = null;
    }
    if (variant_desc != null) {
        longname = variant_desc
    } else if (layout != null && variant != null) {
        longname = layout + " - " + variant
    } else if (layout_desc != null) {
        longname = layout_desc
    }
    if (variant != null) {
        name = "xkb:layout:" + layout + ":" + variant
        desc = "XKB " + layout + "(" + variant + ") keyboard layout"
        engine_layout = layout + "(" + variant + ")"
    } else {
        name = "xkb:layout:" + layout
        desc = "XKB " + layout + " keyboard layout"
        engine_layout = layout
    }

    engine = new IBus.EngineDesc({ name: name,
                                   longname: longname,
                                   description: desc,
                                   language: lang,
                                   license: "LGPL2.1",
                                   author: "Takao Fujiwara <takao.fujiwara1@gmail.com>",
                                   icon: "ibus-engine",
                                   layout: engine_layout });
    return engine
}
