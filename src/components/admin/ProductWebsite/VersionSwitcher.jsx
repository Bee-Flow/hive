import React, { useState } from 'react';
import AppIcon from '../../AppIcon';

/**
 * Version switcher — lists every version (site) that shares the active
 * site's versionGroupId. Sits directly under the SiteSwitcher in the
 * website-builder sidebar.
 *
 * Each row switches the editor to that version on click. The version
 * currently marked live shows a "Live" badge; the others expose a
 * "Set live" action (which takes the previously-live one offline). A
 * "Duplicate current version" button at the bottom deep-copies the
 * active version into a new sibling.
 *
 * All API calls are owned by ProductWebsitePanel — this component only
 * renders and dispatches handler props.
 */
export default function VersionSwitcher({
    versions,
    activeSiteId,
    liveSiteId,
    onSelect,
    onSetLive,
    onDuplicate,
}) {
    const [busy, setBusy] = useState(false);

    const handleDuplicate = async () => {
        if (busy) return;
        setBusy(true);
        try { await onDuplicate(); }
        finally { setBusy(false); }
    };

    return (
        <div className="mt-2">
            <div className="flex items-center gap-1 mb-1 px-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                <AppIcon name="Layers" className="w-3 h-3" />
                Versions
            </div>

            <ul className="rounded-md border border-[var(--border-default)] overflow-hidden divide-y divide-[var(--border-subtle)]">
                {versions.map(v => {
                    const isActive = v.id === activeSiteId;
                    const isLive = v.id === liveSiteId;
                    return (
                        <li key={v.id}>
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => { if (!isActive) onSelect(v.id); }}
                                onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && !isActive) {
                                        e.preventDefault();
                                        onSelect(v.id);
                                    }
                                }}
                                className={`group flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer
                                    ${isActive
                                        ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                    }`}
                                title={isActive ? 'Editing this version' : `Switch to ${v.versionName}`}
                            >
                                <AppIcon
                                    name={isActive ? 'Check' : 'GitBranch'}
                                    className={`w-3 h-3 shrink-0 ${isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}
                                />
                                <span className="font-medium shrink-0">{v.versionName || 'v1'}</span>
                                <span className="truncate flex-1 text-[var(--text-muted)]">{v.name}</span>
                                {isLive ? (
                                    <span
                                        className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-[9px] font-medium text-emerald-400"
                                        title="This version is live at the public URL"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        Live
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onSetLive(v.id); }}
                                        className="shrink-0 opacity-40 group-hover:opacity-100 focus:opacity-100 transition-opacity
                                            text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-[var(--border-default)]
                                            text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/60"
                                        title="Make this version the live one"
                                    >
                                        Set live
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            <button
                type="button"
                onClick={handleDuplicate}
                disabled={busy || !activeSiteId}
                className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1 text-[11px] rounded-md
                    border border-dashed border-[var(--border-default)] text-[var(--text-secondary)]
                    hover:border-[var(--accent-primary)]/60 hover:text-[var(--accent-primary)]
                    disabled:opacity-40 disabled:cursor-not-allowed"
                title="Create a new version by duplicating the version you're editing"
            >
                <AppIcon name="Copy" className="w-3 h-3" />
                {busy ? 'Duplicating…' : 'Duplicate current version'}
            </button>
        </div>
    );
}
