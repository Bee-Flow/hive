import React from 'react';
import { Clock, Users, ListChecks, Share2, AlertTriangle, Loader2 } from 'lucide-react';
import WaveformThumbnail from './WaveformThumbnail';
import { formatDuration, formatRelativeDate } from '../lib/format';
import { getSourceMeta } from '../lib/sourceMeta';

export default function MeetingCard({ meeting, active, onClick }) {
    const status = meeting.status || 'completed';
    const sourceMeta = getSourceMeta(meeting.source);
    const actionItems = Array.isArray(meeting.actionItems) ? meeting.actionItems.length : 0;
    const groupCount = Array.isArray(meeting.sharedGroups) ? meeting.sharedGroups.length : 0;
    const publishLabel = meeting.isPublished
        ? (groupCount > 0 ? `${groupCount}` : 'org')
        : null;
    const publishTitle = meeting.isPublished
        ? (groupCount > 0 ? `Shared with ${groupCount} group${groupCount > 1 ? 's' : ''}` : 'Shared with your organization')
        : '';

    return (
        <button
            type="button"
            onClick={onClick}
            className="text-left rounded-2xl border overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 group"
            style={{
                background: 'var(--bg-secondary)',
                borderColor: active ? 'var(--accent-primary)' : 'var(--border-default)',
                color: 'var(--text-primary)',
                '--tw-ring-color': 'var(--accent-primary)',
            }}
        >
            <div className="px-4 pt-4 pb-2">
                <WaveformThumbnail id={meeting.id} bars={40} height={48} color={active ? 'var(--accent-primary)' : 'var(--text-muted)'} />
            </div>
            <div className="px-4 pb-4 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                        {meeting.title || 'Untitled meeting'}
                    </h3>
                    {status === 'failed' && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#ef4444' }} />}
                    {status === 'processing' && <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" style={{ color: 'var(--text-muted)' }} />}
                </div>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span>{formatRelativeDate(meeting.createdAt)}</span>
                    {sourceMeta && (
                        <span
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
                            title={sourceMeta.title}
                            style={{
                                color: sourceMeta.color,
                                borderColor: `color-mix(in srgb, ${sourceMeta.color} 35%, transparent)`,
                                background: `color-mix(in srgb, ${sourceMeta.color} 12%, transparent)`,
                            }}
                        >
                            <sourceMeta.Icon className="w-3 h-3" />
                            {sourceMeta.label}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(meeting.durationSeconds)}</span>
                    {meeting.speakerCount > 0 && (
                        <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{meeting.speakerCount}</span>
                    )}
                    {actionItems > 0 && (
                        <span className="inline-flex items-center gap-1"><ListChecks className="w-3 h-3" />{actionItems}</span>
                    )}
                    {publishLabel && (
                        <span className="inline-flex items-center gap-1 font-medium" title={publishTitle} style={{ color: 'var(--accent-primary)' }}>
                            <Share2 className="w-3 h-3" />{publishLabel}
                        </span>
                    )}
                </div>
                {Array.isArray(meeting.tags) && meeting.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                        {meeting.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </button>
    );
}
