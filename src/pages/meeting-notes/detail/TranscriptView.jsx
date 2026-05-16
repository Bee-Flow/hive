import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { SPEAKER_COLORS } from '../../../config/meetingNotesConfig';
import SpeakerLegend from './SpeakerLegend';
import { formatDuration, formatSpeakerLabel, getSpeakerColor } from '../lib/format';

export default function TranscriptView({ segments = [], speakers = [], fullText = '', onSeek }) {
    const [query, setQuery] = useState('');
    const [speakerFilter, setSpeakerFilter] = useState(null);

    const filtered = useMemo(() => {
        let arr = segments;
        if (speakerFilter) arr = arr.filter((s) => (s.speaker || s.speakerId) === speakerFilter);
        if (query) {
            const q = query.toLowerCase();
            arr = arr.filter((s) => (s.text || '').toLowerCase().includes(q));
        }
        return arr;
    }, [segments, speakerFilter, query]);

    if (segments.length === 0) {
        return (
            <div className="rounded-xl border px-4 py-6 text-sm whitespace-pre-wrap" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                {fullText || 'No transcript available.'}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search transcript…"
                        className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border outline-none"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                </div>
                <SpeakerLegend speakers={speakers} activeId={speakerFilter} onSelect={setSpeakerFilter} />
            </div>
            <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <ul className="divide-y max-h-[600px] overflow-auto" style={{ borderColor: 'var(--border-subtle)' }}>
                    {filtered.length === 0 && (
                        <li className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                            No matching segments.
                        </li>
                    )}
                    {filtered.map((seg, idx) => {
                        const speakerId = seg.speaker || seg.speakerId || 'unknown';
                        const color = getSpeakerColor(speakerId, SPEAKER_COLORS);
                        return (
                            <li key={idx} className="grid grid-cols-[110px_1fr] gap-3 px-4 py-2.5">
                                <div className="flex flex-col text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                    <button
                                        type="button"
                                        onClick={() => onSeek?.(seg.start || 0)}
                                        className="font-mono hover:text-[var(--accent-primary)] text-left transition-colors"
                                    >
                                        {formatDuration(seg.start || 0)}
                                    </button>
                                    <span className="inline-flex items-center gap-1 mt-0.5">
                                        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                                        <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{formatSpeakerLabel(speakerId)}</span>
                                    </span>
                                </div>
                                <div className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                                    {highlight(seg.text || '', query)}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}

function highlight(text, query) {
    if (!query) return text;
    try {
        const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'ig'));
        return parts.map((p, i) => (
            p.toLowerCase() === query.toLowerCase()
                ? <mark key={i} style={{ background: 'rgba(255, 212, 0, 0.35)', color: 'inherit', borderRadius: 2, padding: '0 2px' }}>{p}</mark>
                : <React.Fragment key={i}>{p}</React.Fragment>
        ));
    } catch (_) { return text; }
}
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
