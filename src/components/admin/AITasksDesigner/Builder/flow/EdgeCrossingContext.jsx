import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { pathSegments } from './edgeHops';

/**
 * Lets one edge know where the others are drawn, so it can bridge over them.
 *
 * An edge component is handed its own endpoints and nothing else — React Flow
 * has no notion of "the other lines". The paths only exist after layout has
 * measured every node, so they cannot be computed up in DiagramPane either.
 * So each edge publishes its own segments here as it renders, and reads back
 * everyone else's.
 *
 * ── WHY THERE ARE TWO CONTEXTS ──────────────────────────────────────
 * This is a render feeding itself, and the first version of it spun forever.
 * The publish/retract API and the "something moved" counter were one object, so
 * every counter bump produced a NEW context value; every edge's publish effect
 * saw its dependency change, tore down (retract → bump) and re-ran (publish →
 * bump), and that bump started the next round. During a drag it looked fine —
 * everything was re-rendering anyway — and the moment you let go the canvas
 * locked up, because nothing was left to stop it.
 *
 * Splitting them fixes it by construction:
 *   • the API object is created ONCE and never changes identity, so a publish
 *     effect re-runs only when that edge's own path really changed;
 *   • the version is its own context, read where the hops are computed, which
 *     is a render-time value with no effect hanging off it.
 *
 * Publishing is also silent when the path string is identical, so a re-render
 * that moved nothing costs nothing, and bumps are coalesced onto a microtask so
 * forty edges in one commit share a single extra pass.
 *
 * Outside a provider every hook here is inert and no hops are drawn — an edge
 * rendered on its own (a test, a preview) simply keeps React Flow's path.
 */

const EdgeCrossingApiContext = createContext(null);
const EdgeCrossingVersionContext = createContext(0);

export function EdgeCrossingProvider({ children }) {
    const byId = useRef(new Map());
    const [version, setVersion] = useState(0);
    const pending = useRef(false);
    const alive = useRef(true);

    // Created once. Its identity is load-bearing: it is what the publish effect
    // depends on, and an identity that changed per bump is exactly the loop
    // described above.
    const api = useMemo(() => {
        const bump = () => {
            if (pending.current) return;
            pending.current = true;
            queueMicrotask(() => {
                pending.current = false;
                if (alive.current) setVersion(v => v + 1);
            });
        };
        return {
            publish(id, d) {
                if (!id) return;
                const prev = byId.current.get(id);
                if (prev && prev.d === d) return;
                byId.current.set(id, { d, segments: pathSegments(d) });
                bump();
            },
            retract(id) {
                if (byId.current.delete(id)) bump();
            },
            others(id) {
                const out = [];
                for (const [key, entry] of byId.current) {
                    if (key === id) continue;
                    out.push(...entry.segments);
                }
                return out;
            },
        };
    }, []);

    // A bump already in flight when the pane unmounts would set state on a dead
    // component; the flag is the cheapest way to make that a no-op.
    React.useEffect(() => () => { alive.current = false; }, []);

    return (
        <EdgeCrossingApiContext.Provider value={api}>
            <EdgeCrossingVersionContext.Provider value={version}>
                {children}
            </EdgeCrossingVersionContext.Provider>
        </EdgeCrossingApiContext.Provider>
    );
}

/** Stable across renders — safe to depend on from an effect. */
export function useEdgeCrossings() {
    return useContext(EdgeCrossingApiContext);
}

/** Changes whenever any edge's path did. Read it in render, never in an effect. */
export function useEdgeCrossingVersion() {
    return useContext(EdgeCrossingVersionContext);
}
