import React, { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '../../../utils/helpers';
import { cmsApi } from './cmsApi';
import AppIcon from '../../AppIcon';

/**
 * SitemapView — read-only directed graph of the site's pages.
 *
 * Nodes  = pages (from /api/cms/sites/:siteId/graph)
 * Edges  = every internal Link.kind==="page" reference across all blocks
 *          and site chrome, deduped per (source, target).
 *
 * Layout: iterative force-directed simulation run in a useEffect so it's
 * pure JS — no additional library needed.
 *   - Repulsion between all node pairs.
 *   - Attraction along edges.
 *   - Gravity toward centre.
 *   - Nodes are draggable so the user can tidy the layout.
 */

const NODE_R      = 28;   // node circle radius (px)
const CANVAS_W    = 900;
const CANVAS_H    = 600;
const ITERATIONS  = 200;  // force simulation steps on load
const REPULSION   = 8000;
const ATTRACTION  = 0.04;
const GRAVITY     = 0.02;
const DAMPING     = 0.85;

// ── force simulation ─────────────────────────────────────────────────

function runLayout(nodes, edges) {
    // Place nodes in a circle initially so the layout starts spread out.
    const n = nodes.length;
    const positions = nodes.map((node, i) => ({
        id: node.id,
        x: CANVAS_W / 2 + Math.cos((2 * Math.PI * i) / n) * Math.min(CANVAS_W, CANVAS_H) * 0.3,
        y: CANVAS_H / 2 + Math.sin((2 * Math.PI * i) / n) * Math.min(CANVAS_W, CANVAS_H) * 0.3,
        vx: 0,
        vy: 0,
    }));

    const posById = new Map(positions.map(p => [p.id, p]));

    for (let iter = 0; iter < ITERATIONS; iter++) {
        // Repulsion between all pairs.
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const a = positions[i];
                const b = positions[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = REPULSION / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                a.vx -= fx; a.vy -= fy;
                b.vx += fx; b.vy += fy;
            }
        }
        // Attraction along edges.
        for (const edge of edges) {
            const a = posById.get(edge.source);
            const b = posById.get(edge.target);
            if (!a || !b) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            a.vx += dx * ATTRACTION;
            a.vy += dy * ATTRACTION;
            b.vx -= dx * ATTRACTION;
            b.vy -= dy * ATTRACTION;
        }
        // Gravity toward centre.
        for (const p of positions) {
            p.vx += (CANVAS_W / 2 - p.x) * GRAVITY;
            p.vy += (CANVAS_H / 2 - p.y) * GRAVITY;
        }
        // Apply velocity + damping + clamp to canvas.
        for (const p of positions) {
            p.vx *= DAMPING;
            p.vy *= DAMPING;
            p.x = Math.max(NODE_R + 4, Math.min(CANVAS_W - NODE_R - 4, p.x + p.vx));
            p.y = Math.max(NODE_R + 4, Math.min(CANVAS_H - NODE_R - 4, p.y + p.vy));
        }
    }

    return positions;
}

// Compute arrowhead endpoint so it sits on the target circle's edge,
// not at the centre.
function edgePoints(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    // Shorten by NODE_R so the line ends at the circle boundary.
    const ex = bx - (dx / dist) * (NODE_R + 3);
    const ey = by - (dy / dist) * (NODE_R + 3);
    // Also start at source boundary.
    const sx = ax + (dx / dist) * (NODE_R + 3);
    const sy = ay + (dy / dist) * (NODE_R + 3);
    return { sx, sy, ex, ey };
}

// ── SitemapView ──────────────────────────────────────────────────────

export default function SitemapView({ siteId, activePageId, onSelectPage }) {
    const [graph, setGraph]       = useState(null);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(null);
    const [positions, setPositions] = useState([]);
    const [dragging, setDragging] = useState(null); // { id, ox, oy }
    const svgRef = useRef(null);

    // Fetch graph data — refetch whenever the active site changes.
    useEffect(() => {
        if (!siteId) { setLoading(false); setGraph({ nodes: [], edges: [] }); setPositions([]); return; }
        let cancelled = false;
        setLoading(true);
        authFetch(cmsApi.siteGraph(siteId))
            .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error || 'Failed')))
            .then(data => {
                if (cancelled) return;
                setGraph(data);
                setPositions(runLayout(data.nodes, data.edges));
            })
            .catch(err => { if (!cancelled) setError(String(err)); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [siteId]);

    const posById = new Map(positions.map(p => [p.id, p]));

    // ── drag logic ───────────────────────────────────────────────────

    const onNodeMouseDown = useCallback((e, id) => {
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
        const pos = posById.get(id);
        if (!pos) return;
        setDragging({ id, ox: svgPt.x - pos.x, oy: svgPt.y - pos.y });
    }, [posById]);

    const onSvgMouseMove = useCallback((e) => {
        if (!dragging) return;
        const svg = svgRef.current;
        if (!svg) return;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
        const nx = Math.max(NODE_R + 4, Math.min(CANVAS_W - NODE_R - 4, svgPt.x - dragging.ox));
        const ny = Math.max(NODE_R + 4, Math.min(CANVAS_H - NODE_R - 4, svgPt.y - dragging.oy));
        setPositions(prev => prev.map(p => p.id === dragging.id ? { ...p, x: nx, y: ny } : p));
    }, [dragging]);

    const onSvgMouseUp = useCallback(() => setDragging(null), []);

    const handleRefresh = async () => {
        if (!siteId) return;
        setLoading(true);
        setError(null);
        try {
            const r = await authFetch(cmsApi.siteGraph(siteId));
            const data = await r.json();
            setGraph(data);
            setPositions(runLayout(data.nodes, data.edges));
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    // ── render ───────────────────────────────────────────────────────

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

    const nodes = graph?.nodes || [];
    const edges = graph?.edges || [];
    const isEmpty = nodes.length === 0;

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] shrink-0">
                <span>{nodes.length} page{nodes.length !== 1 ? 's' : ''} · {edges.length} internal link{edges.length !== 1 ? 's' : ''}</span>
                <div className="flex-1" />
                <span className="italic">Drag nodes to rearrange</span>
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
                <div className="flex-1 overflow-auto bg-[var(--bg-secondary)]">
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                        width={CANVAS_W}
                        height={CANVAS_H}
                        className="block"
                        style={{ cursor: dragging ? 'grabbing' : 'default' }}
                        onMouseMove={onSvgMouseMove}
                        onMouseUp={onSvgMouseUp}
                        onMouseLeave={onSvgMouseUp}
                    >
                        <defs>
                            <marker
                                id="arrow"
                                markerWidth="8" markerHeight="8"
                                refX="6" refY="3"
                                orient="auto"
                            >
                                <path d="M0,0 L0,6 L8,3 z" fill="var(--border-default)" />
                            </marker>
                            <marker
                                id="arrow-active"
                                markerWidth="8" markerHeight="8"
                                refX="6" refY="3"
                                orient="auto"
                            >
                                <path d="M0,0 L0,6 L8,3 z" fill="#6366f1" />
                            </marker>
                        </defs>

                        {/* edges */}
                        {edges.map((edge, i) => {
                            const a = posById.get(edge.source);
                            const b = posById.get(edge.target);
                            if (!a || !b) return null;
                            const { sx, sy, ex, ey } = edgePoints(a.x, a.y, b.x, b.y);
                            const isHighlighted = edge.source === activePageId || edge.target === activePageId;
                            return (
                                <line
                                    key={i}
                                    x1={sx} y1={sy} x2={ex} y2={ey}
                                    stroke={isHighlighted ? '#6366f1' : 'var(--border-default)'}
                                    strokeWidth={isHighlighted ? 2 : 1.5}
                                    strokeOpacity={isHighlighted ? 0.9 : 0.6}
                                    markerEnd={isHighlighted ? 'url(#arrow-active)' : 'url(#arrow)'}
                                />
                            );
                        })}

                        {/* nodes */}
                        {nodes.map(node => {
                            const pos = posById.get(node.id);
                            if (!pos) return null;
                            const isActive   = node.id === activePageId;
                            const isHomepage = node.isHomepage;

                            return (
                                <g
                                    key={node.id}
                                    transform={`translate(${pos.x},${pos.y})`}
                                    style={{ cursor: 'grab' }}
                                    onMouseDown={e => onNodeMouseDown(e, node.id)}
                                    onClick={() => !dragging && onSelectPage(node.id)}
                                >
                                    {/* outer glow for active */}
                                    {isActive && (
                                        <circle r={NODE_R + 5} fill="#6366f1" fillOpacity={0.15} />
                                    )}
                                    <circle
                                        r={NODE_R}
                                        fill={isActive ? '#6366f1' : isHomepage ? 'var(--bg-tertiary)' : 'var(--bg-primary)'}
                                        stroke={isActive ? '#6366f1' : isHomepage ? 'var(--accent-primary)' : 'var(--border-default)'}
                                        strokeWidth={isHomepage ? 2 : 1.5}
                                    />
                                    {/* homepage star icon */}
                                    {isHomepage && !isActive && (
                                        <text
                                            textAnchor="middle"
                                            dominantBaseline="central"
                                            y={-8}
                                            fontSize={12}
                                            fill="var(--accent-primary)"
                                        >⌂</text>
                                    )}
                                    {/* slug label */}
                                    <text
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        y={isHomepage && !isActive ? 6 : 0}
                                        fontSize={10}
                                        fontFamily="monospace"
                                        fill={isActive ? '#fff' : 'var(--text-secondary)'}
                                    >
                                        /{node.slug}
                                    </text>
                                    {/* title below */}
                                    <text
                                        textAnchor="middle"
                                        y={NODE_R + 14}
                                        fontSize={10}
                                        fill={isActive ? '#6366f1' : 'var(--text-muted)'}
                                    >
                                        {node.title.length > 14 ? node.title.slice(0, 13) + '…' : node.title}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            )}

            {/* legend */}
            <div className="px-4 py-2 border-t border-[var(--border-subtle)] shrink-0 flex items-center gap-6 text-[10px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                    <svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--accent-primary)" strokeWidth="2" /></svg>
                    Homepage
                </span>
                <span className="flex items-center gap-1.5">
                    <svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="#6366f1" /></svg>
                    Active page
                </span>
                <span className="flex items-center gap-1.5">
                    <svg width="28" height="10">
                        <line x1="0" y1="5" x2="20" y2="5" stroke="var(--border-default)" strokeWidth="1.5" markerEnd="url(#arrow)" />
                        <polygon points="20,2 28,5 20,8" fill="var(--border-default)" />
                    </svg>
                    Internal link
                </span>
                <span className="flex-1" />
                <span>Click a node to switch pages</span>
            </div>
        </div>
    );
}
