import { useCallback, useEffect, useRef } from 'react';

/**
 * Multi-select + copy/paste for the diagram canvas (§5b scaffolding).
 *
 * ReactFlow already supports rubber-band selection — this hook layers
 * a copy/paste clipboard on top so users can duplicate a chunk of
 * steps and re-attach the internal edges with fresh IDs.
 *
 * Phase 2 work: wire from DiagramPane with `selectedNodes`,
 * `onPasteNodes`, and generate-ID helpers. The hook here defines the
 * keyboard binding contract (Cmd+C / Cmd+V / Cmd+D for duplicate) so
 * the consumer surface is stable.
 *
 *   const clip = useDiagramClipboard({
 *     getSelection,        // () => { nodes, edges }
 *     onPasteNodes,        // (clonedNodes, clonedEdges) => void
 *     onDuplicateInPlace,  // optional, for Cmd+D
 *   });
 */

export default function useDiagramClipboard({ getSelection, onPasteNodes, onDuplicateInPlace }) {
    const buffer = useRef(null);

    const copy = useCallback(() => {
        const sel = typeof getSelection === 'function' ? getSelection() : null;
        if (!sel || !Array.isArray(sel.nodes) || sel.nodes.length === 0) return;
        buffer.current = JSON.parse(JSON.stringify(sel));
    }, [getSelection]);

    const paste = useCallback(() => {
        if (!buffer.current || typeof onPasteNodes !== 'function') return;
        // Phase 2: regenerate stable IDs + retarget intra-selection edges.
        onPasteNodes(buffer.current.nodes, buffer.current.edges || []);
    }, [onPasteNodes]);

    useEffect(() => {
        const onKey = (e) => {
            const meta = e.metaKey || e.ctrlKey;
            if (!meta) return;
            const key = e.key.toLowerCase();
            if (key === 'c') { copy(); return; }
            if (key === 'v') { paste(); return; }
            if (key === 'd') {
                if (typeof onDuplicateInPlace === 'function') {
                    e.preventDefault();
                    onDuplicateInPlace();
                }
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [copy, paste, onDuplicateInPlace]);

    return { copy, paste };
}
