import { Activity, BarChart3, ChevronDown, ListChecks, Tags, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Tabs from '../../../components/shared/Tabs';
import useTranslation from '../../../hooks/useTranslation';
import { formatDuration } from '../lib/format';
import { matchViewerSpeaker } from '../lib/insightsData';
import { buildInsightsModel } from '../lib/insightsMetrics';
import { buildSpeakerColorMap, speakerColor } from '../lib/playerData';
import FlowTab from './insights/FlowTab';
import FollowUpTab from './insights/FollowUpTab';
import OverviewTab from './insights/OverviewTab';
import PeopleTab from './insights/PeopleTab';
import { StatChip } from './insights/primitives';
import TopicsTab from './insights/TopicsTab';

/**
 * Meeting dynamics, at the top of the note: the three headline numbers are
 * always visible, everything else lives behind a tab strip that stays folded
 * away until asked for — the summary is what people came for, so insights may
 * not push it off screen.
 *
 * Privacy model ("own stats first + org toggle"): the viewer's own row floats
 * to the top, and when the org disables per-person stats
 * (`perPersonEnabled === false`) buildInsightsModel never builds the attributed
 * sections at all, so no rendering path can leak them.
 */

const OPEN_STORAGE_KEY = 'mn-insights-open';
const TAB_STORAGE_KEY = 'mn-insights-tab';
const TAB_IDS = ['overview', 'people', 'flow', 'topics', 'followup'];

/** localStorage is unavailable in private mode / SSR — never let that throw. */
function readStored(key, fallback) {
    try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? fallback : raw;
    } catch { return fallback; }
}
function writeStored(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* private mode */ }
}

export default function InsightsPanel({ meeting, onSeek, viewerName = '', perPersonEnabled = true }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(() => readStored(OPEN_STORAGE_KEY, '0') === '1');
    const [tab, setTab] = useState(() => {
        const stored = readStored(TAB_STORAGE_KEY, 'overview');
        return TAB_IDS.includes(stored) ? stored : 'overview';
    });

    useEffect(() => { writeStored(OPEN_STORAGE_KEY, open ? '1' : '0'); }, [open]);
    useEffect(() => { writeStored(TAB_STORAGE_KEY, tab); }, [tab]);

    const model = useMemo(
        () => buildInsightsModel(meeting, { perPersonEnabled }),
        [meeting, perPersonEnabled],
    );
    const colorMap = useMemo(() => buildSpeakerColorMap(meeting?.speakers), [meeting?.speakers]);
    const colorFor = useCallback((id) => speakerColor(colorMap, id), [colorMap]);
    const viewerSpeakerId = useMemo(
        () => matchViewerSpeaker(meeting?.speakers, viewerName),
        [meeting?.speakers, viewerName],
    );

    if (!model) {
        return (
            <section aria-label={t('meeting_notes.insights', 'Insights')}>
                <PanelHeading t={t} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {t('meeting_notes.insights_empty', 'Not enough data for insights on this meeting.')}
                </p>
            </section>
        );
    }

    // A tab with nothing in it is disabled rather than hidden, so the strip
    // doesn't reshuffle between meetings and the absence is itself information.
    const items = [
        { id: 'overview', label: t('meeting_notes.insights_tab_overview', 'Overview'), icon: <BarChart3 className="w-3.5 h-3.5" /> },
        {
            id: 'people',
            label: t('meeting_notes.insights_tab_people', 'People'),
            icon: <Users className="w-3.5 h-3.5" />,
            disabled: !model.people,
        },
        { id: 'flow', label: t('meeting_notes.insights_tab_flow', 'Flow'), icon: <Activity className="w-3.5 h-3.5" /> },
        {
            id: 'topics',
            label: t('meeting_notes.insights_tab_topics', 'Topics'),
            icon: <Tags className="w-3.5 h-3.5" />,
            disabled: model.topics.blocks.length === 0 && model.topics.tags.length === 0,
        },
        {
            id: 'followup',
            label: t('meeting_notes.insights_tab_followup', 'Follow-up'),
            icon: <ListChecks className="w-3.5 h-3.5" />,
            badge: model.followUp.open || undefined,
            disabled: !model.followUp.total && !model.followUp.decisions && !model.followUp.openQuestions.length,
        },
    ];
    // Never leave a disabled tab selected (a stored choice, or a meeting whose
    // per-person stats are off).
    const activeTab = items.find((i) => i.id === tab && !i.disabled) ? tab : 'overview';
    const panelId = `insights-panel-${activeTab}`;

    return (
        <section className="flex flex-col gap-3" aria-label={t('meeting_notes.insights', 'Insights')}>
            <div className="flex items-center justify-between gap-2">
                <PanelHeading t={t} />
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    aria-controls="insights-details"
                    className="flex items-center gap-1 text-xs rounded px-1.5 py-1 hover:bg-[var(--bg-tertiary)] transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                >
                    {open ? t('meeting_notes.insights_hide', 'Hide details') : t('meeting_notes.insights_show', 'Show details')}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <StatChip
                    label={t('meeting_notes.insights_balance', 'Balance')}
                    value={`${Math.round(model.talk.balance * 100)}%`}
                    hint={t('meeting_notes.insights_balance_hint', 'How evenly the speaking time was shared')}
                />
                <StatChip
                    label={t('meeting_notes.insights_interactivity', 'Interactivity')}
                    value={model.interactivity ? `${model.interactivity.score}/10` : '—'}
                    hint={t('meeting_notes.insights_interactivity_hint', 'How often the conversation changed hands')}
                />
                <StatChip
                    label={t('meeting_notes.insights_silence', 'Silence')}
                    value={formatDuration(model.talk.silenceSeconds)}
                    hint={t('meeting_notes.insights_silence_hint', 'Recording time when nobody spoke')}
                />
            </div>

            {open && (
                <div id="insights-details" className="flex flex-col gap-3">
                    {/* The strip must scroll rather than squash on a narrow phone. */}
                    <div className="overflow-x-auto -mx-1 px-1">
                        <Tabs
                            value={activeTab}
                            onChange={setTab}
                            items={items}
                            size="sm"
                            ariaLabel={t('meeting_notes.insights', 'Insights')}
                            className="min-w-max"
                        />
                    </div>

                    {/* shared/Tabs renders the strip only — the panel is ours. */}
                    <div id={panelId} role="tabpanel" aria-label={items.find((i) => i.id === activeTab)?.label}>
                        {activeTab === 'overview' && <OverviewTab model={model} onSeek={onSeek} t={t} />}
                        {activeTab === 'people' && (
                            <PeopleTab model={model} colorFor={colorFor} viewerSpeakerId={viewerSpeakerId} onSeek={onSeek} t={t} />
                        )}
                        {activeTab === 'flow' && <FlowTab model={model} colorFor={colorFor} onSeek={onSeek} t={t} />}
                        {activeTab === 'topics' && <TopicsTab model={model} colorFor={colorFor} onSeek={onSeek} t={t} />}
                        {activeTab === 'followup' && <FollowUpTab model={model} onSeek={onSeek} t={t} />}
                    </div>

                    {!perPersonEnabled && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {t('meeting_notes.insights_per_person_off', 'Per-person statistics are disabled by your organization.')}
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}

function PanelHeading({ t }) {
    return (
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <BarChart3 className="w-4 h-4" />
            {t('meeting_notes.insights', 'Insights')}
        </h2>
    );
}
