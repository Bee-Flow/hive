import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import ConfirmDialog from '../../../../../shared/ConfirmDialog';
import IconButton from '../../../../../shared/IconButton';
import { getComponentEntry } from '../../runtime/componentRegistry';
import { insertNode, removeNode, updateNodeProps } from '../../state/definitionOps';
import { registerInspector } from '../registry';
import { IconField, TextField , usePatch } from './kit';

/** Build a fresh `tab` node from the registry defaults (deep-cloned). */
function newTabNode() {
    const entry = getComponentEntry('tab');
    return {
        type: 'tab',
        visible: true,
        props: JSON.parse(JSON.stringify(entry?.defaultProps || { label: 'Tab', icon: null })),
        style: JSON.parse(JSON.stringify(entry?.defaultStyle || { gap: 3, padding: 0 })),
        children: [],
    };
}

/** Content panel for the `tabs` container — add / rename / remove its tabs. */
export function TabsInspector({ node, definition, onCommit, disabled = false }) {
    const tabs = Array.isArray(node.children) ? node.children : [];

    const addTab = () => {
        const { def, nodeId } = insertNode(definition, { parentId: node.id, node: newTabNode() });
        if (nodeId) onCommit(def);
    };
    const renameTab = (tabId, label) => {
        const next = updateNodeProps(definition, tabId, { label });
        if (next !== definition) onCommit(next);
    };
    // Selecting the tab node and using the header trash asks first when it holds
    // anything (InspectorPanel's ConfirmDialog); this row did not, and it is the
    // faster route — a "Details" tab with a ten-field form vanished on one click
    // with nothing but the editor-wide undo to get it back.
    const [confirmTabId, setConfirmTabId] = useState(null);
    const confirmTab = tabs.find((t) => t.id === confirmTabId) || null;
    const childCount = Array.isArray(confirmTab?.children) ? confirmTab.children.length : 0;

    const doDeleteTab = (tabId) => {
        setConfirmTabId(null);
        const next = removeNode(definition, tabId);
        if (next !== definition) onCommit(next);
    };
    const deleteTab = (tab) => {
        const hasChildren = Array.isArray(tab?.children) && tab.children.length > 0;
        if (hasChildren) setConfirmTabId(tab.id);
        else doDeleteTab(tab.id);
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
                {tabs.map((tab, i) => (
                    <div key={tab.id || i} className="flex items-center gap-2">
                        <input
                            type="text"
                            className="flex-1 px-3 py-2 rounded-md text-sm border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] focus:border-[var(--accent-primary)]"
                            value={tab.props?.label || ''}
                            onChange={(e) => renameTab(tab.id, e.target.value)}
                            placeholder={`Tab ${i + 1}`}
                            disabled={disabled}
                            aria-label={`Tab ${i + 1} label`}
                        />
                        <IconButton ariaLabel={`Delete tab ${i + 1}`} variant="danger" onClick={() => deleteTab(tab)} disabled={disabled || tabs.length <= 1}>
                            <Trash2 />
                        </IconButton>
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={addTab}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
            >
                <Plus className="w-3.5 h-3.5" /> Add tab
            </button>

            <ConfirmDialog
                open={!!confirmTab}
                title={`Delete the “${confirmTab?.props?.label || 'tab'}” tab?`}
                description={`It holds ${childCount} component${childCount === 1 ? '' : 's'} — everything inside it will be deleted too.`}
                confirmLabel="Delete"
                destructive
                onConfirm={() => doDeleteTab(confirmTabId)}
                onCancel={() => setConfirmTabId(null)}
            />
        </div>
    );
}

/** Content panel for a single `tab` — its label + icon. */
export function TabInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    return (
        <div className="flex flex-col gap-4">
            <TextField label="Tab label" value={props.label} onChange={(v) => patch({ label: v })} disabled={disabled} />
            <IconField label="Tab icon" value={props.icon} onChange={(v) => patch({ icon: v })} disabled={disabled} />
        </div>
    );
}

registerInspector('tabs', TabsInspector);
registerInspector('tab', TabInspector);

export default TabsInspector;
