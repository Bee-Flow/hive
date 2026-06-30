import React from 'react';
import { LogOut } from 'lucide-react';
import StepNodeBase from './StepNodeBase';

/**
 * Terminal node inside a Flowlet declaring what the flowlet returns. Its
 * resolved `fields` become the flowlet's output (see execCallLayer/execLayerOutput).
 */
export default function FlowletOutputNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const fields = step.fields && typeof step.fields === 'object' ? Object.keys(step.fields) : [];
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Return'}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] line-clamp-2">
                {fields.length === 0
                    ? <span className="italic">no output fields</span>
                    : `returns: ${fields.slice(0, 4).join(', ')}${fields.length > 4 ? '…' : ''}`}
            </div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<LogOut size={14} />}
            typeLabel="Return"
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
