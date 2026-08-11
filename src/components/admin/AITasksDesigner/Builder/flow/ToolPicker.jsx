import React from 'react';
import AppActionPicker from '../../../../shared/AppActionPicker';

/**
 * Tool picker for the AI step — which functions the step may call.
 *
 * The overlay itself is shared/AppActionPicker, the one app menu every surface
 * renders (agent editor, AI step, App Studio connectors). This file is now just
 * the AI step's binding to it: selection is a list of tool function names (the
 * step's `tools` array).
 *
 * `apps` come straight from the automation catalog (`catalog.apps`), already
 * permission-gated server-side — callers pass only entries with `available`.
 *
 * Props:
 *   apps         — [{ id, label, actions: [{ name, label, description, sideEffect }] }]
 *   selected     — string[] of selected function names
 *   onToggleTool — (name) => void
 *   onToggleApp  — (app, on) => void   // enable/disable all of an app's tools
 *   onClose      — () => void
 */
export default function ToolPicker({ apps = [], selected = [], onToggleTool, onToggleApp, onClose }) {
    return (
        <AppActionPicker
            apps={apps}
            selected={selected}
            onToggle={(name) => onToggleTool?.(name)}
            onToggleApp={(app, on) => onToggleApp?.(app, on)}
            onClose={onClose}
            title="Choose tools"
            emptyLabel="No tools available"
        />
    );
}
