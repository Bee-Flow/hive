import React from 'react';
import { Filter } from 'lucide-react';
import StepNodeBase from './StepNodeBase';
import { humanizeExpression } from '../displayHelpers';

export default function FilterNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const friendlySource = humanizeExpression(step.arrayRef || '', stepLabelById);
    const friendlyCond = humanizeExpression(step.expr || '', stepLabelById);
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Filter'}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] truncate" title={step.arrayRef}>
                {friendlySource || <span className="italic">no source</span>}
            </div>
            <div className="mt-0.5 text-[10px] text-[var(--text-tertiary)] line-clamp-1" title={step.expr}>
                {friendlyCond || <span className="italic">no condition</span>}
            </div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<Filter size={14} />}
            typeLabel="Filter"
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
