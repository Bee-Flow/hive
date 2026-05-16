import { RotateCw, ExternalLink } from 'lucide-react';
import React from 'react';
import { PREVIEW_SURFACES } from './previewSurfaces';

/**
 * Toolbar above the preview iframe — surface tabs on the left, refresh and
 * open-in-new-tab actions on the right. Restyled from the old surface tab
 * strip: pill segments, accent-coloured active state, no border seam.
 */
export default function LookPreviewToolbar({ activeId, onChange, onReload, surfaceUrl }) {
    return (
        <div
            className="flex items-center gap-2 px-3 py-2 border-b"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
        >
            <nav
                aria-label="Preview surface"
                className="flex items-center gap-1 overflow-x-auto"
            >
                {PREVIEW_SURFACES.map(({ id, label, icon: Icon }) => {
                    const active = activeId === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onChange(id)}
                            aria-pressed={active}
                            className="px-2.5 py-1 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                            style={{
                                background: active ? 'var(--bg-card-hover)' : 'transparent',
                                color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                border: active
                                    ? '1px solid var(--border-default)'
                                    : '1px solid transparent',
                            }}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    );
                })}
            </nav>

            <div className="ml-auto flex items-center gap-1">
                <button
                    type="button"
                    onClick={onReload}
                    aria-label="Refresh preview"
                    title="Refresh preview"
                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-tertiary)]"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    <RotateCw className="w-3.5 h-3.5" />
                </button>
                {surfaceUrl && (
                    <a
                        href={surfaceUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open preview in new tab"
                        title="Open preview in new tab"
                        className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                )}
            </div>
        </div>
    );
}
