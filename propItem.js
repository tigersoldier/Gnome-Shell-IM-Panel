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

function PropItem(prop) {
    this._init(prop);
}

PropItem.prototype = {
    _init: function(prop) {
        this._prop = prop;
        this._sub_items = [];
    },

    update_property: function(prop) {
        if (this._prop == null) {
            return false;
        }

        let retval = false;

        if (this._prop.get_key() == prop.get_key() && this._prop.get_prop_type() == prop.get_prop_type()) {
            this._prop = prop;
            this.property_changed();
            retval =  true;
        }

        for (let i = 0; i < this._sub_items.length; i++) {
            this._subitems[i].update_property(prop);
            retval = true;
        }

        return retval;
    },

    set_prop_label: function(label) {
        this._prop.set_label(label);
        this.property_changed();
    },

    set_icon: function(icon) {
        this._prop.set_icon(icon);
        this.property_changed();
    },

    set_tooltip: function(tooltip) {
        this._prop.set_tooltip(tooltip);
        this.property_changed();
    },

    set_state: function(state) {
        this._prop.set_state(state);
        this.property_changed();
    },

    property_changed: function() {
    },
};
