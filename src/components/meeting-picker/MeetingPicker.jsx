import React, { useEffect, useMemo, useState } from 'react';
import { Search, Check, Clock, Users, FileAudio, Loader2 } from 'lucide-react';
import * as api from '../../pages/meeting-notes/lib/transcriptionsApi';
import { formatDuration, formatRelativeDate } from '../../pages/meeting-notes/lib/format';

/**
 * Shared meeting picker used by NotebookSources (single-add) and TemplatesPage
 * (multi-select context). One implementation, two modes — keeps the UX
 * consistent across the app.
 *
 * Props:
 *   - mode: 'single' | 'multi'
 *   - value (multi): array of meeting IDs currently selected
 *   - onChange (multi): receives new array of IDs
 *   - onSelect (single): receives a single meeting object on row click
 *   - autoLoad: defaults to true; set false to render the inline form factor
 *   - emptyAction: optional CTA shown when no meetings exist
 */
export default function MeetingPicker({
    mode = 'multi',
    value = [],
    onChange,
    onSelect,
    autoLoad = true,
    placeholder = 'Search meeting notes…',
    emptyAction,
}) {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(autoLoad);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');
    const [hoveredId, setHoveredId] = useState(null);
    const [previews, setPreviews] = useState({}); // id -> { summary, title }

    useEffect(() => {
        if (!autoLoad) return;
        setLoading(true);
        api.listTranscriptions()
            .then(setMeetings)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [autoLoad]);

    useEffect(() => {
        if (!hoveredId || previews[hoveredId]) return;
        let cancelled = false;
        api.getTranscription(hoveredId)
            .then((d) => { if (!cancelled) setPreviews((p) => ({ ...p, [hoveredId]: { summary: d.summary || '', title: d.title } })); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [hoveredId, previews]);

    const filtered = useMemo(() => {
        if (!query) return meetings;
        const q = query.toLowerCase();
        return meetings.filter((m) => (m.title || '').toLowerCase().includes(q) || (m.tags || []).some((t) => String(t).toLowerCase().includes(q)));
    }, [meetings, query]);

    const toggle = (m) => {
        if (mode === 'single') { onSelect?.(m); return; }
        if (!onChange) return;
        const set = new Set(value);
        if (set.has(m.id)) set.delete(m.id);
        else set.add(m.id);
        onChange(Array.from(set));
    };

    return (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="relative px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                    className="w-full pl-7 pr-3 py-1.5 bg-transparent outline-none text-sm"
                    style={{ color: 'var(--text-primary)' }}
                />
            </div>
            <div className="max-h-72 overflow-auto">
                {loading && (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
                    </div>
                )}
                {error && (
                    <div className="px-4 py-6 text-xs text-rose-500">{error}</div>
                )}
                {!loading && !error && filtered.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                        {meetings.length === 0 ? 'No meeting notes yet.' : 'No meetings match your search.'}
                        {emptyAction && (
                            <div className="mt-3">{emptyAction}</div>
                        )}
                    </div>
                )}
                {filtered.map((m) => {
                    const selected = value.includes(m.id);
                    const preview = previews[m.id];
                    return (
                        <div
                            key={m.id}
                            className="relative"
                            onMouseEnter={() => setHoveredId(m.id)}
                            onMouseLeave={() => setHoveredId(null)}
                        >
                            <button
                                type="button"
                                onClick={() => toggle(m)}
                                className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
                            >
                                {mode === 'multi' && (
                                    <span
                                        className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                                        style={{
                                            background: selected ? 'var(--accent-primary)' : 'transparent',
                                            borderColor: selected ? 'var(--accent-primary)' : 'var(--border-default)',
                                        }}
                                    >
                                        {selected && <Check className="w-3 h-3 text-white" />}
                                    </span>
                                )}
                                {mode === 'single' && <FileAudio className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{m.title || 'Untitled meeting'}</div>
                                    <div className="flex items-center gap-3 text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                        <span>{formatRelativeDate(m.createdAt)}</span>
                                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(m.durationSeconds)}</span>
                                        {m.speakerCount > 0 && (
                                            <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{m.speakerCount}</span>
                                        )}
                                    </div>
                                </div>
                            </button>
                            {hoveredId === m.id && preview && preview.summary && (
                                <div
                                    className="absolute left-full top-0 ml-2 z-20 w-72 p-3 rounded-xl border shadow-lg text-[11px] leading-relaxed pointer-events-none hidden xl:block"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                >
                                    <div className="font-semibold text-[12px] mb-1" style={{ color: 'var(--text-primary)' }}>{preview.title}</div>
                                    <div className="line-clamp-6">{stripMd(preview.summary).slice(0, 220)}{preview.summary.length > 220 ? '…' : ''}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function stripMd(s) {
    return String(s || '').replace(/[#*_`>~\-]/g, '').replace(/\s+/g, ' ').trim();
}
