/**
 * Editing a name → value MAP as a list of rows.
 *
 * Three places in the schema are objects keyed by a name the author types:
 * a navigate action's carried values, a flow step's navigate params / record
 * values / routine inputs. An object cannot hold two rows with the same key,
 * and it cannot hold a row with no key at all — but a person adding a row
 * necessarily has, for a moment, a row with no name.
 *
 * Committing the list straight through Object.fromEntries resolved that by
 * keeping the last row and throwing the other away, silently: clicking "add"
 * twice destroyed the first row's value, and so did clearing one row's name and
 * then another. So an unnamed row waits OUTSIDE the stored object until it has
 * a name of its own — and waits at the position it occupies, because a row that
 * jumps to the bottom of the list the moment its name is cleared is a row the
 * author is still typing in.
 *
 * Kept in its own module rather than in either editor: ActionsSection already
 * imports StepSettings, so a helper living in one of them and used by the other
 * would close an import cycle.
 */

/**
 * The visible row list: the stored (named) rows, with each unnamed draft
 * spliced back in at the position it was left in.
 *
 * `stored` is Object.entries(map); `drafts` is [{ at, row }].
 */
export function mergeDrafts(stored, drafts) {
    const out = [...stored];
    for (const d of [...(drafts || [])].sort((a, b) => a.at - b.at)) {
        out.splice(Math.min(d.at, out.length), 0, d.row);
    }
    return out;
}

/**
 * Split an edited row list into what can be stored and what is still unnamed.
 * → { named: [[name, value]], drafts: [{ at, row }] }
 */
export function splitNamed(rows) {
    const named = [];
    const drafts = [];
    (rows || []).forEach(([name, value], i) => {
        if (name === '') drafts.push({ at: i, row: [name, value] });
        else named.push([name, value]);
    });
    return { named, drafts };
}
