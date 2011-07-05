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

const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;
const Signals = imports.signals;

function Handle() {
    this._init();
}

Handle.prototype = {
    _init: function() {
        this._eventbox = new Gtk.EventBox();
        this._eventbox.set_visible_window(false);
        this._eventbox.set_size_request(10, -1);
        this._eventbox.set_events(
            Gdk.EventMask.EXPOSURE_MASK |
            Gdk.EventMask.BUTTON_PRESS_MASK |
            Gdk.EventMask.BUTTON_RELEASE_MASK |
            Gdk.EventMask.BUTTON1_MOTION_MASK);
        this._press_pos = [0, 0];
        /* workaround for motion-notify-event*/
        this._pointer_pos = [0, 0];

        this._move_begined = false;

        let root = Gdk.get_default_root_window();

        this._eventbox.connect('button-press-event', Lang.bind(this, this._on_button_press_event));
        this._eventbox.connect('button-release-event', Lang.bind(this, this._on_button_release_event));
        this._eventbox.connect('motion-notify-event', Lang.bind(this, this._on_motion_notify_event));
        this._eventbox.connect('draw', Lang.bind(this, this._on_realize));
    },

    _on_button_press_event: function(widget, event) {
        /* It seems the GdkEvent.button is not a property. */
        //if (event.button == 1) {
        if (1) {
            let root = Gdk.get_default_root_window();
            try {
                let desktop = root.property_get('_NET_CURRENT_DESKTOP')[2][0];
                let workareas = root.property_get('_NET_WORKAREA')[2];
                this._workarea = [];
                for (let i = desktop * 4; i <  (desktop + 1) * 4; i++) {
                    this._workarea[this._workarea.length] = workareas[i];
                }
            } catch(e) {
                this._workarea = null;
            }
            this._move_begined = true;
            let toplevel = this._eventbox.get_toplevel();
            let [x, y] = toplevel.get_position();
            this._press_pos = [event.x_root - x, event.y_root - y];
            this._pointer_pos = toplevel.get_pointer();
            this._eventbox.window.set_cursor(Gdk.Cursor.new(Gdk.CursorType.FLEUR ));
            this.emit('move-begin');
            return true;
        }
        return false;
    },

    _on_button_release_event: function(widget, event) {
        /* It seems the GdkEvent.button is not a property. */
        //if (event.button == 1) {
        if (1) {
            this._move_begined = false;
            this._press_pos = null;
            this._pointer_pos = null;
            this._workarea = null;
            this._eventbox.window.set_cursor(Gdk.Cursor.new(Gdk.CursorType.LEFT_PTR));
            this.emit('move-end');
            return true;
        }

        return false;
    },

    _on_motion_notify_event: function(widget, event) {
        if (!this._move_begined) {
            return;
        }
        let toplevel = this._eventbox.get_toplevel();
        let [x, y] = toplevel.get_position();
        /* It seems the GdkEvent is private. */
        /*
        if (event.x_root - this._press_pos[0] >= 0) {
            x  = Math.floor(event.x_root - this._press_pos[0]);
        } else {
            x  = Math.ceil(event.x_root - this._press_pos[0]);
        }
        if (event.y_root - this._press_pos[1] >= 0) {
            y  = Math.floor(event.y_root - this._press_pos[1]);
        } else {
            y  = Math.ceil(event.y_root - this._press_pos[1]);
        }
        */

        /* workaround for event.*_root */
        x  = x + (toplevel.get_pointer()[0] - this._pointer_pos[0]);
        y  = y + (toplevel.get_pointer()[1] - this._pointer_pos[1]);
        let root = Gdk.get_default_root_window();
        let x_root = root.get_width();
        let y_root = root.get_height();
        if (x_root < x) {
            x  = x_root;
        }
        if (x < 0) {
            x  = 0;
        }
        if (y_root < y) {
            y  = y_root;
        }
        if (y < 0) {
            y  = 0;
        }

        if (this._workarea == null) {
            toplevel.move(x, y);
            return;
        }

        if (x < this._workarea[0] && x > this._workarea[0] - 16) {
            x = this._workarea[0];
        }
        if (y < this._workarea[1] && y > this._workarea[1] - 16) {
            y = this._workarea[1];
        }

        let [w, h] = toplevel.get_size();
        if (x + w > this._workarea[0] + this._workarea[2] &&
            x + w < this._workarea[0] + this._workarea[2] + 16) {
            x = this._workarea[0] + this._workarea[2] - w;
        }
        if (y + h > this._workarea[1] + this._workarea[3] &&
            y + h < this._workarea[1] + this._workarea[3] + 16) {
            y =  this._workarea[1] + this._workarea[3] - h;
        }

        toplevel.move(x, y);
    },

    _on_realize: function(widget, event) {
        let toplevel = this._eventbox.get_toplevel();
        let [x, y] = toplevel.get_position();
        let width = this._eventbox.get_allocated_width();
        let height = this._eventbox.get_allocated_height();
        Gtk.paint_handle(this._eventbox.style,
                         Gdk.cairo_create(this._eventbox.window),
                         Gtk.StateType.NORMAL,
                         Gtk.ShadowType.OUT,
                         this._eventbox,
                         '',
                         x, y,
                         10, height,
                         Gtk.Orientation.VERTICAL);
        return true;
    },

    get_raw: function() {
        return this._eventbox;
    },

    show: function() {
        return this._eventbox.show();
    },

    hide: function() {
        return this._eventbox.hide();
    },
};

Signals.addSignalMethods(Handle.prototype);
