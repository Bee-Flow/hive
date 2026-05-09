import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { buildLayout } from './flow/layout';
import { edgeTypes } from './flow/edges';
import { buildIssuesByStep } from './flow/matchValidationToStep';

import TriggerNode from './flow/nodes/TriggerNode';
import IntegrationActionNode from './flow/nodes/IntegrationActionNode';
import AiStepNode from './flow/nodes/AiStepNode';
import ConditionNode from './flow/nodes/ConditionNode';
import LoopNode from './flow/nodes/LoopNode';
import CodeNode from './flow/nodes/CodeNode';
import NotificationNode from './flow/nodes/NotificationNode';

/**
 * Interactive flow diagram for the automation builder.
 *
 * Renders the draft definition as a `@xyflow/react` graph with auto-layout
 * by dagre. Each node is a typed card that surfaces the fields that matter
 * for that step type and reflects:
 *   - run status (left bar pulses while running, snaps green/red on done)
 *   - validation (red/amber badge bottom-right when this step has issues)
 *   - hover popover (label, key fields, last-output preview)
 *
 * Click anywhere on a node bubbles up to `onNodeClick(stepId)` so the
 * existing StepInspector keeps opening exactly as before.
 *
 * Replaces the previous Mermaid-rendered SVG.
 */
const NODE_TYPES = {
    trigger:            TriggerNode,
    integration_action: IntegrationActionNode,
    ai_step:            AiStepNode,
    condition:          ConditionNode,
    loop:               LoopNode,
    code:               CodeNode,
    notification:       NotificationNode,
};

export default function DiagramPane({ definition, runSteps = [], onNodeClick, validation = null, readOnly = false }) {
    // Build look-up maps once per change so layout work is amortised.
    const runByStep = useMemo(() => {
        const m = new Map();
        for (const r of (runSteps || [])) if (r?.stepId) m.set(r.stepId, r);
        return m;
    }, [runSteps]);

    const issuesByStep = useMemo(
        () => buildIssuesByStep(validation, definition),
        [validation, definition],
    );

    const { nodes, edges } = useMemo(
        () => buildLayout(definition, { runByStep, issuesByStep }),
        [definition, runByStep, issuesByStep],
    );

    if (!definition || !definition.trigger) {
        return (
            <div className="p-4 text-xs text-[var(--text-tertiary)] italic">
                (empty draft) — describe what you want and the builder will assemble the graph.
            </div>
        );
    }

    return (
        // ReactFlow needs the container to have a real, measurable height.
        // Inside the new BuilderShell the parent uses `flex-1 min-h-0`, so
        // a `h-full` here resolves to whatever vertical space is left in
        // the Build tab — exactly what we want so the diagram fills as
        // much of the screen as the chat / summary / dry-run panels free
        // up. Falls back to a sensible minimum when used outside that
        // flex context.
        <div className="w-full h-full" style={{ minHeight: 320 }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={NODE_TYPES}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.18 }}
                panOnDrag={!readOnly}
                zoomOnScroll={!readOnly}
                zoomOnPinch={!readOnly}
                zoomOnDoubleClick={!readOnly}
                proOptions={{ hideAttribution: true }}
                onNodeClick={readOnly ? undefined : ((_evt, node) => onNodeClick?.(node.id))}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={!readOnly}
            >
                <Background gap={16} size={1} color="var(--border-default)" />
                <Controls showInteractive={false} />
                <MiniMap
                    pannable
                    zoomable
                    nodeColor={(n) => {
                        const status = n.data?.runStep?.status;
                        if (status === 'success') return '#10b981';
                        if (status === 'error')   return '#ef4444';
                        if (status === 'running') return 'var(--accent)';
                        return 'var(--bg-tertiary, rgba(0,0,0,0.1))';
                    }}
                    maskColor="rgba(0,0,0,0.04)"
                />
            </ReactFlow>
        </div>
    );
}
