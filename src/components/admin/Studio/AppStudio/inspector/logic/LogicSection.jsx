import React from 'react';
import ComputedPropsEditor from './ComputedPropsEditor';
import StudioScopeProvider from './StudioScopeProvider';
import ValidationRuleEditor from './ValidationRuleEditor';
import VisibilityControls from './VisibilityControls';
import { getComponentEntry } from '../../runtime/componentRegistry';
import { setNodeComputed, updateNodeLogic } from '../../state/definitionOps';

/**
 * LogicSection — the inspector's "Logic" accordion body for a component node.
 * Surfaces the v2 node-level logic the schema (and the AI builder) already
 * support but had no manual editor for:
 *
 *   • Visibility & enablement — visible / visibleWhen / enabledWhen
 *   • Validation rules        — node.validations (input components only)
 *   • Computed values         — node.computed { propKey: formula }
 *
 * Every child emits a change that becomes a definitionOps write + onCommit —
 * the same single-authority flow the Content/Style/Actions sections use. One
 * StudioScopeProvider wraps all three so their formula fields share the Studio
 * variable scope (currentUser / form / screen.params / actions / datasets).
 */
export default function LogicSection({ node, definition, onCommit, disabled = false }) {
    if (!node) return null;
    const isInput = !!getComponentEntry(node.type)?.isInput;

    const commitLogic = (patch) => {
        const next = updateNodeLogic(definition, node.id, patch);
        if (next !== definition) onCommit(next);
    };
    const commitComputed = (computed) => {
        const next = setNodeComputed(definition, node.id, computed);
        if (next !== definition) onCommit(next);
    };

    return (
        <StudioScopeProvider definition={definition} node={node}>
            <div className="flex flex-col gap-4">
                <VisibilityControls
                    node={node}
                    definition={definition}
                    onChange={commitLogic}
                    disabled={disabled}
                />

                {isInput ? (
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                            Validation
                        </span>
                        <ValidationRuleEditor
                            value={node.validations}
                            onChange={(rules) => commitLogic({ validations: rules })}
                            definition={definition}
                            node={node}
                            disabled={disabled}
                        />
                    </div>
                ) : null}

                <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                        Computed values
                    </span>
                    <ComputedPropsEditor
                        node={node}
                        value={node.computed}
                        onChange={commitComputed}
                        definition={definition}
                        disabled={disabled}
                    />
                </div>
            </div>
        </StudioScopeProvider>
    );
}
