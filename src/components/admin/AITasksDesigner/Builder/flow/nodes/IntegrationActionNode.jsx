import React from 'react';
import { Wrench, Zap } from 'lucide-react';
import StepNodeBase, { NodeChip, renderInputsPreview } from './StepNodeBase';

/**
 * Side-effect detection mirrors server/automation/sideEffectMap.js — we
 * keep a small client mirror because the catalog API doesn't always
 * include the boolean. Names are stable; this list only needs an update
 * when a new write tool ships and we want the ⚡ pill to flag it.
 */
const KNOWN_SIDE_EFFECT_PREFIXES = [
    '_send', '_compose', '_create', '_update', '_delete', '_post',
    '_add', '_remove', '_move', '_share', '_set', '_reply', '_forward',
    '_attach', '_write',
];
function looksLikeSideEffect(toolName) {
    if (!toolName) return false;
    return KNOWN_SIDE_EFFECT_PREFIXES.some(suffix => toolName.includes(suffix));
}

export default function IntegrationActionNode({ data }) {
    const { step, runStep, issues } = data;
    const tool = step.tool || 'unknown_tool';
    const sideEffect = step.sideEffect ?? looksLikeSideEffect(tool);

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || tool}</div>
            <div className="mt-0.5 font-mono text-[10px] text-[var(--text-tertiary)] truncate">{tool}</div>
        </div>
    );

    const badges = sideEffect ? (
        <NodeChip tone="warn" title="This step writes/sends — runs are skipped in dry-run.">
            <Zap size={10} />
        </NodeChip>
    ) : null;

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{step.label || tool}</div>
            <div className="text-[var(--text-secondary)]">tool: <span className="font-mono">{tool}</span></div>
            {sideEffect && <div className="mt-0.5 text-amber-600 dark:text-amber-400">⚡ Side effect — synthesised in dry-run.</div>}
            {renderInputsPreview(step.inputs)}
            {runStep?.status && (
                <div className="mt-1 text-[var(--text-tertiary)]">last run: <span className="font-semibold">{runStep.status}</span></div>
            )}
        </div>
    );

    return (
        <StepNodeBase
            icon={<Wrench size={14} />}
            typeLabel="Integration"
            body={body}
            badges={badges}
            hoverDetail={hoverDetail}
            runStep={runStep}
            issues={issues}
        />
    );
}
