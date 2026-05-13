import React from 'react';
import { Sigma } from 'lucide-react';
import StepNodeBase from './StepNodeBase';

export default function SummarizeNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Summarize'}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] truncate">
                {step.op || 'sum'}{step.field ? ` of ${step.field}` : ''}
            </div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<Sigma size={14} />}
            typeLabel="Summarize"
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
