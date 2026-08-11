import React, { useEffect, useMemo, useState } from 'react';
import ModalShell from './ModalShell';
import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * AssetPickerDialog — browse previously uploaded CMS assets and pick one.
 *
 * Backed by the read-only `GET /api/cms/admin/assets` route (org-wide
 * `cms/` bucket prefix, same admin gate as /admin/upload). That route
 * degrades to `{ assets: [], unavailable: true }` in local-fs mode or a
 * storage outage — we surface that as an explanatory empty state rather
 * than an error, and ImageField hides its "Browse" entry point entirely
 * once it has seen `unavailable` (see useAssetLibraryAvailable).
 *
 * onPick receives the asset's URL (`/api/cms/asset/cms/…`), matching what
 * the upload handler returns, so both paths store the same shape.
 */
export default function AssetPickerDialog({ onPick, onClose, accept = 'image' }) {
    const [state, setState] = useState({ loading: true, error: null, assets: [], unavailable: false });
    const [query, setQuery] = useState('');

    useEffect(() => {
        let cancelled = false;
        authFetch(`${API_BASE}/api/cms/admin/assets`)
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
            .then(data => {
                if (cancelled) return;
                setState({
                    loading: false,
                    error: null,
                    assets: Array.isArray(data?.assets) ? data.assets : [],
                    unavailable: data?.unavailable === true,
                });
            })
            .catch(err => {
                if (cancelled) return;
                setState({ loading: false, error: err.message || 'Failed to load', assets: [], unavailable: false });
            });
        return () => { cancelled = true; };
    }, []);

    // Filename search — keys are `cms/<timestamp>-<original name>.<ext>`,
    // so matching the whole key lets users find by name or by date.
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        const byKind = state.assets.filter(a =>
            accept === 'video'
                ? /\.(mp4|webm)$/i.test(a.key)
                : !/\.(mp4|webm)$/i.test(a.key));
        if (!q) return byKind;
        return byKind.filter(a => a.key.toLowerCase().includes(q));
    }, [state.assets, query, accept]);

    return (
        <ModalShell onClose={onClose} labelledBy="cms-asset-picker-title" width="lg">
            <div className="flex flex-col" style={{ height: 'min(72vh, 620px)' }}>
                <div className="px-4 pt-4 pb-3 border-b border-[var(--border-default)]">
                    <h2 id="cms-asset-picker-title" className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Media library
                    </h2>
                    <input
                        type="text"
                        autoFocus
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search by file name…"
                        className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {state.loading ? (
                        <div className="text-xs text-[var(--text-muted)]">Loading…</div>
                    ) : state.error ? (
                        <div className="text-xs text-red-400">Could not load the library: {state.error}</div>
                    ) : state.unavailable ? (
                        <div className="text-xs text-[var(--text-muted)] max-w-md">
                            The media library needs object storage (RustFS/S3). This install is using
                            local-disk storage, so previously uploaded files can&apos;t be listed —
                            upload a file or paste its URL instead.
                        </div>
                    ) : visible.length === 0 ? (
                        <div className="text-xs text-[var(--text-muted)]">
                            {state.assets.length === 0
                                ? 'No uploads yet. Files you upload from any image field appear here.'
                                : 'No files match that search.'}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {visible.map(asset => (
                                <button
                                    key={asset.key}
                                    type="button"
                                    onClick={() => { onPick(asset.url); onClose?.(); }}
                                    title={asset.key}
                                    className="group text-left rounded-md border border-[var(--border-default)] overflow-hidden hover:border-[var(--accent-primary)] transition-colors"
                                >
                                    <div className="aspect-[4/3] bg-[var(--bg-tertiary)] flex items-center justify-center overflow-hidden">
                                        {/\.(mp4|webm)$/i.test(asset.key) ? (
                                            <video src={asset.url} muted playsInline className="w-full h-full object-contain" />
                                        ) : (
                                            <img src={asset.url} alt="" loading="lazy" className="w-full h-full object-contain" />
                                        )}
                                    </div>
                                    <div className="px-2 py-1.5 text-[11px] text-[var(--text-secondary)] truncate">
                                        {asset.key.replace(/^cms\/\d+-/, '')}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-4 py-3 border-t border-[var(--border-default)] flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}
