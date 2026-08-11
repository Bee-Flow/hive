import React from 'react';
import { Split } from 'lucide-react';
import { nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase from './StepNodeBase';
import { ROUTE_STEP_NAME } from '../stepDisplayName';
import { describeRuleExpr } from '../displayHelpers';

export default function ConditionNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById } = data;
    const expr = step.expr || '';
    // Reads as a sentence ("Subject contains “isv”"), never a raw path.
    const friendlyExpr = describeRuleExpr(expr, stepLabelById);
    // Two connectable output ports — the true (`then`) and false (`else`)
    // branches the runtime routes on.
    const sourceHandles = [
        // Port LABELS speak the unified node's language ("did it match?");
        // the handle ids stay then/else — that's what the runtime routes on.
        { id: 'then', label: 'match', tone: 'then' },
        { id: 'else', label: 'otherwise', tone: 'else' },
    ];

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || ROUTE_STEP_NAME}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] line-clamp-2 break-words" title={expr}>
                {friendlyExpr || <span className="italic">no expression</span>}
            </div>
        </div>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{step.label || ROUTE_STEP_NAME}</div>
            <div>Continues when: <span className="font-mono">{expr}</span></div>
            <div className="mt-1 text-[var(--text-tertiary)]">
                Leaves by <span className="font-semibold text-emerald-600 dark:text-emerald-400">match</span> or <span className="font-semibold text-amber-600 dark:text-amber-400">otherwise</span>.
            </div>
            {/* A fan-out run takes SEVERAL ports, and `branch` is deliberately just
                the first of them — reporting it alone would answer "where did this
                go?" with half the truth on exactly the nodes fan-out adds. An empty
                `branches` means nothing matched, and then `branch` (the default
                port) is the real answer. */}
            {(runStep?.output?.branches?.length || runStep?.output?.branch) && (
                <div className="mt-1 text-[var(--text-secondary)]">
                    last run took: <span className="font-semibold">
                        {runStep.output.branches?.length
                            ? runStep.output.branches.join(', ')
                            : runStep.output.branch}
                    </span>
                </div>
            )}
        </div>
    );

    return (
        <StepNodeBase
            icon={<Split size={14} />}
            typeLabel={nodeTypeLabel('condition')}
            help={nodeHelp('condition')}
            body={body}
            hoverDetail={hoverDetail}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
            sourceHandles={sourceHandles}
        />
    );
}
