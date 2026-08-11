import React from 'react';
import { OctagonX } from 'lucide-react';
import { nodeDefaultLabel, nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase from './StepNodeBase';

export default function StopErrorNode({ id, data }) {
    const { step, runStep, issues } = data;
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || nodeDefaultLabel('stop_error')}</div>
            <div className="mt-0.5 text-[10px] text-red-600 dark:text-red-400 line-clamp-2">
                {step.message || <span className="italic text-[var(--text-tertiary)]">no message</span>}
            </div>
        </div>
    );
    // NOTHING ever runs after a Stop-and-Error — it halts the run by design.
    // The node therefore offers no "+ add next step" and no draggable source
    // port (B9): the canvas used to invite appending steps here, every one of
    // which was permanently dead with no warning. Legacy outgoing edges (from
    // JSON/AI authoring) still render and stay deletable — the handle remains
    // in the DOM, only new connections are refused.
    return (
        <StepNodeBase
            icon={<OctagonX size={14} />}
            typeLabel={nodeTypeLabel('stop_error')}
            help={nodeHelp('stop_error')}
            body={body}
            hoverDetail={(
                <div>
                    <div className="font-semibold mb-1">{step.label || nodeDefaultLabel('stop_error')}</div>
                    <div>Halts the run with this message. Nothing after this node ever runs.</div>
                </div>
            )}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            sourceConnectable={false}
        />
    );
}
