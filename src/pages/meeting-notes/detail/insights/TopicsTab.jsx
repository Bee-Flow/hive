import React from 'react';
import { formatDuration, formatSpeakerLabel } from '../../lib/format';
import { BarRow, EmptyState, MetricRow, TabHeading } from './primitives';

/**
 * Where the hour went. The stacked bar and the per-chapter durations are
 * meeting-level facts and stay visible with the per-person gate off; the
 * "driven by / opened by" columns are stripped from the model in that case.
 */
export default function TopicsTab({ model, colorFor, onSeek, t }) {
    const { blocks, tags } = model.topics;

    if (!blocks.length && !tags.length) {
        return (
            <EmptyState>
                {t('meeting_notes.insights_topics_empty', 'No chapters were detected for this meeting. Regenerate the summary to add them.')}
            </EmptyState>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {blocks.length > 0 && (
                <div className="flex flex-col gap-2">
                    <TabHeading hint={t('meeting_notes.insights_topic_time_hint', 'How the recording time split across chapters')}>
                        {t('meeting_notes.insights_topic_time', 'Time per topic')}
                    </TabHeading>
                    <div className="flex h-3 rounded-md overflow-hidden gap-px" role="img" aria-label={t('meeting_notes.insights_topic_time', 'Time per topic')}>
                        {blocks.map((c, i) => (
                            <button
                                key={`${c.title}-${c.seconds}`}
                                type="button"
                                onClick={() => onSeek?.(c.seconds)}
                                className="h-full min-w-0"
                                style={{
                                    flexBasis: `${c.widthFraction * 100}%`,
                                    flexGrow: 0,
                                    flexShrink: 1,
                                    background: 'var(--accent-primary)',
                                    opacity: [0.9, 0.55, 0.3][i % 3],
                                }}
                                title={`${c.title} · ${formatDuration(c.endSeconds - c.seconds)}`}
                                aria-label={`${c.title} (${formatDuration(c.seconds)})`}
                            />
                        ))}
                    </div>
                    <div className="flex flex-col gap-1">
                        {blocks.map((c) => (
                            <div key={`row-${c.title}-${c.seconds}`} className="flex flex-col gap-0.5">
                                <BarRow
                                    label={c.title}
                                    fraction={c.widthFraction}
                                    value={formatDuration(c.endSeconds - c.seconds)}
                                    onClick={onSeek ? () => onSeek(c.seconds) : undefined}
                                    title={t('meeting_notes.insights_jump', 'Jump to this moment')}
                                />
                                {c.topSpeakerId && (
                                    <div className="ml-[7.5rem] flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorFor(c.topSpeakerId) }} />
                                        <span className="truncate">
                                            {t('meeting_notes.insights_driven_by', 'Mostly {name}')
                                                .replace('{name}', formatSpeakerLabel(c.topSpeakerId))}
                                            {' '}({Math.round(c.topSpeakerShare * 100)}%)
                                            {c.openedBy && c.openedBy !== c.topSpeakerId && (
                                                <> · {t('meeting_notes.insights_opened_by', 'opened by {name}')
                                                    .replace('{name}', formatSpeakerLabel(c.openedBy))}</>
                                            )}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {model.actionsPerTopic.length > 0 && (
                <div className="flex flex-col gap-1">
                    <TabHeading hint={t('meeting_notes.insights_actions_topic_hint', 'Which topics produced the most follow-up')}>
                        {t('meeting_notes.insights_actions_topic', 'Action items per topic')}
                    </TabHeading>
                    {model.actionsPerTopic.map((a) => (
                        <MetricRow
                            key={a.title}
                            label={a.title}
                            value={a.count}
                            onClick={onSeek ? () => onSeek(a.seconds) : undefined}
                            title={t('meeting_notes.insights_jump', 'Jump to this moment')}
                        />
                    ))}
                </div>
            )}

            {tags.length > 0 && (
                <div className="flex flex-col gap-1">
                    <TabHeading hint={t('meeting_notes.insights_keywords_hint', 'How often each detected keyword was actually said')}>
                        {t('meeting_notes.insights_keywords', 'Keywords mentioned')}
                    </TabHeading>
                    {tags.map((tag) => (
                        <MetricRow
                            key={tag.tag}
                            label={tag.tag}
                            value={`${tag.count}×`}
                            onClick={tag.firstSeconds != null && onSeek ? () => onSeek(tag.firstSeconds) : undefined}
                            title={t('meeting_notes.insights_first_mention', 'Jump to the first mention')}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
