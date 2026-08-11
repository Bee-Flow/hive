import React from 'react';
import { formatDuration, formatSpeakerLabel } from '../../lib/format';
import { EmptyState, MetricRow, Sparkline, StackedAirtime, TabHeading } from './primitives';

/**
 * How the conversation moved: rhythm over time, who held the floor when,
 * who hands over to whom, and where it went quiet.
 *
 * The meeting-level halves (rhythm, monologue share, dead air) render even
 * when the org disabled per-person stats; the attributed halves are simply
 * absent from the model then.
 */
export default function FlowTab({ model, colorFor, onSeek, t }) {
    const { flow, interactivity } = model;
    const hasRhythm = interactivity && interactivity.windows.length > 1;
    const hasAirtime = !!flow.airtime && flow.airtime.length > 1;
    const hasHandoffs = !!flow.handoffs && flow.handoffs.length > 0;

    if (!hasRhythm && !hasAirtime && !hasHandoffs && !flow.deadAir.length && !flow.monologue) {
        return <EmptyState>{t('meeting_notes.insights_flow_empty', 'This recording is too short to show how the conversation moved.')}</EmptyState>;
    }

    const windowLabel = (start) => formatDuration(start);

    return (
        <div className="flex flex-col gap-4">
            {hasRhythm && (
                <div className="flex flex-col gap-1.5">
                    <TabHeading hint={t('meeting_notes.insights_rhythm_hint', 'Speaker changes per time block — tall means a lively exchange')}>
                        {t('meeting_notes.insights_rhythm', 'Turn-taking rhythm')}
                    </TabHeading>
                    <Sparkline
                        points={interactivity.windows.map((w) => ({ start: w.start, value: w.switches }))}
                        ariaLabel={t('meeting_notes.insights_rhythm', 'Turn-taking rhythm')}
                        onSeek={onSeek}
                        formatTitle={(p) => `${windowLabel(p.start)} · ${p.value} ${t('meeting_notes.insights_switches', 'switches')}`}
                    />
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {interactivity.switches} {t('meeting_notes.insights_switches', 'switches')} ·{' '}
                        {interactivity.switchesPerMinute.toFixed(1)}/{t('meeting_notes.insights_per_minute', 'min')}
                    </p>
                </div>
            )}

            {hasAirtime && (
                <div className="flex flex-col gap-1.5">
                    <TabHeading hint={t('meeting_notes.insights_airtime_hint', 'Who held the floor in each time block')}>
                        {t('meeting_notes.insights_airtime', 'Airtime over time')}
                    </TabHeading>
                    <StackedAirtime
                        windows={flow.airtime}
                        colorFor={colorFor}
                        ariaLabel={t('meeting_notes.insights_airtime', 'Airtime over time')}
                        onSeek={onSeek}
                        formatTitle={(w) => `${windowLabel(w.start)} — ${w.shares
                            .map((s) => `${formatSpeakerLabel(s.speakerId)} ${Math.round(s.share * 100)}%`)
                            .join(' · ') || t('meeting_notes.insights_silence', 'Silence')}`}
                    />
                </div>
            )}

            {hasHandoffs && (
                <div className="flex flex-col gap-1">
                    <TabHeading hint={t('meeting_notes.insights_handoff_hint', 'Who most often speaks straight after whom')}>
                        {t('meeting_notes.insights_handoff', 'Who follows whom')}
                    </TabHeading>
                    {flow.handoffs.map((h, i) => (
                        <MetricRow
                            // Index, not the names: a display name can contain
                            // anything, so a composed key is not reliably unique.
                            key={`handoff-${i}`}
                            label={`${formatSpeakerLabel(h.from)} → ${formatSpeakerLabel(h.to)}`}
                            value={`${h.count}×`}
                        />
                    ))}
                </div>
            )}

            {flow.monologue && (
                <MetricRow
                    label={t('meeting_notes.insights_monologue_share', 'Time in long monologues')}
                    detail={`${flow.monologue.count}×`}
                    value={`${Math.round(flow.monologue.ratio * 100)}%`}
                    title={t('meeting_notes.insights_monologue_hint', 'Share of the speaking time spent in uninterrupted stretches of 90 seconds or more')}
                />
            )}

            {flow.deadAir.length > 0 && (
                <div className="flex flex-col gap-1">
                    <TabHeading hint={t('meeting_notes.insights_dead_air_hint', 'The longest stretches where nobody spoke')}>
                        {t('meeting_notes.insights_dead_air', 'Quiet stretches')}
                    </TabHeading>
                    {flow.deadAir.map((g) => (
                        <MetricRow
                            key={`${g.start}-${g.end}`}
                            label={g.kind === 'lead_in'
                                ? t('meeting_notes.insights_lead_in', 'Before the first word')
                                : g.kind === 'lead_out'
                                    ? t('meeting_notes.insights_lead_out', 'After the last word')
                                    : `${t('meeting_notes.insights_from', 'From')} ${formatDuration(g.start)}`}
                            value={formatDuration(g.seconds)}
                            onClick={onSeek ? () => onSeek(g.start) : undefined}
                            title={t('meeting_notes.insights_jump', 'Jump to this moment')}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
