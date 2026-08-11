import React, { useRef } from 'react';
import AppIcon from '../../../AppIcon';
import Dropdown from './Dropdown';
import SiteSwitcher from '../SiteSwitcher';
import VersionSwitcher from '../VersionSwitcher';

/**
 * TopBar site + version menu — one trigger for everything site-level:
 * switch/create/rename/delete sites, switch/duplicate/set-live versions,
 * export/import a site. Composes the existing SiteSwitcher (embedded mode)
 * and VersionSwitcher so all handler contracts stay identical to the old
 * Pane A wiring.
 */
export default function SiteVersionMenu({
    sites,
    versions,
    activeSiteId,
    liveSiteId,
    onSelectSite,
    onCreateSite,
    onRenameSite,
    onDeleteSite,      // (site) — parent confirms
    onSetLiveVersion,
    onDuplicateVersion,
    onExportSite,
    onImportFile,      // (File)
    ioStatus,          // { kind: 'success'|'error'|'busy', text } | null
}) {
    const importInputRef = useRef(null);
    const activeSite = sites.find(s => s.id === activeSiteId);
    const versionName = activeSite?.versionName || 'v1';
    const isLive = activeSiteId && activeSiteId === liveSiteId;

    return (
        <Dropdown
            width={300}
            trigger={({ open }) => (
                <button
                    type="button"
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-transparent hover:border-[var(--border-subtle)] max-w-[280px]"
                    title="Site, versions, export & import"
                >
                    <AppIcon name="Globe" className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                    <span className="truncate font-medium">{activeSite?.name || 'Select a site'}</span>
                    <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                        {versionName}
                    </span>
                    {isLive && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="This site is live" />
                    )}
                    <AppIcon name={open ? 'ChevronUp' : 'ChevronDown'} className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
                </button>
            )}
        >
            {() => (
                <div className="overflow-hidden rounded-lg">
                    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Sites</div>
                    <SiteSwitcher
                        embedded
                        sites={sites}
                        activeSiteId={activeSiteId}
                        liveSiteId={liveSiteId}
                        onSelect={onSelectSite}
                        onCreate={onCreateSite}
                        onRename={onRenameSite}
                        onDelete={onDeleteSite}
                    />
                    <div className="border-t border-[var(--border-subtle)] px-3 py-2">
                        <VersionSwitcher
                            versions={versions}
                            activeSiteId={activeSiteId}
                            liveSiteId={liveSiteId}
                            onSelect={onSelectSite}
                            onSetLive={onSetLiveVersion}
                            onDuplicate={onDuplicateVersion}
                        />
                    </div>
                    {/* Site export / import — same hidden-input flow as before.
                        The primary Export is the .zip: it carries every page,
                        every language AND every uploaded image, so it restores
                        a complete site on any install. The JSON escape hatch
                        below is the bundle on its own — smaller and diffable,
                        but its media only resolves where the storage bucket is
                        shared. */}
                    <div className="border-t border-[var(--border-subtle)] px-3 py-2">
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => onExportSite('zip')}
                                disabled={!activeSiteId || ioStatus?.kind === 'busy'}
                                className="flex-1 px-2 py-1 text-[11px] rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/60 hover:text-[var(--accent-primary)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                title="Download the complete website — all pages, all languages and all images — as a .zip"
                            >
                                <AppIcon name="Download" className="w-3 h-3" />
                                Export site
                            </button>
                            <button
                                type="button"
                                onClick={() => importInputRef.current?.click()}
                                disabled={ioStatus?.kind === 'busy'}
                                className="flex-1 px-2 py-1 text-[11px] rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/60 hover:text-[var(--accent-primary)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                title="Restore a site from a previously-exported .zip or .json file"
                            >
                                <AppIcon name="Upload" className="w-3 h-3" />
                                Import site
                            </button>
                            {/* Hidden input — value reset so the same file can be re-picked. */}
                            <input
                                ref={importInputRef}
                                type="file"
                                accept=".zip,application/zip,application/json,.json"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    if (file) onImportFile(file);
                                }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => onExportSite('json')}
                            disabled={!activeSiteId || ioStatus?.kind === 'busy'}
                            className="mt-1 w-full px-2 py-1 text-[10px] rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            title="Content only — images stay referenced by key, so they resolve only on an install sharing this storage"
                        >
                            <AppIcon name="FileJson" className="w-3 h-3" />
                            Export as JSON (no images)
                        </button>
                        {ioStatus ? (
                            <p
                                className={`mt-1.5 text-[10px] leading-tight ${
                                    ioStatus.kind === 'error'
                                        ? 'text-red-400'
                                        : ioStatus.kind === 'success'
                                            ? 'text-emerald-500'
                                            : 'text-[var(--text-muted)]'
                                }`}
                            >
                                {ioStatus.kind === 'busy' ? '… ' : ''}{ioStatus.text}
                            </p>
                        ) : null}
                    </div>
                </div>
            )}
        </Dropdown>
    );
}
