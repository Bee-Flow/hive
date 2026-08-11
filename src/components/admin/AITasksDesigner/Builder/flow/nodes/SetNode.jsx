import React from 'react';
import { Pencil } from 'lucide-react';
import { nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase, { ForEachBadge } from './StepNodeBase';
import { summariseSetStep } from '../setOperations';
import { SET_STEP_NAME } from '../stepDisplayName';

export default function SetNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    // One line for both modes: "3 fields: name, email, …" (single) or
    // "Each row: +2 fields · number rows · shared ID by Subject" (list).
    const summary = summariseSetStep(step);
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || SET_STEP_NAME}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] line-clamp-2">
                {summary === 'No fields yet' || summary === 'Nothing to do yet'
                    ? <span className="italic">{summary}</span>
                    : summary}
            </div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<Pencil size={14} />}
            typeLabel={nodeTypeLabel('set')}
            help={nodeHelp('set')}
            body={body}
            badges={<ForEachBadge step={step} />}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
