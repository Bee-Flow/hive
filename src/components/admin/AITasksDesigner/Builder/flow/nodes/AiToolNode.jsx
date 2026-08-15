import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Hammer, X } from 'lucide-react';
import IntegrationLogo from './IntegrationLogo';

/**
 * One tool hanging under an AI step — the canvas half of `ai_step.tools`.
 *
 * Deliberately NOT a StepNodeBase card: it is not a step, it never runs on its
 * own, and giving it the same chrome (run ▶, duplicate, the left/right flow
 * handles) would promise four things that cannot happen. It is a small chip
 * with one input handle at the top, hanging off the parent's tool port.
 *
 * Its "×" removes the tool from the parent's allowlist. See flow/aiToolNodes.js
 * for why none of this is ever written to definition.steps/edges.
 */
export default function AiToolNode({ data }) {
    const [hovered, setHovered] = useState(false);
    const { label, description, integrationId, tool, all, onDetach, stepId } = data || {};

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            title={description || label}
            className={`group relative w-[168px] rounded-full border px-2.5 py-1.5 flex items-center gap-2 shadow-sm transition-shadow ${
                all
                    ? 'border-dashed border-[var(--border-default)] bg-[var(--bg-secondary)]'
                    : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:shadow-md'
            }`}
        >
            {/* Top-centre input: the only place the parent's tool port lands. */}
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={false}
                className="!w-2 !h-2 !rounded-full !border !border-[var(--text-tertiary)] !bg-[var(--bg-primary)] !opacity-60"
                style={{ top: -4 }}
            />
            <span className="shrink-0 h-5 w-5 rounded-md bg-[var(--bg-primary)] flex items-center justify-center">
                {all
                    ? <Hammer size={12} className="text-[var(--text-tertiary)]" />
                    : <IntegrationLogo integrationId={integrationId} tool={tool} size={13} fallback={<Hammer size={12} />} />}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-primary)]">{label}</span>
            {onDetach && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDetach(stepId, tool); }}
                    aria-label={`Remove ${label}`}
                    title="Take this tool away from the AI step"
                    className={`shrink-0 rounded-full p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-opacity ${
                        hovered ? 'opacity-100' : 'opacity-0'
                    }`}
                >
                    <X size={11} />
                </button>
            )}
        </div>
    );
}
