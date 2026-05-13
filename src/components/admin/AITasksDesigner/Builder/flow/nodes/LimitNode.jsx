import React from 'react';
import { ChevronsDown } from 'lucide-react';
import StepNodeBase from './StepNodeBase';

export default function LimitNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Limit'}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] truncate">{step.mode === 'last' ? 'last' : 'first'} {step.count ?? 0}</div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<ChevronsDown size={14} />}
            typeLabel="Limit"
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
