import React from 'react';

/**
 * The shared empty-state artwork.
 *
 * Six scenes, because six is how many distinct "there is nothing here" moments
 * the product actually has — an inbox with no mail is not the same feeling as a
 * search with no hits, and a disconnected integration is not an empty one.
 * Before this, every one of them was the same grey sentence.
 *
 * Drawn rather than imported: an SVG asset cannot follow the theme. These use
 * `currentColor` for the line work (so the caller's text colour drives it) and
 * `var(--app-primary, var(--accent-primary))` for the one accent, which makes
 * them correct in light, dark and high-contrast without a second copy — and
 * inside a Studio app they pick up that app's own brand colour.
 *
 * Deliberately flat and thin: artwork in an empty state is a signpost, not a
 * picture. Anything more detailed starts competing with the sentence under it.
 */

export type IllustrationName =
    | 'empty-inbox'
    | 'no-results'
    | 'no-files'
    | 'all-done'
    | 'not-connected'
    | 'broken';

interface ArtProps {
    className?: string;
}

const BASE = 'block';
const ACCENT = 'var(--app-primary, var(--accent-primary, #B45309))';

function Frame({ className = '', children }: ArtProps & { children: React.ReactNode }) {
    return (
        <svg
            viewBox="0 0 96 72"
            role="presentation"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${BASE} ${className}`}
            style={{ width: '5.5rem', height: 'auto', opacity: 0.9 }}
        >
            {children}
        </svg>
    );
}

/** A tray with the lid open and nothing in it. */
export function EmptyInbox(props: ArtProps) {
    return (
        <Frame {...props}>
            <path d="M20 34h14l4 8h20l4-8h14v20a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" opacity={0.55} />
            <path d="M28 34 34 18h28l6 16" opacity={0.35} />
            <path d="M44 26h8" stroke={ACCENT} />
        </Frame>
    );
}

/** A magnifier over an empty field. */
export function NoResults(props: ArtProps) {
    return (
        <Frame {...props}>
            <circle cx={44} cy={32} r={14} opacity={0.55} />
            <path d="m55 43 9 9" opacity={0.55} />
            <path d="M38 32h12" stroke={ACCENT} />
            <path d="M26 58h44" opacity={0.25} />
        </Frame>
    );
}

/** A folder standing open. */
export function NoFiles(props: ArtProps) {
    return (
        <Frame {...props}>
            <path d="M22 24h16l5 6h31v26a3 3 0 0 1-3 3H25a3 3 0 0 1-3-3z" opacity={0.55} />
            <path d="M22 40h52" opacity={0.25} />
            <path d="M44 48h8" stroke={ACCENT} />
        </Frame>
    );
}

/** A checked circle — the good empty. */
export function AllDone(props: ArtProps) {
    return (
        <Frame {...props}>
            <circle cx={48} cy={36} r={18} opacity={0.4} />
            <path d="m40 36 6 6 12-13" stroke={ACCENT} strokeWidth={2} />
        </Frame>
    );
}

/** Two plug halves that do not meet. */
export function NotConnected(props: ArtProps) {
    return (
        <Frame {...props}>
            <path d="M26 36h12v-6a4 4 0 0 1 4-4h2v20h-2a4 4 0 0 1-4-4v-6" opacity={0.55} />
            <path d="M70 36H58v-6a4 4 0 0 0-4-4h-2v20h2a4 4 0 0 0 4-4v-6" opacity={0.55} />
            <path d="M46 36h4" stroke={ACCENT} strokeDasharray="2 4" />
            <path d="M20 36h4M72 36h4" opacity={0.3} />
        </Frame>
    );
}

/** A page with a break through it. */
export function Broken(props: ArtProps) {
    return (
        <Frame {...props}>
            <path d="M32 16h20l12 12v28a3 3 0 0 1-3 3H32a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3z" opacity={0.5} />
            <path d="M52 16v12h12" opacity={0.4} />
            <path d="m44 34-5 10h9l-4 10" stroke={ACCENT} strokeWidth={2} />
        </Frame>
    );
}

export const ILLUSTRATIONS: Record<IllustrationName, (p: ArtProps) => React.ReactElement> = {
    'empty-inbox': EmptyInbox,
    'no-results': NoResults,
    'no-files': NoFiles,
    'all-done': AllDone,
    'not-connected': NotConnected,
    broken: Broken,
};

/** Render one by name; an unknown name renders nothing rather than throwing. */
export default function Illustration({ name, className }: ArtProps & { name: IllustrationName }) {
    const Art = ILLUSTRATIONS[name];
    return Art ? <Art className={className} /> : null;
}
