/**
 * The display identity of the two nodes that were renamed away from their
 * runtime type names.
 *
 * Both now come from flow/nodeDefs.js, which holds the same facts for EVERY
 * node type and is kept exhaustive by flow/nodeDefs.test.js. These named
 * exports stay because seven files and several tests import them, and because
 * they say something the generic accessor does not: "this node's name is not
 * its type, so import it rather than typing it out".
 *
 * Only the KEYWORDS still live here — searching is a palette concern, not a
 * presentation one, so nodeDefs deliberately doesn't carry it.
 */

import { NODE_DEFS } from './nodeDefs';

/**
 * "Edit data" (runtime type `set`). Used to be labelled three different ways —
 * "Edit Fields (Set)" in the palette, "Set fields" in the detail view, "Edit
 * fields" on the canvas.
 */
export const SET_STEP_NAME = NODE_DEFS.set.defaultLabel;
export const SET_STEP_DESC = NODE_DEFS.set.desc;

/**
 * The unified deciding step (runtime types `condition` / `switch` / `filter` —
 * see flow/routeModel.js's ROUTE_STEP_TYPES). "Filter" read as "drop some rows"
 * while the node's real job is "decide where this goes"; it also collided with
 * the Lists group, which is full of genuine filtering.
 */
export const ROUTE_STEP_NAME = NODE_DEFS.condition.defaultLabel;
export const ROUTE_STEP_DESC = NODE_DEFS.condition.desc;

// Search terms. Each list keeps the words the node was ONCE called, so a user
// who knows the old name — or the n8n one — still lands on it: the palette's
// ranker matches keywords, and a rename that dropped them would make a node
// unfindable by the only word half its users know.
export const ROUTE_STEP_KEYWORDS = 'if condition switch case filter route branch keep drop guard where match else multiway split';
export const SET_STEP_KEYWORDS = 'set edit fields data table rows columns assign rename restructure mapping group id number sort parse json extract path body response';
