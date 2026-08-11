import React from 'react';
import { Eye } from 'lucide-react';
import { nodeDefaultLabel, nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase from './StepNodeBase';
import { humanizeExpression } from '../displayHelpers';

/**
 * "Show real values again".
 *
 * The counterpart to Hide personal data, for the values the runner does not
 * restore on its own — anything that never came back through an AI reply, a
 * tool result or an HTTP response.
 *
 * The node reports what it could NOT resolve, because that is the failure worth
 * seeing: a leftover `[person_5]` reads as ordinary text and travels onward
 * looking deliberate.
 */
export default function UntokenizeNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const source = humanizeExpression(step.sourceRef || '', stepLabelById);
    const out = runStep?.output;

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || nodeDefaultLabel('untokenize')}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] truncate" title={step.sourceRef}>
                {source || <span className="italic">nothing to restore yet</span>}
            </div>
            {out && (
                <div className={`mt-0.5 text-[10px] ${out.unresolved ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--text-tertiary)]'}`}>
                    {out.unresolved
                        ? `${out.restored} back · ${out.unresolved} could not be resolved`
                        : `${out.restored || 0} put back`}
                </div>
            )}
        </div>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{step.label || nodeDefaultLabel('untokenize')}</div>
            <div>Restores in: <span className="font-mono">{step.sourceRef || '—'}</span></div>
            <div className="mt-1 text-[var(--text-tertiary)]">
                Reads <span className="font-mono">output.text</span> / <span className="font-mono">output.value</span>.
                Only needed where a value did not already come back on its own.
            </div>
            {out?.unresolved ? (
                <div className="mt-1 text-amber-600 dark:text-amber-400">
                    {out.unresolved} placeholder{out.unresolved === 1 ? '' : 's'} this run cannot account for
                    {out.unresolvedTokens?.length ? `: ${out.unresolvedTokens.slice(0, 3).join(', ')}` : ''}
                </div>
            ) : null}
        </div>
    );

    return (
        <StepNodeBase
            icon={<Eye size={14} />}
            typeLabel={nodeTypeLabel('untokenize')}
            help={nodeHelp('untokenize')}
            body={body}
            hoverDetail={hoverDetail}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
