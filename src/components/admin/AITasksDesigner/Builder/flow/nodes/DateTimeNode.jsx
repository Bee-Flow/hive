import React from 'react';
import { Clock } from 'lucide-react';
import StepNodeBase from './StepNodeBase';
import NodeSummaryLine from './NodeSummaryLine';
import { dateTimeSummary } from '../nodeSummaries';
import { nodeDefaultLabel, nodeHelp, nodeTypeLabel } from '../nodeDefs';

export default function DateTimeNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    // Used to print the raw op key in monospace — `addDays`, `diff`, `extract`.
    // The editor never shows those words, so the card named the operation in a
    // vocabulary the user had no way to have learned.
    return (
        <StepNodeBase
            icon={<Clock size={14} />}
            typeLabel={nodeTypeLabel('datetime')}
            help={nodeHelp('datetime')}
            body={(
                <div>
                    <div className="font-semibold truncate">{step.label || nodeDefaultLabel('datetime')}</div>
                    <NodeSummaryLine summary={dateTimeSummary(step)} />
                </div>
            )}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
