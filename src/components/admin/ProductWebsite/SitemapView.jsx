import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cmsApi } from './cmsApi';
import useAsyncAction from '../../../hooks/useAsyncAction';
import useOutsideDismiss from '../../../hooks/useOutsideDismiss';
import { authFetch } from '../../../utils/helpers';
import AppIcon from '../../AppIcon';
import { slugIssues } from '../../../utils/cmsPublicRouting';

/**
 * SitemapView — top-down tree of the site's pages.
 *
 *   Site Chrome (pseudo-node, header/footer)
 *           │
 *        Homepage   (rank 0)
 *      ┌────┼────┐
 *      page  page  page          (rank 1 — chrome targets + BFS children)
 *       │
 *       page                     (rank 2 — internal block links)
 *
 *   ── Unlinked pages ──
 *     orphanA   orphanB           (no inbound nav / link)
 *
 * Layout is BFS-based: homepage at rank 0, chrome targets become rank 1
 * children of the homepage, internal block-content links extend the
 * tree to rank 2+. Pages never reached are bucketed at the bottom.
 *
 * Edges are typed:
 *   NAV       — chrome (header / footer)            solid, accent
 *   INTERNAL  — block-content edge that follows the BFS tree
 *               (source IS the target's tree parent) — dashed, muted
 *   BACKLINK  — block-content edge that doesn't follow the tree — dotted, warning
 *
 * Chrome edges are routed through a single "Site Chrome" pseudo-node so
 * the graph doesn't get the N×C inflation the previous version had (one
 * edge per page × chrome target).
 *
 * The component fetches the full admin payload (`cmsApi.site`) so it can
 * derive typed edges client-side — block content isn't on the
 * `/graph` endpoint and we'd otherwise lose the chrome-vs-internal
 * distinction.
 */

// ── Layout constants ─────────────────────────────────────────────────

const NODE_W = 200;
const NODE_H = 78;
const RANK_GAP = 90;        // vertical gap between rank rows (above NODE_H)
const COL_GAP = 36;         // horizontal gap between cards in a rank
const PADDING = 64;         // outer canvas padding
const ORPHAN_GAP = 60;      // gap above the orphan row
const CHROME_W = 160;
const CHROME_H = 30;
const CHROME_GAP = 60;      // gap between chrome pseudo-node and homepage
const DRAG_THRESHOLD = 8;   // px movement before a mousedown becomes a drag

// ── Graph derivation helpers ─────────────────────────────────────────

// Collect every page-kind link target found in the header + footer.
// Returns:
//   targets : Set<pageId>
//   sources : Map<pageId, [{location:'header'|'footer'}]>  (for info popover)
function collectChromeTargets(site) {
    const targets = new Set();
    const sources = new Map();
    const walk = (location, node) => {
        if (Array.isArray(node)) { node.forEach(n => walk(location, n)); return; }
        if (!node || typeof node !== 'object') return;
        if (node.kind === 'page' && node.pageId) {
            targets.add(node.pageId);
            if (!sources.has(node.pageId)) sources.set(node.pageId, []);
            sources.get(node.pageId).push({ location });
        }
        for (const v of Object.values(node)) walk(location, v);
    };
    walk('header', site?.header);
    walk('footer', site?.footer);
    return { targets, sources };
}

// Walk every block on every page; emit (source, target) per page-kind link.
// Returns:
//   edges : [{ source, target }] deduped by pair
//   meta  : Map<"src->tgt", [{blockType, blockId}]> (which block defines it)
function collectInternalEdges(pages) {
    const edges = [];
    const seen  = new Set();
    const meta  = new Map();
    const addEdge = (source, target, blockType, blockId) => {
        if (!source || !target || source === target) return;
        const k = `${source}->${target}`;
        if (!seen.has(k)) {
            seen.add(k);
            edges.push({ source, target });
        }
        if (!meta.has(k)) meta.set(k, []);
        const existing = meta.get(k);
        if (!existing.some(e => e.blockId === blockId)) {
            existing.push({ blockType, blockId });
        }
    };
    const walk = (sourceId, blockType, blockId, node) => {
        if (Array.isArray(node)) { node.forEach(n => walk(sourceId, blockType, blockId, n)); return; }
        if (!node || typeof node !== 'object') return;
        if (node.kind === 'page' && node.pageId) addEdge(sourceId, node.pageId, blockType, blockId);
        for (const v of Object.values(node)) walk(sourceId, blockType, blockId, v);
    };
    for (const page of pages) {
        (page.blocks || []).forEach(block => walk(page.id, block.type, block.id, block));
    }
    return { edges, meta };
}

// BFS rank assignment from the homepage. Chrome targets seed rank 1 (the
// homepage's "nav children"). Internal edges extend the tree from there.
// Pages never visited become orphans.
//
// Returns:
//   positions    : Map<pageId, {x, y}>
//   parent       : Map<pageId, pageId>     tree parent (for edge classification)
//   chromePos    : { x, y } | null         only when chrome targets exist
//   orphanIds    : Set<pageId>             pages not reached by BFS
//   width, height: number                  computed canvas bounds
function bfsLayout(pages, internalEdges, chromeTargets) {
    const homepage = pages.find(p => p.isHomepage) || pages[0] || null;
    const outgoing = new Map();
    for (const e of internalEdges) {
        if (!outgoing.has(e.source)) outgoing.set(e.source, []);
        outgoing.get(e.source).push(e.target);
    }

    const rank   = new Map();
    const parent = new Map();
    const queue  = [];

    if (homepage) {
        rank.set(homepage.id, 0);
        queue.push(homepage.id);
        // Chrome targets become rank-1 children of the homepage.
        for (const t of chromeTargets) {
            if (t === homepage.id || rank.has(t)) continue;
            rank.set(t, 1);
            parent.set(t, homepage.id);
            queue.push(t);
        }
    }

    // BFS through internal edges.
    let cursor = 0;
    while (cursor < queue.length) {
        const id = queue[cursor++];
        const idRank = rank.get(id);
        const children = outgoing.get(id) || [];
        for (const child of children) {
            if (rank.has(child)) continue;
            rank.set(child, idRank + 1);
            parent.set(child, id);
            queue.push(child);
        }
    }

    // Bucket pages by rank.
    const byRank = new Map();
    const orphanIds = new Set();
    for (const p of pages) {
        if (rank.has(p.id)) {
            const r = rank.get(p.id);
            if (!byRank.has(r)) byRank.set(r, []);
            byRank.get(r).push(p);
        } else {
            orphanIds.add(p.id);
        }
    }
    const orphans = pages.filter(p => orphanIds.has(p.id));
    const ranks = Array.from(byRank.keys()).sort((a, b) => a - b);

    // Canvas width — widest row drives it. Plus padding.
    let widestRow = NODE_W;
    for (const items of byRank.values()) {
        const w = items.length * NODE_W + Math.max(0, items.length - 1) * COL_GAP;
        if (w > widestRow) widestRow = w;
    }
    if (orphans.length > 0) {
        const w = orphans.length * NODE_W + Math.max(0, orphans.length - 1) * COL_GAP;
        if (w > widestRow) widestRow = w;
    }
    const canvasWidth = widestRow + 2 * PADDING;
    const centerX = canvasWidth / 2;

    // Reserve space above rank 0 for the chrome pseudo-node when present.
    const hasChrome = chromeTargets.size > 0;
    const topPad = PADDING + (hasChrome ? CHROME_H + CHROME_GAP : 0);

    const positions = new Map();
    for (const r of ranks) {
        const items = byRank.get(r);
        const rowWidth = items.length * NODE_W + Math.max(0, items.length - 1) * COL_GAP;
        const startX = centerX - rowWidth / 2;
        const y = topPad + r * (NODE_H + RANK_GAP);
        items.forEach((p, idx) => {
            positions.set(p.id, { x: startX + idx * (NODE_W + COL_GAP), y });
        });
    }

    const maxPageRank = ranks.length > 0 ? ranks[ranks.length - 1] : 0;
    const bottomOfTree = topPad + maxPageRank * (NODE_H + RANK_GAP) + NODE_H;

    // Orphan row at the bottom.
    let orphanRowY = 0;
    if (orphans.length > 0) {
        orphanRowY = bottomOfTree + ORPHAN_GAP;
        const rowWidth = orphans.length * NODE_W + Math.max(0, orphans.length - 1) * COL_GAP;
        const startX = centerX - rowWidth / 2;
        orphans.forEach((p, idx) => {
            positions.set(p.id, { x: startX + idx * (NODE_W + COL_GAP), y: orphanRowY });
        });
    }

    // Chrome pseudo-node centred above the homepage.
    let chromePos = null;
    if (hasChrome && homepage) {
        const hpPos = positions.get(homepage.id);
        if (hpPos) {
            chromePos = {
                x: hpPos.x + (NODE_W - CHROME_W) / 2,
                y: hpPos.y - CHROME_H - CHROME_GAP,
            };
        }
    }

    const canvasHeight = (orphans.length > 0 ? orphanRowY + NODE_H : bottomOfTree) + PADDING;

    return {
        positions,
        parent,
        chromePos,
        orphanIds,
        orphanRowY,
        canvasWidth,
        canvasHeight,
        homepageId: homepage?.id || null,
    };
}

// Edge endpoint geometry — shorten the line so the arrowhead lands on
// the card edge, not its centre.
function edgeEndpoints(srcCx, srcCy, srcH, tgtCx, tgtCy, tgtH) {
    // For top-down trees most edges go roughly downward — start from the
    // bottom of the source rect's centre, end at the top of the target's.
    // For lateral / upward edges (backlinks) we still anchor on the centre
    // and let the visual handle it — good enough for the read-only graph.
    const sx = srcCx;
    const sy = srcCy + srcH / 2 - 2;
    const ex = tgtCx;
    const ey = tgtCy - tgtH / 2 + 2;
    return { sx, sy, ex, ey };
}

// Edge classification — returns 'tree' or 'backlink' for internal edges.
function classifyInternal(edge, parent) {
    return parent.get(edge.target) === edge.source ? 'tree' : 'backlink';
}

// Throw a useful Error when a CMS response isn't ok — the body's `error`
// field when present, else a status-coded fallback. Shared by the initial
// load and every mutation handler so the not-ok boilerplate lives once.
async function ensureOk(res, fallback) {
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `${fallback} (${res.status})`);
    }
}

// ── SitemapView ──────────────────────────────────────────────────────

export default function SitemapView({ siteId, activePageId, onSelectPage, onMutated }) {
    const containerRef = useRef(null);
    const [adminPayload, setAdminPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    // Manual position overrides (drag results). Survive Refresh so the
    // user's tidying isn't lost when the layout recomputes.
    const [overrides, setOverrides] = useState({});

    // Drag state — `candidate` is the pre-threshold mousedown record;
    // `dragging` is the actual drag once movement exceeds DRAG_THRESHOLD.
    const [candidate, setCandidate] = useState(null);
    const [dragging,  setDragging]  = useState(null);

    // UI overlays
    const [flyout, setFlyout]           = useState(null); // { pageId, anchorX, anchorY }
    const [edgePopover, setEdgePopover] = useState(null); // { x, y, info }

    // ── Fetch admin payload (site + pages with blocks) ──────────────
    const fetchData = useCallback(async () => {
        if (!siteId) { setLoading(false); setAdminPayload(null); return; }
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch(cmsApi.site(siteId));
            await ensureOk(res, 'Failed to load');
            const data = await res.json();
            setAdminPayload(data);
        } catch (err) {
            setError(String(err.message || err));
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Derived graph + layout ──────────────────────────────────────
    const derived = useMemo(() => {
        if (!adminPayload?.site) return null;
        const site = adminPayload.site;
        // Merge page index (has isHomepage) with page docs (have blocks).
        const docById = new Map((adminPayload.pages || []).map(p => [p.id, p]));
        const pages = (site.pages || []).map(entry => ({
            ...entry,
            blocks: docById.get(entry.id)?.blocks || [],
        }));
        const { targets: chromeTargets, sources: chromeSources } = collectChromeTargets(site);
        const { edges: internalEdges, meta: internalMeta } = collectInternalEdges(pages);
        const layout = bfsLayout(pages, internalEdges, chromeTargets);
        return { site, pages, chromeTargets, chromeSources, internalEdges, internalMeta, layout };
    }, [adminPayload]);

    // Positions: layout-computed unless the user has dragged the node.
    const effectivePositions = useMemo(() => {
        const out = new Map();
        if (!derived) return out;
        for (const [id, pos] of derived.layout.positions) {
            out.set(id, overrides[id] || pos);
        }
        return out;
    }, [derived, overrides]);

    // ── Drag handling ────────────────────────────────────────────────
    // Mousedown captures the candidate node + offset; we don't enter
    // drag mode until the mouse moves past DRAG_THRESHOLD pixels. This
    // lets click handlers on the gear icon fire cleanly without ever
    // triggering a "click after drag" miss.
    const handleNodeMouseDown = useCallback((e, nodeId) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + containerRef.current.scrollLeft;
        const mouseY = e.clientY - rect.top  + containerRef.current.scrollTop;
        const pos = effectivePositions.get(nodeId);
        if (!pos) return;
        setCandidate({
            id: nodeId,
            startMouseX: mouseX,
            startMouseY: mouseY,
            offsetX: mouseX - pos.x,
            offsetY: mouseY - pos.y,
        });
    }, [effectivePositions]);

    const handleMouseMove = useCallback((e) => {
        if (!candidate && !dragging) return;
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + containerRef.current.scrollLeft;
        const mouseY = e.clientY - rect.top  + containerRef.current.scrollTop;

        if (candidate && !dragging) {
            const dx = mouseX - candidate.startMouseX;
            const dy = mouseY - candidate.startMouseY;
            if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
                setDragging({
                    id: candidate.id,
                    offsetX: candidate.offsetX,
                    offsetY: candidate.offsetY,
                });
            }
        }
        if (dragging) {
            setOverrides(prev => ({
                ...prev,
                [dragging.id]: {
                    x: Math.max(0, mouseX - dragging.offsetX),
                    y: Math.max(0, mouseY - dragging.offsetY),
                },
            }));
        }
    }, [candidate, dragging]);

    const handleMouseUp = useCallback(() => {
        setCandidate(null);
        setDragging(null);
    }, []);

    // ── Refresh ─────────────────────────────────────────────────────
    // Re-fetches the payload (layout is re-derived in `derived` useMemo).
    // We deliberately do NOT clear `overrides`, so manual node tidying
    // survives a refresh. Reset Layout button below clears them.
    const handleRefresh = useCallback(() => { fetchData(); }, [fetchData]);
    const handleResetLayout = useCallback(() => { setOverrides({}); }, []);

    // ── Flyout open + page-mutation handlers ────────────────────────
    const openFlyout = useCallback((pageId, posX, posY) => {
        setFlyout({ pageId, anchorX: posX + NODE_W + 12, anchorY: posY });
    }, []);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
                Loading sitemap…
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm">
                <p className="text-red-400">{error}</p>
                <button type="button" onClick={handleRefresh} className="px-3 py-1.5 text-xs rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]">
                    Retry
                </button>
            </div>
        );
    }
    if (!derived) return null;

    const { pages, chromeTargets, chromeSources, internalEdges, internalMeta, layout, site } = derived;
    const { positions, parent, chromePos, orphanIds, orphanRowY, canvasWidth, canvasHeight } = layout;
    const isEmpty = pages.length === 0;

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] shrink-0">
                <span>
                    {pages.length} page{pages.length !== 1 ? 's' : ''}
                    {' · '}
                    {chromeTargets.size} chrome link{chromeTargets.size !== 1 ? 's' : ''}
                    {' · '}
                    {internalEdges.length} internal link{internalEdges.length !== 1 ? 's' : ''}
                </span>
                <div className="flex-1" />
                {Object.keys(overrides).length > 0 ? (
                    <button
                        type="button"
                        onClick={handleResetLayout}
                        className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        title="Reset manual node positions"
                    >
                        <AppIcon name="RotateCcw" className="w-3.5 h-3.5" />
                        Reset layout
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={handleRefresh}
                    className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    title="Refresh graph"
                >
                    <AppIcon name="RefreshCw" className="w-3.5 h-3.5" />
                    Refresh
                </button>
            </div>

            {isEmpty ? (
                <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-muted)]">
                    No pages yet. Add a page to see the sitemap.
                </div>
            ) : (
                <div
                    ref={containerRef}
                    className="flex-1 overflow-auto bg-[var(--bg-secondary)] relative"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <div style={{ width: canvasWidth, height: canvasHeight, position: 'relative' }}>
                        {/* SVG edge layer — sits behind the cards via DOM order. */}
                        <svg
                            width={canvasWidth}
                            height={canvasHeight}
                            style={{ position: 'absolute', left: 0, top: 0 }}
                        >
                            <defs>
                                <marker id="sm-arrow-nav" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                                    <path d="M0,0 L0,6 L8,3 z" fill="var(--accent-primary)" />
                                </marker>
                                <marker id="sm-arrow-internal" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                                    <path d="M0,0 L0,6 L8,3 z" fill="var(--text-secondary)" />
                                </marker>
                                <marker id="sm-arrow-backlink" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                                    <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b" />
                                </marker>
                            </defs>

                            {/* NAV edges from the chrome pseudo-node. */}
                            {chromePos && Array.from(chromeTargets).map(targetId => {
                                const tpos = effectivePositions.get(targetId);
                                if (!tpos) return null;
                                const srcCx = chromePos.x + CHROME_W / 2;
                                const srcCy = chromePos.y + CHROME_H / 2;
                                const tgtCx = tpos.x + NODE_W / 2;
                                const tgtCy = tpos.y + NODE_H / 2;
                                const { sx, sy, ex, ey } = edgeEndpoints(srcCx, srcCy, CHROME_H, tgtCx, tgtCy, NODE_H);
                                const onClick = () => {
                                    const srcs = chromeSources.get(targetId) || [];
                                    const where = srcs.map(s => s.location).join(' / ');
                                    setEdgePopover({
                                        x: (sx + ex) / 2,
                                        y: (sy + ey) / 2,
                                        info: {
                                            kind: 'chrome',
                                            text: `Defined in ${where || 'site chrome'} — edit it in Site chrome.`,
                                        },
                                    });
                                };
                                return (
                                    <g key={`nav-${targetId}`} onClick={onClick} style={{ cursor: 'pointer' }}>
                                        <line x1={sx} y1={sy} x2={ex} y2={ey}
                                            stroke="transparent" strokeWidth={12} />
                                        <line x1={sx} y1={sy} x2={ex} y2={ey}
                                            stroke="var(--accent-primary)"
                                            strokeWidth={1.75}
                                            markerEnd="url(#sm-arrow-nav)" />
                                    </g>
                                );
                            })}

                            {/* INTERNAL / BACKLINK edges, page → page. */}
                            {internalEdges.map((edge, i) => {
                                const s = effectivePositions.get(edge.source);
                                const t = effectivePositions.get(edge.target);
                                if (!s || !t) return null;
                                const cls = classifyInternal(edge, parent);
                                const srcCx = s.x + NODE_W / 2;
                                const srcCy = s.y + NODE_H / 2;
                                const tgtCx = t.x + NODE_W / 2;
                                const tgtCy = t.y + NODE_H / 2;
                                const { sx, sy, ex, ey } = edgeEndpoints(srcCx, srcCy, NODE_H, tgtCx, tgtCy, NODE_H);
                                const dash = cls === 'tree' ? '6,4' : '2,4';
                                const stroke = cls === 'tree' ? 'var(--text-secondary)' : '#f59e0b';
                                const marker = cls === 'tree' ? 'url(#sm-arrow-internal)' : 'url(#sm-arrow-backlink)';
                                const blocks = internalMeta.get(`${edge.source}->${edge.target}`) || [];
                                const onClick = () => {
                                    const where = blocks.length
                                        ? `block${blocks.length > 1 ? 's' : ''}: ${blocks.map(b => b.blockType).join(', ')}`
                                        : 'block content';
                                    setEdgePopover({
                                        x: (sx + ex) / 2,
                                        y: (sy + ey) / 2,
                                        info: {
                                            kind: cls,
                                            text: `Defined inside ${where} on the source page — edit it from that block.`,
                                        },
                                    });
                                };
                                return (
                                    <g key={`int-${i}`} onClick={onClick} style={{ cursor: 'pointer' }}>
                                        <line x1={sx} y1={sy} x2={ex} y2={ey}
                                            stroke="transparent" strokeWidth={12} />
                                        <line x1={sx} y1={sy} x2={ex} y2={ey}
                                            stroke={stroke}
                                            strokeWidth={1.5}
                                            strokeOpacity={0.85}
                                            strokeDasharray={dash}
                                            markerEnd={marker} />
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Chrome pseudo-node — pill, not interactive. */}
                        {chromePos ? (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: chromePos.x,
                                    top: chromePos.y,
                                    width: CHROME_W,
                                    height: CHROME_H,
                                }}
                                className="flex items-center justify-center gap-1.5 px-3 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[10px] uppercase tracking-wider text-[var(--text-secondary)] select-none pointer-events-none"
                                aria-label="Site chrome — header and footer"
                            >
                                <AppIcon name="LayoutTemplate" className="w-3 h-3" />
                                Header / Footer
                            </div>
                        ) : null}

                        {/* Orphan row label, drawn only when there are orphans. */}
                        {orphanIds.size > 0 ? (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: PADDING,
                                    top: orphanRowY - 28,
                                }}
                                className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] pointer-events-none"
                            >
                                Unlinked pages
                            </div>
                        ) : null}

                        {/* Page nodes (cards). */}
                        {pages.map(page => {
                            const pos = effectivePositions.get(page.id);
                            if (!pos) return null;
                            const isHomepage = !!page.isHomepage;
                            const isOrphan   = orphanIds.has(page.id);
                            const isActive   = page.id === activePageId;
                            const inNav      = chromeTargets.has(page.id);
                            return (
                                <NodeCard
                                    key={page.id}
                                    page={page}
                                    pos={pos}
                                    isHomepage={isHomepage}
                                    isOrphan={isOrphan}
                                    isActive={isActive}
                                    inNav={inNav}
                                    onMouseDown={(e) => handleNodeMouseDown(e, page.id)}
                                    onGear={() => openFlyout(page.id, pos.x, pos.y)}
                                />
                            );
                        })}

                        {/* Edge popover (info-only). */}
                        {edgePopover ? (
                            <EdgePopover
                                edgePopover={edgePopover}
                                onClose={() => setEdgePopover(null)}
                            />
                        ) : null}

                        {/* Page settings flyout. */}
                        {flyout ? (() => {
                            const target = pages.find(p => p.id === flyout.pageId);
                            if (!target) return null;
                            return (
                                <SettingsFlyout
                                    key={target.id}
                                    page={target}
                                    pages={pages}
                                    site={site}
                                    siteId={siteId}
                                    anchorPos={{ x: flyout.anchorX, y: flyout.anchorY }}
                                    canvasWidth={canvasWidth}
                                    onClose={() => setFlyout(null)}
                                    onOpenInEditor={() => {
                                        // Optional bridge to the page editor — preserves
                                        // the existing onSelectPage API even though
                                        // node clicks no longer fire it.
                                        if (typeof onSelectPage === 'function') onSelectPage(target.id);
                                        setFlyout(null);
                                    }}
                                    // Flyout mutations (title/slug/nav/delete/homepage) write the
                                    // site doc directly, bypassing the panel's copy — notify the
                                    // host so it can refresh its state and reset undo history
                                    // (a stale panel-side save would otherwise clobber the change).
                                    onChanged={() => { setFlyout(null); fetchData(); onMutated?.(); }}
                                />
                            );
                        })() : null}
                    </div>
                </div>
            )}

            {/* Legend (bottom-left corner of toolbar strip). */}
            <div className="px-4 py-2 border-t border-[var(--border-subtle)] shrink-0 flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
                <LegendItem color="var(--accent-primary)" style="solid"  label="Nav link" />
                <LegendItem color="var(--text-secondary)" style="dashed" label="Internal link" />
                <LegendItem color="#f59e0b"               style="dotted" label="Backlink" />
                <div className="flex-1" />
                <span>Drag a card to tidy · Click ⚙ to edit a page</span>
            </div>
        </div>
    );
}

// ── Node card ────────────────────────────────────────────────────────

function NodeCard({ page, pos, isHomepage, isOrphan, isActive, inNav, onMouseDown, onGear }) {
    const title = page.title || '(untitled)';
    const truncated = title.length > 20 ? title.slice(0, 19) + '…' : title;
    const borderColor = isActive
        ? 'var(--accent-primary)'
        : (isOrphan ? 'var(--border-default)' : 'var(--border-subtle)');
    const handleGearKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onGear();
        }
    };
    return (
        <div
            style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: NODE_W,
                height: NODE_H,
                borderColor,
            }}
            className={`group flex flex-col rounded-lg border bg-[var(--bg-primary)] shadow-sm
                ${isActive ? 'ring-2 ring-[var(--accent-primary)]/30' : ''}
                ${isOrphan ? 'opacity-90' : ''}
                select-none cursor-grab active:cursor-grabbing
                transition-shadow transition-colors duration-150
                hover:shadow-md hover:border-[var(--accent-primary)]/60`}
            onMouseDown={onMouseDown}
        >
            {/* Header strip: title + gear */}
            <div className="flex items-start justify-between px-3 pt-2 gap-2 min-w-0">
                <span
                    className="text-sm font-medium text-[var(--text-primary)] leading-tight truncate"
                    title={title}
                >
                    {truncated}
                </span>
                <button
                    type="button"
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit page ${title}`}
                    title="Edit page"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onGear(); }}
                    onKeyDown={handleGearKey}
                    className="shrink-0 -mr-1 mt-0.5 w-6 h-6 inline-flex items-center justify-center rounded
                        text-[var(--text-muted)] hover:text-[var(--accent-primary)]
                        opacity-40 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                    <AppIcon name="Settings" className="w-3.5 h-3.5" />
                </button>
            </div>
            {/* Slug */}
            <span className="px-3 text-[11px] font-mono text-[var(--text-muted)] truncate" title={`/${page.slug}`}>
                /{page.slug}
            </span>
            {/* Badges */}
            <div className="px-3 pb-2 mt-auto flex items-center gap-1 text-[9px] uppercase tracking-wider">
                {isHomepage ? <Badge variant="home">Home</Badge> : null}
                {!isHomepage && inNav ? <Badge variant="nav">In nav</Badge> : null}
                {!isHomepage && isOrphan ? <Badge variant="orphan">Orphan</Badge> : null}
            </div>
        </div>
    );
}

function Badge({ variant, children }) {
    const cls = variant === 'home'
        ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
        : variant === 'orphan'
            ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]';
    return (
        <span className={`px-1.5 py-0.5 rounded ${cls} font-medium`}>{children}</span>
    );
}

// ── Edge popover (info-only) ─────────────────────────────────────────
//
// The spec described a "Break link?" confirm action; implementing
// destructive edge removal cleanly requires walking the source block's
// content tree to a specific path, which is non-trivial and out of
// scope for this rebuild. The popover currently surfaces *where* a link
// is defined so the user can navigate to that surface and edit it
// there. Marked as a follow-up.

function EdgePopover({ edgePopover, onClose }) {
    const ref = useRef(null);
    useOutsideDismiss(ref, onClose);

    const kindLabel = edgePopover.info.kind === 'chrome'
        ? 'Nav link (Site chrome)'
        : edgePopover.info.kind === 'tree'
            ? 'Internal link'
            : 'Backlink';

    return (
        <div
            ref={ref}
            style={{
                position: 'absolute',
                left: edgePopover.x,
                top: edgePopover.y,
                transform: 'translate(-50%, -100%)',
                zIndex: 60,
            }}
            className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md shadow-lg px-3 py-2 text-xs text-[var(--text-primary)] min-w-[200px] max-w-[280px]"
        >
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {kindLabel}
            </div>
            <p className="leading-snug text-[var(--text-secondary)]">{edgePopover.info.text}</p>
        </div>
    );
}

// ── Settings flyout ──────────────────────────────────────────────────

function SettingsFlyout({ page, pages, site, siteId, anchorPos, canvasWidth, onClose, onChanged, onOpenInEditor }) {
    const [title, setTitle] = useState(page.title || '');
    const [slug, setSlug]   = useState(page.slug  || '');
    // One shared async runner for every mutation below — `busy` gates the
    // whole form, `error` surfaces the last failure. `run` never throws.
    const { run, loading: busy, error } = useAsyncAction((task) => task());
    const ref = useRef(null);

    // In-nav membership lives on the site doc's header.nav, not on the
    // page itself. Detect by scanning for a page-kind nav entry that
    // points at this page.
    const inNav = useMemo(() => {
        const nav = site?.header?.nav || [];
        return nav.some(n => n?.link?.kind === 'page' && n.link.pageId === page.id);
    }, [site, page.id]);

    // Close on Escape / click outside.
    useOutsideDismiss(ref, onClose);

    // Anchor — clamp so the flyout doesn't overflow the canvas on the right.
    const FLYOUT_W = 280;
    const clampedLeft = Math.min(anchorPos.x, Math.max(0, canvasWidth - FLYOUT_W - 16));

    // Reserved slugs / duplicates block the save (server rejects reserved,
    // and would silently -2-suffix a duplicate); `_` slugs warn only.
    const slugIssue = slugIssues(slug, {
        existingSlugs: (pages || []).map(pg => pg.slug),
        currentSlug: page.slug,
    });

    const handleSaveMeta = () => {
        const titleChanged = title.trim() !== page.title;
        const slugChanged  = slug.trim()  !== page.slug;
        if (slugChanged && slugIssue?.blocking) return;
        if (!titleChanged && !slugChanged) { onClose(); return; }
        run(async () => {
            const patch = {};
            if (titleChanged) patch.title = title.trim();
            if (slugChanged)  patch.slug  = slug.trim();
            const res = await authFetch(cmsApi.pageMeta(siteId, page.id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            await ensureOk(res, 'Save failed');
            onChanged();
        });
    };

    const handleToggleNav = (next) => run(async () => {
        // "Show in nav" maps to adding/removing a nav item pointing at
        // this page. We mutate the full site doc and PUT it back.
        const navItems = site?.header?.nav || [];
        let nextNav;
        if (next) {
            // Add an entry if there isn't one already.
            if (!navItems.some(n => n?.link?.kind === 'page' && n.link.pageId === page.id)) {
                nextNav = [
                    ...navItems,
                    {
                        id: `nav_${Math.random().toString(36).slice(2, 8)}`,
                        label: page.title || page.slug || 'Page',
                        link: { kind: 'page', pageId: page.id },
                    },
                ];
            } else {
                nextNav = navItems;
            }
        } else {
            nextNav = navItems.filter(n => !(n?.link?.kind === 'page' && n.link.pageId === page.id));
        }
        const nextSite = { ...site, header: { ...(site.header || {}), nav: nextNav } };
        const res = await authFetch(cmsApi.site(siteId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ site: nextSite }),
        });
        await ensureOk(res, 'Save failed');
        onChanged();
    });

    const handleSetHomepage = () => run(async () => {
        const res = await authFetch(cmsApi.pageHomepage(siteId, page.id), { method: 'PUT' });
        await ensureOk(res, 'Save failed');
        onChanged();
    });

    const handleDelete = () => {
        if (!window.confirm(`Delete page "${page.title || page.slug}"? This cannot be undone.`)) return;
        run(async () => {
            const res = await authFetch(cmsApi.page(siteId, page.id), { method: 'DELETE' });
            await ensureOk(res, 'Delete failed');
            onChanged();
        });
    };

    return (
        <div
            ref={ref}
            style={{
                position: 'absolute',
                left: clampedLeft,
                top: anchorPos.y,
                width: FLYOUT_W,
                zIndex: 80,
            }}
            className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
                <span className="text-xs font-semibold text-[var(--text-primary)]">Page settings</span>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    title="Close"
                >
                    <AppIcon name="X" className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="p-3 flex flex-col gap-2.5">
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Title</span>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        disabled={busy}
                        className="px-2 py-1.5 rounded text-xs border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Slug</span>
                    <input
                        type="text"
                        value={slug}
                        onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                        disabled={busy}
                        className="px-2 py-1.5 rounded text-xs font-mono border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                    {slugIssue ? (
                        <span className={`text-[10px] leading-tight ${slugIssue.blocking ? 'text-red-400' : 'text-amber-500/90'}`}>
                            ⚠ {slugIssue.message}
                        </span>
                    ) : null}
                </label>
                <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-[var(--text-secondary)]">Show in nav</span>
                    <button
                        type="button"
                        onClick={() => handleToggleNav(!inNav)}
                        disabled={busy}
                        role="switch"
                        aria-checked={inNav}
                        className={`relative inline-flex items-center w-9 h-5 rounded-full transition-colors
                            ${inNav ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)] border border-[var(--border-default)]'}
                            ${busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow
                                ${inNav ? 'translate-x-4' : 'translate-x-0.5'}`}
                        />
                    </button>
                </div>
                {error ? <p className="text-xs text-red-400">{error.message}</p> : null}

                <div className="flex items-center gap-2 pt-1">
                    <button
                        type="button"
                        onClick={handleSaveMeta}
                        disabled={busy || (slug.trim() !== page.slug && !!slugIssue?.blocking)}
                        className="flex-1 px-3 py-1.5 text-xs rounded-md bg-[var(--accent-primary)] text-white disabled:opacity-50"
                    >
                        {busy ? 'Saving…' : 'Save'}
                    </button>
                    <button
                        type="button"
                        onClick={onOpenInEditor}
                        disabled={busy}
                        className="px-3 py-1.5 text-xs rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/60 hover:text-[var(--accent-primary)] disabled:opacity-50"
                    >
                        Open in editor
                    </button>
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-2.5 flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={handleSetHomepage}
                        disabled={busy || page.isHomepage}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                        title={page.isHomepage ? 'Already the homepage' : 'Promote to homepage'}
                    >
                        Set as homepage
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={busy || (page.isHomepage && pages.length > 1)}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={page.isHomepage && pages.length > 1
                            ? 'Promote another page to homepage first'
                            : 'Delete this page'}
                    >
                        Delete page
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Legend item ──────────────────────────────────────────────────────

function LegendItem({ color, style, label }) {
    const dash = style === 'solid' ? '0' : style === 'dashed' ? '6,4' : '2,4';
    return (
        <span className="inline-flex items-center gap-1.5">
            <svg width="28" height="6" aria-hidden="true">
                <line
                    x1="0" y1="3" x2="28" y2="3"
                    stroke={color}
                    strokeWidth="2"
                    strokeDasharray={dash}
                />
            </svg>
            {label}
        </span>
    );
}
