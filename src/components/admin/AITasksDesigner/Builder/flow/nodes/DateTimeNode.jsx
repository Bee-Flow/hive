import React from 'react';
import { Clock } from 'lucide-react';
import StepNodeBase from './StepNodeBase';

export default function DateTimeNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const op = step.op || 'now';
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Date & Time'}</div>
            <div className="mt-0.5 font-mono text-[10px] text-[var(--text-secondary)] truncate">{op}</div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<Clock size={14} />}
            typeLabel="Date & Time"
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
