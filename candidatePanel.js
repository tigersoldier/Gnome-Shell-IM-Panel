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
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const IBus = imports.gi.IBus;
const Lang = imports.lang;
const Signals = imports.signals;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;

const Extension = imports.ui.extensionSystem.extensions["gjsimp@tigersoldier"];
const Common = Extension.common;

function StCandidateArea(orientation) {
    this._init(orientation);
}

StCandidateArea.prototype = {
    _init: function(orientation) {
        this.actor = new St.BoxLayout({ style_class: 'candidate-area' });
        this._orientation = orientation;
        this._labels = [];
        this._createUI();
    },

    _removeOldWidgets: function() {
        this.actor.destroy_children();
        this._labels = [];
    },

    _createUI: function() {
        let vbox = null;
        let hbox = null;
        if (this._orientation == Common.ORIENTATION_VERTICAL) {
            vbox = new St.BoxLayout({ vertical: true,
                                      style_class: 'candidate-vertical' });
            this.actor.add(vbox,
                           { expand: true, 
                             x_fill: true,
                             y_fill: true
                           });
        } else {
            hbox = new St.BoxLayout({ vertical: false,
                                      style_class: 'candidate-horizontal' });
            this.actor.add(hbox,
                           { expand: true, 
                             x_fill: true,
                             y_fill: true
                           });
        }
        for (let i = 0; i < 16; i++) {
            let label1 = new St.Label({ text: '1234567890abcdef'.charAt(i) + '.',
                                        style_class: 'candidate-label',
                                        reactive: true });

            let label2 = new St.Label({ text: '' ,
                                        style_class: 'candidate-text',
                                        reactive: true });

            if (this._orientation == Common.ORIENTATION_VERTICAL) {
                let candidateHBox = new St.BoxLayout({vertical: false});
                candidateHBox.add(label1,
                                   { expand: false,
                                     x_fill: false,
                                     y_fill: true
                                   });
                candidateHBox.add(label2,
                                   { expand: true,
                                     x_fill: true,
                                     y_fill: true
                                   });
                vbox.add(candidateHBox);
            } else {
                hbox.add(label1);
                hbox.add(label2);
            }

            this._labels.push([label1, label2]);
        }

        for (let i = 0; i < this._labels.length; i++) {
            for(let j = 0; j < this._labels[i].length; j++) {
                let widget = this._labels[i][j];
                widget.candidateIndex = i;
                widget.connect('button-press-event', 
                               Lang.bind(this, function (widget, event) {
                                   this._candidateClickedCB(widget, event);
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

    _recreateUI: function() {
        this._removeOldWidgets();
        this._createUI();
    },

    _candidateClickedCB: function(widget, event) {
        this.emit('candidate-clicked',
                  widget.candidateIndex,
                  event.get_button(),
                  Shell.get_event_state(event));
    },

    setLabels: function(labels) {
        if (!labels || labels.length == 0) {
            for (let i = 0; i < 16; i++) {
                this._labels[i][0].set_text('1234567890abcdef'.charAt(i) + '.');
            }
            return;
        }

        for (let i = 0; i < labels.length && i < this._labels.length; i++) {
            /* Use a ClutterActor attribute of Shell's theme instead of
             * Pango.AttrList for the lookup window GUI and 
             * can ignore 'attrs' simply from IBus engines?
             */
            let [text, attrs] = labels[i];
            this._labels[i][0].set_text(text);
        }
    },

    setCandidates: function(candidates, focusCandidate, showCursor) {
        if (focusCandidate == undefined) {
            focusCandidate = 0;
        }
        if (showCursor == undefined) {
            showCursor = true;
        }
        if (candidates.length > this._labels.length) {
            assert();
        }

        for (let i = 0; i < candidates.length; i++) {
            /* Use a ClutterActor attribute of Shell's theme instead of
             * Pango.AttrList for the lookup window GUI and 
             * can ignore 'attrs' simply from IBus engines?
             */
            let [text, attrs] = candidates[i];
            if (i == focusCandidate && showCursor) {
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

    setOrientation: function(orientation) {
        if (orientation == this._orientation)
            return;
        this._orientation = orientation;
        this._recreateUI();
    },

    showAll: function() {
        this.actor.show();
    },

    hideAll: function() {
        this.actor.hide();
    },
};

Signals.addSignalMethods(StCandidateArea.prototype);

function CandidatePanel() {
    this._init();
}

CandidatePanel.prototype = {
    _init: function() {
        this._orientation = Common.ORIENTATION_VERTICAL;
        this._currentOrientation = this._orientation;
        this._preeditVisible = false;
        this._auxStringVisible = false;
        this._lookupTableVisible = false; 
        this._lookupTable = null;

        this._cursorLocation = [0, 0, 0, 0];
        this._movedCursorLocation = null; 

        this._initSt();

    },

    _initSt: function() {
        this._stCandidatePanel = new St.BoxLayout({style_class: 'candidate-panel',
                                                   vertical: true});

        this._stPreeditLabel = new St.Label({text: ''});
        if (!this._preeditVisible) {
            this._stPreeditLabel.hide();
        }
        this._stAuxLabel = new St.Label({text: ''});
        if (!this._auxVisible) {
            this._stAuxLabel.hide();
        }
        this._stCandidatePanel.set_position(500, 500);
        // create candidates area
        this._stCandidateArea = new StCandidateArea(this._currentOrientation);
        this._stCandidateArea.connect('candidate-clicked', 
                                      Lang.bind(this, function(x, i, b, s) {
                                                this.emit('candidate-clicked', i, b, s);}));
        this.updateLookupTable(this._lookupTable, this._lookupTableVisible);

        // TODO: page up/down GUI

        this._packAllStWidgets();
        Main.uiGroup.add_actor(this._stCandidatePanel);
        this._checkShowStates();
    },

    _packAllStWidgets: function() {
        this._stCandidatePanel.add(this._stPreeditLabel,
                                   {x_fill: true,
                                    y_fill: false,
                                    x_align: St.Align.MIDDLE,
                                    y_align: St.Align.START});
        this._stCandidatePanel.add(this._stAuxLabel,
                                   {x_fill: true,
                                    y_fill: false,
                                    x_align: St.Align.MIDDLE,
                                    y_align: St.Align.MIDDLE});
        this._stCandidatePanel.add(this._stCandidateArea.actor,
                                   {x_fill: true,
                                    y_fill: false,
                                    x_align: St.Align.MIDDLE,
                                    y_align: St.Align.END});
    },

    showPreeditText: function() {
        this._preeditVisible = true;
        this._stPreeditLabel.show();
        this._checkShowStates();
    },

    hidePreeditText: function() {
        this._preeditVisible = false;
        this._stPreeditLabel.hide();
        this._checkShowStates();
    },

    updatePreeditText: function(text, cursorPos, visible) {
        if (visible) {
            this.showPreeditText();
        } else {
            this.hidePreeditText();
        }
        let str = text.get_text();
        this._stPreeditLabel.set_text(str);

        let attrs = text.get_attributes();
        for (let i = 0; attrs != null && attrs.get(i) != null; i++) {
            let attr = attrs.get(i);
            if (attr.get_attr_type() == IBus.AttrType.BACKGROUND) {
                let startIndex = attr.get_start_index();
                let endIndex = attr.get_end_index();
                let len = GLib.utf8_strlen(str, -1);
                let markup = '';
                if (startIndex == 0 &&
                    endIndex == GLib.utf8_strlen(str, -1)) {
                    markup = markup.concat(str);
                } else {
                    if (startIndex > 0) {
                        markup = markup.concat(GLib.utf8_substring(str,
                                                                   0,
                                                                   startIndex));
                    }
                    if (startIndex != endIndex) {
                        markup = markup.concat('<span background=\"#555555\">');
                        markup = markup.concat(GLib.utf8_substring(str,
                                                                   startIndex,
                                                                   endIndex));
                        markup = markup.concat('</span>');
                    }
                    if (endIndex < len) {
                        markup = markup.concat(GLib.utf8_substring(str,
                                                                   endIndex,
                                                                   len));
                    }
                }
                let clutter_text = this._stPreeditLabel.get_clutter_text();
                clutter_text.set_markup(markup);
                clutter_text.queue_redraw();
            }
        }
    },

    showAuxiliaryText: function() {
        this._auxStringVisible = true;
        this._stAuxLabel.show();
        this._checkShowStates();
    },

    hideAuxiliaryText: function() {
        this._auxStringVisible = false;
        this._stAuxLabel.hide();
        this._checkShowStates();
    },

    updateAuxiliaryText: function(text, show) {
        if (show) {
            this.showAuxiliaryText();
        } else {
            this.hideAuxiliaryText();
        }

        this._stAuxLabel.set_text(text.get_text());
    },

    _refreshLabels: function() {
        let newLabels = [];
        for (let i = 0; this._lookupTable.get_label(i) != null; i++) {
            let label = this._lookupTable.get_label(i);
            newLabels.push([label.get_text(), label.get_attributes()]);
        }
        this._stCandidateArea.setLabels(newLabels);
    },


    _getCandidatesInCurrentPage: function() {
        let cursorPos = this._lookupTable.get_cursor_pos();
        let pageSize = this._lookupTable.get_page_size();
        let page = ((cursorPos == 0) ? 0 : Math.floor(cursorPos / pageSize));
        let startIndex = page * pageSize;
        let endIndex = Math.min((page + 1) * pageSize,
                                this._lookupTable.get_number_of_candidates());
        let candidates = [];
        for (let i = startIndex; i < endIndex; i++) {
            candidates.push(this._lookupTable.get_candidate(i));
        }
        return candidates;
    },

    _getCursorPosInCurrentPage: function() {
        let cursorPos = this._lookupTable.get_cursor_pos();
        let pageSize = this._lookupTable.get_page_size();
        let posInPage = cursorPos % pageSize;
        return posInPage;
    },

    _refreshCandidates: function() {
        let candidates = this._getCandidatesInCurrentPage();
        let newCandidates = [];
        for (let i = 0; i < candidates.length; i++) {
            let candidate = candidates[i];
            newCandidates.push([candidate.get_text(),
                                candidate.get_attributes()]);
        }
        this._stCandidateArea.setCandidates(newCandidates,
                                            this._getCursorPosInCurrentPage(),
                                            this._lookupTable.is_cursor_visible());
    },

    updateLookupTable: function(lookupTable, visible) {
        // hide lookup table
        if (!visible) {
            this.hideLookupTable();
        }

        this._lookupTable = lookupTable || new IBus.LookupTable();
        let orientation = this._lookupTable.get_orientation();
        if (orientation != Common.ORIENTATION_HORIZONTAL &&
            orientation != Common.ORIENTATION_VERTICAL) {
            orientation = this._orientation;
        }
        this.setCurrentOrientation(orientation);
        this._refreshCandidates();
        this._refreshLabels();

        // show lookup table
        if (visible) {
            this.showLookupTable();
        }
    },

    showLookupTable: function() {
        this._lookupTableVisible = true;
        this._stCandidateArea.showAll();
        this._checkShowStates();
    },

    hideLookupTable: function() {
        this._lookupTableVisible = false;
        this._stCandidateArea.hideAll();
        this._checkShowStates();
    },

    pageUpLookupTable: function() {
        this._lookupTable.page_up();
        this._refreshCandidates();
    },

    pageDownLookup_table: function() {
        this._lookupTable.page_down();
        this._refreshCandidates();
    },

    cursorUpLookupTable: function() {
        this._lookupTable.cursor_up();
        this._refreshCandidates();
    },

    cursorDownLookupTable: function() {
        this._lookupTable.cursor_down();
        this._refreshCandidates();
    },

    setCursorLocation: function(x, y, w, h) {
        // if cursor location is changed, we reset the moved cursor location
        if (this._cursorLocation.join() != [x, y, w, h].join()) {
            this._cursorLocation = [x, y, w, h];
            this._movedCursorLocation = null;
            this._checkPosition();
        }
    },

    _checkShowStates: function() {
        if (this._preeditVisible ||
            this._auxStringVisible ||
            this._lookupTableVisible) {
            this._stCandidatePanel.show();
            this._checkPosition();
            this.emit('show');
        } else {
            this._stCandidatePanel.hide();
            this.emit('hide');
        }
    },

    reset: function() {
        let text = IBus.Text.new_from_string('');
        this.updatePreeditText(text, 0, false);
        text = IBus.Text.new_from_string('');
        this.updateAuxiliaryText(text, false);
        this.updateLookupTable(null, false);
        this.hideAll();
    },

    setCurrentOrientation: function(orientation) {
        if (this._currentOrientation == orientation) {
            return;
        }
        this._currentOrientation = orientation;
        this._stCandidateArea.setOrientation(orientation);
    },

    setOrientation: function(orientation) {
        this._orientation = orientation;
        this.updateLookupTable(this._lookupTable, this._lookupTableVisible);
    },

    getCurrentOrientation: function() {
        return this._currentOrientation;
    },

    _checkPosition: function() {
        let cursorLocation = this._movedCursorLocation || this._cursorLocation;
        let cursorRight = cursorLocation[0] + cursorLocation[2];
        let cursorBottom = cursorLocation[1] + cursorLocation[3];

        let windowRight = cursorRight + this._stCandidatePanel.get_width();
        let windowBottom = cursorBottom + this._stCandidatePanel.get_height();
        let rootWindow = Gdk.get_default_root_window();
        let [sx, sy] = [rootWindow.get_width(), rootWindow.get_height()];
        let x = 0;
        let y = 0;

        if (windowRight > sx) {
            x = sx - this._stCandidatePanel.get_width();
        } else {
            x = cursorRight;
        }

        if (windowBottom > sy) {
            // move the window just above the cursor so the window and a preedit string do not overlap.
            /* FIXME: pad would not be needed. */
            let pad = 20; 
            if (this._currentOrientation == Common.ORIENTATION_VERTICAL) {
                pad = 10;
            }
            y = Math.min(cursorLocation[1] - pad, sy) - 
                this._stCandidatePanel.get_height();
        } else {
            y = cursorBottom;
        }

        this.move(x, y);
    },

    showAll: function() {
        this._stCandidatePanel.show();
    },

    hideAll: function() {
        this._stCandidatePanel.hide();
    },

    move: function(x, y) {
        this._stCandidatePanel.set_position(x, y);
    }
};

Signals.addSignalMethods(CandidatePanel.prototype);
