import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { nodeDefaultLabel, nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase from './StepNodeBase';
import { humanizeExpression } from '../displayHelpers';

/**
 * The guard step on the canvas — "does this contain personal data?".
 *
 * Two output ports, the same then/else the runtime routes on, but named for
 * what this step actually decided. A guard whose ports read "match" /
 * "otherwise" tells a reader nothing about which line carries the alert.
 */
export default function GuardNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const source = humanizeExpression(step.sourceRef || '', stepLabelById);
    const cats = Array.isArray(step.categories) && step.categories.length ? step.categories : null;
    const onFound = step.onFound || {};

    const sourceHandles = [
        { id: 'then', label: 'personal data', tone: 'else' },
        { id: 'else', label: 'clean', tone: 'then' },
    ];

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || nodeDefaultLabel('guard')}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] truncate" title={step.sourceRef}>
                {source || <span className="italic">nothing to scan yet</span>}
            </div>
            {(onFound.stop || onFound.mask) && (
                <div className="mt-0.5 text-[10px] text-[var(--text-tertiary)] truncate">
                    {[onFound.stop ? 'stops the run' : null, onFound.mask ? 'masks a copy' : null].filter(Boolean).join(' · ')}
                </div>
            )}
        </div>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{step.label || nodeDefaultLabel('guard')}</div>
            <div>Scans: <span className="font-mono">{step.sourceRef || '—'}</span></div>
            <div className="mt-1">
                Looking for: {cats ? cats.join(', ') : 'everything the Privacy Shield looks for'}
            </div>
            <div className="mt-1 text-[var(--text-tertiary)]">
                Leaves by <span className="font-semibold text-amber-600 dark:text-amber-400">personal data</span> or <span className="font-semibold text-emerald-600 dark:text-emerald-400">clean</span>.
            </div>
            {runStep?.output && (
                <div className="mt-1 text-[var(--text-secondary)]">
                    {/* "found nothing" and "could not look" are different
                        answers, and the node says which one it was. */}
                    last run: {runStep.output.degraded
                        ? <span className="font-semibold text-amber-600 dark:text-amber-400">could not scan ({runStep.output.degradedReason})</span>
                        : <span className="font-semibold">{runStep.output.count || 0} found</span>}
                </div>
            )}
        </div>
    );

    return (
        <StepNodeBase
            icon={<ShieldAlert size={14} />}
            typeLabel={nodeTypeLabel('guard')}
            help={nodeHelp('guard')}
            body={body}
            hoverDetail={hoverDetail}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
            sourceHandles={sourceHandles}
        />
    );
}
