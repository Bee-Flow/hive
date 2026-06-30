import React, { useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, closestCorners } from '@dnd-kit/core';
import { Sparkles, Loader2, Flame, Clock, RefreshCw, Mail } from 'lucide-react';
import { formatRelativeTime } from '../../../../utils/dateFormatters';

// Pipeline stages reuse the lead status enum + colours (mirrors LeadTable).
const STAGES = [
    { id: 'new', label: 'Nieuw', color: 'text-sky-500', bg: 'bg-sky-500' },
    { id: 'contacted', label: 'Benaderd', color: 'text-amber-500', bg: 'bg-amber-500' },
    { id: 'qualified', label: 'Gekwalificeerd', color: 'text-emerald-500', bg: 'bg-emerald-500' },
    { id: 'converted', label: 'Gewonnen', color: 'text-green-600', bg: 'bg-green-600' },
    { id: 'disqualified', label: 'Afgewezen', color: 'text-rose-500', bg: 'bg-rose-500' },
];
const STAGE_IDS = STAGES.map(s => s.id);

const euro = (v) => (v == null ? null : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v));

function Card({ lead, task, onOpen, t, dragging }) {
    const pct = lead.hotnessScore;
    return (
        <div
            onClick={() => onOpen?.(lead)}
            className={`rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-2.5 text-xs cursor-pointer hover:border-[var(--accent-primary)] ${dragging ? 'shadow-lg' : ''}`}>
            <div className="flex items-start justify-between gap-1">
                <span className="font-medium text-[var(--text-primary)] truncate">{lead.companyName}</span>
                {pct != null && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-600 flex-shrink-0" title={lead.hotnessReason || ''}>
                        <Flame size={10} /> {pct}
                    </span>
                )}
            </div>
            {lead.ownerName && <div className="text-[var(--text-tertiary)] truncate">{lead.ownerName}</div>}
            <div className="mt-1 flex items-center gap-2 flex-wrap">
                {lead.dealValue != null && <span className="text-[var(--text-secondary)] font-medium">{euro(lead.dealValue)}</span>}
                {task?.dueAt && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--text-tertiary)]" title={task.title}>
                        <Clock size={10} /> {formatRelativeTime(task.dueAt)}
                    </span>
                )}
                {lead.emailDraftSubject && <Mail size={10} className="text-amber-500" title={t('leads.email.title', 'Concept e-mail')} />}
            </div>
        </div>
    );
}

function DraggableCard(props) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.lead.id, data: { status: props.lead.status } });
    return (
        <div ref={setNodeRef} {...attributes} {...listeners} style={{ opacity: isDragging ? 0.4 : 1 }}>
            <Card {...props} />
        </div>
    );
}

function Column({ stage, leads, tasksByLead, totals, onOpen, t }) {
    const { setNodeRef, isOver } = useDroppable({ id: stage.id });
    return (
        <div className="flex flex-col w-64 flex-shrink-0">
            <div className="flex items-center justify-between px-1 py-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                    <span className={`inline-block w-2 h-2 rounded-full ${stage.bg}`} /> {t(`leads.status.${stage.id}`, stage.label)}
                    <span className="text-[var(--text-tertiary)] font-normal">{totals?.count || 0}</span>
                </span>
                {totals?.value > 0 && <span className="text-[10px] text-[var(--text-tertiary)]">{euro(totals.value)}</span>}
            </div>
            <div ref={setNodeRef}
                className={`flex-1 min-h-[120px] rounded-lg p-1.5 space-y-1.5 overflow-y-auto ${isOver ? 'bg-[var(--accent-primary)]/10 ring-1 ring-[var(--accent-primary)]' : 'bg-[var(--bg-secondary)]'}`}>
                {leads.map(l => <DraggableCard key={l.id} lead={l} task={tasksByLead[l.id]} onOpen={onOpen} t={t} />)}
                {!leads.length && <div className="text-[10px] text-[var(--text-tertiary)] text-center py-4">—</div>}
            </div>
        </div>
    );
}

/**
 * Pipeline (Kanban) board — leads grouped by stage; drag a card to another column
 * to change its stage (optimistic, reconciled over SSE). The "Dagfocus" banner is
 * an AI digest; "Prioriteer" runs AI hotness scoring.
 */
export default function PipelineBoard({ leads = [], tasks = [], pipeline = {}, onStageChange = () => {}, onOpenLead = () => {}, onDigest = () => {}, onScore = () => {}, digest = null, busyDigest = false, busyScore = false, t }) {
    const [activeId, setActiveId] = useState(null);
    const [showDigest, setShowDigest] = useState(false);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const tasksByLead = useMemo(() => {
        const m = {};
        for (const tk of tasks) {
            if (tk.completedAt) continue;
            if (!m[tk.leadId] || (tk.dueAt && (!m[tk.leadId].dueAt || tk.dueAt < m[tk.leadId].dueAt))) m[tk.leadId] = tk;
        }
        return m;
    }, [tasks]);

    const byStage = useMemo(() => {
        const m = Object.fromEntries(STAGE_IDS.map(s => [s, []]));
        for (const l of leads) (m[l.status] || (m[l.status] = [])).push(l);
        return m;
    }, [leads]);

    const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

    const onDragEnd = (e) => {
        setActiveId(null);
        const overStage = e.over?.id;
        const lead = leads.find(l => l.id === e.active?.id);
        if (lead && overStage && STAGE_IDS.includes(overStage) && overStage !== lead.status) {
            onStageChange?.(lead.id, overStage);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* AI daily focus */}
            <div className="px-4 py-2 border-b border-[var(--border-default)] flex items-center gap-2">
                <button onClick={() => { setShowDigest(s => !s); if (!digest) onDigest?.(); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
                    {busyDigest ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-amber-500" />} {t('crm.daily_focus', 'Dagfocus')}
                </button>
                <button onClick={() => onScore?.()} disabled={busyScore}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50">
                    {busyScore ? <Loader2 size={12} className="animate-spin" /> : <Flame size={12} className="text-amber-500" />} {t('crm.prioritize', 'Prioriteer')}
                </button>
                {pipeline.totalValue > 0 && <span className="text-[11px] text-[var(--text-tertiary)] ml-auto">{t('crm.pipeline_value', 'Pijplijnwaarde')}: {euro(pipeline.totalValue)}</span>}
            </div>
            {showDigest && digest && (
                <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-xs text-[var(--text-secondary)] space-y-1">
                    {digest.summary && <p>{digest.summary}</p>}
                    {Array.isArray(digest.stalled) && digest.stalled.length > 0 && (
                        <div><span className="text-[var(--text-tertiary)]">{t('crm.stalled', 'Vastgelopen')}:</span> {digest.stalled.map(s => s.company).join(', ')}</div>
                    )}
                    {Array.isArray(digest.today) && digest.today.length > 0 && (
                        <ul className="list-disc pl-4">{digest.today.slice(0, 5).map((s, i) => <li key={i}>{s}</li>)}</ul>
                    )}
                </div>
            )}

            {/* Board */}
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={e => setActiveId(e.active.id)} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-3">
                    <div className="flex gap-3 h-full">
                        {STAGES.map(stage => (
                            <Column key={stage.id} stage={stage} leads={byStage[stage.id] || []} tasksByLead={tasksByLead}
                                totals={pipeline.stages?.[stage.id]} onOpen={onOpenLead} t={t} />
                        ))}
                    </div>
                </div>
                <DragOverlay>{activeLead ? <Card lead={activeLead} task={tasksByLead[activeLead.id]} t={t} dragging /> : null}</DragOverlay>
            </DndContext>
        </div>
    );
}
