import React, { useState } from 'react';
import { FileText, ListChecks, ScrollText } from 'lucide-react';
import Tabs from '../../../components/shared/Tabs';
import SummaryView from './SummaryView';
import ActionItemsList from './ActionItemsList';
import TranscriptView from './TranscriptView';
import useMediaQuery from '../hooks/useMediaQuery';

export default function SummaryActionsLayout({
    meeting,
    onSeek,
    onToggleActionItem,
    onEditActionItem,
    onRegenerateSummary,
    regenerating,
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
                        { id: 'transcript', label: 'Transcript', icon: <ScrollText className="w-3.5 h-3.5" /> },
                    ]}
                />
                {tab === 'summary' && (
                    <SummaryView summary={meeting.summary} onRegenerate={onRegenerateSummary} regenerating={regenerating} />
                )}
                {tab === 'actions' && (
                    <ActionItemsList items={meeting.actionItems || []} onToggle={onToggleActionItem} onEdit={onEditActionItem} onSeek={onSeek} />
                )}
                {tab === 'transcript' && (
                    <TranscriptView segments={meeting.segments || []} speakers={meeting.speakers || []} fullText={meeting.fullText || meeting.transcript} onSeek={onSeek} />
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4" style={{ minHeight: 320 }}>
                <SummaryView summary={meeting.summary} onRegenerate={onRegenerateSummary} regenerating={regenerating} />
                <ActionItemsList items={meeting.actionItems || []} onToggle={onToggleActionItem} onEdit={onEditActionItem} onSeek={onSeek} />
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
