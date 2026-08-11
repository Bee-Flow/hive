/**
 * Edge identity — the single source of truth for what makes two definition
 * edges "the same edge".
 *
 * A definition edge's real identity is `(from, to, label, caseName)`: an
 * If/Switch can legitimately route several branches to the SAME downstream
 * step, so `(from, to)` alone is ambiguous. Before this module existed, every
 * canvas handler matched differently — the edge "✕" matched on
 * label-reconstructed-from-handle, the Delete key on the bare pair, and the
 * edge "+" splice on the bare pair too — so deleting or splicing one branch
 * edge silently took its siblings with it (node-audit defects B3/B4/B10).
 *
 * Everything here is pure and framework-free.
 */

/**
 * Map a React Flow source-handle id to the edge branch fields the runtime
 * routes on: `then`/`else` for a condition, `case:<name>` (incl.
 * `case:default`) for a switch, `on_error` for a loop's error port. Plain
 * handles → no branch (unlabelled edge).
 *
 * (Moved verbatim from DiagramPane, which re-exports it for back-compat.)
 */
export function branchFromHandle(sourceHandle) {
    if (sourceHandle === 'then' || sourceHandle === 'else') return { label: sourceHandle };
    if (sourceHandle === 'on_error') return { label: 'on_error' };
    if (typeof sourceHandle === 'string' && sourceHandle.startsWith('case:')) {
        return { label: sourceHandle, caseName: sourceHandle.slice(5) };
    }
    return {};
}

/**
 * Canonical string key for a definition edge. Two edges with the same key are
 * duplicates. (Moved from nodeOps.js, which now imports it from here.)
 */
export function edgeKey(e) {
    return `${e.from}->${e.to}|${e.label || ''}|${e.caseName ?? ''}`;
}

/** The branch part of an edge's identity, normalised to nulls. */
export function edgeIdentity(e) {
    return { label: e?.label ?? null, caseName: e?.caseName ?? null };
}

/**
 * Does definition edge `e` carry the branch identity `identity`?
 *
 * Case edges tolerate the two legacy shapes: writers used to stamp label-only
 * (`case:vip`) or caseName-only (`vip`) rows, and both exist in saved
 * definitions. A `case:` identity therefore matches an edge that carries
 * EITHER side. Plain identities (label:null, caseName:null) match only truly
 * unlabelled edges.
 */
export function matchesEdgeIdentity(e, identity) {
    const want = edgeIdentity(identity || {});
    const have = edgeIdentity(e);
    if (want.caseName != null || (want.label && want.label.startsWith('case:'))) {
        const wantCase = want.caseName ?? want.label.slice(5);
        const haveCase = have.caseName ?? (have.label && have.label.startsWith('case:') ? have.label.slice(5) : null);
        return haveCase === wantCase;
    }
    return (have.label || null) === (want.label || null);
}

/**
 * Copy every NON-identity key (anything besides from/to/label/caseName) from
 * one edge object onto another. Definition edges may carry extra metadata —
 * today a persisted `color` — and every helper that rebuilds edge objects
 * from scratch must run its output through this, or the metadata silently
 * dies on a splice/bridge/duplicate. (Extracted from routeEdges' re-pointing
 * loop, which pioneered the idiom.)
 */
export function copyExtraEdgeKeys(src, out) {
    if (!src || typeof src !== 'object') return out;
    for (const k of Object.keys(src)) {
        if (k !== 'from' && k !== 'to' && k !== 'label' && k !== 'caseName') out[k] = src[k];
    }
    return out;
}

/**
 * Splice a freshly inserted step onto ONE specific edge:
 * `source --(identity)--> inserted --(firstPort)--> target`.
 *
 * Only the identity-matched edge is removed — sibling branch edges between the
 * same pair survive. The branch decision lives on the source→inserted edge
 * (that is where routing happens), and the replaced edge's extra keys (colour)
 * ride along with it; the continuation starts clean.
 *
 * `insertedPort` names the port the CONTINUATION leaves by. Plain steps have
 * one unnamed output and pass null; a brancher must name one, because the
 * runtime routes those on their label only — an unlabelled edge out of an
 * If/Switch never fires (B5), so dropping a Filter onto a connection used to
 * produce a dead "never runs" continuation.
 */
export function spliceStepIntoEdge(edges, insertedId, sourceId, targetId, identity, insertedPort = null) {
    const list = Array.isArray(edges) ? edges : [];
    const isMatch = (e) => e.from === sourceId && e.to === targetId && matchesEdgeIdentity(e, identity);
    const replaced = list.find(isMatch) || null;
    const kept = list.filter(e => !isMatch(e));
    const id = edgeIdentity(identity || {});
    const sourceToNew = { from: sourceId, to: insertedId };
    if (id.label) sourceToNew.label = id.label;
    if (id.caseName != null) sourceToNew.caseName = id.caseName;
    copyExtraEdgeKeys(replaced, sourceToNew);
    const newToTarget = { from: insertedId, to: targetId };
    if (insertedPort?.label) newToTarget.label = insertedPort.label;
    if (insertedPort?.caseName != null) newToTarget.caseName = insertedPort.caseName;
    return [...kept, sourceToNew, newToTarget];
}

/**
 * Remove exactly the edges named by `identities`
 * (`[{from, to, label?, caseName?}]`). Used by the Delete-key path: each
 * rendered edge maps 1:1 to a definition row, so full-identity matching
 * removes only what was actually selected.
 */
export function removeEdgesByIdentity(edges, identities) {
    const list = Array.isArray(edges) ? edges : [];
    const wanted = (Array.isArray(identities) ? identities : [identities]).filter(Boolean);
    return list.filter(e => !wanted.some(w =>
        e.from === w.from && e.to === w.to && matchesEdgeIdentity(e, w)));
}
