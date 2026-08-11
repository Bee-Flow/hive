import React from 'react';
import { formatDuration } from '../../lib/format';
import { EmptyState, MetricRow } from './primitives';

/**
 * The five-second read: one line per headline fact, each jumping into the
 * recording where it applies. Highlights are produced by
 * buildOverviewHighlights, which already respects the per-person gate — a
 * highlight that names somebody simply isn't in the list when the org
 * disabled attribution.
 */
export default function OverviewTab({ model, onSeek, t }) {
    const highlights = model.overview || [];
    if (!highlights.length) {
        return <EmptyState>{t('meeting_notes.insights_empty', 'Not enough data for insights on this meeting.')}</EmptyState>;
    }

    const LABELS = {
        longest_monologue: t('meeting_notes.insights_hl_monologue', 'Longest monologue'),
        most_questions: t('meeting_notes.insights_hl_questions', 'Most questions asked'),
        biggest_topic: t('meeting_notes.insights_hl_topic', 'Biggest topic'),
        open_actions: t('meeting_notes.insights_hl_actions', 'Open action items'),
        participants: t('meeting_notes.insights_hl_participants', 'People who spoke'),
        attention: t('meeting_notes.insights_hl_attention', 'Attention spent'),
    };

    const render = (h) => {
        if (h.kind === 'duration') return formatDuration(h.value);
        if (h.kind === 'percent') return `${h.value}%`;
        if (h.kind === 'hours') return `${h.value.toFixed(1)} h`;
        return String(h.value);
    };

    const detailFor = (h) => {
        if (h.id === 'participants' && h.detail) {
            return t('meeting_notes.insights_hl_silent', '{n} silent').replace('{n}', h.detail.split(' ')[0]);
        }
        if (h.id === 'open_actions' && h.detail) {
            return t('meeting_notes.insights_hl_unassigned', '{n} unassigned').replace('{n}', h.detail.split(' ')[0]);
        }
        return h.detail;
    };

    return (
        <div className="flex flex-col gap-1.5">
            {highlights.map((h) => (
                <MetricRow
                    key={h.id}
                    label={LABELS[h.id] || h.label}
                    detail={detailFor(h)}
                    value={render(h)}
                    flagged={h.id === 'open_actions' && h.value > 0 && model.followUp?.overdue > 0}
                    onClick={h.seconds != null && onSeek ? () => onSeek(h.seconds) : undefined}
                    title={h.seconds != null ? t('meeting_notes.insights_jump', 'Jump to this moment') : undefined}
                />
            ))}
        </div>
    );
}
