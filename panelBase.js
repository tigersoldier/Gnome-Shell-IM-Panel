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

const DBus = imports.gi.DBus;
const IBus = imports.gi.IBus;
const Lang = imports.lang;


function PanelBase(bus) {
    this._init(bus);
}

PanelBase.prototype = {

    _init: function(bus) {
        this._bus = bus;
        this._panel = IBus.PanelService.new(bus.get_connection());
        this._panel.connect('set-cursor-location',
                            Lang.bind(this, this.set_cursor_location));
        this._panel.connect('update-preedit-text',
                            Lang.bind(this, this.update_preedit_text));
        this._panel.connect('show-preedit-text',
                            Lang.bind(this, this.show_preedit_text));
        this._panel.connect('hide-preedit-text',
                            Lang.bind(this, this.hide_preedit_text));
        this._panel.connect('update-auxiliary-text',
                            Lang.bind(this, this.update_auxiliary_text));
        this._panel.connect('show-auxiliary-text',
                            Lang.bind(this, this.show_auxiliary_text));
        this._panel.connect('hide-auxiliary-text',
                            Lang.bind(this, this.hide_auxiliary_text));
        this._panel.connect('update-lookup-table',
                            Lang.bind(this, this.update_lookup_table));
        this._panel.connect('show-lookup-table',
                            Lang.bind(this, this.show_lookup_table));
        this._panel.connect('hide-lookup-table',
                            Lang.bind(this, this.hide_lookup_table));
        this._panel.connect('page-up-lookup-table',
                            Lang.bind(this, this.page_up_lookup_table));
        this._panel.connect('page-down-lookup-table',
                            Lang.bind(this, this.page_down_lookup_table));
        this._panel.connect('cursor-up-lookup-table',
                            Lang.bind(this, this.cursor_up_lookup_table));
        this._panel.connect('cursor-down-lookup-table',
                            Lang.bind(this, this.cursor_down_lookup_table));
        this._panel.connect('focus-in', Lang.bind(this, this.focus_in));
        this._panel.connect('focus-out', Lang.bind(this, this.focus_out));
        this._panel.connect('register-properties', Lang.bind(this, this.register_properties));
        this._panel.connect('update-property', Lang.bind(this, this.update_property));
        this._panel.connect('state-changed', Lang.bind(this, this.state_changed));
    },

    set_cursor_location: function(panel, x, y, w, h) {
    },

    update_preedit_text: function(panel, text, cursor_pos, visible) {
    },

    show_preedit_text: function(panel) {
    },

    hide_preedit_text: function(panel) {
    },

    update_auxiliary_text: function(panel, text, visible) {
    },

    show_auxiliary_text: function(panel) {
    },

    hide_auxiliary_text: function(panel) {
    },

    update_lookup_table: function(panel, lookup_table, visible) {
    },

    show_lookup_table: function(panel) {
    },

    hide_lookup_table: function(panel) {
    },

    page_up_lookup_table: function(panel) {
    },

    page_down_lookup_table: function(panel) {
    },

    cursor_up_lookup_table: function(panel) {
    },

    cursor_down_lookup_table: function(panel) {
    },

    show_candidate_window: function(panel) {
    },

    hide_candidate_window: function(panel) {
    },

    show_language_bar: function() {
    },

    hide_language_bar: function() {
    },

    focus_in: function(panel, path) {
    },

    focus_out: function(panel, path) {
    },

    register_properties: function(panel, props) {
    },

    update_property: function(panel, prop) {
    },

    state_changed: function(panel) {
    },

    reset: function() {
    },

    start_setup: function() {
    },

    page_up: function() {
        this._panel.page_up();
    },

    page_down: function() {
        this._panel.page_down();
    },

    cursor_up: function() {
        this._panel.cursor_up();
    },

    cursor_down: function() {
        this._panel.cursor_down();
    },

    candidate_clicked: function(index, button, state) {
        this._panel.candidate_clicked(index, button, state);
    },

    property_activate: function(prop_name, prop_state) {
        this._panel.property_activate(prop_name, prop_state);
    },

    property_show: function(prop_name) {
        prop_name = new DBus.String(prop_name);
        this._panel.property_show(prop_name);
    },

    property_hide: function(prop_name) {
        prop_name = new DBus.String(prop_name);
        this._panel.property_hide(prop_name);
    },

    set_bus: function(bus) {
        this._init(bus);
    },
};
