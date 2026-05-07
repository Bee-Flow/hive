import React from 'react';
import { Clock, Zap, Webhook, MousePointer2, Mail, Calendar } from 'lucide-react';
import StepNodeBase, { NodeChip } from './StepNodeBase';

const KIND_META = {
    schedule:   { icon: Clock,         label: 'Schedule trigger' },
    manual:     { icon: MousePointer2, label: 'Manual trigger' },
    webhook:    { icon: Webhook,       label: 'Webhook trigger' },
    app_event:  { icon: Zap,           label: 'App-event trigger' },
};

/**
 * Sub-meta per (provider, event) so a Gmail-new-email trigger gets a
 * Mail icon and a friendly "New email (Gmail)" label instead of the
 * generic "App-event trigger" lightning bolt.
 */
const APP_EVENT_META = {
    'gmail.mail.new':              { icon: Mail,     label: 'New email (Gmail)' },
    'google-calendar.event.changed': { icon: Calendar, label: 'Calendar event changed' },
};

export default function TriggerNode({ data }) {
    const { step, runStep, issues } = data;
    const kind = step.kind || 'manual';

    let meta = KIND_META[kind] || KIND_META.manual;
    if (kind === 'app_event' && step.appEvent) {
        const key = `${step.appEvent.provider}.${step.appEvent.event}`;
        if (APP_EVENT_META[key]) meta = APP_EVENT_META[key];
    }
    const Icon = meta.icon;

    const cron = step.schedule?.cron;
    const tz = step.schedule?.tz;
    const filter = step.appEvent?.filter || null;

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || meta.label}</div>
            {kind === 'schedule' && cron && (
                <div className="mt-0.5 flex items-center gap-1 flex-wrap">
                    <NodeChip><span className="font-mono">{cron}</span></NodeChip>
                    {tz && <NodeChip>{tz}</NodeChip>}
                </div>
            )}
            {kind === 'app_event' && step.appEvent && (
                <div className="mt-0.5 text-[var(--text-tertiary)] text-[10px] truncate">
                    <span className="font-mono">{step.appEvent.provider}.{step.appEvent.event}</span>
                </div>
            )}
            {kind === 'app_event' && filter && Object.keys(filter).length > 0 && (
                <div className="mt-1 flex items-center gap-1 flex-wrap">
                    {Object.entries(filter).slice(0, 3).map(([k, v]) => (
                        <NodeChip key={k} title={`filter ${k}=${JSON.stringify(v)}`}>
                            {k}={Array.isArray(v) ? v.join(',') : String(v)}
                        </NodeChip>
                    ))}
                </div>
            )}
        </div>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{meta.label}</div>
            <div className="text-[var(--text-secondary)]">id: <span className="font-mono">{step.id}</span></div>
            {kind === 'schedule' && cron && <div>cron: <span className="font-mono">{cron}</span> ({tz || 'UTC'})</div>}
            {kind === 'webhook' && <div>HTTP webhook entry point.</div>}
            {kind === 'manual' && <div>Runs only on user action.</div>}
            {kind === 'app_event' && step.appEvent?.provider === 'gmail' && step.appEvent?.event === 'mail.new' && (
                <>
                    <div className="mt-1">Fires on every new email in your inbox.</div>
                    <div className="mt-1 text-[var(--text-tertiary)]">
                        Trigger payload: <span className="font-mono">{'{messageId, threadId, from, subject, snippet, labelIds, …}'}</span>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <StepNodeBase
            icon={<Icon size={14} />}
            typeLabel={meta.label}
            body={body}
            hoverDetail={hoverDetail}
            runStep={runStep}
            issues={issues}
        />
    );
}
