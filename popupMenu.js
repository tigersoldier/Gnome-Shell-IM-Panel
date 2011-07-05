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
const Signals = imports.signals;
const PopupBaseMenuItem = imports.ui.popupMenu.PopupBaseMenuItem;
const PopupMenu = imports.ui.popupMenu.PopupMenu;


function PopupImageMenuItemMarkup(text, iconName) {
    this._init(text, iconName);
}

/* We'd like to show the markup text likes bold type. */
PopupImageMenuItemMarkup.prototype = {
    __proto__: PopupBaseMenuItem.prototype,

    _init: function (text, iconName) {
        PopupBaseMenuItem.prototype._init.call(this);

        this.label = new St.Label({ text: text });
        let clutter_text = this.label.get_clutter_text();
        clutter_text.set_markup(text);
        this.addActor(this.label);
        this._icon = new St.Icon({ style_class: 'popup-menu-icon' });
        this.addActor(this._icon, { align: St.Align.END });

        this.setIcon(iconName);
    },

    setIcon: function(name) {
        this._icon.icon_name = name;
    }
};

function PopupMenuNoOpenStateChanged() {
    this._init.apply(this, arguments);
}

/* This class and PopupMenu.PopupMenu are almost same but this does not emit
 * open-state-changed signal because PopupMenu.PopupMenuManager catch 
 * the signal and Main.pushModal() is called in _grab().
 * Input method needs to keep the focus on the text application to get the
 * current GtkIMContext so the grab methods need to be avoided. */
PopupMenuNoOpenStateChanged.prototype = {
    __proto__: PopupMenu.prototype,

    _init: function(sourceActor, alignment, arrowSide, gap) {
        PopupMenu.prototype._init.call(this, sourceActor, alignment, arrowSide, gap);
    },

    open: function(animate) {
        if (this.isOpen)
            return;

        this.isOpen = true;

        this._boxPointer.setPosition(this.sourceActor, this._gap, this._alignment);
        this._boxPointer.show(animate);

        /* This does not emit open-state-changed to keep the focus on
         * text applications. */
        //this.emit('open-state-changed', true);
    },

    close: function(animate) {
        if (!this.isOpen)
            return;

        if (this._activeMenuItem)
            this._activeMenuItem.setActive(false);

        this._boxPointer.hide(animate);

        this.isOpen = false;

        /* This does not emit open-state-changed to keep the focus on
         * text applications. */
        //this.emit('open-state-changed', false);
    },
};
