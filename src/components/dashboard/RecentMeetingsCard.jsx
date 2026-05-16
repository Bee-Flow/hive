import React, { useEffect, useState } from 'react';
import { Mic, Clock, ListChecks, ArrowRight } from 'lucide-react';
import * as api from '../../pages/meeting-notes/lib/transcriptionsApi';
import { formatDuration, formatRelativeDate } from '../../pages/meeting-notes/lib/format';
import { useCapture } from '../../pages/meeting-notes/capture/CaptureContext';

export default function RecentMeetingsCard({ user, onNavigate }) {
    const [items, setItems] = useState(null);
    const { openCapture } = useCapture();
    const flagsOn = user?.featureFlags?.meeting_notes !== false;
    const beta = Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('meeting_notes');
    const adminLike = !!user?.isAdmin || (user?.permissions || []).includes('all');
    const allowed = flagsOn && (adminLike || beta);

    useEffect(() => {
        if (!allowed) return;
        api.listTranscriptions().then((list) => setItems(list.slice(0, 3))).catch(() => setItems([]));
    }, [allowed]);

    if (!allowed) return null;
    if (items == null) return null;
    if (items.length === 0) return null; // hide completely when no meetings

    return (
        <div className="w-full max-w-xl rounded-2xl border p-4" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)', color: 'var(--accent-primary)' }}>
                        <Mic className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent meetings</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Pick up where you left off</div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onNavigate?.('meetingNotes')}
                    className="inline-flex items-center gap-1 text-[11px] font-medium hover:opacity-100 opacity-70 transition-opacity"
                    style={{ color: 'var(--accent-primary)' }}
                >
                    See all
                    <ArrowRight className="w-3 h-3" />
                </button>
            </div>
            <div className="flex flex-col gap-1.5">
                {items.map((m) => {
                    const actionItems = Array.isArray(m.actionItems) ? m.actionItems.length : 0;
                    return (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => { window.__beeflowPendingMeetingId = m.id; onNavigate?.('meetingNotes'); }}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{m.title || 'Untitled meeting'}</div>
                                <div className="flex items-center gap-3 text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    <span>{formatRelativeDate(m.createdAt)}</span>
                                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(m.durationSeconds)}</span>
                                    {actionItems > 0 && (
                                        <span className="inline-flex items-center gap-1"><ListChecks className="w-3 h-3" />{actionItems}</span>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
            <button
                type="button"
                onClick={() => openCapture('record')}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
                <Mic className="w-3.5 h-3.5" />
                Capture a new meeting
            </button>
        </div>
    );
}
