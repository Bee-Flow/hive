import React from 'react';
import { Split } from 'lucide-react';
import StepNodeBase from './StepNodeBase';
import { humanizeExpression } from '../displayHelpers';

export default function SwitchNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const cases = Array.isArray(step.cases) ? step.cases : [];
    const friendlyExpr = humanizeExpression(step.expr || '', stepLabelById);
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Switch'}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] truncate" title={step.expr}>
                {friendlyExpr || <span className="italic">no expression</span>}
            </div>
            <div className="mt-0.5 text-[10px] text-[var(--text-tertiary)] truncate">
                {cases.length === 0 ? 'no cases' : `${cases.length} case${cases.length === 1 ? '' : 's'}${step.defaultBranch ? ` + default` : ''}`}
            </div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<Split size={14} />}
            typeLabel="Switch"
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
