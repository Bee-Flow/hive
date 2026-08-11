import React from 'react';
import { Sigma } from 'lucide-react';
import StepNodeBase from './StepNodeBase';
import NodeSummaryLine from './NodeSummaryLine';
import { summarizeSummary } from '../nodeSummaries';
import { nodeDefaultLabel, nodeHelp, nodeTypeLabel } from '../nodeDefs';

export default function SummarizeNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || nodeDefaultLabel('summarize')}</div>
            <NodeSummaryLine summary={summarizeSummary(step, { stepLabelById })} title={step.arrayRef} />
        </div>
    );
    return (
        <StepNodeBase
            icon={<Sigma size={14} />}
            typeLabel={nodeTypeLabel('summarize')}
            help={nodeHelp('summarize')}
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
