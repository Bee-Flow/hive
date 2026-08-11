import React from 'react';
import { Globe, ShieldAlert } from 'lucide-react';
import { nodeDefaultLabel, nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase, { NodeChip, ForEachBadge } from './StepNodeBase';

export default function HttpRequestNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const method = (step.method || 'GET').toUpperCase();
    const url = step.url || '(no URL set)';
    // blockPrivateTargets defaults true — only show the badge when the
    // user has explicitly opted OUT of the SSRF guard, since that's the
    // security-relevant state worth flagging on the canvas.
    const privateTargetsAllowed = step.blockPrivateTargets === false;

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || nodeDefaultLabel('http_request')}</div>
            <div className="mt-0.5 text-[var(--text-tertiary)] truncate">
                <span className="font-mono">{method}</span> {url}
            </div>
        </div>
    );

    const badges = (
        <>
            <ForEachBadge step={step} />
            {privateTargetsAllowed && (
                <NodeChip title="Private/internal-address blocking is turned OFF for this step — it can reach localhost, private-network, and cloud-metadata targets.">
                    <ShieldAlert size={10} />
                </NodeChip>
            )}
        </>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{step.label || nodeDefaultLabel('http_request')}</div>
            <div><span className="font-mono">{method}</span> {url}</div>
            {step.timeoutMs && <div>timeout: {step.timeoutMs}ms</div>}
            <div className="text-[var(--text-secondary)] mt-1">
                {privateTargetsAllowed
                    ? 'Private/internal addresses ALLOWED (security toggle off).'
                    : 'Private/internal addresses blocked (default).'}
            </div>
        </div>
    );

    return (
        <StepNodeBase
            icon={<Globe size={14} />}
            typeLabel={nodeTypeLabel('http_request')}
            help={nodeHelp('http_request')}
            body={body}
            badges={badges}
            hoverDetail={hoverDetail}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
