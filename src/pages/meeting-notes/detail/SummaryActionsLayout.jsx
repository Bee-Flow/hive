import React, { useState } from 'react';
import { BarChart3, FileText, ListChecks, ScrollText } from 'lucide-react';
import Tabs from '../../../components/shared/Tabs';
import SummaryView from './SummaryView';
import ActionItemsList from './ActionItemsList';
import DecisionsQuestionsPanel from './DecisionsQuestionsPanel';
import InsightsPanel from './InsightsPanel';
import TranscriptView from './TranscriptView';
import useMediaQuery from '../hooks/useMediaQuery';

export default function SummaryActionsLayout({
    meeting,
    onSeek,
    onEditSpeakers,
    onToggleActionItem,
    onEditActionItem,
    onRegenerateSummary,
    regenerating,
    templates,
    onNewTemplate,
    onEditTemplate,
    viewerName,
    perPersonInsights = true,
}) {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [tab, setTab] = useState('summary');

    if (isMobile) {
        return (
            <div className="flex flex-col gap-3">
                <Tabs
                    value={tab}
                    onChange={setTab}
                    items={[
                        { id: 'summary', label: 'Summary', icon: <FileText className="w-3.5 h-3.5" /> },
                        { id: 'actions', label: 'Actions', icon: <ListChecks className="w-3.5 h-3.5" />, badge: (meeting.actionItems || []).filter((i) => !i.done).length || undefined },
                        { id: 'insights', label: 'Insights', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                        { id: 'transcript', label: 'Transcript', icon: <ScrollText className="w-3.5 h-3.5" /> },
                    ]}
                />
                {tab === 'summary' && (
                    <SummaryView
                        summary={meeting.summary}
                        onRegenerate={onRegenerateSummary}
                        regenerating={regenerating}
                        templates={templates}
                        onNewTemplate={onNewTemplate}
                        onEditTemplate={onEditTemplate}
                    />
                )}
                {tab === 'actions' && (
                    <div className="flex flex-col gap-4">
                        <ActionItemsList items={meeting.actionItems || []} onToggle={onToggleActionItem} onEdit={onEditActionItem} onSeek={onSeek} />
                        <DecisionsQuestionsPanel decisions={meeting.decisions || []} questions={meeting.questions || []} onSeek={onSeek} />
                    </div>
                )}
                {tab === 'insights' && (
                    <InsightsPanel meeting={meeting} onSeek={onSeek} viewerName={viewerName} perPersonEnabled={perPersonInsights} />
                )}
                {tab === 'transcript' && (
                    <TranscriptView segments={meeting.segments || []} speakers={meeting.speakers || []} fullText={meeting.fullText || meeting.transcript} onSeek={onSeek} onEditSpeakers={onEditSpeakers} />
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Insights lead the note: the three headline numbers are always
                visible, the tabbed detail stays folded away by default so the
                summary below keeps its place. */}
            <InsightsPanel meeting={meeting} onSeek={onSeek} viewerName={viewerName} perPersonEnabled={perPersonInsights} />
            <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4" style={{ minHeight: 320 }}>
                <SummaryView
                    summary={meeting.summary}
                    onRegenerate={onRegenerateSummary}
                    regenerating={regenerating}
                    templates={templates}
                    onNewTemplate={onNewTemplate}
                    onEditTemplate={onEditTemplate}
                />
                <div className="flex flex-col gap-4 min-w-0">
                    <ActionItemsList items={meeting.actionItems || []} onToggle={onToggleActionItem} onEdit={onEditActionItem} onSeek={onSeek} />
                    <DecisionsQuestionsPanel decisions={meeting.decisions || []} questions={meeting.questions || []} onSeek={onSeek} />
                </div>
            </div>
            <div>
                <h2 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <ScrollText className="w-4 h-4" />
                    Transcript
                </h2>
                <TranscriptView segments={meeting.segments || []} speakers={meeting.speakers || []} fullText={meeting.fullText || meeting.transcript} onSeek={onSeek} />
            </div>
        </div>
    );
}
