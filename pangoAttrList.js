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

const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;
const IBus = imports.gi.IBus;

function _utf8_next_char(p) {
    let i = 0;
    if (p == null) {
        return null;
    }
    if (p.length > 0) {
        for (i = 1; (i < p.length) && ((p[i] & 0xc0) == 0x80); i++);
    }
    return p.substring(i);
}


function PangoAttrList(attrs, str) {
    this._init(attrs, str);
}

PangoAttrList.prototype = {
    _init: function(attrs, str) {
        this._attrs = new Pango.AttrList();
        if (attrs == null) {
            return;
        }
        let offsets = [];
        let offset = 0;
        let unistr = null;
        if (str == '') {
            unistr = '';
        /* gojbect-introspection 0.10.1 or latest is needed.
         * https://bugzilla.gnome.org/show_bug.cgi?id=633197 */
        /* gi/arg.c:gjs_value_from_g_argument() outputs the error
         * "Unhandled type gunichar converting GArgument to JavaScript". */
        /*
        } else if (str != null) {
            unistr = GLib.utf8_to_ucs4(str, -1, null, null);
        */
        }
        /*
        for (let i = 0; i < unistr.length; i++) {
            let c = unistr[i];
            offsets[offsets.length] = offset;
            let buff = [];
            let length = GLib.unichar_to_utf8(c, buff);
            buff[0][length] = 0;
            offset += buff.length;
        }
        offsets[offsets.length] = offset;
        */
        for (let i = 0; i < str.length; ) {
            let substr = _utf8_next_char(str.substring(i));
            offsets[offsets.length] = offset;
            offset += str.substring(i).length - substr.length;
            i += str.substring(i).length - substr.length;
        }
        offsets[offsets.length] = offset;
        for (let i = 0; i < attrs.length; i++) {
            let attr = attrs[i];
            let pango_attr = null;
            let start_index = ((attr.start_index >= 0) ? attr.start_index : 0);
            let end_index = ((attr.end_index >= 0) ? attr.end_index : 0);
            start_index = ((start_index < offsets.length) ? offsets[start_index] : offsets[0]);
            end_index = ((end_index < offsets.length) ? offsets[end_index] : offsets[0]);
            if (attr.type == IBus.ATTR_TYPE_FOREGROUND) {
                let r = (attr.value & 0x00ff0000) >> 8;
                let g = (attr.value & 0x0000ff00);
                let b = (attr.value & 0x000000ff) << 8;
                /* Currently no definition to convert Pango.Attribute to
                 * Javascript object. No pango_attribute_get_type() */
                //pango_attr = new Pango.AttrForeground(r, g, b,
                //    start_index, end_index);
            } else if (attr.type == IBus.ATTR_TYPE_BACKGROUND) {
                let r = (attr.value & 0x00ff0000) >> 8;
                let g = (attr.value & 0x0000ff00);
                let b = (attr.value & 0x000000ff) << 8;
                /* Currently no definition to convert Pango.Attribute to
                 * Javascript object. No pango_attribute_get_type() */
                //pango_attr = new Pango.AttrBackground(r, g, b,
                //    start_index, end_index);
            } else if (attr.type == IBus.ATTR_TYPE_UNDERLINE) {
                /* Currently no definition to convert Pango.Attribute to
                 * Javascript object. No pango_attribute_get_type() */
                //pango_attr = new Pango.AttrUnderline(Math.floor(attr.value),
                //    start_index, end_index);
            }
            if (pango_attr != null) {
                this._attrs.insert(pango_attr);
            }
        }
    },

    get_raw: function() {
        return this._attrs;
    },
};
