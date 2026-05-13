import React from 'react';
import { Copy } from 'lucide-react';
import StepNodeBase from './StepNodeBase';

export default function DedupeNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Remove duplicates'}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] truncate">
                {step.keyField ? `by ${step.keyField}` : 'by deep-equal'}
            </div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<Copy size={14} />}
            typeLabel="Dedupe"
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
