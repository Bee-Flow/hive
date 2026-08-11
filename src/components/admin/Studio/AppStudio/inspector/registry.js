/**
 * App Studio inspector — per-type Content-panel registry.
 *
 * Mirrors the AITasksDesigner settings registry pattern
 * (admin/AITasksDesigner/Builder/flow/settings/registry.js): each panel file
 * under ./panels/ calls registerInspector(type, Component) at module scope,
 * and panels/index.js imports them all so a single side-effect import
 * (`import './panels'`) self-registers the whole catalog.
 *
 * Types WITHOUT a bespoke panel fall back to the generic SpecPanel, which
 * renders its controls from the server catalog's prop specs — so a new
 * catalog type is editable without writing a panel. Only prop-less types
 * (divider, container — their sole editing surface is Style) get no Content
 * panel; the InspectorPanel skips the Content accordion in that case.
 */

import SpecPanel from './panels/SpecPanel';
import { getComponentEntry } from '../runtime/componentRegistry';

const REGISTRY = {};

export function registerInspector(type, component) {
    REGISTRY[type] = component;
}

export function getInspectorForType(type) {
    if (REGISTRY[type]) return REGISTRY[type];
    // Fallback: catalog-driven generic panel — but only for types that have
    // props to edit (and that the registry knows at all).
    const entry = getComponentEntry(type);
    if (!entry || Object.keys(entry.defaultProps || {}).length === 0) return null;
    return SpecPanel;
}

export default REGISTRY;
