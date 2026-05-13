import React from 'react';
import { OctagonX } from 'lucide-react';
import StepNodeBase from './StepNodeBase';

export default function StopErrorNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Stop and error'}</div>
            <div className="mt-0.5 text-[10px] text-red-600 dark:text-red-400 line-clamp-2">
                {step.message || <span className="italic text-[var(--text-tertiary)]">no message</span>}
            </div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<OctagonX size={14} />}
            typeLabel="Stop and error"
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
