import React from 'react';
import { GitBranch } from 'lucide-react';
import StepNodeBase from './StepNodeBase';
import { humanizeExpression } from '../displayHelpers';

export default function ConditionNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const expr = step.expr || '';
    const friendlyExpr = humanizeExpression(expr, stepLabelById);

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Condition'}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] line-clamp-2 break-words" title={expr}>
                {friendlyExpr || <span className="italic">no expression</span>}
            </div>
        </div>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{step.label || 'Condition'}</div>
            <div>If: <span className="font-mono">{expr}</span></div>
            <div className="mt-1 text-[var(--text-tertiary)]">
                Outgoing edges labelled <span className="font-semibold text-emerald-600 dark:text-emerald-400">then</span> or <span className="font-semibold text-amber-600 dark:text-amber-400">else</span>.
            </div>
            {runStep?.output?.branch && (
                <div className="mt-1 text-[var(--text-secondary)]">
                    last run took: <span className="font-semibold">{runStep.output.branch}</span>
                </div>
            )}
        </div>
    );

    return (
        <StepNodeBase
            icon={<GitBranch size={14} />}
            typeLabel="Condition"
            body={body}
            hoverDetail={hoverDetail}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
