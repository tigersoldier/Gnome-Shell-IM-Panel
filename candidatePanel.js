/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2011 Red Hat, Inc.
 * Copyright 2011 Peng Huang <shawn.p.huang@gmail.com>
 * Copyright 2011 Takao Fujiwara <tfujiwar@redhat.com>
 * Copyright 2011 Tiger Soldier <tigersoldi@gmail.com>
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

const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Pango = imports.gi.Pango;
const IBus = imports.gi.IBus;
const Lang = imports.lang;
const Signals = imports.signals;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;

const Extension = imports.ui.extensionSystem.extensions["gjsimp@tigersoldier"];
const Handle = Extension.handle;
const PangoAttrList = Extension.pangoAttrList.PangoAttrList;

const _ = Extension.common._;
const ORIENTATION_HORIZONTAL = Extension.common.ORIENTATION_HORIZONTAL;
const ORIENTATION_VERTICAL   = Extension.common.ORIENTATION_VERTICAL;
const ORIENTATION_SYSTEM     = Extension.common.ORIENTATION_SYSTEM;


function StCandidateArea(orientation) {
    this._init(orientation);
}

StCandidateArea.prototype = {
    _init: function(orientation) {
        this.actor = new St.BoxLayout({ vertical: false,
                                        style_class: "candidate-area" });
        this._orientation = orientation;
        this._labels = [];
        this._create_ui();
    },

    _create_ui: function() {
        if (this._orientation == ORIENTATION_VERTICAL) {
            this._vbox1 = new St.BoxLayout({vertical: true,
                                            style_class: "candidate-vertical"});
            this.actor.add(this._vbox1,
                           { expand: true, 
                             x_fill: true,
                             y_fill: true
                           });
        }
        for (let i = 0; i < 16; i++) {
            let label1 = new St.Label({ text: "1234567890abcdef".charAt(i) + '.',
                                        style_class: "candidate-label",
                                        reactive: true });

            let label2 = new St.Label({ text: '' ,
                                        style_class: "candidate-text",
                                        reactive: true });

            if (this._orientation == ORIENTATION_VERTICAL) {
                let hbox = new St.BoxLayout({vertical: false});
                hbox.add(label1,
                         { expand: false,
                           x_fill: false,
                           y_fill: true
                         });
                hbox.add(label2,
                         { expand: true,
                           x_fill: true,
                           y_fill: true
                         });
                this._vbox1.add(hbox);
            } else {
                this.actor.add(label1);
                this.actor.add(label2);
            }

            this._labels[this._labels.length] = [label1, label2];
        }

        for (let i = 0; i < this._labels.length; i++) {
            for(let j = 0; j < this._labels[i].length; j++) {
                let widget = this._labels[i][j];
                widget.candidate_index = i;
                widget.connect('button-press-event', 
                               Lang.bind(this, function (widget, event) {
                                   this._candidate_clicked_cb(widget, event);
                               }));
                widget.connect('enter-event',
                               function(widget, event) {
                                   widget.add_style_pseudo_class('hover');
                               });
                widget.connect('leave-event',
                               function(widget, event) {
                                   widget.remove_style_pseudo_class('hover');
                               });
            }
        }
    },

    _candidate_clicked_cb: function(widget, event) {
        this.emit('candidate-clicked',
                  widget.candidate_index,
                  event.get_button(),
                  Shell.get_event_state(event));
    },

    set_labels: function(labels) {
        if (!labels || labels.length == 0) {
            for (let i = 0; i < 16; i++) {
                this._labels[i][0].set_text("1234567890abcdef".charAt(i) + '.');
            }
            return;
        }

        for (let i = 0; j < labels.length && i < this._labels.length; i++) {
            let [text, attrs] = labels[i];
            this._labels[i][0].set_text(text);
            this._labels[i][0].set_attributes(attrs);
        }
    },

    set_candidates: function(candidates, focus_candidate, show_cursor) {
        if (focus_candidate == undefined) {
            focus_candidate = 0;
        }
        if (show_cursor == undefined) {
            show_cursor = true;
        }
        if (candidates.length > this._labels.length) {
            assert();
        }

        for (let i = 0; i < candidates.length; i++) {
            let [text, attrs] = candidates[i];
            if (i == focus_candidate && show_cursor) {
                this._labels[i][1].add_style_pseudo_class('active');
            } else {
                this._labels[i][1].remove_style_pseudo_class('active');
            }
            this._labels[i][1].set_text(text);
            for (let j = 0; j < this._labels[i].length; j++) {
                this._labels[i][j].show();
            }
        }

        for (let i = this._labels.length - 1; i >= candidates.length; i--) {
            for (let j = 0; j < this._labels[i].length; j++) {
                this._labels[i][j].hide();
            }
        }
    },

    show_all: function() {
        this.actor.show();
    },

    hide_all: function() {
        this.actor.hide();
    },

};

Signals.addSignalMethods(StCandidateArea.prototype);

function CandidatePanel() {
    this._init();
}

CandidatePanel.prototype = {
    _init: function() {
        let handle = new Handle.Handle();
        handle.connect('move-end',
                       Lang.bind(this, this._handle_move_end_cb));
        handle.show();

        this._begin_move = false;

        this._orientation = ORIENTATION_VERTICAL;
        this._current_orientation = this._orientation;
        this._preedit_visible = false;
        this._aux_string_visible = false;
        this._lookup_table_visible = false; 
        this._preedit_string = '';
        this._preedit_attrs = new Pango.AttrList();
        this._aux_string = '';
        this._aux_attrs = new Pango.AttrList();
        this._lookup_table = null;

        this._cursor_location = [0, 0, 0, 0];
        this._moved_cursor_location = null; 

        this._init_st();

    },

    _init_st: function() {
        this._st_candidate_panel = new St.BoxLayout({style_class: 'candidate-panel',
                                          vertical: true});

        this._st_preedit_label = new St.Label({text: this._preedit_string});
        if (!this._preedit_visible) {
            this._st_preedit_label.hide();
        }
        this._st_aux_label = new St.Label({text: this._aux_string});
        if (!this._aux_visible) {
            this._st_aux_label.hide();
        }
        this._st_candidate_panel.set_position(500, 500);
        // create candidates area
        this._st_candidate_area = new StCandidateArea(this._current_orientation);
        this._st_candidate_area.connect('candidate-clicked', 
                                        Lang.bind(this, function(x, i, b, s) {
                                                      this.emit('candidate-clicked', i, b, s);}));
        this.update_lookup_table(this._lookup_table, this._lookup_table_visible);

        // // create state label
        // this._state_label = new Gtk.Label({ label: '' });
        // this._state_label.set_size_request(20, -1);

        // // create buttons
        // this._prev_button = new Gtk.Button();
        // this._prev_button.connect('clicked', Lang.bind(this, function(x) {
        //     this.emit('page-up');}));
        // this._prev_button.set_relief(Gtk.ReliefStyle.NONE);
        // this._prev_button.set_tooltip_text(_("Previous page"));

        // this._next_button = new Gtk.Button();
        // this._next_button.connect('clicked', Lang.bind(this, function(x) {
        //     this.emit('page-down');}));
        // this._next_button.set_relief(Gtk.ReliefStyle.NONE);
        // this._next_button.set_tooltip_text(_("Next page"));

        this._pack_all_st_widgets();
        Main.chrome.addActor(this._st_candidate_panel,
                            { visibleInOverview: true,
                              affectsStruts: false});
        //global.stage.add_actor(this.actor);
        this._check_show_states();
    },

    _pack_all_st_widgets: function() {
        this._st_candidate_panel.add(this._st_preedit_label,
                                     {x_fill: true,
                                      y_fill: false,
                                      x_align: St.Align.MIDDLE,
                                      y_align: St.Align.START});
        this._st_candidate_panel.add(this._st_aux_label,
                                     {x_fill: true,
                                      y_fill: false,
                                      x_align: St.Align.MIDDLE,
                                      y_align: St.Align.MIDDLE});
        this._st_candidate_panel.add(this._st_candidate_area.actor,
                                     {x_fill: true,
                                      y_fill: false,
                                      x_align: St.Align.MIDDLE,
                                      y_align: St.Align.END});
    },

    _handle_move_end_cb: function(handle) {
        // store moved location
        let [x, y] = this._st_candidate_area.get_position();
        this._moved_cursor_location = [x, y,
                                       this._cursor_location[2],
                                       this._cursor_location[3]];
    },

    show_preedit_text: function() {
        this._preedit_visible = true;
        this._st_preedit_label.show();
        this._check_show_states();
    },

    hide_preedit_text: function() {
        this._preedit_visible = false;
        this._st_preedit_label.hide();
        this._check_show_states();
    },

    update_preedit_text: function(text, cursor_pos, visible) {
        let attrs = new PangoAttrList(text.get_attributes(), text.get_text());
        if (visible) {
            this.show_preedit_text();
        } else {
            this.hide_preedit_text();
        }
        this._preedit_stribg = text.get_text();
        this._st_preedit_label.set_text(text.get_text());
        this._preedit_attrs = attrs;
    },

    show_auxiliary_text: function() {
        this._aux_string_visible = true;
        this._st_aux_label.show();
        this._check_show_states();
    },

    hide_auxiliary_text: function() {
        this._aux_string_visible = false;
        this._st_aux_label.hide();
        this._check_show_states();
    },

    update_auxiliary_text: function(text, show) {
        let attrs = new PangoAttrList(text.get_attributes(), text.get_text());

        if (show) {
            this.show_auxiliary_text();
        } else {
            this.hide_auxiliary_text();
        }

        this._aux_string = text.get_text();
        this._st_aux_label.set_text(text.get_text());
        this._aux_attrs = attrs;
    },

    _refresh_labels: function() {
        let new_labels = [];
        for (let i = 0; this._lookup_table.get_label(i) != null; i++) {
            let label = this._lookup_table.get_label(i);
            new_labels[new_labels.length] = [label.get_text(),
                                             new PangoAttrList(label.get_attributes(), label.get_text()).get_raw()];
        }
        this._st_candidate_area.set_labels(new_labels);
    },


    _get_candidates_in_current_page: function() {
        let cursor_pos = this._lookup_table.get_cursor_pos();
        let page_size = this._lookup_table.get_page_size();
        let page = ((cursor_pos == 0) ? 0 : Math.floor(cursor_pos / page_size));
        let start_index = page * page_size;
        let end_index = Math.min((page + 1) * page_size,
                                 this._lookup_table.get_number_of_candidates());
        let candidates = [];
        for (let i = start_index; i < end_index; i++) {
            candidates[candidates.length] = this._lookup_table.get_candidate(i);
        }
        return candidates;
    },

    _get_cursor_pos_in_current_page: function() {
        let cursor_pos = this._lookup_table.get_cursor_pos();
        let page_size = this._lookup_table.get_page_size();
        let pos_in_page = cursor_pos % page_size;
        return pos_in_page;
    },

    _refresh_candidates: function() {
        let candidates = this._get_candidates_in_current_page();
        let new_candidates = [];
        for (let i = 0; i < candidates.length; i++) {
            let candidate = candidates[i];
            new_candidates[new_candidates.length] = [candidate.get_text(),
                                                     new PangoAttrList(candidate.get_attributes(), candidate.get_text()).get_raw()];
        }
        this._st_candidate_area.set_candidates(new_candidates,
                                               this._get_cursor_pos_in_current_page(),
                                               this._lookup_table.is_cursor_visible()
                                              );
    },

    update_lookup_table: function(lookup_table, visible) {
        // hide lookup table
        if (!visible) {
            this.hide_lookup_table();
        }

        this._lookup_table = lookup_table || new IBus.LookupTable();
        let orientation = this._lookup_table.get_orientation();
        if (orientation != ORIENTATION_HORIZONTAL &&
            orientation != ORIENTATION_VERTICAL) {
            orientation = this._orientation;
        }
        this.set_current_orientation(orientation);
        this._refresh_candidates();
        this._refresh_labels();

        // show lookup table
        if (visible) {
            this.show_lookup_table();
        }
    },

    show_lookup_table: function() {
        this._lookup_table_visible = true;
        this._st_candidate_area.show_all();
        this._check_show_states();
    },

    hide_lookup_table: function() {
        this._lookup_table_visible = false;
        this._st_candidate_area.hide_all();
        this._check_show_states();
    },

    page_up_lookup_table: function() {
        this._lookup_table.page_up();
        this._refresh_candidates();
    },

    page_down_lookup_table: function() {
        this._lookup_table.page_down();
        this._refresh_candidates();
    },

    cursor_up_lookup_table: function() {
        this._lookup_table.cursor_up();
        this._refresh_candidates();
    },

    cursor_down_lookup_table: function() {
        this._lookup_table.cursor_down();
        this._refresh_candidates();
    },

    set_cursor_location: function(x, y, w, h) {
        // if cursor location is changed, we reset the moved cursor location
        if (this._cursor_location != [x, y, w, h]) {
            this._cursor_location = [x, y, w, h];
            this._moved_cursor_location = null;
            this._check_position();
        }
    },

    _check_show_states: function() {
        if (this._preedit_visible ||
            this._aux_string_visible ||
            this._lookup_table_visible) {
            this._st_candidate_panel.show();
            this._check_position();
            this.emit('show');
        } else {
            this._st_candidate_panel.hide();
            this.emit('hide');
        }
    },

    reset: function() {
        let text = IBus.Text.new_from_string('');
        this.update_preedit_text(text, 0, false);
        text.unref();
        text = IBus.Text.new_from_string('');
        this.update_auxiliary_text(text, false);
        text.unref();
        this.update_lookup_table(null, false);
        this.hide();
    },

    set_current_orientation: function(orientation) {
        if (this._current_orientation == orientation) {
            return;
        }
        this._current_orientation = orientation;
        // FIXME:
    },

    set_orientation: function(orientation) {
        global.log('current orientation is:' + orientation);
        this._orientation = orientation;
        this.update_lookup_table(this._lookup_table, this._lookup_table_visible);
    },

    get_current_orientation: function() {
        return this._current_orientation;
    },

    _check_position: function() {
        let cursor_location = this._moved_cursor_location || this._cursor_location;
        let cursor_right = cursor_location[0] + cursor_location[2];
        let cursor_bottom = cursor_location[1] + cursor_location[3];

        let window_right = cursor_right + this._st_candidate_panel.get_width();
        let window_bottom = cursor_bottom + this._st_candidate_panel.get_height();
        let root_window = Gdk.get_default_root_window();
        let [sx, sy] = [root_window.get_width(), root_window.get_height()];
        let x = 0;
        let y = 0;

        if (window_right > sx) {
            x = sx - this._st_candidate_panel.get_width();
        } else {
            x = cursor_right;
        }

        if (window_bottom > sy) {
            // move the window just above the cursor so the window and a preedit string do not overlap.
            /* FIXME: pad would not be needed. */
            let pad = 20; 
            if (this._current_orientation == ORIENTATION_VERTICAL) {
                pad = 10;
            }
            y = Math.min(cursor_location[1] - pad, sy) - 
                this._st_candidate_panel.get_height();
        } else {
            y = cursor_bottom;
        }

        this.move(x, y);
    },

    show_all: function() {
        this._st_candidate_panel.show();
    },

    hide_all: function() {
        this._st_candidate_panel.hide();
    },

    move: function(x, y) {
        this._st_candidate_panel.set_position(x, y);
    },
};

Signals.addSignalMethods(CandidatePanel.prototype);
