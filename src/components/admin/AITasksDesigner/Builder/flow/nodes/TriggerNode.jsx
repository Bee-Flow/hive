import React from 'react';
import { Clock, Zap, Webhook, MousePointer2 } from 'lucide-react';
import StepNodeBase, { NodeChip } from './StepNodeBase';

const KIND_META = {
    schedule:   { icon: Clock,         label: 'Schedule trigger' },
    manual:     { icon: MousePointer2, label: 'Manual trigger' },
    webhook:    { icon: Webhook,       label: 'Webhook trigger' },
    app_event:  { icon: Zap,           label: 'App-event trigger' },
};

export default function TriggerNode({ data }) {
    const { step, runStep, issues } = data;
    const kind = step.kind || 'manual';
    const meta = KIND_META[kind] || KIND_META.manual;
    const Icon = meta.icon;

    const cron = step.schedule?.cron;
    const tz = step.schedule?.tz;

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
                <div className="mt-0.5 text-[var(--text-tertiary)] truncate">
                    {step.appEvent.provider}.{step.appEvent.event}
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
