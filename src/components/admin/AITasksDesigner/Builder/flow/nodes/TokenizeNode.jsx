import React from 'react';
import { VenetianMask } from 'lucide-react';
import { nodeDefaultLabel, nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase from './StepNodeBase';
import { humanizeExpression } from '../displayHelpers';

/**
 * "Hide personal data" on the canvas.
 *
 * One output, unlike the guard's two: there is nothing to decide, and no
 * restore step to wire — the real values come back on their own wherever the
 * run uses them again. The node says that out loud, because a reader who
 * expects a second node will go looking for one.
 */
export default function TokenizeNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const source = humanizeExpression(step.sourceRef || '', stepLabelById);
    const cats = Array.isArray(step.categories) && step.categories.length ? step.categories : null;
    const hidden = runStep?.output?.count;

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || nodeDefaultLabel('tokenize')}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] truncate" title={step.sourceRef}>
                {source || <span className="italic">nothing to hide yet</span>}
            </div>
            {Number.isInteger(hidden) && (
                <div className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">
                    {hidden === 0 ? 'nothing found' : `${hidden} value${hidden === 1 ? '' : 's'} hidden`}
                </div>
            )}
        </div>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{step.label || nodeDefaultLabel('tokenize')}</div>
            <div>Hides in: <span className="font-mono">{step.sourceRef || '—'}</span></div>
            <div className="mt-1">
                Looking for: {cats ? cats.join(', ') : 'everything the Privacy Shield looks for'}
            </div>
            <div className="mt-1 text-[var(--text-tertiary)]">
                Use <span className="font-mono">output.text</span> downstream. The real values are put back
                automatically wherever the run uses them again — there is no restore step to add.
            </div>
        </div>
    );

    return (
        <StepNodeBase
            icon={<VenetianMask size={14} />}
            typeLabel={nodeTypeLabel('tokenize')}
            help={nodeHelp('tokenize')}
            body={body}
            hoverDetail={hoverDetail}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
