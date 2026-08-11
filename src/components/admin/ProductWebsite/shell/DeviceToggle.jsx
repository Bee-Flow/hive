import React, { useSyncExternalStore } from 'react';
import AppIcon from '../../../AppIcon';
import Tooltip from '../../../shared/Tooltip';
import Dropdown from './Dropdown';
import scopedStorage from '../../../../utils/scopedStorage';

// Preview device presets — a pure max-width on the stage's iframe wrapper.
// No postMessage / renderer change: the marketing site is responsive, so
// narrowing the frame IS the mobile preview.
export const DEVICES = [
    { key: 'desktop', width: null, icon: 'Monitor',    title: 'Desktop preview' },
    { key: 'tablet',  width: 768,  icon: 'Tablet',     title: 'Tablet preview (768px)' },
    { key: 'mobile',  width: 390,  icon: 'Smartphone', title: 'Mobile preview (390px)' },
];

// ── Stage viewport store (WS3-P5) ───────────────────────────────────
//
// Zoom + mobile rotation live in a tiny module-level store shared by the
// TopBar's DeviceToggle (writes zoom) and PreviewStage (reads both,
// writes rotation) — the two sit in different slots of CmsBuilderShell,
// so a store avoids threading yet another prop pair through
// ProductWebsitePanel. Zoom persists per user via scopedStorage;
// rotation is session-only (a glance, not a setting).

export const ZOOM_LEVELS = [
    { value: 'fit',  label: 'Fit' },
    { value: '0.5',  label: '50%' },
    { value: '0.75', label: '75%' },
    { value: '1',    label: '100%' },
];
const ZOOM_KEY = 'cmsPreviewZoom';
const isZoom = (v) => ZOOM_LEVELS.some(z => z.value === v);

let viewportState = null;   // lazy — scopedStorage needs the user registered
const viewportListeners = new Set();

function getViewportState() {
    if (viewportState === null) {
        const stored = scopedStorage.getItem(ZOOM_KEY);
        viewportState = { zoom: isZoom(stored) ? stored : '1', rotated: false };
    }
    return viewportState;
}

function patchViewport(patch) {
    viewportState = { ...getViewportState(), ...patch };
    if (patch.zoom) scopedStorage.setItem(ZOOM_KEY, patch.zoom);
    viewportListeners.forEach(l => l());
}

function subscribeViewport(listener) {
    viewportListeners.add(listener);
    return () => viewportListeners.delete(listener);
}

export function useStageViewport() {
    return useSyncExternalStore(subscribeViewport, getViewportState);
}

export function setStageZoom(zoom) {
    if (isZoom(zoom)) patchViewport({ zoom });
}

export function toggleStageRotate() {
    patchViewport({ rotated: !getViewportState().rotated });
}

export default function DeviceToggle({ value, onChange }) {
    const { zoom } = useStageViewport();
    const zoomLabel = (ZOOM_LEVELS.find(z => z.value === zoom) || ZOOM_LEVELS[3]).label;
    return (
        <div className="flex items-center gap-0.5 p-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
            {DEVICES.map(d => (
                <Tooltip key={d.key} content={d.title}>
                    <button
                        type="button"
                        onClick={() => onChange(d.key)}
                        aria-label={d.title}
                        className={`p-1 rounded ${value === d.key
                            ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                    >
                        <AppIcon name={d.icon} className="w-3.5 h-3.5" />
                    </button>
                </Tooltip>
            ))}
            <div className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />
            <Dropdown
                align="right"
                width={96}
                trigger={() => (
                    <button
                        type="button"
                        aria-label="Preview zoom"
                        title="Preview zoom"
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                    >
                        {zoomLabel}
                        <AppIcon name="ChevronDown" className="w-3 h-3" />
                    </button>
                )}
            >
                {({ close }) => (
                    <ul className="py-1">
                        {ZOOM_LEVELS.map(z => (
                            <li key={z.value}>
                                <button
                                    type="button"
                                    onClick={() => { setStageZoom(z.value); close(); }}
                                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-[var(--bg-tertiary)]
                                        ${z.value === zoom ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
                                >
                                    {z.label}
                                    {z.value === zoom ? <AppIcon name="Check" className="w-3 h-3" /> : null}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Dropdown>
        </div>
    );
}
