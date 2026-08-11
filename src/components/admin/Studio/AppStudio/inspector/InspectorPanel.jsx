import { Copy, Rows3, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import ActionsSection from './ActionsSection';
import LogicSection from './logic/LogicSection';
import StudioScopeProvider from './logic/StudioScopeProvider';
import MultiInspector from './MultiInspector';
import { getInspectorForType } from './registry';
import { TYPE_EVENT_LISTS } from './styleKnobMeta';
import StyleSection, { findSectionById } from './StyleSection';
import ThemePanel from './ThemePanel';
import ConfirmDialog from '../../../../shared/ConfirmDialog';
import IconButton from '../../../../shared/IconButton';
import AccordionSection from '../../../AITasksDesigner/Builder/flow/AccordionSection';
import { getComponentEntry } from '../runtime/componentRegistry';
import { useAppEditor } from '../state/AppEditorContext';
import { findNode, duplicateNode, removeNode } from '../state/definitionOps';
import './panels'; // side effect: registers every per-type Content panel

/**
 * InspectorPanel — the fixed right-hand property inspector.
 *
 *   nothing selected      → ThemePanel (whole-app theme + meta + this screen)
 *   a section (sec_*)     → the section style knobs (padding/gap/background)
 *   a component node      → header (icon/label + Duplicate/Delete) and
 *                           Content / Style / Actions accordions
 *
 * Editing contract: every change builds nextDef via the pure definitionOps
 * and calls onCommit(nextDef) — this panel never dispatches definitions
 * itself. All inputs are disabled while the AI builder streams (streamLock).
 */
export default function InspectorPanel({ onCommit, onTestActionResult }) {
    const { definition, screenId, selectedNodeId, selectedNodeIds, streamLock, dispatch } = useAppEditor();
    const disabled = !!streamLock;
    const multiCount = selectedNodeIds instanceof Set ? selectedNodeIds.size : 0;
    // The confirm dialog remembers WHICH node it was opened for, so a stale
    // dialog can never delete a different node after the selection moves.
    const [confirmFor, setConfirmFor] = useState(null);
    const confirmDelete = confirmFor != null && confirmFor === selectedNodeId;

    // The panel does NOT own its width, border or scrollbar — AppEditorShell's
    // <aside> does. It used to render a second <aside> inside that one, so the
    // inspector was literally nested in itself: two borders, two scroll
    // containers, and two different widths (320px outside, w-80 inside) fighting
    // over the same column. Anything that resizes or collapses the panel has to
    // have exactly one place to do it.
    const shell = (children) => (
        <div className="h-full bg-[var(--bg-secondary)]">{children}</div>
    );

    if (!definition) return shell(null);

    // ── Multiple selected → compact multi-panel (shared knobs + bulk ops) ──
    if (multiCount > 1) {
        return shell(
            <MultiInspector
                definition={definition}
                ids={[...selectedNodeIds]}
                onCommit={onCommit}
                disabled={disabled}
                dispatch={dispatch}
            />,
        );
    }

    // ── Nothing selected → app theme ───────────────────────────────────────
    if (!selectedNodeId) {
        return shell(<ThemePanel definition={definition} onCommit={onCommit} disabled={disabled} screenId={screenId} />);
    }

    // ── Section selected → section style knobs ─────────────────────────────
    if (selectedNodeId.startsWith('sec_')) {
        const found = findSectionById(definition, selectedNodeId);
        if (!found) return shell(<ThemePanel definition={definition} onCommit={onCommit} disabled={disabled} screenId={screenId} />);
        return shell(
            <div className="p-4 flex flex-col gap-3">
                <header className="flex items-center gap-2">
                    <Rows3 className="w-4 h-4 shrink-0 text-[var(--text-tertiary)]" />
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">Section</h2>
                </header>
                <AccordionSection stepType="appstudio.section" sectionKey="style" title="Style" defaultOpen>
                    <StyleSection
                        definition={definition}
                        sectionId={selectedNodeId}
                        onCommit={onCommit}
                        disabled={disabled}
                    />
                </AccordionSection>
            </div>,
        );
    }

    // ── Component node selected ────────────────────────────────────────────
    const found = findNode(definition, selectedNodeId);
    if (!found) {
        return shell(<ThemePanel definition={definition} onCommit={onCommit} disabled={disabled} screenId={screenId} />);
    }
    const { node } = found;
    const entry = getComponentEntry(node.type);
    const TypeIcon = entry?.icon || null;
    const ContentPanel = getInspectorForType(node.type);
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;

    const onDuplicate = () => {
        const { def } = duplicateNode(definition, node.id);
        if (def !== definition) onCommit(def);
    };
    const doDelete = () => {
        setConfirmFor(null);
        const next = removeNode(definition, node.id);
        if (next !== definition) onCommit(next);
    };

    return shell(
        <div className="p-4 flex flex-col gap-3">
            <header className="flex items-center gap-2">
                {TypeIcon ? <TypeIcon className="w-4 h-4 shrink-0 text-[var(--text-tertiary)]" /> : null}
                <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate flex-1">
                    {entry?.label || node.type}
                </h2>
                <IconButton ariaLabel="Duplicate" onClick={onDuplicate} disabled={disabled}>
                    <Copy />
                </IconButton>
                <IconButton
                    ariaLabel="Delete"
                    variant="danger"
                    disabled={disabled}
                    onClick={() => (hasChildren ? setConfirmFor(node.id) : doDelete())}
                >
                    <Trash2 />
                </IconButton>
            </header>

            {ContentPanel ? (
                <AccordionSection stepType={`appstudio.${node.type}`} sectionKey="content" title="Content" defaultOpen>
                    {/* Binding/formula fields inside a content panel need the
                        Studio variable scope, or their picker has nothing in it. */}
                    <StudioScopeProvider definition={definition} node={node}>
                        <ContentPanel node={node} definition={definition} onCommit={onCommit} disabled={disabled} />
                    </StudioScopeProvider>
                </AccordionSection>
            ) : null}

            <AccordionSection stepType={`appstudio.${node.type}`} sectionKey="style" title="Style" defaultOpen>
                <StyleSection definition={definition} node={node} onCommit={onCommit} disabled={disabled} />
            </AccordionSection>

            <AccordionSection stepType={`appstudio.${node.type}`} sectionKey="logic" title="Logic">
                <LogicSection node={node} definition={definition} onCommit={onCommit} disabled={disabled} />
            </AccordionSection>

            {TYPE_EVENT_LISTS[node.type]?.length ? (
                <AccordionSection stepType={`appstudio.${node.type}`} sectionKey="actions" title="Actions" defaultOpen>
                    {/* Actions hold formulas too — navigate params, an AI step's
                        source — and this section had no scope around it, so
                        every picker inside it came up empty. */}
                    <StudioScopeProvider definition={definition} node={node}>
                        <ActionsSection
                            node={node}
                            definition={definition}
                            onCommit={onCommit}
                            onTestActionResult={onTestActionResult}
                            disabled={disabled}
                        />
                    </StudioScopeProvider>
                </AccordionSection>
            ) : null}

            <ConfirmDialog
                open={confirmDelete}
                title={`Delete this ${entry?.label?.toLowerCase() || 'component'}?`}
                description="It contains other components — everything inside it will be deleted too."
                confirmLabel="Delete"
                destructive
                onConfirm={doDelete}
                onCancel={() => setConfirmFor(null)}
            />
        </div>,
    );
}
