// Shared KB ingest UI — the "add content" block (mode tab switcher + per-mode
// inputs + File / Drive / Ingest action row) that was duplicated verbatim
// between KnowledgePanel and KnowledgeBasesSection. Both fed it from their own
// copy-pasted ingest handlers; those now live in useKnowledgeBases, and this
// panel is the shared view over that hook.
//
// Usage:
//   const kb = useKnowledgeBases({ enableDrive: true, enableAzureInfo: true });
//   <KBIngestPanel kb={kb} fieldBg="var(--bg-tertiary)" />
//
// The one intentional visual difference between the two original copies was the
// input/tab background (which flips depending on whether the surrounding card is
// bg-secondary or bg-tertiary); pass it via `fieldBg`. Optional features can be
// hidden per consumer via `tabs` / `showFile` / `showDrive` / `showSitemap`.

import React from 'react';

const DEFAULT_TABS = [
    { id: 'text', label: '📝 Text' },
    { id: 'url', label: '🌐 URL' },
    { id: 'n8n', label: '⚙️ n8n' },
];

const Spinner = () => (
    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="44" strokeDashoffset="8" />
    </svg>
);

export default function KBIngestPanel({
    kb,
    fieldBg = 'var(--bg-tertiary)',
    tabs = DEFAULT_TABS,
    showFile = true,
    showDrive = true,
    showSitemap = true,
}) {
    const {
        kbInputMode, setKbInputMode,
        kbTextContent, setKbTextContent, kbTextTitle, setKbTextTitle,
        kbUrlInput, setKbUrlInput,
        kbIngesting, kbIngestStatus,
        sitemapMode, setSitemapMode, sitemapMaxPages, setSitemapMaxPages,
        n8nWorkflows, n8nIngestMode, setN8nIngestMode,
        driveConnected, setDrivePickerOpen,
        ingestText, ingestUrl, ingestSitemap, ingestN8n, ingestFile,
    } = kb;

    const fieldStyle = { background: fieldBg, borderColor: 'var(--border-default)', color: 'var(--text-primary)' };
    const submit = kbInputMode === 'url' ? (sitemapMode ? ingestSitemap : ingestUrl) : ingestText;

    return (
        <div className="space-y-3">
            {/* Mode tabs */}
            <div className="flex gap-1 p-0.5 rounded-lg border border-[var(--border-subtle)] w-fit" style={{ background: fieldBg }}>
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setKbInputMode(tab.id)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${kbInputMode === tab.id
                            ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {kbInputMode === 'text' && (
                <div className="space-y-2">
                    <input value={kbTextTitle} onChange={e => setKbTextTitle(e.target.value)}
                        placeholder="Title (optional)" className="w-full px-3 py-2 rounded-lg border text-xs"
                        style={fieldStyle} />
                    <textarea value={kbTextContent} onChange={e => setKbTextContent(e.target.value)}
                        placeholder="Paste text content here..." rows={3}
                        className="w-full px-3 py-2 rounded-lg border text-xs"
                        style={fieldStyle} />
                </div>
            )}

            {kbInputMode === 'url' && (
                <div className="space-y-2">
                    <input type="url" value={kbUrlInput} onChange={e => setKbUrlInput(e.target.value)}
                        placeholder={sitemapMode ? 'https://example.com' : 'https://example.com/page'}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={fieldStyle}
                        onKeyDown={e => { if (e.key === 'Enter' && !kbIngesting) { submit(); } }} />
                    {showSitemap && (
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={sitemapMode} onChange={e => setSitemapMode(e.target.checked)}
                                    className="rounded border-gray-500" />
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>🗺️ Import from sitemap</span>
                            </label>
                            {sitemapMode && (
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Max pages:</span>
                                    <input type="number" value={sitemapMaxPages}
                                        onChange={e => setSitemapMaxPages(Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
                                        className="w-14 px-1.5 py-0.5 rounded border text-xs text-center"
                                        style={fieldStyle}
                                        min={1} max={200} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {kbInputMode === 'n8n' && (
                <div className="space-y-3">
                    <div className="flex p-1 rounded-lg border" style={{ background: fieldBg, borderColor: 'var(--border-subtle)' }}>
                        <button onClick={() => setN8nIngestMode('data')}
                            className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-md transition-all ${n8nIngestMode === 'data' ? 'bg-[var(--bg-primary)] shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                            style={{ color: n8nIngestMode === 'data' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            Execute & Ingest Output Data
                        </button>
                        <button onClick={() => setN8nIngestMode('definition')}
                            className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-md transition-all ${n8nIngestMode === 'definition' ? 'bg-[var(--bg-primary)] shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                            style={{ color: n8nIngestMode === 'definition' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            Import Workflow Definition
                        </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {n8nWorkflows.length === 0 ? (
                            <div className="text-xs p-3 text-center rounded border border-dashed" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                                No n8n workflows enabled for KB ingestion. Enable them in your Organisation settings.
                            </div>
                        ) : (
                            n8nWorkflows.map(wf => (
                                <div key={wf.id} className="flex items-center justify-between p-2 rounded border" style={{ borderColor: 'var(--border-subtle)', background: fieldBg }}>
                                    <div className="min-w-0 pr-2">
                                        <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{wf.name}</div>
                                        <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>n8n_run_{wf.slug}</div>
                                    </div>
                                    <button disabled={kbIngesting} onClick={() => ingestN8n(wf.id)}
                                        className="px-2 py-1 text-[10px] font-medium rounded text-white disabled:opacity-50 transition-opacity hover:opacity-80 flex-shrink-0"
                                        style={{ background: 'var(--accent-primary)' }}>
                                        {n8nIngestMode === 'data' ? 'Execute' : 'Ingest'}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Action row */}
            <div className="flex gap-2 justify-end items-center">
                {kbIngestStatus && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                        {kbIngesting && <Spinner />}
                        {kbIngestStatus}
                    </span>
                )}
                {kbInputMode !== 'n8n' && (
                    <>
                        {showFile && (
                            <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 hover:bg-[var(--bg-tertiary)] transition-colors"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                <input type="file" accept=".pdf,.txt,.md,.docx,.csv" className="hidden" onChange={ingestFile} disabled={kbIngesting} />
                                📎 File
                            </label>
                        )}
                        {showDrive && driveConnected && (
                            <button onClick={() => setDrivePickerOpen(true)} disabled={kbIngesting}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                <svg className="w-3.5 h-3.5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
                                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" />
                                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.8z" fill="#ea4335" />
                                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
                                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
                                    <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
                                </svg>
                                Drive
                            </button>
                        )}
                        <button onClick={submit}
                            disabled={kbIngesting || (kbInputMode === 'text' ? !kbTextContent.trim() : !kbUrlInput.trim())}
                            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-all hover:opacity-90"
                            style={{ background: 'var(--accent-primary)' }}>
                            {kbIngesting ? 'Processing...' : 'Ingest'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
