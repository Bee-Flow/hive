import React from 'react';
import { Pencil } from 'lucide-react';
import StepNodeBase from './StepNodeBase';

export default function SetNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const fields = step.fields && typeof step.fields === 'object' ? Object.keys(step.fields) : [];
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Edit fields'}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] line-clamp-2">
                {fields.length === 0 ? <span className="italic">no fields</span> : `${fields.length} field${fields.length === 1 ? '' : 's'}: ${fields.slice(0, 4).join(', ')}${fields.length > 4 ? '…' : ''}`}
            </div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<Pencil size={14} />}
            typeLabel="Set"
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
