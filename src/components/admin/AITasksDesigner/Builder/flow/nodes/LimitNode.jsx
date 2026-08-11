import React from 'react';
import { ChevronsDown } from 'lucide-react';
import StepNodeBase from './StepNodeBase';
import NodeSummaryLine from './NodeSummaryLine';
import { limitSummary } from '../nodeSummaries';
import { nodeDefaultLabel, nodeHelp, nodeTypeLabel } from '../nodeDefs';

export default function LimitNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || nodeDefaultLabel('limit')}</div>
            <NodeSummaryLine summary={limitSummary(step, { stepLabelById })} title={step.arrayRef} />
        </div>
    );
    return (
        <StepNodeBase
            icon={<ChevronsDown size={14} />}
            typeLabel={nodeTypeLabel('limit')}
            help={nodeHelp('limit')}
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
