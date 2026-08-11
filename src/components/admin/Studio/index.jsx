import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useTranslation from '../../../hooks/useTranslation';
import { useLicenseContext } from '../../LicenseContext';
import { useEntitlements } from '../../EntitlementsContext';
import { useRuntimeStudioApps } from '../../../moduleRuntime/registry';
import { STUDIO_APPS, makeCanUse } from './studioApps';

// Unified Studio: a single shell hosting Agents, Skills, Knowledge Bases, and
// AI Tasks. All sections share a sidebar-list + editor-right split layout.
// The tab list, gating and per-app props all come from the studioApps.jsx
// registry; each app loads as its own lazy chunk.

// Local Suspense fallback (same spinner as AgentHub's LazyFallback). Must stay
// local: without a boundary here, the first visit to a lazy tab would suspend
// the whole hub instead of just the section pane.
function StudioSectionLoading() {
    return (
        <div className="flex items-center justify-center w-full h-full">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-primary)] animate-spin" />
        </div>
    );
}

export default function Studio({
    user,
    section = 'agents',     // 'agents' | 'skills' | 'knowledge' | 'aiTasks' | 'webpages'
    initialAgentId = null,
    initialSkillId = null,
    initialKbId = null,
    initialTaskId = null,
    initialStepId = null,
    initialFlowletKey = null,
    initialWebpageId = null,
    initialStudioAppId = null,
    onClose,
    onNavigate,
    hasPermission = () => true,
    modelTiers = {},
    onEditingChange,
}) {
    const { t, locale } = useTranslation();
    const { hasFeature: hasLicenseFeature } = useLicenseContext();
    // Runtime (remotely-installed) modules contribute extra Studio apps. They
    // merge AFTER the build-time apps and gate purely on the entitlement
    // capability (server is authoritative — this is display-only).
    const { can } = useEntitlements();
    const runtimeApps = useRuntimeStudioApps();
    const allApps = useMemo(() => [...STUDIO_APPS, ...runtimeApps], [runtimeApps]);
    // Per-app fullscreen-editing flags (Agents + Routines report these). The
    // tab bar hides while ANY app is editing; onEditingChange fires with the
    // aggregate, computed against the render-scope map — same semantics as the
    // old per-app handlers (only the mounted app ever reports in a tick).
    const [editingById, setEditingById] = useState({});
    const editing = Object.values(editingById).some(Boolean);
    // The `setEditing` prop handed to the active app (below) is a fresh arrow
    // function every render (it closes over `activeApp.id`), so any child
    // effect keyed on that prop's identity re-fires every render. Without a
    // no-op guard here, that re-fire calls reportEditing → setEditingById with
    // a new object → Studio re-renders → new setEditing → the child's effect
    // deps change again → infinite render loop (React error #185, seen on
    // /app/studio/routines). Bailing out (returning the SAME object) when the
    // value hasn't actually changed makes React skip the re-render and stops
    // the cascade regardless of how often the child's unstable-prop effect
    // re-invokes us with the same value.
    const reportEditing = useCallback((appId, next) => {
        const nextVal = !!next;
        setEditingById(prev => (prev[appId] === nextVal ? prev : { ...prev, [appId]: nextVal }));
    }, []);
    // Notify the parent only when the AGGREGATE boolean actually flips — not
    // on every render — using a ref for the callback so an unstable
    // `onEditingChange` identity from the parent can't retrigger this either.
    const onEditingChangeRef = useRef(onEditingChange);
    useEffect(() => { onEditingChangeRef.current = onEditingChange; });
    useEffect(() => { onEditingChangeRef.current?.(editing); }, [editing]);

    const canUse = makeCanUse(user);
    const gateCtx = { user, hasLicenseFeature, hasPermission, canUse, can };
    const visibleApps = allApps.filter((app) => app.gate(gateCtx));

    const switchTo = (app) => {
        if (!onNavigate) return;
        onNavigate(`studio/${app.urlSegment}`);
    };

    // Tab label: runtime apps carry a locale-aware label() function; built-in
    // apps use their i18n key (with the historical literal fallback).
    const tabLabel = (app) => (typeof app.label === 'function'
        ? app.label(t, locale)
        : (app.labelFallback ? (t(app.labelKey) || app.labelFallback) : t(app.labelKey)));

    // The active section renders even when its gate is false — the server
    // 403s the data, matching the pre-registry behaviour.
    const activeApp = allApps.find((app) => app.id === section) || null;
    const ActiveComponent = activeApp?.Component;
    // Stable per-app-id identity (only changes when the active tab does) so
    // a child effect keyed on this prop's reference doesn't re-fire every
    // Studio render — belt-and-braces alongside the no-op guard above.
    const setEditing = useCallback((next) => reportEditing(activeApp?.id, next), [activeApp?.id, reportEditing]);

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Top sub-nav — hidden in any fullscreen edit mode */}
            {!editing && (
            <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-default)]">
                {visibleApps.map((app) => {
                    const active = section === app.id;
                    const { Icon } = app;
                    return (
                        <button
                            key={app.id}
                            onClick={() => switchTo(app)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${active
                                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                        >
                            <Icon size={14} />
                            {tabLabel(app)}
                        </button>
                    );
                })}
            </div>
            )}

            {/* Sub-section */}
            <div className="flex-1 min-h-0">
                {activeApp && (
                    <Suspense fallback={<StudioSectionLoading />}>
                        <ActiveComponent
                            {...activeApp.getProps({
                                user,
                                initialAgentId,
                                initialSkillId,
                                initialKbId,
                                initialTaskId,
                                initialStepId,
                                initialFlowletKey,
                                initialWebpageId,
                                initialStudioAppId,
                                onClose,
                                onNavigate,
                                hasPermission,
                                modelTiers,
                                setEditing,
                            })}
                        />
                    </Suspense>
                )}
            </div>
        </div>
    );
}
