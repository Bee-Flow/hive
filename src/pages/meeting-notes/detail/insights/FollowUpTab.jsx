import React from 'react';
import { formatDuration } from '../../lib/format';
import { EmptyState, FLAG_AMBER, MetricRow, TabHeading } from './primitives';

/**
 * What the meeting actually produced, and how much of it is real work someone
 * can pick up: assigned vs orphaned action items, deadlines, decisions and the
 * questions nobody answered.
 */
export default function FollowUpTab({ model, onSeek, t }) {
    const f = model.followUp;
    if (!f.total && !f.decisions && !f.openQuestions.length) {
        return (
            <EmptyState>
                {t('meeting_notes.insights_followup_empty', 'No action items, decisions or open questions were detected for this meeting.')}
            </EmptyState>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {f.total > 0 && (
                <div className="flex flex-col gap-1">
                    <TabHeading>{t('meeting_notes.insights_actions', 'Action items')}</TabHeading>
                    <MetricRow
                        label={t('meeting_notes.insights_actions_open', 'Open')}
                        value={`${f.open} / ${f.total}`}
                    />
                    <MetricRow
                        label={t('meeting_notes.insights_actions_unassigned', 'Without an owner')}
                        value={f.unassigned}
                        flagged={f.unassigned > 0}
                        title={t('meeting_notes.insights_actions_unassigned_hint', 'Nobody was named for these — they usually stall')}
                    />
                    <MetricRow
                        label={t('meeting_notes.insights_actions_with_due', 'With a deadline')}
                        value={`${f.withDue} / ${f.total}`}
                    />
                    {f.overdue > 0 && (
                        <MetricRow
                            label={t('meeting_notes.insights_actions_overdue', 'Past their deadline')}
                            value={f.overdue}
                            flagged
                        />
                    )}
                </div>
            )}

            {f.byAssignee && f.byAssignee.length > 0 && (
                <div className="flex flex-col gap-1">
                    <TabHeading hint={t('meeting_notes.insights_workload_hint', 'How the follow-up work is spread')}>
                        {t('meeting_notes.insights_workload', 'Per person')}
                    </TabHeading>
                    {f.byAssignee.map((row) => (
                        <MetricRow
                            key={row.assignee}
                            label={row.assignee}
                            detail={row.overdue > 0
                                ? t('meeting_notes.insights_n_overdue', '{n} overdue').replace('{n}', row.overdue)
                                : undefined}
                            value={`${row.open} / ${row.total}`}
                            flagged={row.overdue > 0}
                            title={t('meeting_notes.insights_open_of_total', 'Open of total')}
                        />
                    ))}
                </div>
            )}

            {f.decisions > 0 && (
                <MetricRow
                    label={t('meeting_notes.insights_decisions_made', 'Decisions made')}
                    detail={t('meeting_notes.insights_per_hour', '{n}/hour').replace('{n}', f.decisionsPerHour.toFixed(1))}
                    value={f.decisions}
                />
            )}

            {f.openQuestions.length > 0 && (
                <div className="flex flex-col gap-1">
                    <TabHeading hint={t('meeting_notes.insights_open_questions_hint', 'Raised but never resolved on the recording')}>
                        {t('meeting_notes.insights_open_questions', 'Left unanswered')}
                    </TabHeading>
                    {f.openQuestions.map((q) => (
                        <div key={q.id} className="flex items-baseline gap-2 text-xs">
                            <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--text-secondary)' }} title={q.text}>
                                {q.text}
                            </span>
                            {q.seconds != null && onSeek ? (
                                <button
                                    type="button"
                                    onClick={() => onSeek(q.seconds)}
                                    className="shrink-0 tabular-nums hover:underline"
                                    style={{ color: FLAG_AMBER }}
                                    title={t('meeting_notes.insights_jump', 'Jump to this moment')}
                                >
                                    {formatDuration(q.seconds)}
                                </button>
                            ) : (
                                <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
