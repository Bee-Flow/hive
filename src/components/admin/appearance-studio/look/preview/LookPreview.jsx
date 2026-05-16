import React, { useMemo, useState } from 'react';
import LookPreviewIframe from './LookPreviewIframe';
import LookPreviewToolbar from './LookPreviewToolbar';
import { PREVIEW_SURFACES } from './previewSurfaces';

/**
 * Right-rail preview chrome. Wraps the iframe in a soft rounded card so the
 * preview reads as "your app inside a frame" rather than "broken layout".
 *
 *   draftPayload — theme payload sent to the iframe (form + saved wallpaper)
 */
export default function LookPreview({ draftPayload }) {
    const [activeId, setActiveId] = useState(PREVIEW_SURFACES[0].id);
    const [reloadCount, setReloadCount] = useState(0);
    const surface = useMemo(
        () => PREVIEW_SURFACES.find((s) => s.id === activeId) || PREVIEW_SURFACES[0],
        [activeId],
    );

    const liveUrl = `${surface.path}${surface.extraQuery ? `?${surface.extraQuery.slice(1)}` : ''}`;

    return (
        <aside
            className="h-full flex flex-col p-4 gap-3"
            style={{ background: 'var(--bg-primary)' }}
            aria-label="Live theme preview"
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Live preview
                    </h3>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Real app, signed in as you. Clicks hit the backend.
                    </p>
                </div>
                <span
                    className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wider px-2 py-1 rounded-full"
                    style={{
                        background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                        color: 'var(--accent-primary)',
                    }}
                >
                    <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: 'var(--accent-primary)' }}
                    />
                    Live
                </span>
            </div>

            <div
                className="flex-1 min-h-0 rounded-xl border overflow-hidden flex flex-col"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
                data-surface="opaque"
            >
                <LookPreviewToolbar
                    activeId={activeId}
                    onChange={setActiveId}
                    onReload={() => setReloadCount((n) => n + 1)}
                    surfaceUrl={liveUrl}
                />
                <div className="flex-1 min-h-0">
                    <LookPreviewIframe
                        key={`${surface.id}:${reloadCount}`}
                        surface={surface}
                        draftPayload={draftPayload}
                    />
                </div>
            </div>
        </aside>
    );
}
