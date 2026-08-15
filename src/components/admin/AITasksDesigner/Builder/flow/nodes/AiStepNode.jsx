import React from 'react';
import { Sparkles, Hammer } from 'lucide-react';
import { nodeHelp, nodeTypeLabel } from '../nodeDefs';
import { TOOL_HANDLE_ID, toolStateOf } from '../aiToolNodes';
import StepNodeBase, { NodeChip, renderInputsPreview, ForEachBadge } from './StepNodeBase';

export default function AiStepNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, toolPortActive = false } = data;
    const tier = step.modelTier || 'auto';
    const allowTools = !!step.allowTools;
    const toolCount = Array.isArray(step.tools) ? step.tools.length : 0;
    const toolState = toolStateOf(step);

    // First two lines of the prompt for the inline body.
    const promptPreview = (step.prompt || '')
        .split('\n')
        .filter(Boolean)
        .slice(0, 2)
        .join(' ');

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'AI step'}</div>
            <div className="mt-0.5 text-[var(--text-secondary)] line-clamp-2">{promptPreview || <span className="italic">no prompt yet</span>}</div>
        </div>
    );

    const badges = (
        <>
            <ForEachBadge step={step} />
            <NodeChip tone="accent" title={`Model tier: ${tier}`}>{tier}</NodeChip>
            {allowTools && (
                <NodeChip tone="warn" title={`Can call ${toolCount || 'all permitted'} tool(s)`}>
                    <Hammer size={10} />{toolCount ? toolCount : ''}
                </NodeChip>
            )}
        </>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{step.label || 'AI step'}</div>
            <div className="whitespace-pre-wrap text-[var(--text-secondary)]">{(step.prompt || '').slice(0, 280)}</div>
            <div className="mt-1 flex items-center gap-1 flex-wrap">
                <NodeChip tone="accent">tier: {tier}</NodeChip>
                {allowTools && <NodeChip tone="warn">tools: {toolCount || 'all'}</NodeChip>}
                {step.outputSchema && <NodeChip>structured output</NodeChip>}
            </div>
            {renderInputsPreview(step.inputs)}
        </div>
    );

    return (
        <StepNodeBase
            icon={<Sparkles size={14} />}
            typeLabel={nodeTypeLabel('ai_step')}
            help={nodeHelp('ai_step')}
            body={body}
            badges={badges}
            hoverDetail={hoverDetail}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
            // The tools port. An AI step is the one node whose capabilities are
            // configuration rather than flow, so it gets a second output that
            // says so — and accepts an app dragged straight from the ribbon.
            bottomPort={{
                handleId: TOOL_HANDLE_ID,
                label: toolState.mode === 'none' ? 'Drop an app here to give it a tool' : 'Tools',
                hint: 'Drag an app from the ribbon onto this port to let the AI use it.',
                active: toolPortActive,
            }}
        />
    );
}
