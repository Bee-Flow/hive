/**
 * Tiny line-diff helper for the post-edit preview card. Output a list of hunks
 * suitable for rendering as a stripped-down GitHub-style diff:
 *
 *   [
 *     { type: 'context', text: '...' },
 *     { type: 'remove',  text: '...' },
 *     { type: 'add',     text: '...' },
 *     ...
 *   ]
 *
 * Algorithm: classic LCS over lines, then walk the LCS to produce the hunk
 * sequence. Bound the result to ~120 lines to keep the chat card readable —
 * for huge rewrites we just summarise (n lines added / removed).
 *
 * No external dependency.
 */

const MAX_LINES = 120;
const CONTEXT_LINES = 2;

function splitLines(s) {
    if (!s) return [];
    // Preserve a trailing newline as an empty entry only if the original ended in \n
    return s.split('\n');
}

function buildLcsTable(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    return dp;
}

function diffOps(oldLines, newLines) {
    const dp = buildLcsTable(oldLines, newLines);
    const ops = [];
    let i = 0, j = 0;
    const m = oldLines.length, n = newLines.length;
    while (i < m && j < n) {
        if (oldLines[i] === newLines[j]) {
            ops.push({ type: 'context', text: oldLines[i] });
            i++; j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            ops.push({ type: 'remove', text: oldLines[i] });
            i++;
        } else {
            ops.push({ type: 'add', text: newLines[j] });
            j++;
        }
    }
    while (i < m) ops.push({ type: 'remove', text: oldLines[i++] });
    while (j < n) ops.push({ type: 'add', text: newLines[j++] });
    return ops;
}

/**
 * Trim the ops list to interesting hunks (changes ± CONTEXT_LINES of context).
 * Returns a single flat list with the same shape as `diffOps`, but shorter.
 */
function trimToHunks(ops) {
    if (ops.length === 0) return ops;
    const keep = new Array(ops.length).fill(false);
    for (let i = 0; i < ops.length; i++) {
        if (ops[i].type !== 'context') {
            for (let k = Math.max(0, i - CONTEXT_LINES); k <= Math.min(ops.length - 1, i + CONTEXT_LINES); k++) {
                keep[k] = true;
            }
        }
    }
    const out = [];
    let lastKept = -2;
    for (let i = 0; i < ops.length; i++) {
        if (!keep[i]) continue;
        if (lastKept >= 0 && i - lastKept > 1) out.push({ type: 'gap', text: '…' });
        out.push(ops[i]);
        lastKept = i;
    }
    return out;
}

/**
 * Compute a hunked diff between two strings.
 *
 * @returns {{
 *   hunks: Array<{type:'context'|'add'|'remove'|'gap', text:string}>,
 *   added:   number,
 *   removed: number,
 *   summary: string,           // e.g. "+12 −4"
 *   truncated: boolean,
 * }}
 */
export default function computeWebpageDiff(oldText, newText) {
    const a = splitLines(oldText || '');
    const b = splitLines(newText || '');

    if (oldText === newText) {
        return { hunks: [], added: 0, removed: 0, summary: 'no change', truncated: false };
    }

    // Cheap path for huge rewrites — don't run LCS on multi-thousand-line files.
    if (a.length + b.length > 4000) {
        return {
            hunks: [],
            added: b.length,
            removed: a.length,
            summary: `+${b.length} −${a.length} (large rewrite)`,
            truncated: true,
        };
    }

    const ops = diffOps(a, b);
    let added = 0, removed = 0;
    for (const op of ops) {
        if (op.type === 'add') added++;
        else if (op.type === 'remove') removed++;
    }

    let hunks = trimToHunks(ops);
    let truncated = false;
    if (hunks.length > MAX_LINES) {
        hunks = hunks.slice(0, MAX_LINES);
        hunks.push({ type: 'gap', text: '…(truncated)' });
        truncated = true;
    }

    return {
        hunks,
        added,
        removed,
        summary: `+${added} −${removed}`,
        truncated,
    };
}
