import React from 'react';
import { Copy } from 'lucide-react';
import StepNodeBase from './StepNodeBase';
import NodeSummaryLine from './NodeSummaryLine';
import { dedupeSummary } from '../nodeSummaries';
import { nodeDefaultLabel, nodeHelp, nodeTypeLabel } from '../nodeDefs';

export default function DedupeNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || nodeDefaultLabel('dedupe')}</div>
            <NodeSummaryLine summary={dedupeSummary(step, { stepLabelById })} title={step.arrayRef} />
        </div>
    );
    return (
        <StepNodeBase
            icon={<Copy size={14} />}
            typeLabel={nodeTypeLabel('dedupe')}
            help={nodeHelp('dedupe')}
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
