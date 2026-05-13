import React from 'react';
import { Bell } from 'lucide-react';
import StepNodeBase, { NodeChip } from './StepNodeBase';
import { humanizeExpression } from '../displayHelpers';

export default function NotificationNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const channels = Array.isArray(step.channels) ? step.channels : ['notification'];
    const title = step.title || '';
    const bodyText = step.body || '';
    const friendlyTitle = humanizeExpression(title, stepLabelById);
    const friendlyBody = humanizeExpression(bodyText, stepLabelById);

    const body = (
        <div>
            <div className="font-semibold truncate" title={title}>
                {friendlyTitle || step.label || 'Notification'}
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
            {channels.slice(0, 3).map(c => <NodeChip key={c}>{c}</NodeChip>)}
        </>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{step.label || 'Notification'}</div>
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
            typeLabel="Notification"
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
