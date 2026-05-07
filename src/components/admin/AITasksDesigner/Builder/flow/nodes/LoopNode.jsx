import React from 'react';
import { Repeat } from 'lucide-react';
import StepNodeBase, { NodeChip } from './StepNodeBase';

export default function LoopNode({ data }) {
    const { step, runStep, issues } = data;
    const overRef = step.overRef || '';
    const itemVar = step.itemVar || 'item';
    const max = step.maxIterations ?? 100;
    const bodyLen = Array.isArray(step.body) ? step.body.length : 0;

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Loop'}</div>
            <div className="mt-0.5 text-[var(--text-secondary)]">
                <div className="truncate">over: <span className="font-mono text-[10px]">{overRef || '—'}</span></div>
                <div className="truncate">as: <span className="font-mono text-[10px]">loop.{itemVar}</span></div>
            </div>
        </div>
    );

    const badges = (
        <>
            <NodeChip title="Body step count">{bodyLen} step{bodyLen === 1 ? '' : 's'}</NodeChip>
            <NodeChip title="Max iterations">≤{max}</NodeChip>
        </>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{step.label || 'Loop'}</div>
            <div>over: <span className="font-mono">{overRef || '—'}</span></div>
            <div>as: <span className="font-mono">loop.{itemVar}</span></div>
            <div>max iterations: {max}</div>
            <div className="mt-1 text-[var(--text-tertiary)]">
                Body has {bodyLen} step{bodyLen === 1 ? '' : 's'} — open the inspector to drill in.
            </div>
            {runStep?.output?.iterations !== undefined && (
                <div className="mt-1 text-[var(--text-secondary)]">
                    last run: {runStep.output.iterations} iteration{runStep.output.iterations === 1 ? '' : 's'}
                </div>
            )}
        </div>
    );

    return (
        <StepNodeBase
            icon={<Repeat size={14} />}
            typeLabel="Loop"
            body={body}
            badges={badges}
            hoverDetail={hoverDetail}
            runStep={runStep}
            issues={issues}
        />
    );
}
