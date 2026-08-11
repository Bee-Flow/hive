import React from 'react';
import { Layers } from 'lucide-react';
import StepNodeBase from './StepNodeBase';
import NodeSummaryLine from './NodeSummaryLine';
import { aggregateSummary } from '../nodeSummaries';
import { nodeDefaultLabel, nodeHelp, nodeTypeLabel } from '../nodeDefs';

export default function AggregateNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || nodeDefaultLabel('aggregate')}</div>
            <NodeSummaryLine summary={aggregateSummary(step, { stepLabelById })} title={step.arrayRef} />
        </div>
    );
    return (
        <StepNodeBase
            icon={<Layers size={14} />}
            typeLabel={nodeTypeLabel('aggregate')}
            help={nodeHelp('aggregate')}
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
