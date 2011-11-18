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
const Lang = imports.lang;

const Config = imports.misc.config;
const Util = imports.misc.util;

const XKB_SESSION_TIME_OUT = 30.0;
const ICON_KEYBOARD = 'input-keyboard-symbolic';
const DEFAULT_BRIDGE_ENGINE_NAME = 'xkb:layout:default:';
const XMODMAP_CMD = 'xmodmap';
const XMODMAP_KNOWN_FILES = ['.xmodmap', '.xmodmaprc', '.Xmodmap', '.Xmodmaprc'];


function XKBLayout(config, command) {
    this._init(config, command);
}

XKBLayout.prototype = {
    _init: function(config) {
        this._config = null;
        this._command = '';
        this._useXkb = false;
        this._useXmodmap = true;
        this._xkbPid = -1;
        this._xmodmapPid = -1;

        if (config != undefined) {
            this._config = config;
        }
        if (this._command == null) {
            this._useXkb = false;
        }
        this._defaultLayout = this.getLayout();
        this._defaultModel = this.getModel();
        this._defaultOption = this.getOption();
        /* If setDefaultLayout() is default, the default layout is
         * pulled from the current XKB. But it's possible gnome-settings-daemon
         * does not run yet. I added XKB_SESSION_TIME_OUT for the timer.
         * The _timeLagSessionXkbTimer will be compared with
         * XKB_SESSION_TIME_OUT.
         * Maybe it would be good that IBusPanel is able to create
         * IBus.Engines from gsettings of org.gnome.libgnomekbd.keyboard */
        this._timeLagSessionXkbLayout = true;
        this._timeLagSessionXkbOption = true;
        this._timeLagSessionXkbTimer = 0;
        GLib.test_timer_start();
        this._xkbLatinLayouts = [];
        if (this._config != null) {
            let value = this._config.get_value('general',
                                               'xkb-latin-layouts',
                                               null);
            for (let i = 0; value != null && i < value.n_children(); i++) {
                this._xkbLatinLayouts.push(
                    value.get_child_value(i).dup_string()[0]);
            }
            let useXmodmapValue = this._config.get_value(
                'general',
                'use-xmodmap',
                GLib.Variant.new_boolean(true));
            if (useXmodmapValue != null)
                this._useXmodmap = useXmodmapValue.get_boolean();
            else
                this._useXmodmap = false;
        }
    },

    /* _getModelFromLayout:
     * @layout: The format is 'layouts(models)[options]'
     * @returns: ['layouts[options]', 'models']
     *
     * Return the array of layouts and models from the formatted string.
     * Each element can be the comma separated values.
     */
    _getModelFromLayout: function(layout) {
        let leftBracket = layout.indexOf('(');
        let rightBracket = layout.indexOf(')');
        if (leftBracket >= 0 && rightBracket > leftBracket) {
            return [layout.substring(0, leftBracket) + layout.substring(rightBracket + 1, layout.length),
                    layout.substring(leftBracket + 1, rightBracket)];
        }
        return [layout, 'default'];
    },

    /* _getOptionFromLayout:
     * @layout: The format is 'layouts[options]'
     * @returns: ['layouts', 'options']
     *
     * Return the array of layouts and options from the formatted string.
     * Each element can be the comma separated values.
     */
    _getOptionFromLayout: function(layout) {
        let leftBracket = layout.indexOf('[');
        let rightBracket = layout.indexOf(']');
        if (leftBracket >= 0 && rightBracket > leftBracket) {
            return [layout.substring(0, leftBracket) + layout.substring(rightBracket + 1, layout.length),
                    layout.substring(leftBracket + 1, rightBracket)];
        }
        return [layout, 'default'];
    },

    _getOutputFromCmdline: function(arg, str) {
        let retval = null;
        let basename = GLib.path_get_basename(this._command);
        let argv = [this._command, basename, arg];
        let [result, output, std_err, status] = this._spawnWithPipes(argv);
        if (!result) {
            return null;
        }
        let lines = ('' + output).split('\n');
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.substring(0, str.length) == str) {
                retval = line.substring(str.length);
                break;
            }
        }
        return retval;
    },

    _getFullPath: function(command) {
        let paths = GLib.getenv('PATH');
        if (paths != null) {
            paths = paths.split(':');
        } else {
            paths = ['/usr/bin', '/bin'];
        }
        for (let i = 0; paths.length; i++) {
            let dir = paths[i];
            let filepath = dir + '/' + command;
            if (GLib.file_test(filepath, GLib.FileTest.EXISTS)) {
                return filepath;
            }
        }
        return null;
    },

    _setLayoutCB: function(pid, status, data) {
        if (this._xkbPid != pid) {
            log('XkbLayout.setLayout has another pid.');
            return;
        }
        this._xkbPid = -1;
        this.setXmodmap();
    },

    _setXmodmapCB: function(pid, status, data) {
        if (this._xmodmapPid != pid) {
            log('XkbLayout.setXmodmap has another pid.');
            return;
        }
        this._xmodmapPid = -1;
    },

    _trySpawnWithPipes: function(argv) {
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
                //   execute child process 'foo' (No such file or directory)
                // We are only interested in the part in the parentheses. (And
                // we can't pattern match the text, since it gets localized.)
                err.message = err.message.replace(/.*\((.+)\)/, '$1');
            }

            throw err;
        }
        return retval;
    },

    _trySpawnAsyncXkb: function(argv) {
        let retval = false;
        let pid = -1;

        try {
            [retval, pid] = GLib.spawn_async(null, argv, null,
                                      GLib.SpawnFlags.SEARCH_PATH |
                                      GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                      null, null);
            this._xkbPid = pid;
            GLib.child_watch_add(0, this._xkbPid,
                                 Lang.bind(this, this._setLayoutCB),
                                 null);
        } catch (err) {
            if (err.code == GLib.SpawnError.G_SPAWN_ERROR_NOENT) {
                err.message = _("Command not found");
            } else {
                // The exception from gjs contains an error string like:
                //   Error invoking GLib.spawn_command_line_async: Failed to
                //   execute child process 'foo' (No such file or directory)
                // We are only interested in the part in the parentheses. (And
                // we can't pattern match the text, since it gets localized.)
                err.message = err.message.replace(/.*\((.+)\)/, '$1');
            }

            throw err;
        }
        return retval;
    },

    _trySpawnAsyncXmodmap: function(argv) {
        let retval = false;
        let pid = -1;

        try {
            [retval, pid] = GLib.spawn_async(null, argv, null,
                                      GLib.SpawnFlags.SEARCH_PATH |
                                      GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                      null, null);
            this._xmodmapPid = pid;
            GLib.child_watch_add(0, this._xmodmapPid,
                                 Lang.bind(this, this._setXmodmapCB),
                                 null);
        } catch (err) {
            if (err.code == GLib.SpawnError.G_SPAWN_ERROR_NOENT) {
                err.message = _("Command not found");
            } else {
                // The exception from gjs contains an error string like:
                //   Error invoking GLib.spawn_command_line_async: Failed to
                //   execute child process 'foo' (No such file or directory)
                // We are only interested in the part in the parentheses. (And
                // we can't pattern match the text, since it gets localized.)
                err.message = err.message.replace(/.*\((.+)\)/, '$1');
            }

            throw err;
        }
        return retval;
    },

    _handleSpawnError: function(command, err) {
        let title = _("Execution of '%s' failed:").format(command);
        log(title);
        log(err.message);
    },

    _spawnWithPipes: function(argv) {
        try {
            return this._trySpawnWithPipes(argv);
        } catch (err) {
            this._handleSpawnError(argv[0], err);
            return [false, null, err.message, -1];
        }
    },

    _spawnAsyncXkb: function(argv) {
        try {
            return this._trySpawnAsyncXkb(argv);
        } catch (err) {
            this._handleSpawnError(argv[0], err);
            return false;
        }
    },

    _spawnAsyncXmodmap: function(argv) {
        try {
            return this._trySpawnAsyncXmodmap(argv);
        } catch (err) {
            this._handleSpawnError(argv[0], err);
            return false;
        }
    },

    useXkb: function(enable) {
        if (this._command == null) {
            return;
        }
        this._useXkb = enable;
    },

    getLayout: function() {
        if (!this._useXkb) {
            return null;
        }
        return this._getOutputFromCmdline('--get', 'layout: ');
    },

    getModel: function() {
        if (!this._useXkb) {
            return null;
        }
        return this._getOutputFromCmdline('--get', 'model: ');
    },

    getOption: function() {
        if (!this._useXkb) {
            return null;
        }
        return this._getOutputFromCmdline('--get', 'option: ');
    },

    getGroup: function() {
        if (!this._useXkb) {
            return 0;
        }
        return this._getOutputFromCmdline('--get-group', 'group: ');
    },

    setLayout: function(layout) {
        let model = 'default';
        let option = 'default';

        if (!this._useXkb) {
            return;
        }
        if (this._xkbPid != -1) {
            return;
        }
        if (layout == undefined) {
            layout = 'default';
        }
        if (this._defaultLayout == null) {
            // Maybe opening display was failed in constructor.
            this.reloadDefaultLayout();
        }
        if (this._defaultLayout == null) {
            return;
        }
        if (this._timeLagSessionXkbLayout == true) {
            this._defaultLayout = this.getLayout();
            this._defaultModel = this.getModel();
        }
        if (this._timeLagSessionXkbOption == true) {
            this._defaultOption = this.getOption();
        }
        if ((this._timeLagSessionXkbLayout == true ||
             this._timeLagSessionXkbOption == true) &&
            (GLib.test_timer_elapsed() - this._timeLagSessionXkbTimer
             > XKB_SESSION_TIME_OUT)) {
            this._timeLagSessionXkbLayout = false;
            this._timeLagSessionXkbOption = false;
        }
        let isDefaultLayout = false;
        if (layout == 'default') {
            isDefaultLayout = true;
            layout = this._defaultLayout;
        } else {
            this._timeLagSessionXkbLayout = false;
        }
        [layout, model] = this._getModelFromLayout(layout);
        if (model == 'default') {
            if (isDefaultLayout) {
                model = this._defaultModel;
            } else {
                model = null;
            }
        } else {
            this._timeLagSessionXkbLayout = false;
        }
        let engineOption = 'default';
        [layout, engineOption] = this._getOptionFromLayout(layout);
        if (engineOption != null && engineOption != 'default') {
            option = this._defaultOption;
            if (option == null) {
                    option = engineOption;
            } else {
                    option = option + ',' + engineOption;
            }
            this._timeLagSessionXkbOption = false;
        }
        if (option == 'default') {
            option = this._defaultOption;
        }
        let needUsLayout = false;
        for (let i = 0; i < this._xkbLatinLayouts.length; i ++) {
            let latinLayout = this._xkbLatinLayouts[i];
            // layout 'in' and model 'eng' is English layout.
            if (layout == latinLayout && model != 'eng') {
                needUsLayout = true;
                break;
            }
            if (model != null && layout + '(' + model + ')' == latinLayout) {
                needUsLayout = true;
                break;
            }
        }
        if (needUsLayout) {
            layout = layout + ',us';
            if (model != null) {
                model = model + ',';
            }
        }
        if (layout == this.getLayout() &&
            model == this.getModel() &&
            option == this.getOption()) {
            return;
        }
        let args = [];
        args.push(this._command);
        args.push('--layout');
        args.push(layout);
        if (model != null) {
            args.push('--model');
            args.push(model);
        }
        if (option != null) {
            args.push('--option');
            args.push(option);
        }
        this._spawnAsyncXkb(args);
    },

    getDefaultLayout: function() {
        return [this._defaultLayout, this._defaultModel];
    },

    getDefaultOption: function() {
        return this._defaultOption;
    },

    setDefaultLayout: function(layout, model) {
        if (!this._useXkb) {
            return;
        }
        if (layout == undefined) {
            layout = 'default';
        }
        if (model == undefined) {
            model = 'default';
        }
        if (layout == 'default') {
            this._defaultLayout = this.getLayout();
            this._defaultModel = this.getModel();
        } else {
            if (model == 'default') {
                [layout, model] = this._getModelFromLayout(layout);
            }
            this._defaultLayout = layout;
            this._timeLagSessionXkbLayout = false;
            if (model == 'default') {
                this._defaultModel = null;
            } else {
                this._defaultModel = model;
            }
        }
    },

    setDefaultOption: function(option) {
        if (!this._useXkb) {
            return;
        }
        if (option == undefined) {
            option = 'default';
        }
        if (option == 'default') {
            this._defaultOption = this.getOption();
        } else {
            this._defaultOption = option;
            this._timeLagSessionXkbOption = false;
        }
    },

    reloadDefaultLayout: function() {
        if (!this._useXkb) {
            return;
        }
        this._defaultLayout = this.getLayout();
        this._defaultModel = this.getModel();
        this._defaultOption = this.getOption();
    },

    setXmodmap: function() {
        if (!this._useXmodmap) {
            return;
        }
        if (this._xmodmapPid != -1) {
            return;
        }
        let xmodmapCmdPath = this._getFullPath(XMODMAP_CMD);
        if (xmodmapCmdPath == null) {
            xmodmapCmdPath = XMODMAP_CMD;
        }
        for (let i = 0; i < XMODMAP_KNOWN_FILES.length; i++) {
            let xmodmapFile = XMODMAP_KNOWN_FILES[i];
            let xmodmapFilePath = GLib.get_home_dir() + '/' + xmodmapFile;
            if (!GLib.file_test(xmodmapFilePath, GLib.FileTest.EXISTS)) {
                continue;
            }
            let args = [];
            args.push(xmodmapCmdPath);
            args.push(xmodmapFilePath);
            this._spawnAsyncXmodmap(args);
            break;
        }
    }
};

function engineDescNew(lang, layout, layoutDesc,
                       variant, variantDesc,
                       name) {
    let longname = layout;
    let desc = null;
    let engineLayout = null;
    let engine = null;

    if (variantDesc != null) {
        longname = variantDesc;
    } else if (layout != null && variant != null) {
        longname = layout + ' - ' + variant;
    } else if (layoutDesc != null) {
        longname = layoutDesc;
    }
    let name_prefix = 'xkb:layout:';
    if (variant != null) {
        if (name == null) {
            name = name_prefix + layout + ':' + variant;
        }
        desc = 'XKB ' + layout + '(' + variant + ') keyboard layout';
        engineLayout = layout + '(' + variant + ')';
    } else {
        if (name == null) {
            name = name_prefix + layout;
        }
        desc = 'XKB ' + layout + ' keyboard layout';
        engineLayout = layout;
    }

    let icon = 'ibus-engine';
    let defaultBridgeEngineName = DEFAULT_BRIDGE_ENGINE_NAME;
    try {
        defaultBridgeEngineName = IBus.get_default_bridge_engine_name();
    } catch (e) {
        // This feature is not available.
    }

    if (name.substring(0, defaultBridgeEngineName.length)
        == defaultBridgeEngineName) {
        icon = ICON_KEYBOARD;
    }

    engine = new IBus.EngineDesc({ name: name,
                                   longname: longname,
                                   description: desc,
                                   language: lang,
                                   license: 'GPL2',
                                   author: 'Takao Fujiwara <takao.fujiwara1@gmail.com>',
                                   icon: icon,
                                   layout: engineLayout });
    return engine;
}
