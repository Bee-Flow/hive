/**
 * "How much, and what kind" — one sentence about a step's data.
 *
 * After running a step the question is almost never "show me the JSON", it is
 * "did anything come out, and how much of it goes to the next node". That
 * answer is needed in three places (the chip on a connection, the quick
 * editor's in/out line, the Output panel header), so it is computed once here.
 *
 * Pure and framework-free.
 */

/**
 * Keys that conventionally hold "the actual list" inside a result envelope.
 * A Gmail search returns `{query, total, results:[…]}` — reporting that as
 * "1 record" would be technically true and completely useless.
 */
const LIST_KEYS = ['items', 'results', 'rows', 'records', 'messages', 'values', 'data', 'entries', 'files'];

/** Text longer than this is worth reporting a character count for. */
const LONG_TEXT = 60;

function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
}

/** Is every element (that we sampled) an object? Then it reads as records. */
function looksTabular(arr) {
    const sample = arr.slice(0, 20).filter(v => v !== null && v !== undefined);
    if (!sample.length) return false;
    const objects = sample.filter(v => typeof v === 'object' && !Array.isArray(v));
    return objects.length >= sample.length / 2;
}

function fromArray(arr) {
    if (looksTabular(arr)) return { count: arr.length, kind: 'records', label: plural(arr.length, 'record', 'records') };
    return { count: arr.length, kind: 'items', label: plural(arr.length, 'item', 'items') };
}

/**
 * The list hiding inside a result envelope, if there is exactly one obvious
 * candidate: a conventionally-named array key, or — failing that — a single
 * array-valued key. Anything more ambiguous stays "1 record".
 *
 * `conventional` says WHICH of the two it was: only a recognised envelope key
 * lets us read a sibling `total` as "how many there were altogether" (see
 * withTotal) — in `{total: 100, lines:[…]}` that `total` is far more likely to
 * be an amount of money than a row count.
 */
function envelopeList(obj) {
    for (const k of LIST_KEYS) {
        if (Array.isArray(obj[k])) return { list: obj[k], conventional: true };
    }
    // `branches` is ROUTING metadata — which ports a fan-out switch fired — and
    // never the payload. Without this exclusion it IS the single array value on
    // a scalar fan-out output ({branch, branches, matched, value}), so the
    // fallback below reported the number of PORTS as a record count: an edge
    // chip reading "2 items" where the identical first-match node reads
    // "1 record", and "0 items" when nothing matched. A first-match switch
    // emits no `branches` key at all, so nothing about it changes here.
    const arrays = Object.entries(obj)
        .filter(([k, v]) => Array.isArray(v) && k !== 'branches')
        .map(([, v]) => v);
    return arrays.length === 1 ? { list: arrays[0], conventional: false } : null;
}

/**
 * "10 of 201 records" — the sentence that makes a truncated result visible.
 *
 * A search envelope reports how many matches EXIST (`gmail_search` returns
 * `{query, total, results}`, total = Gmail's resultSizeEstimate) next to the
 * page it actually returned. Ignoring `total` is how someone processes 10 of
 * 201 mails and never learns there were 201 (BFSF-358A) — so it is reported
 * here, mirroring the filter chip's "3 of 201" (summariseEdgeData).
 *
 * Guarded: the count must be a whole number ABOVE the returned length. A float
 * (a cart total) or a number that matches the list length says nothing extra
 * and keeps the plain label.
 */
function withTotal(summary, total) {
    if (!Number.isInteger(total) || total <= summary.count) return summary;
    const noun = summary.kind === 'records' || summary.kind === 'record' ? 'records' : 'items';
    return {
        ...summary,
        total,
        label: `${summary.count} of ${total} ${noun}`,
        title: `This step returned the first ${summary.count} of ${total} matches — raise its result limit to work through more.`,
    };
}

/**
 * @param {*} value  any step output (or a slice of one)
 * @returns {{count:number, kind:string, label:string}|null}
 *          null when there is nothing worth reporting (no run yet, empty text)
 */
export function summariseData(value) {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return fromArray(value);
    if (typeof value === 'object') {
        const found = envelopeList(value);
        if (found) {
            const summary = fromArray(found.list);
            return found.conventional ? withTotal(summary, value.total) : summary;
        }
        const n = Object.keys(value).length;
        if (n === 0) return null;
        return { count: 1, kind: 'record', label: '1 record' };
    }
    if (typeof value === 'string') {
        if (!value.length) return null;
        return {
            count: value.length,
            kind: 'text',
            label: value.length > LONG_TEXT ? `text · ${value.length} characters` : 'text',
        };
    }
    return { count: 1, kind: 'value', label: '1 value' };
}

/**
 * What travels down ONE connection.
 *
 * A Filter's `then` port carries the whole run; its list mode carries
 * `output.items`; a Switch carries only the rows that matched THAT case
 * (`output.matchesByCase.<name>`). Reporting the step's whole output on every
 * outgoing edge would claim 201 records go down a branch that got 3.
 *
 * @param {object} sourceStep  the step the edge leaves from
 * @param {object} runStep     its most recent run record ({status, output})
 * @param {object} edge        the definition edge ({label, caseName})
 */
export function summariseEdgeData(sourceStep, runStep, edge) {
    if (!runStep || runStep.status === 'skipped') return null;
    const output = runStep.output;
    if (output === null || output === undefined) return null;

    const caseName = edge?.caseName
        ?? (typeof edge?.label === 'string' && edge.label.startsWith('case:') ? edge.label.slice(5) : null);

    // A switch in collection mode buckets the rows per case.
    if (caseName && output.matchesByCase && typeof output.matchesByCase === 'object') {
        const rows = output.matchesByCase[caseName];
        return Array.isArray(rows) ? fromArray(rows) : null;
    }
    // A scalar switch/condition routes the whole run down one port: the ports
    // that did NOT fire carry nothing.
    //
    // …unless the switch fans out (matchMode 'all', BFSF-356), where SEVERAL
    // ports fire and `output.branches` lists them all while `output.branch`
    // holds only the first. Testing the edge against the singular value alone
    // showed "no data" on every path but the first, even though the run
    // demonstrably took them. A non-empty list is therefore the authority; an
    // EMPTY one means nothing matched, and then `branch` is the real (default)
    // port the run went down.
    const branches = Array.isArray(output.branches)
        ? output.branches.filter(b => typeof b === 'string') : [];
    const branch = typeof output.branch === 'string' ? output.branch : null;
    if (branches.length || branch) {
        const edgeBranch = edge?.label === 'then' || edge?.label === 'else'
            ? edge.label
            : (caseName ? `case:${caseName}` : null);
        const fired = branches.length ? branches.includes(edgeBranch) : edgeBranch === branch;
        if (edgeBranch && !fired) return null;
    }
    if (sourceStep?.type === 'filter' && Array.isArray(output.items)) {
        const summary = fromArray(output.items);
        // The runtime reports what the filter dropped (inputCount /
        // rejectedCount, engine execFilter). "3 of 201 records" answers the
        // follow-up question every filter chip raises; older run rows predate
        // the counts and keep the plain label.
        if (typeof output.inputCount === 'number' && output.inputCount > output.items.length) {
            return {
                ...summary,
                label: `${output.items.length} of ${output.inputCount} ${summary.kind === 'records' || summary.kind === 'record' ? 'records' : 'items'}`,
                title: `Kept ${output.items.length} of ${output.inputCount} — the other ${output.inputCount - output.items.length} did not match this filter`,
            };
        }
        return summary;
    }
    return summariseData(output);
}
