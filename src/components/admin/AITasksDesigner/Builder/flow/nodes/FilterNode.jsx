import React from 'react';
import { Split } from 'lucide-react';
import { nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase from './StepNodeBase';
import { ROUTE_STEP_NAME } from '../stepDisplayName';
import { humanizeExpression, describeRuleExpr } from '../displayHelpers';

export default function FilterNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const friendlySource = humanizeExpression(step.arrayRef || '', stepLabelById);
    const friendlyCond = describeRuleExpr(step.expr || '', stepLabelById);
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || ROUTE_STEP_NAME}</div>
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
            icon={<Split size={14} />}
            typeLabel={nodeTypeLabel('filter')}
            help={nodeHelp('filter')}
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
