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

const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Pango = imports.gi.Pango;
const IBus = imports.gi.IBus;
const Lang = imports.lang;
const Signals = imports.signals;

const Extension = imports.ui.extensionSystem.extensions["gjsimp@tigersoldier"];
const Handle = Extension.handle;
const PangoAttrList = Extension.pangoAttrList.PangoAttrList;

const _ = Extension.common._;
const ORIENTATION_HORIZONTAL = Extension.common.ORIENTATION_HORIZONTAL;
const ORIENTATION_VERTICAL   = Extension.common.ORIENTATION_VERTICAL;
const ORIENTATION_SYSTEM     = Extension.common.ORIENTATION_SYSTEM;


function eventbox_new() {
    let retval = new Gtk.EventBox();
    retval.connect('realize', function(widget) {
        widget.window.set_cursor(Gdk.Cursor.new(Gdk.CursorType.HAND2));});
    retval.show();
    return retval;
}

function hseparator_new() {
    let retval = new Gtk.HBox({ homogeneous: false, spacing: 0 });
    retval.pack_start(new Gtk.HSeparator(), true, true, 4);
    retval.show();
    return retval;
}

function vseparator_new() {
    let retval = new Gtk.VBox({ homogeneous: false, spacing: 0 });
    retval.pack_start(new Gtk.VSeparator(), true, true, 4);
    retval.show();
    return retval;
}

function StCandidateArea(orientation) {
    this._init(orientation);
}

StCandidateArea.prototype = {
    _init: function(orientation) {
        this.actor = new St.BoxLayout({ vertical: false,
                                        style_class: "candidate-area" });
        this._orientation = orientation;
        this._labels = [];
        // this._candidates = [];
        this._create_ui();
    },

    _create_ui: function() {
        if (this._orientation == ORIENTATION_VERTICAL) {
            // this._table = new St.Table({homogeneous: false});
            this._vbox1 = new St.BoxLayout({vertical: true,
                                            style_class: "candidate-vertical"});
            this.actor.add(this._vbox1,
                           { expand: true, 
                             x_fill: true,
                             y_fill: true
                           });
            // this.actor.add(this._vbox2,
            //                { expand: true, 
            //                  x_fill: true,
            //                  y_fill: false,
            //                });
            // this.actor.add(this._table);
        }
        for (let i = 0; i < 16; i++) {
            let label1 = new St.Label({ text: "1234567890abcdef".charAt(i) + '.',
                                        style_class: "candidate-label" });

            let label2 = new St.Label({ text: '' ,
                                        style_class: "candidate-text"});

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

        // for (let i = 0; i < this._candidates.length; i++) {
        //     let ws = this._candidates[i];
        //     for(let j = 0; j < ws.length; j++) {
        //         let w = ws[j];
        //         w.data = i;
        //         w.connect('button-press-event', Lang.bind(this, function(w, e) {
        //             this.emit('candidate-clicked', w.data, e.button, e.state);}));
        //     }
        // }
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

function CandidateArea(orientation) {
    this._init(orientation);
}

CandidateArea.prototype = {
    _init: function(orientation) {
        this._hbox = new Gtk.HBox({ homogeneous: false, spacing: 0 });
        this._hbox.set_name('IBusCandidateArea');
        this._orientation = orientation;
        this._labels = [];
        this._candidates = [];
        this._create_ui();
    },

    _create_ui: function() {
        if (this._orientation == ORIENTATION_VERTICAL) {
            this._vbox1 = new Gtk.VBox({ homogeneous: false, spacing: 0 });
            this._vbox2 = new Gtk.VBox({ homogeneous: false, spacing: 0 });
            this._hbox.pack_start(this._vbox1, false, false, 4);
            this._hbox.pack_start(vseparator_new(), false, false, 0);
            this._hbox.pack_start(this._vbox2, true, true, 4);
        }

        for (let i = 0; i < 16; i++) {
            let label1 = new Gtk.Label({ label: "1234567890abcdef".charAt(i) + '.' });
            label1.set_alignment(0.0, 0.5);
            label1.show();

            let label2 = new Gtk.Label({ label: '' });
            label2.set_alignment(0.0, 0.5);
            label2.show();

            if (this._orientation == ORIENTATION_VERTICAL) {
                label1.set_property('xpad', 8);
                label2.set_property('xpad', 8);
                let ebox1 = eventbox_new();
                ebox1.set_no_show_all(true);
                ebox1.add(label1);
                let ebox2 = eventbox_new();
                ebox2.set_no_show_all(true);
                ebox2.add(label2);
                this._vbox1.pack_start(ebox1, false, false, 2);
                this._vbox2.pack_start(ebox2, false, false, 2);
                this._candidates[this._candidates.length] = [ebox1, ebox2];
            } else {
                let hbox = new Gtk.HBox({ homogeneous: false, spacing: 0 });
                hbox.show();
                hbox.pack_start(label1, false, false, 1);
                hbox.pack_start(label2, false, false, 1);
                let ebox = eventbox_new();
                ebox.set_no_show_all(true);
                ebox.add(hbox);
                this._hbox.pack_start(ebox, false, false, 4);
                this._candidates[this._candidates.length] = [ebox,];
            }

            this._labels[this._labels.length] = [label1, label2];
        }

        for (let i = 0; i < this._candidates.length; i++) {
            let ws = this._candidates[i];
            for(let j = 0; j < ws.length; j++) {
                let w = ws[j];
                w.data = i;
                w.connect('button-press-event', Lang.bind(this, function(w, e) {
                    this.emit('candidate-clicked', w.data, e.button, e.state);}));
            }
        }
    },

    set_labels: function(labels) {
        if (!labels || labels.length == 0) {
            for (let i = 0; i < 16; i++) {
                this._labels[i][0].set_text("1234567890abcdef".charAt(i) + '.');
                this._labels[i][0].set_attributes(new Pango.AttrList());
            }
            return;
        }

        let i = 0;
        for (let j = 0; j < labels.length; j++) {
            let [text, attrs] = labels[j];
            this._labels[i][0].set_text(text);
            this._labels[i][0].set_attributes(attrs);
            i += 1;
            if (i >= 16) {
                break;
            }
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
                if (attrs == null) {
                    attrs = new Pango.AttrList();
                }
                /* FIXME: Need to get GtkStyle->base */
                //let color = this._labels[i][1].style.base[Gtk.StateType.SELECTED];
                let color = {pixels: 0, red: 0x4b4b, green: 0x6969, blue: 0x8383};
                let end_index = text.length;
                /* Currently no definition to convert Pango.Attribute to
                 * Javascript object. No pango_attribute_get_type() */
                //let attr = Pango.attr_background_new(color.red, color.green, color.blue, 0, end_index);
                //attrs.change(attr);
                //color = this._labels[i][1].style.text[Gtk.StateType.SELECTED];
                color = {pixels: 0, red: 65535, green: 65535, blue: 65535};
                /* Currently no definition to convert Pango.Attribute to
                 * Javascript object. No pango_attribute_get_type() */
                //attr = Pango.attr_background_new(color.red, color.green, color.blue, 0, end_index);
                //attrs.insert(attr);
            }

            /* Workaround for Pango.Attribute */
            if (i == focus_candidate && show_cursor) {
                let markup_text = '<span background=\"SlateBlue\" foreground=\"white\">' + text + '</span>';
                this._labels[i][1].set_markup(markup_text);
            } else {
                this._labels[i][1].set_text(text);
            }
            this._labels[i][1].show();
            this._labels[i][1].set_attributes(attrs);
            for (let j = 0; j < this._candidates[i].length; j++) {
                this._candidates[i][j].show();
            }
        }

        /* FIXME: It seems other candidate labels are also hide... */
        for (let i = this._candidates.length - 1; i >= candidates.length; i--) {
            for (let j = 0; j < this._candidates[i].length; j++) {
                this._candidates[i][j].hide();
            }
        }
    },

    show_all: function() {
        this._hbox.show_all();
    },

    hide_all: function() {
        this._hbox.hide();
    },

    set_no_show_all: function(show) {
        this._hbox.set_no_show_all(show);
    },

    get_raw: function() {
        return this._hbox;
    },
};

Signals.addSignalMethods(CandidateArea.prototype);

function CandidatePanel() {
    this._init();
}

CandidatePanel.prototype = {
    _init: function() {
        this._vbox = new Gtk.VBox({ homogeneous: false, spacing: 0 });
        this._toplevel = new Gtk.Window({ type: Gtk.WindowType.POPUP });
        this._viewport = new Gtk.Viewport();
        this._viewport.set_shadow_type(Gtk.ShadowType.IN);
        this._toplevel.add(this._viewport);

        let hbox = new Gtk.HBox({ homogeneous: false, spacing: 0 });
        let handle = new Handle.Handle();
        handle.connect('move-end',
                       Lang.bind(this, this._handle_move_end_cb));
        handle.show();
        hbox.pack_start(handle.get_raw(), true, true, 0);
        hbox.pack_start(this._vbox, true, true, 0);

        this._viewport.add(hbox);
        this._toplevel.add_events(
            Gdk.EventMask.BUTTON_PRESS_MASK |
            Gdk.EventMask.BUTTON_RELEASE_MASK |
            Gdk.EventMask.BUTTON1_MOTION_MASK);
        this._begin_move = false;
        this._toplevel.connect('size-allocate', Lang.bind(this, function (w, a) {
            this._check_position();}));

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
        this._recreate_ui();

        // size-request is a deprecated signal.
        //this._vbox.connect('size-request', Lang.bind(this, this._size_request));
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
        // this._candidate_area.get_raw().set_no_show_all(true);
        // this._candidate_area.connect('candidate-clicked', Lang.bind(this, function(x, i, b, s) {
        //     this.emit('candidate-clicked', i, b, s);}));
        // this.update_lookup_table(this._lookup_table, this._lookup_table_visible);

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

        // this._check_show_states();
        this._pack_all_st_widgets();
        global.stage.add_actor(this._st_candidate_panel);
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
        let [x, y] = this._toplevel.get_position();
        this._moved_cursor_location = [x, y,
                                       this._cursor_location[2],
                                       this._cursor_location[3]];
    },

    _recreate_ui: function() {
        let list = this._vbox.get_children();
        for (let i = 0; i < list.length; i++) {
            let w = list[i];
            this._vbox.remove(w);
            w.destroy();
        }
        // create preedit label
        this._preedit_label = new Gtk.Label({ label: this._preedit_string });
        this._preedit_label.set_attributes(this._preedit_attrs);
        this._preedit_label.set_alignment(0.0, 0.5);
        this._preedit_label.set_padding(8, 0);
        this._preedit_label.set_no_show_all(true);
        if (this._preedit_visible) {
            this._preedit_label.show();
        }

        // create aux label
        this._aux_label = new Gtk.Label({ label: this._aux_string });
        this._aux_label.set_attributes(this._aux_attrs);
        this._aux_label.set_alignment(0.0, 0.5);
        this._aux_label.set_padding(8, 0);
        this._aux_label.set_no_show_all(true);
        if (this._aux_string_visible) {
            this._aux_label.show();
        }

        // create candidates area
        this._candidate_area = new CandidateArea(this._current_orientation);
        this._candidate_area.get_raw().set_no_show_all(true);
        this._candidate_area.connect('candidate-clicked', Lang.bind(this, function(x, i, b, s) {
            this.emit('candidate-clicked', i, b, s);}));
        // this.update_lookup_table(this._lookup_table, this._lookup_table_visible);

        // create state label
        this._state_label = new Gtk.Label({ label: '' });
        this._state_label.set_size_request(20, -1);

        // create buttons
        this._prev_button = new Gtk.Button();
        this._prev_button.connect('clicked', Lang.bind(this, function(x) {
            this.emit('page-up');}));
        this._prev_button.set_relief(Gtk.ReliefStyle.NONE);
        this._prev_button.set_tooltip_text(_("Previous page"));

        this._next_button = new Gtk.Button();
        this._next_button.connect('clicked', Lang.bind(this, function(x) {
            this.emit('page-down');}));
        this._next_button.set_relief(Gtk.ReliefStyle.NONE);
        this._next_button.set_tooltip_text(_("Next page"));

        this._pack_all_widgets();
        this._check_show_states();
    },

    _pack_all_widgets: function() {
        if (this._current_orientation == ORIENTATION_VERTICAL) {
            // package all widgets in vertical mode
            let image = new Gtk.Image();
            image.set_from_stock(Gtk.STOCK_GO_UP, Gtk.IconSize.MENU);
            this._prev_button.set_image(image);

            image = new Gtk.Image();
            image.set_from_stock(Gtk.STOCK_GO_DOWN, Gtk.IconSize.MENU);
            this._next_button.set_image(image);

            let vbox = new Gtk.VBox({ homogeneous: false, spacing: 0 });
            vbox.pack_start(this._preedit_label, false, false, 0);
            vbox.pack_start(this._aux_label, false, false, 0);
            this._vbox.pack_start(vbox, false, false, 5);
            this._vbox.pack_start(hseparator_new(), false, false, 0);
            this._vbox.pack_start(this._candidate_area.get_raw(), false, false, 2);
            this._vbox.pack_start(hseparator_new(), false, false, 0);
            let hbox= new Gtk.HBox({ homogeneous: false, spacing: 0 });
            hbox.pack_start(this._state_label, true, true, 0);
            hbox.pack_start(vseparator_new(), false, false, 0);
            hbox.pack_start(this._prev_button, false, false, 2);
            hbox.pack_start(this._next_button, false, false, 2);
            this._vbox.pack_start(hbox, false, false, 0);
        } else {
            // package all widgets in HORIZONTAL mode
            let image = new Gtk.Image();
            image.set_from_stock(Gtk.STOCK_GO_UP, Gtk.IconSize.MENU);
            this._prev_button.set_image(image);

            image = new Gtk.Image();
            image.set_from_stock(Gtk.STOCK_GO_DOWN, Gtk.IconSize.MENU);
            this._next_button.set_image(image);

            let vbox = new Gtk.VBox({ homogeneous: false, spacing: 0 });
            vbox.pack_start(this._preedit_label, false, false, 0);
            vbox.pack_start(this._aux_label, false, false, 0);
            this._vbox.pack_start(vbox, false, false, 5);
            this._vbox.pack_start(hseparator_new(), false, false, 0);
            let hbox = new Gtk.HBox({ homogeneous: false, spacing: 0 });
            hbox.pack_start(this._candidate_area.get_raw(), true, true, 2);
            hbox.pack_start(vseparator_new(), false, false, 0);
            hbox.pack_start(this._prev_button, false, false, 2);
            hbox.pack_start(this._next_button, false, false, 2);
            this._vbox.pack_start(hbox, false, false, 0);
        }

         // this._vbox.hide();
         // this._vbox.show_all();
    },

    show_preedit_text: function() {
        this._preedit_visible = true;
        this._preedit_label.show();
        this._st_preedit_label.show();
        this._check_show_states();
    },

    hide_preedit_text: function() {
        this._preedit_visible = false;
        this._preedit_label.hide();
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
        this._preedit_label.set_text(text.get_text());
        this._preedit_attrs = attrs;
        this._preedit_label.set_attributes(attrs.get_raw());
    },

    show_auxiliary_text: function() {
        this._aux_string_visible = true;
        this._aux_label.show();
        this._st_aux_label.show();
        this._check_show_states();
    },

    hide_auxiliary_text: function() {
        this._aux_string_visible = false;
        this._aux_label.hide();
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
        this._aux_label.set_text(text.get_text());
        this._st_aux_label.set_text(text.get_text());
        this._aux_attrs = attrs;
        this._aux_label.set_attributes(attrs.get_raw());
    },

    _refresh_labels: function() {
        let new_labels = [];
        for (let i = 0; this._lookup_table.get_label(i) != null; i++) {
            let label = this._lookup_table.get_label(i);
            new_labels[new_labels.length] = [label.get_text(),
                                             new PangoAttrList(label.get_attributes(), label.get_text()).get_raw()];
        }
        this._candidate_area.set_labels(new_labels);
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
        this._candidate_area.set_candidates(new_candidates,
                this._get_cursor_pos_in_current_page(),
                this._lookup_table.is_cursor_visible()
                );
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

        this._lookup_table = lookup_table || ibus.LookupTable();
        let orientation = this._lookup_table.get_orientation();
        if (orientation != ORIENTATION_HORIZONTAL &&
            orientation != ORIENTATION_VERTICAL) {
            orientation = this._orientation;
        }
        this.set_current_orientation(orientation);
        this._refresh_candidates();
        this._refresh_labels();
        this._size_request();

        // show lookup table
        if (visible) {
            this.show_lookup_table();
        }
    },

    show_lookup_table: function() {
        this._lookup_table_visible = true;
        this._candidate_area.get_raw().set_no_show_all(false);
        this._candidate_area.get_raw().show_all();
        this._st_candidate_area.show_all();
        this._check_show_states();
    },

    hide_lookup_table: function() {
        this._lookup_table_visible = false;
        this._candidate_area.hide_all();
        this._candidate_area.set_no_show_all(true);
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
            this._vbox.show_all();
            // this._toplevel.show_all();
            this._toplevel.hide();
            this._st_candidate_panel.show();
            this._check_position();
            this.emit('show');
        } else {
            this._vbox.hide();
            this._toplevel.hide();
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
        this._recreate_ui();
        if (this._toplevel.get_visible()) {
            this._vbox.show_all();
        }
    },

    set_orientation: function(orientation) {
        this._orientation = orientation;
        this.update_lookup_table(this._lookup_table, this._lookup_table_visible);
    },

    get_current_orientation: function() {
        return this._current_orientation;
    },

    // do_expose_event: function(event) {
    //     this.style.paint_box(this.window,
    //                 Gtk.StateType.NORMAL,
    //                 Gtk.ShadowType.IN,
    //                 event.area,
    //                 this._vbox,
    //                 'panel',
    //                 this.allocation.x, this.allocation.y,
    //                 this.allocation.width, this.allocation.height);

    //     Gtk.VBox.do_expose_event(this._vbox, event);
    // },

    _size_request: function() {
        this._toplevel.resize(1, 1);
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
            y = cursor_location[1] - this._st_candidate_panel.get_height() - pad;
        } else {
            y = cursor_bottom;
        }

        this.move(x, y);
    },

    show_all: function() {
        this._vbox.show_all();
        // this._toplevel.show_all();
        this._toplevel.hide();
        this._st_candidate_panel.show();
    },

    hide_all: function() {
        this._vbox.hide();
        this._toplevel.hide();
        this._st_candidate_panel.hide();
    },

    move: function(x, y) {
        this._toplevel.move(x, y);
        this._st_candidate_panel.set_position(x, y);
    },
};

Signals.addSignalMethods(CandidatePanel.prototype);
