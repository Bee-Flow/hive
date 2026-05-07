import React from 'react';
import { GitBranch } from 'lucide-react';
import StepNodeBase from './StepNodeBase';

export default function ConditionNode({ data }) {
    const { step, runStep, issues } = data;
    const expr = step.expr || '';

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Condition'}</div>
            <div className="mt-0.5 font-mono text-[10px] text-[var(--text-secondary)] line-clamp-2 break-all">{expr || <span className="italic">no expression</span>}</div>
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
        />
    );
}
