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

const Gettext = imports.gettext.domain('gnome-shell');
const _ = Gettext.gettext;

// define orientation
const ORIENTATION_HORIZONTAL  = 0;
const ORIENTATION_VERTICAL    = 1;
const ORIENTATION_SYSTEM      = 2;

function actor_set_sensitive(actor, sensitive, label) {
    actor.set_reactive(sensitive);
    if (label != null) {
        if (sensitive) {
            label.opacity = 255;
        } else {
            label.opacity = 85;
        }
    }
}
