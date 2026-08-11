import React from 'react';
import { Split } from 'lucide-react';
import { nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase from './StepNodeBase';
import { ROUTE_STEP_NAME } from '../stepDisplayName';
import { humanizeExpression } from '../displayHelpers';

export default function SwitchNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const cases = Array.isArray(step.cases) ? step.cases : [];
    // In list mode the step works through `arrayRef` and each rule decides per
    // row; otherwise it matches the step-level expression. One of the two is
    // always the meaningful subtitle.
    const listMode = typeof step.arrayRef === 'string';
    const friendlyExpr = humanizeExpression((listMode ? step.arrayRef : step.expr) || '', stepLabelById);
    // One connectable output port per case, plus a catch-all "default" port
    // (the `case:default` edge fires when no case matches and no defaultBranch
    // redirects). Ports map 1:1 to the edge labels the runtime routes on.
    const sourceHandles = [
        ...cases
            .filter((c) => c && typeof c.name === 'string' && c.name)
            .map((c) => ({ id: `case:${c.name}`, label: c.name, tone: 'case' })),
        { id: 'case:default', label: 'otherwise', tone: 'default' },
    ];
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || ROUTE_STEP_NAME}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] truncate" title={listMode ? step.arrayRef : step.expr}>
                {friendlyExpr || <span className="italic">{listMode ? 'no source list' : 'no expression'}</span>}
            </div>
            <div className="mt-0.5 text-[10px] text-[var(--text-tertiary)] truncate">
                {cases.length === 0 ? 'no rules' : `${cases.length} rule${cases.length === 1 ? '' : 's'}${step.defaultBranch ? ' + otherwise' : ''}`}
            </div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<Split size={14} />}
            typeLabel={nodeTypeLabel('switch')}
            help={nodeHelp('switch')}
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
            sourceHandles={sourceHandles}
        />
    );
}
