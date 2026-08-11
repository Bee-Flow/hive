import { Eye } from 'lucide-react';
import React from 'react';
import FormulaField from './FormulaField';
import StudioScopeProvider from './StudioScopeProvider';
import Toggle from '../../../../../shared/Toggle';

/**
 * VisibilityControls — the "Logic" inspector block for a node's visibility and
 * enablement. Emits partial-patch changes ({ visible?, visibleWhen?,
 * enabledWhen? }); the panel wrapper maps them onto the node via definitionOps.
 *
 *   - Visible toggle → node.visible (boolean). Off hides the node in run mode.
 *   - "Only show when" → node.visibleWhen (formula). Empty clears it.
 *   - "Enabled when"   → node.enabledWhen (formula). Empty clears it.
 *
 * Both flags must reach the server as a boolean or { kind:'formula', expr }
 * (canonicalize.js cleanBoolOrFormula, authoritative) — a bare expression
 * string is DROPPED on save, so the rule would silently never exist.
 *
 * Both formula fields share the Studio scope (StudioScopeProvider) so their
 * variable pickers and live-eval work.
 */

/** The expression behind a boolean|formula flag (legacy bare strings included). */
function exprOf(flag) {
    if (typeof flag === 'string') return flag;
    if (flag && typeof flag === 'object') return flag.expr || '';
    return '';
}

/** Blank clears the key upstream (definitionOps.updateNodeLogic drops null). */
function formulaOrNull(expr) {
    return expr.trim() ? { kind: 'formula', expr } : null;
}

export default function VisibilityControls({ node, definition = null, onChange, disabled = false }) {
    const visible = node?.visible !== false;
    const emit = (patch) => onChange?.(patch);

    return (
        <StudioScopeProvider definition={definition} node={node}>
            <div className="flex flex-col gap-3">
                <Toggle
                    label={(
                        <span className="inline-flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> Visible
                        </span>
                    )}
                    description="Hide this component from the running app."
                    checked={visible}
                    onChange={(next) => emit({ visible: next })}
                    disabled={disabled}
                    size="sm"
                />

                <div className="flex flex-col gap-1.5">
                    <FormulaField
                        label="Only show when"
                        value={exprOf(node?.visibleWhen)}
                        onChange={(expr) => emit({ visibleWhen: formulaOrNull(expr) })}
                        definition={definition}
                        node={node}
                        placeholder="e.g. form.priority == 'high'"
                        expectsBoolean
                        ariaLabel="Only show when"
                        disabled={disabled}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <FormulaField
                        label="Enabled when"
                        value={exprOf(node?.enabledWhen)}
                        onChange={(expr) => emit({ enabledWhen: formulaOrNull(expr) })}
                        definition={definition}
                        node={node}
                        placeholder="e.g. form.agree == true"
                        expectsBoolean
                        ariaLabel="Enabled when"
                        disabled={disabled}
                    />
                </div>
            </div>
        </StudioScopeProvider>
    );
}
