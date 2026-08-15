import React from 'react';
import { resolveBinding } from '../resolveBinding';
import { rowKey, useRuntime } from '../RuntimeContext';
import { spaceSteps } from '../styleResolver';
import { EmptyText, SkeletonLines } from '../uiBits';

/**
 * App Studio runtime — 'repeater' (container). Spec: server/appStudio/componentSpecs.js.
 *
 * Repetition is done by AppRenderer's per-item scope mechanism — NOT a parallel
 * one. AppRenderer.renderChildren repeats a node's children once per item of its
 * `repeat`/`forEach` binding, threading a per-row scope `{ ...scope, item,
 * index, value:item }` into each child's RenderNode (that is where `item`/
 * `index` become available to child formulas/bindings). So when the repeater
 * node carries `forEach` (mirrored from props.source by the inspector), the
 * `children` this component receives are ALREADY flattened: items × childCount
 * elements, grouped per item in order. We simply:
 *   - resolve the same source binding for the empty-state and itemAction rows;
 *   - chunk the flattened children back into per-item groups (childCount each);
 *   - render each group on its own 12-column grid, with per-item action buttons.
 *
 * We do NOT modify AppRenderer. If a definition reaches us with only
 * props.source and no forEach (e.g. not yet mirrored), we still render one group
 * per item so the layout is right — but per-item `item` scope only resolves when
 * the renderer repeated (forEach present).
 */

export default function AppRepeater({ node, children }) {
    const { mode, runAction, actionState, dataState, scope } = useRuntime();
    const { itemActions = [], emptyText = 'Nothing to show yet.' } = node.props || {};

    // AppRenderer reads repeat/forEach; the repeater mirrors props.source there.
    // `scope` is the scope of the subtree we sit in (ScopeProvider), so a
    // repeater nested inside another one resolves `item.<field>` sources.
    const sourceBinding = node.repeat || node.forEach || node.props?.source;
    const { value, isLoading } = resolveBinding(sourceBinding, { actionState, dataState, scope });
    const items = Array.isArray(value) ? value : [];

    const childCount = Array.isArray(node.children) ? node.children.length : 0;
    const rendered = React.Children.toArray(children);

    if (isLoading) return <SkeletonLines lines={3} />;
    if (items.length === 0) return <EmptyText text={emptyText} />;

    // Flattened (renderer repeated via forEach) → chunk per item; otherwise
    // fall back to the single rendered subtree per item.
    const flattened = childCount > 0 && rendered.length === items.length * childCount;
    const gap = Number.isFinite(node.style?.gap) ? node.style.gap : 3;

    const groupFor = (i, row) => {
        const slice = flattened ? rendered.slice(i * childCount, (i + 1) * childCount) : rendered;
        return slice.map((el, j) => (React.isValidElement(el)
            ? React.cloneElement(el, { key: `${el.key ?? j}::${row}` })
            : el));
    };

    return (
        <div className="flex flex-col" style={{ gap: spaceSteps(gap) }} data-app-repeater="true">
            {items.map((item, i) => (
                <div key={rowKey(item, i)} className="app-repeater-item" data-app-repeater-item={i}>
                    <div
                        className="app-grid"
                        style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: spaceSteps(gap) }}
                    >
                        {groupFor(i, rowKey(item, i))}
                    </div>
                    {itemActions.length ? (
                        <div className="flex items-center gap-1.5 mt-1.5">
                            {itemActions.map((a, ai) => (
                                <button
                                    key={ai}
                                    type="button"
                                    onClick={() => { if (mode === 'run' && a.actionId) runAction(a.actionId, { formValues: item, item }); }}
                                    className="px-2 py-0.5 text-xs font-medium border"
                                    style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)', color: 'var(--text-secondary)' }}
                                >
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    );
}
