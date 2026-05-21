import React from 'react';
import { Clock, Users, ListChecks, Share2, AlertTriangle, Loader2 } from 'lucide-react';
import { formatDuration, formatRelativeDate } from '../lib/format';

export default function MeetingRow({ meeting, active, onClick }) {
    const status = meeting.status || 'completed';
    const actionItems = Array.isArray(meeting.actionItems) ? meeting.actionItems.length : 0;
    const groupCount = Array.isArray(meeting.sharedGroups) ? meeting.sharedGroups.length : 0;
    const publishLabel = meeting.isPublished ? (groupCount > 0 ? `${groupCount}` : 'org') : null;
    const publishTitle = meeting.isPublished
        ? (groupCount > 0 ? `Shared with ${groupCount} group${groupCount > 1 ? 's' : ''}` : 'Shared with your organization')
        : '';
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors text-left focus:outline-none focus:ring-2"
            style={{
                background: active ? 'color-mix(in srgb, var(--accent-primary) 10%, var(--bg-secondary))' : 'var(--bg-secondary)',
                borderColor: active ? 'var(--accent-primary)' : 'var(--border-default)',
                color: 'var(--text-primary)',
                '--tw-ring-color': 'var(--accent-primary)',
            }}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold truncate">{meeting.title || 'Untitled meeting'}</span>
                    {status === 'failed' && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#ef4444' }} />}
                    {status === 'processing' && <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" style={{ color: 'var(--text-muted)' }} />}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {formatRelativeDate(meeting.createdAt)}
                </div>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
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
        </button>
    );
}
