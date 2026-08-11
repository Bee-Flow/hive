import React from 'react';
import { ClipboardList, CheckCircle2, Clock } from 'lucide-react';
import { nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase, { NodeChip } from './StepNodeBase';

/** 900 → "15 min", 3600 → "1 hour", 604800 → "7 days". */
function humanWait(seconds) {
    const s = Number(seconds) || 3600;
    if (s < 3600) return `${Math.round(s / 60)} min`;
    if (s < 86400) return `${Math.round(s / 3600)} hour${s >= 7200 ? 's' : ''}`;
    return `${Math.round(s / 86400)} day${s >= 172800 ? 's' : ''}`;
}

/**
 * A further page of the routine's public form, shown on the SAME /f/<token>
 * URL the visitor is already on.
 *
 *   input  — the run PAUSES here until the visitor answers. Worth showing the
 *            wait window on the canvas: it is the only step whose duration is
 *            bounded by a person rather than by the routine.
 *   ending — the closing page (typically a summary). It does not pause.
 */
export default function FormPageNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const isEnding = step.mode === 'ending';
    const fields = Array.isArray(step.form?.fields) ? step.form.fields : [];
    const title = step.form?.title || (isEnding ? 'All done' : 'Form page');

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || (isEnding ? 'Closing page' : 'Ask for more info')}</div>
            <div className="mt-0.5 text-[var(--text-tertiary)] truncate">
                {isEnding ? title : `${title} · ${fields.length} question${fields.length === 1 ? '' : 's'}`}
            </div>
        </div>
    );

    const badges = isEnding ? null : (
        <NodeChip title={`The routine waits up to ${humanWait(step.waitSeconds)} for the visitor to answer.`}>
            <Clock size={10} />
        </NodeChip>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{title}</div>
            {isEnding ? (
                <div>Shown to the visitor when the routine finishes. It does not wait.</div>
            ) : (
                <>
                    <div>Asks {fields.length} question{fields.length === 1 ? '' : 's'} on the form&apos;s own URL.</div>
                    <div className="text-[var(--text-secondary)] mt-1">
                        The run pauses here for up to {humanWait(step.waitSeconds)}.
                    </div>
                </>
            )}
        </div>
    );

    return (
        <StepNodeBase
            icon={isEnding ? <CheckCircle2 size={14} /> : <ClipboardList size={14} />}
            typeLabel={nodeTypeLabel('form_page')}
            help={nodeHelp('form_page')}
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
