import React, { useState } from 'react';
import DiagramPane from './DiagramPane';
import OutputView from './OutputView';
import { tokenFor } from '../../../shared/statusTokens';

/**
 * Read-only execution view for ONE run, shared by the in-automation Run
 * history tab and the cross-automation History drawer so both show the
 * identical overview/detail.
 *
 * Renders the run's flow diagram (each node coloured by its recorded status)
 * and a click-to-inspect panel below it that shows the selected step's
 * recorded Input and Output with the SAME friendly Table/JSON OutputView the
 * Build editor uses — so the data reads the same everywhere.
 *
 * The caller should pass a `key` of the run id so switching runs remounts
 * this view (the diagram re-fits and the open step resets).
 *
 * Props:
 *   definition  — the run-time definition snapshot (render THIS, not the
 *                 current definition, so the graph shows what actually ran)
 *   steps       — run step records:
 *                 [{ stepId, stepType, status, input, output, error, errorRemediation, durationMs }]
 *   emptyDefinitionMessage — text shown when no definition snapshot exists
 */
export default function RunExecutionView({
    definition,
    steps = [],
    emptyDefinitionMessage = 'Definition unavailable for this run.',
}) {
    const [selectedStepId, setSelectedStepId] = useState(null);
    const selectedStepRecord = selectedStepId
        ? steps.find(s => s.stepId === selectedStepId) || null
        : null;

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 relative">
                {definition ? (
                    <DiagramPane
                        definition={definition}
                        runSteps={steps}
                        onNodeClick={setSelectedStepId}
                        readOnly
                    />
                ) : (
                    <div className="p-4 text-xs text-[var(--text-tertiary)]">{emptyDefinitionMessage}</div>
                )}
            </div>
            {selectedStepRecord && (
                <StepDataPanel record={selectedStepRecord} onClose={() => setSelectedStepId(null)} />
            )}
        </div>
    );
}

/**
 * Bottom panel for the clicked step: a status/identity strip, any error, and
 * the recorded Input + Output side by side as friendly OutputViews.
 */
function StepDataPanel({ record, onClose }) {
    return (
        <div className="flex-shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-secondary)] max-h-[45%] overflow-y-auto p-3">
            <div className="flex items-center gap-2 text-xs mb-2">
                <StatusIcon status={record.status} />
                <code className="font-mono text-[var(--text-primary)]">{record.stepId}</code>
                {record.stepType && <span className="text-[var(--text-tertiary)]">({record.stepType})</span>}
                <button
                    onClick={onClose}
                    className="ml-auto text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                    Close
                </button>
            </div>
            {record.error && (
                <div className="text-xs text-red-600 dark:text-red-400 mb-2">{record.error}</div>
            )}
            {record.errorRemediation && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mb-2">→ {record.errorRemediation}</div>
            )}
            {/* Same friendly Table/JSON view as the Build editor's node Run tab. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Input</div>
                    <OutputView value={record.input ?? null} emptyMessage="No input recorded." />
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Output</div>
                    <OutputView
                        value={record.output ?? null}
                        basePath={`steps.${record.stepId}.output`}
                        emptyMessage="No output recorded."
                    />
                </div>
            </div>
        </div>
    );
}

function StatusIcon({ status }) {
    // Use the canonical status token table (single source of truth) so every
    // state — incl. awaiting_approval / cancelled / queued / handled_error —
    // gets its correct icon + colour, instead of falling through to a neutral
    // gray Play icon that made distinct states look identical.
    const t = tokenFor(status);
    const Icon = t.icon;
    return <Icon size={12} className={`${t.solid}${t.spin ? ' animate-spin' : ''}`} />;
}
