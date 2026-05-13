import React from 'react';
import { Layers } from 'lucide-react';
import StepNodeBase from './StepNodeBase';

export default function AggregateNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Aggregate'}</div>
            <div className="mt-0.5 font-mono text-[10px] text-[var(--text-secondary)] truncate">{step.field || <span className="italic">no field</span>}</div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<Layers size={14} />}
            typeLabel="Aggregate"
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
