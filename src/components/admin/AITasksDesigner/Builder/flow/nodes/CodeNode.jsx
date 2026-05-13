import React from 'react';
import { Code2, Lock } from 'lucide-react';
import StepNodeBase, { NodeChip } from './StepNodeBase';

export default function CodeNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const code = step.code || '';
    const lineCount = code ? code.split('\n').length : 0;
    const hashShort = (step.codeHash || '').slice(0, 8);

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || 'Code step'}</div>
            <div className="mt-0.5 text-[var(--text-tertiary)]">
                {lineCount} line{lineCount === 1 ? '' : 's'}{hashShort && <> · <span className="font-mono">{hashShort}</span></>}
            </div>
        </div>
    );

    const badges = (
        <NodeChip title="Sandboxed isolated-vm — no Node bindings, HTTPS-only fetch.">
            <Lock size={10} />
        </NodeChip>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{step.label || 'Code step'}</div>
            <div className="text-[var(--text-secondary)]">JavaScript, sandboxed in isolated-vm.</div>
            <div>{lineCount} lines{hashShort && <> · sha256:<span className="font-mono">{hashShort}</span></>}</div>
            {Array.isArray(step.allowedTools) && step.allowedTools.length > 0 && (
                <div className="mt-1">allowed tools: <span className="font-mono">{step.allowedTools.slice(0, 3).join(', ')}{step.allowedTools.length > 3 ? '…' : ''}</span></div>
            )}
        </div>
    );

    return (
        <StepNodeBase
            icon={<Code2 size={14} />}
            typeLabel="Code"
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
