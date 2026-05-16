// Shared date-range builder.
//
// Replaces the divergent `rangeQuery` (Terminations panel) and
// `rangeToFilter` (Feedback panel) implementations — same idea, different
// return shape, easy to drift.
//
// Pass a preset key ('today' | '7d' | '30d' | '90d' | 'all') OR an explicit
// `{ from, to }` ISO pair. Returns both a URLSearchParams blob (ready to
// append to a fetch URL) and a `{ from, to }` filter object (for in-memory
// filtering).

import { MS_PER_DAY } from '../constants/units';

const PRESETS = {
    today: 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
};

/**
 * @param {string|{from?: string, to?: string}} input
 * @returns {{ params: URLSearchParams, filter: { from: string|null, to: string|null } }}
 */
export function buildDateRange(input) {
    const params = new URLSearchParams();
    let from = null;
    let to = null;

    if (input === 'all' || input == null) {
        return { params, filter: { from, to } };
    }

    if (typeof input === 'string' && input in PRESETS) {
        const now = Date.now();
        const days = PRESETS[input];
        from = new Date(now - days * MS_PER_DAY).toISOString();
        to = new Date(now).toISOString();
    } else if (typeof input === 'object') {
        from = input.from || null;
        to = input.to || null;
    }

    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return { params, filter: { from, to } };
}

export const DATE_RANGE_PRESETS = Object.keys(PRESETS).concat('all');
