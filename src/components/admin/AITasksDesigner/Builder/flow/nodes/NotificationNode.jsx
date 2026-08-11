import React from 'react';
import { Bell } from 'lucide-react';
import { nodeDefaultLabel, nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase, { NodeChip, ForEachBadge } from './StepNodeBase';
import { humanizeExpression } from '../displayHelpers';
import { CHANNEL_LABELS } from '../../notificationDefaults';

export default function NotificationNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    // The chip used to read the raw key — a node whose only badge said
    // "notification" told the author nothing about where the message lands
    // (BFSF-350).
    const channels = (Array.isArray(step.channels) && step.channels.length ? step.channels : ['notification'])
        .map(c => CHANNEL_LABELS[c] || c);
    const title = step.title || '';
    const bodyText = step.body || '';
    const friendlyTitle = humanizeExpression(title, stepLabelById);
    const friendlyBody = humanizeExpression(bodyText, stepLabelById);

    const body = (
        <div>
            <div className="font-semibold truncate" title={title}>
                {friendlyTitle || step.label || nodeDefaultLabel('notification')}
            </div>
            {bodyText && (
                <div className="mt-0.5 text-[var(--text-secondary)] line-clamp-2" title={bodyText}>
                    {friendlyBody}
                </div>
            )}
        </div>
    );

    const badges = (
        <>
            <ForEachBadge step={step} />
            {channels.slice(0, 3).map(c => <NodeChip key={c}>{c}</NodeChip>)}
        </>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{step.label || nodeDefaultLabel('notification')}</div>
            {title && <div className="font-semibold">{title}</div>}
            {bodyText && <div className="mt-0.5 whitespace-pre-wrap text-[var(--text-secondary)]">{bodyText.slice(0, 280)}</div>}
            <div className="mt-1 flex items-center gap-1 flex-wrap">
                {channels.map(c => <NodeChip key={c}>{c}</NodeChip>)}
            </div>
        </div>
    );

    return (
        <StepNodeBase
            icon={<Bell size={14} />}
            typeLabel={nodeTypeLabel('notification')}
            help={nodeHelp('notification')}
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
