import { ChevronDown } from 'lucide-react';
import React, { useState } from 'react';
import { formatDuration, formatSpeakerLabel } from '../../lib/format';
import { EmptyState, FLAG_AMBER, TabHeading } from './primitives';

/**
 * Per-speaker detail. The row keeps the original share bar + longest monologue
 * + contribution disclosure, and adds the delivery numbers (pace, turns,
 * questions, listening time) underneath so the row itself stays scannable.
 *
 * Never rendered when the org disabled per-person stats — the model doesn't
 * even build `people` then (see buildInsightsModel).
 */
export default function PeopleTab({ model, colorFor, viewerSpeakerId, onSeek, t }) {
    const [expandedId, setExpandedId] = useState(null);
    const people = model.people;
    if (!people || !people.rows.length) {
        return <EmptyState>{t('meeting_notes.insights_empty', 'Not enough data for insights on this meeting.')}</EmptyState>;
    }

    // Own row first: a stable partition, not a resort — everyone else keeps
    // their talk-time order.
    const rows = viewerSpeakerId
        ? [...people.rows.filter((s) => s.speakerId === viewerSpeakerId),
            ...people.rows.filter((s) => s.speakerId !== viewerSpeakerId)]
        : people.rows;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2" role="list" aria-label={t('meeting_notes.insights_talk_time', 'Talk time')}>
                {rows.map((s) => (
                    <SpeakerRow
                        key={s.speakerId}
                        stat={s}
                        color={colorFor(s.speakerId)}
                        isViewer={s.speakerId === viewerSpeakerId}
                        onSeek={onSeek}
                        expanded={expandedId === s.speakerId}
                        onToggle={() => setExpandedId((cur) => (cur === s.speakerId ? null : s.speakerId))}
                        t={t}
                    />
                ))}
            </div>

            {people.silentAttendees.length > 0 && (
                <div className="flex flex-col gap-1">
                    <TabHeading hint={t('meeting_notes.insights_silent_hint', 'Invited but never recorded speaking')}>
                        {t('meeting_notes.insights_silent', 'Did not speak')}
                    </TabHeading>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {people.silentAttendees.join(', ')}
                    </p>
                </div>
            )}
        </div>
    );
}

function SpeakerRow({ stat, color, isViewer, onSeek, expanded, onToggle, t }) {
    const pct = Math.round(stat.share * 100);
    const mono = stat.longestMonologue;
    const panelId = `contribution-${encodeURIComponent(stat.speakerId)}`;
    return (
        <div role="listitem">
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="w-28 truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                    {formatSpeakerLabel(stat.speakerId)}
                    {isViewer && (
                        <span
                            className="ml-1.5 px-1 py-px rounded text-[9px] font-semibold align-middle"
                            style={{ background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)', color: 'var(--accent-primary)' }}
                        >
                            {t('meeting_notes.insights_you', 'you')}
                        </span>
                    )}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(1, pct)}%`, background: color }} />
                </div>
                <span className="w-9 text-right tabular-nums">{pct}%</span>
                <span className="w-12 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {formatDuration(stat.speakingSeconds)}
                </span>
                {mono && onSeek ? (
                    <button
                        type="button"
                        onClick={() => onSeek(mono.start)}
                        className="w-16 text-right tabular-nums hover:underline"
                        style={{ color: mono.flagged ? FLAG_AMBER : 'var(--text-muted)' }}
                        title={t('meeting_notes.insights_longest_monologue', 'Longest monologue — click to play')}
                    >
                        {formatDuration(mono.seconds)}
                    </button>
                ) : (
                    <span className="w-16" />
                )}
                {/* Only notes whose pipeline wrote a contribution get a disclosure —
                    older ones show no dead control; Regenerate fills them in. */}
                {stat.summary ? (
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label={expanded
                            ? t('meeting_notes.insights_hide_contribution', 'Hide contribution')
                            : t('meeting_notes.insights_show_contribution', 'Show contribution')}
                        title={t('meeting_notes.insights_contribution', 'Contribution')}
                    >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                ) : (
                    <span className="w-[22px]" />
                )}
            </div>

            <div className="ml-4 mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {stat.wpm != null && (
                    <span title={t('meeting_notes.insights_pace_hint', 'Words per minute while speaking')}>
                        {t('meeting_notes.insights_pace', 'Pace')} <span className="tabular-nums">{stat.wpm}</span> {t('meeting_notes.insights_wpm', 'wpm')}
                    </span>
                )}
                <span title={t('meeting_notes.insights_turns_hint', 'How many times they took the floor, and for how long on average')}>
                    {t('meeting_notes.insights_turns', 'Turns')} <span className="tabular-nums">{stat.turnCount}</span>
                    {stat.avgTurnSeconds > 0 && <> · {t('meeting_notes.insights_avg', 'avg')} <span className="tabular-nums">{formatDuration(stat.avgTurnSeconds)}</span></>}
                </span>
                <span title={t('meeting_notes.insights_questions_hint', 'Lines ending in a question mark — a rough signal, not exact')}>
                    {t('meeting_notes.insights_questions_asked', 'Questions')} <span className="tabular-nums">{stat.questionCount}</span>
                </span>
                <span title={t('meeting_notes.insights_listening_hint', 'Recording time while somebody else had the floor')}>
                    {t('meeting_notes.insights_listening', 'Listening')} <span className="tabular-nums">{formatDuration(stat.listeningSeconds)}</span>
                </span>
            </div>

            {expanded && stat.summary && (
                <p
                    id={panelId}
                    className="text-xs leading-relaxed ml-4 mt-1.5 mb-1 pl-3 border-l-2"
                    style={{ color: 'var(--text-secondary)', borderColor: color }}
                >
                    {stat.summary}
                </p>
            )}
        </div>
    );
}
