import React from 'react';
import { Hourglass } from 'lucide-react';
import StepNodeBase from './StepNodeBase';

export default function WaitNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const sec = typeof step.seconds === 'number' ? step.seconds : 0;
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Wait'}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] truncate">{sec}s</div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<Hourglass size={14} />}
            typeLabel="Wait"
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
