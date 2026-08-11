import React from 'react';
import { Braces, Sparkles } from 'lucide-react';
import { nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase, { ForEachBadge, NodeChip } from './StepNodeBase';

export default function ParseJsonNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const fields = Array.isArray(step.fields) ? step.fields.filter(f => f && f.name).map(f => f.name) : [];
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Parse JSON'}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] line-clamp-2">
                {fields.length === 0 ? <span className="italic">no fields</span> : `${fields.length} field${fields.length === 1 ? '' : 's'}: ${fields.slice(0, 4).join(', ')}${fields.length > 4 ? '…' : ''}`}
            </div>
        </div>
    );
    const badges = (
        <>
            {step.mode === 'ai' && (
                <NodeChip tone="accent" title="Extracts with AI on every run">
                    <Sparkles size={10} /> AI
                </NodeChip>
            )}
            <ForEachBadge step={step} />
        </>
    );
    return (
        <StepNodeBase
            icon={<Braces size={14} />}
            typeLabel={nodeTypeLabel('parse_json')}
            help={nodeHelp('parse_json')}
            body={body}
            badges={badges}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
