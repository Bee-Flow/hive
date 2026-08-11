import React from 'react';
import { lazy } from '../../../utils/lazyWithReload';
import { Bot, Sparkles, ListChecks, BookOpen, Globe, Bug, Mic, LifeBuoy, Target, LayoutGrid } from 'lucide-react';

// Studio app registry — the single source of truth for which apps live inside
// the unified Studio shell, in what order, behind which gates, and with which
// props. Studio/index.jsx renders tabs + the active app from this list, and
// studioRoutes.js derives the URL segment ↔ section maps from it.
//
// IMPORT DISCIPLINE: this module is imported (via studioRoutes.js) from
// App.jsx, so it lands in the MAIN chunk. Top-level imports must stay limited
// to react, utils/lazyWithReload and lucide-react — the app components
// themselves may only be referenced inside the lazy() callbacks so each app
// stays a separate on-demand chunk. Enforced by studioApps.test.jsx.

// Feature gate helper — the server-resolved canUseFeature map (licence × beta
// intersection) is authoritative when present; otherwise fall back to the
// legacy permissions/betaFeatures spot-check. `??` (not `||`) so an explicit
// server `false` wins over a stale 'all' permission.
export const makeCanUse = (user) => (id) =>
    !!(user?.canUseFeature?.[id] ?? (user?.permissions?.includes('all') || user?.betaFeatures?.includes(id)));

// Descriptor shape:
//   id             — Studio section key (state / <Studio section=...> value)
//   urlSegment     — canonical /app/studio/<segment> slug
//   legacySegments — extra accepted URL/navigation aliases (id itself is
//                    always accepted too — see studioRoutes.js)
//   labelKey       — i18n key for the tab label
//   labelFallback  — literal fallback when the key resolves empty (only the
//                    tabs that historically had one — keeps t() output exact)
//   Icon           — lucide icon for the tab
//   moduleId       — informational link to the admin modules registry
//   gate(ctx)      — tab visibility; ctx = { user, hasLicenseFeature,
//                    hasPermission, canUse }. The active section still renders
//                    when its gate is false (the server 403s the data).
//   Component      — lazy-loaded app component
//   getProps(ctx)  — props passed to the app; ctx additionally carries
//                    setEditing (per-app fullscreen-editing reporter)
export const STUDIO_APPS = [
    {
        id: 'agents',
        urlSegment: 'agents',
        labelKey: 'studio.tab.agents',
        Icon: Bot,
        gate: () => true,
        Component: lazy(() => import('../AgentStudio')),
        getProps: ({ user, initialAgentId, onClose, onNavigate, hasPermission, setEditing }) => ({
            user,
            initialAgentId,
            onClose,
            onNavigate,
            hasPermission,
            onEditingChange: setEditing,
        }),
    },
    {
        id: 'skills',
        urlSegment: 'skills',
        labelKey: 'studio.tab.skills',
        Icon: Sparkles,
        gate: () => true,
        Component: lazy(() => import('./SkillsStudio')),
        getProps: ({ user, initialSkillId, onNavigate, hasPermission }) => ({
            user,
            initialSkillId,
            onNavigate,
            hasPermission,
        }),
    },
    {
        id: 'knowledge',
        urlSegment: 'knowledge',
        labelKey: 'studio.tab.knowledge',
        Icon: BookOpen,
        gate: () => true,
        Component: lazy(() => import('./KBsStudio')),
        getProps: ({ user, initialKbId, onNavigate, hasPermission }) => ({
            user,
            initialKbId,
            onNavigate,
            hasPermission,
        }),
    },
    {
        id: 'aiTasks',
        urlSegment: 'routines',
        legacySegments: ['ai-tasks'],
        labelKey: 'studio.tab.ai_tasks',
        Icon: ListChecks,
        // BFSF-226: the AI Tasks tab (Routines + Automations) was previously
        // shown unconditionally, so restricted/Free-tier orgs saw a feature the
        // backend 403s and the admin panel flags as "Blocked". Gate it like the
        // siblings: visible when the plan grants *either* routines or
        // automations. The canUseFeature map is the server-resolved licence ×
        // beta intersection; hasLicenseFeature re-checks the licence so a stale
        // session can't keep the tab after a downgrade. AITasksDesigner keeps
        // its own internal guards.
        gate: ({ hasLicenseFeature, canUse }) =>
            (hasLicenseFeature('agent_routines') && canUse('agent_routines'))
            || (hasLicenseFeature('automations') && canUse('automations')),
        Component: lazy(() => import('../AITasksDesigner')),
        getProps: ({ user, initialTaskId, initialStepId, initialFlowletKey, onClose, onNavigate, modelTiers, setEditing }) => ({
            initialTaskId,
            initialStepId,
            initialFlowletKey,
            onClose,
            onNavigate,
            modelTiers,
            embedded: true,
            user,
            onEditingChange: setEditing,
        }),
    },
    {
        id: 'webpages',
        urlSegment: 'webpages',
        labelKey: 'studio.tab.webpages',
        labelFallback: 'Webpages',
        Icon: Globe,
        // Licence feature is authoritative. canUseFeature is the server-derived
        // intersection of licence × beta and includes webpages automatically
        // when the tier matches, but we re-check the licence explicitly so a
        // stale session can't keep the tab visible after a downgrade.
        gate: ({ hasLicenseFeature, canUse }) => hasLicenseFeature('webpages') && canUse('webpages'),
        Component: lazy(() => import('../../../pages/WebpagesPage')),
        getProps: ({ user, initialWebpageId, onNavigate, hasPermission }) => ({
            user,
            initialWebpageId,
            onWebpageChange: (id) => onNavigate && onNavigate(id ? `studio/webpages/${id}` : 'studio/webpages'),
            embedded: true,
            hasPermission,
        }),
    },
    {
        id: 'tests',
        urlSegment: 'tests',
        labelKey: 'studio.tab.tests',
        labelFallback: 'Tests',
        Icon: Bug,
        // Mirrors the webpages gate — playwright_tests is enterprise-tier +
        // beta-opt-in. canUseFeature already does the AND on the server side.
        gate: ({ hasLicenseFeature, canUse }) => hasLicenseFeature('playwright_tests') && canUse('playwright_tests'),
        Component: lazy(() => import('./TestsStudio')),
        getProps: ({ user, onNavigate, hasPermission }) => ({
            user,
            onNavigate,
            hasPermission,
        }),
    },
    // Security Scan is no longer a built-in Studio app: it ships as a
    // downloadable module (Modules → Marketplace) and its Studio tab is supplied
    // at runtime by the module registry (moduleRuntime/registry.js) after install.
    {
        id: 'support',
        urlSegment: 'support',
        labelKey: 'studio.tab.support',
        labelFallback: 'Support',
        Icon: LifeBuoy,
        // Support Studio — enterprise + beta opt-in (licence × beta via
        // canUseFeature) AND the org-level support_inbox permission (the inbox
        // is gated per member, not just per org). hasPermission resolves the
        // user's effective permissions.
        gate: ({ hasLicenseFeature, hasPermission, canUse }) =>
            hasLicenseFeature('support_inbox')
            && canUse('support_inbox')
            && (hasPermission('support_inbox') || hasPermission('all')),
        Component: lazy(() => import('./SupportStudio')),
        getProps: ({ user, onNavigate, hasPermission }) => ({
            user,
            onNavigate,
            hasPermission,
        }),
    },
    {
        id: 'leadStudio',
        urlSegment: 'lead-studio',
        labelKey: 'studio.tab.lead_studio',
        labelFallback: 'Lead Studio',
        Icon: Target,
        // Lead Studio — enterprise + beta opt-in (licence × beta via
        // canUseFeature). Gated purely on licence × beta like
        // Security/Tests/Webpages — NO separate per-member permission (enabling
        // the beta for the org is enough to see it).
        gate: ({ hasLicenseFeature, canUse }) => hasLicenseFeature('lead_studio') && canUse('lead_studio'),
        Component: lazy(() => import('./LeadStudio')),
        getProps: ({ user, onNavigate, hasPermission, modelTiers }) => ({
            user,
            onNavigate,
            hasPermission,
            modelTiers,
        }),
    },
    {
        id: 'apps',
        urlSegment: 'apps',
        labelKey: 'studio.tab.apps',
        labelFallback: 'Apps',
        Icon: LayoutGrid,
        // App Studio — Enterprise, GA (auto-on; org admin may disable), gated
        // like Webpages: licence × capability via canUseFeature, no separate
        // per-member permission. GA removed the per-org beta opt-in, so canUse
        // now resolves true for every Enterprise org by default. NOTE the
        // capability id is app_studio (plain `apps` is the marketplace); only
        // the tab label says "Apps".
        gate: ({ hasLicenseFeature, canUse }) => hasLicenseFeature('app_studio') && canUse('app_studio'),
        Component: lazy(() => import('./AppStudio')),
        getProps: ({ initialStudioAppId, onNavigate, setEditing }) => ({
            initialAppId: initialStudioAppId,
            onNavigate,
            onEditingChange: setEditing,
        }),
    },
    {
        id: 'meetingNotes',
        urlSegment: 'meeting-notes',
        labelKey: 'studio.tab.meeting_notes',
        labelFallback: 'Meeting Notes',
        Icon: Mic,
        // Meeting Notes is enterprise + beta opt-in (mirrors webpages/tests).
        // We intentionally rely on canUseFeature (server-resolved licence ×
        // beta) rather than spot-checking betaFeatures so super-admin grants
        // flow correctly down to ordinary org members.
        gate: ({ hasLicenseFeature, canUse }) => hasLicenseFeature('meeting_notes') && canUse('meeting_notes'),
        Component: lazy(() => import('../../../pages/meeting-notes/MeetingNotesPage')),
        getProps: ({ user }) => ({
            user,
            embedded: true,
            onBack: null,
        }),
    },
];

export default STUDIO_APPS;
