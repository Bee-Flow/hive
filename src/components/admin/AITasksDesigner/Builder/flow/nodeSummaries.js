/**
 * The one line under a node's name on the canvas.
 *
 * The well-made cards (Loop, Condition, Notification, the privacy trio) already
 * say something a person can read. The Lists and Data cards printed raw config
 * instead: "by deep-equal", a bare field name in monospace, "addDays", "7200s",
 * "first 10". Worse, none of them named the LIST they act on — so four Lists
 * nodes hanging off one search read as four identical cards with different
 * titles, and the only way to tell them apart was to open each one.
 *
 * Pure string functions, no React, so they can be tested directly and reused by
 * any surface that needs a one-line description of a step.
 *
 * `stepLabelById` comes from flow/layout.js via every node's `data`, and turns
 * `steps.s1.output.results` into `‹Search email›.results`.
 */

import { humanizeExpression, humanizeFieldKey } from './displayHelpers';
import { formatWaitDuration } from './waitDuration';

/**
 * The source list, named the way the user named the step that made it.
 * `stepLabelById` is the Map from displayHelpers.buildStepLabelMap. The ‹›
 * marks stay: they are the canvas's existing way of saying "this bit is a step
 * you named", and LoopNode already reads that way.
 */
function listName(arrayRef, stepLabelById) {
    if (!arrayRef) return null;
    return humanizeExpression(arrayRef, stepLabelById) || arrayRef;
}

/** "… of ‹Search email›", or nothing at all when no list is picked yet. */
function fromList(arrayRef, stepLabelById, preposition = 'of') {
    const name = listName(arrayRef, stepLabelById);
    return name ? ` ${preposition} ${name}` : '';
}

/**
 * Each returns either a plain string, or `{ muted: string }` for the
 * "not answered yet" state the card renders in italic. Never a raw config key.
 */

export function limitSummary(step, { stepLabelById } = {}) {
    if (!step.arrayRef) return { muted: 'no list picked yet' };
    const n = Number(step.count);
    const count = Number.isFinite(n) ? n : 0;
    if (count === 0) return `Nothing${fromList(step.arrayRef, stepLabelById, 'from')}`;
    const which = step.mode === 'last' ? 'Last' : 'First';
    return `${which} ${count}${fromList(step.arrayRef, stepLabelById)}`;
}

export function dedupeSummary(step, { stepLabelById } = {}) {
    if (!step.arrayRef) return { muted: 'no list picked yet' };
    // "by deep-equal" was the old line: accurate, and the single most
    // developer-only string on the canvas.
    return step.keyField
        ? `One per ${humanizeFieldKey(step.keyField)}${fromList(step.arrayRef, stepLabelById, '· from')}`
        : `Identical items removed${fromList(step.arrayRef, stepLabelById, 'from')}`;
}

export function aggregateSummary(step, { stepLabelById } = {}) {
    if (!step.arrayRef) return { muted: 'no list picked yet' };
    if (!step.field) return { muted: 'pick which field to collect' };
    return `${humanizeFieldKey(step.field)} from every item${fromList(step.arrayRef, stepLabelById)}`;
}

const SUMMARIZE_VERB = { sum: 'Total', count: 'Count', avg: 'Average', min: 'Lowest', max: 'Highest' };

export function summarizeSummary(step, { stepLabelById } = {}) {
    if (!step.arrayRef) return { muted: 'no list picked yet' };
    const op = step.op || 'sum';
    // count ignores the field entirely — saying "Count of Amount" would be a lie.
    if (op === 'count') return `How many items${fromList(step.arrayRef, stepLabelById, 'in')}`;
    if (!step.field) return { muted: 'pick which field to add up' };
    const verb = SUMMARIZE_VERB[op] || op;
    return `${verb} of ${humanizeFieldKey(step.field)}${fromList(step.arrayRef, stepLabelById, '· from')}`;
}

const DATETIME_PHRASE = {
    now: () => 'Today’s date and time',
    parse: () => 'Read a date from text',
    format: (s) => (s.format ? `Reformat as ${s.format}` : 'Reformat a date'),
    diff: (s) => `Time between two dates${s.unit ? ` in ${s.unit}` : ''}`,
    extract: (s) => (s.part ? `Take the ${humanizeFieldKey(s.part).toLowerCase()}` : 'Take part of a date'),
};

const DATETIME_ADD = { addDays: 'day', addHours: 'hour', addMinutes: 'minute' };

export function dateTimeSummary(step) {
    const op = step.op || 'now';
    const unit = DATETIME_ADD[op];
    if (unit) {
        const n = Number(step.amount);
        // A negative amount is a subtraction and should read as one.
        if (!Number.isFinite(n) || n === 0) return `Add or subtract ${unit}s`;
        const verb = n < 0 ? 'Subtract' : 'Add';
        const abs = Math.abs(n);
        return `${verb} ${abs} ${unit}${abs === 1 ? '' : 's'}`;
    }
    const phrase = DATETIME_PHRASE[op];
    // An unknown op is a hand-edited or imported definition; show it plainly
    // rather than pretending to understand it.
    return phrase ? phrase(step) : humanizeFieldKey(op);
}

export function waitSummary(step) {
    const phrase = formatWaitDuration(step.seconds);
    return phrase || { muted: 'no wait set' };
}
