import React, { useState, useEffect, useMemo } from 'react';

/**
 * mcpLogos.jsx — official logo resolution for MCP marketplace cards.
 *
 * Fully open-source and keyless — NO third-party logo SaaS (no Smithery,
 * no logo.dev/Brandfetch). Logos come from sources we don't depend on a
 * vendor for:
 *
 *   1. explicit catalog `logo` URL            (e.g. a bundled/self-hosted asset)
 *   2. a URL carried in `iconUrl`             (generic; future-proofing)
 *   3. `icon` when it already holds a URL     (persisted resolved logo)
 *   4. GitHub owner avatar from `repository`  (github.com/<org>.png — the
 *                                              org's own official logo, free)
 *   5. emoji `icon`                           (legacy/default)
 *   6. brand-coloured letter mark             (never fails)
 *
 * `<McpLogo server={...} />` walks the candidate list, stepping to the next
 * one whenever an <img> fails to load, so a dead URL silently degrades to
 * emoji/letter instead of leaving a blank card. Mirrors the fallback idea in
 * integrationLogos.jsx but is URL-image-first (MCP logos are remote, not
 * bundled SVGs).
 */

const isUrl = (s) => typeof s === 'string' && /^https?:\/\//i.test(s.trim());

// Non-purple palette (project rule: never use violet/indigo).
const LETTER_PALETTE = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#14b8a6', '#f97316', '#ec4899', '#06b6d4', '#64748b', '#eab308'];

function letterColor(key) {
    const s = String(key || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return LETTER_PALETTE[h % LETTER_PALETTE.length];
}

/**
 * Derive the GitHub owner avatar from a repo URL. The owner avatar is the
 * org's official logo for the large majority of MCP servers (they live in a
 * brand-owned GitHub org: stripe/, supabase/, getsentry/, …).
 */
export function githubAvatarFromRepo(repo) {
    const m = /github\.com\/([^/#?]+)/i.exec(String(repo || ''));
    if (!m) return null;
    const owner = m[1].trim();
    if (!owner || owner === 'sponsors' || owner === 'orgs') return null;
    return `https://github.com/${owner}.png?size=80`;
}

/**
 * Ordered list of logo candidates for a server, best first. URL candidates
 * come before the emoji/letter terminals so stepping forward always moves
 * toward a safe fallback.
 */
export function mcpLogoCandidates(server = {}) {
    const out = [];
    if (isUrl(server.logo)) out.push({ kind: 'url', src: server.logo });
    if (isUrl(server.iconUrl)) out.push({ kind: 'url', src: server.iconUrl });
    if (isUrl(server.icon)) out.push({ kind: 'url', src: server.icon });
    const gh = githubAvatarFromRepo(server.repository);
    if (gh) out.push({ kind: 'url', src: gh });
    if (server.icon && !isUrl(server.icon)) out.push({ kind: 'emoji', value: server.icon });
    const char = (String(server.name || '').trim().charAt(0) || '?').toUpperCase();
    out.push({ kind: 'letter', char, color: letterColor(server.id || server.name) });
    return out;
}

/** First resolvable logo URL for a server, or null — used to persist a logo at install. */
export function bestLogoUrl(server) {
    const c = mcpLogoCandidates(server).find(x => x.kind === 'url');
    return c ? c.src : null;
}

export function McpLogo({ server, size = 32, className = '' }) {
    const candidates = useMemo(() => mcpLogoCandidates(server), [server]);
    const [idx, setIdx] = useState(0);

    // Reset to the best candidate whenever the underlying server changes.
    useEffect(() => { setIdx(0); }, [server?.id, server?.name, server?.icon, server?.logo, server?.iconUrl, server?.repository]);

    const cand = candidates[Math.min(idx, candidates.length - 1)] || { kind: 'letter', char: '?', color: '#64748b' };

    if (cand.kind === 'url') {
        return (
            <img
                src={cand.src}
                width={size}
                height={size}
                loading="lazy"
                alt=""
                className={className}
                onError={() => setIdx(i => i + 1)}
                style={{ borderRadius: 6, objectFit: 'contain', background: 'var(--bg-tertiary)', flexShrink: 0, display: 'block' }}
            />
        );
    }

    if (cand.kind === 'emoji') {
        return <span className={className} style={{ fontSize: Math.round(size * 0.72), lineHeight: 1, flexShrink: 0 }}>{cand.value}</span>;
    }

    return (
        <span
            className={className}
            style={{
                width: size, height: size, borderRadius: 6, background: cand.color, color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: Math.round(size * 0.5), fontWeight: 700, flexShrink: 0,
            }}
        >
            {cand.char}
        </span>
    );
}

export default McpLogo;
