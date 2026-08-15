import React from 'react';
import { lazy } from '../../../utils/lazyWithReload';
import { Bot, Sparkles, ListChecks, BookOpen, Globe, Mic, LifeBuoy, LayoutGrid } from 'lucide-react';

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
//   descKey        — i18n key for the one-line description shown in the
//   descFallback     sidebar's Studio flyout panel (see Sidebar.jsx)
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
        descKey: 'studio.tab.agents_desc',
        descFallback: 'Create and manage your agents',
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
        descKey: 'studio.tab.skills_desc',
        descFallback: 'Reusable abilities for your agents',
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
        descKey: 'studio.tab.knowledge_desc',
        descFallback: 'Knowledge bases your AI can search',
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
        // The section id stays 'aiTasks': it is the key the whole navigation
        // layer (studioRoute.section, AgentHub's initialTaskId wiring, the
        // builder's query state) is written against. Only the name and the URL
        // change — the tab is the Automations builder and nothing else now that
        // prompt tasks live in Cowork and agent routines are managed from the
        // agent that owns them.
        id: 'aiTasks',
        urlSegment: 'automations',
        legacySegments: ['routines', 'ai-tasks'],
        labelKey: 'studio.tab.automations',
        labelFallback: 'Automations',
        descKey: 'studio.tab.automations_desc',
        descFallback: 'Multi-step routines that run for you',
        Icon: ListChecks,
        // BFSF-226: this tab was previously shown unconditionally, so
        // restricted/Free-tier orgs saw a feature the backend 403s and the
        // admin panel flags as "Blocked". Now that the tab is only the
        // Automations builder, `automations` is the whole gate: an org with
        // agent_routines but no automations used to land on the second segment,
        // and that segment is gone. Their agent routines are managed from the
        // agent that owns them, and a deep link still renders (the registry
        // only gates the tab, not the section).
        gate: ({ hasLicenseFeature, canUse }) =>
            hasLicenseFeature('automations') && canUse('automations'),
        Component: lazy(() => import('../AITasksDesigner')),
        getProps: ({ user, initialTaskId, initialStepId, initialFlowletKey, initialBuilderView, initialRunId, initialRunStepId, onClose, onNavigate, modelTiers, setEditing }) => ({
            initialTaskId,
            initialStepId,
            initialFlowletKey,
            initialBuilderView,
            initialRunId,
            initialRunStepId,
            onClose,
            onNavigate,
            modelTiers,
            embedded: true,
            user,
            onEditingChange: setEditing,
        }),
    },
    // Cowork used to be a tab here, duplicating the sidebar's Work page: one
    // could edit and show run history, the other could create. It is now a
    // single top-level page at /app/cowork, and /app/studio/cowork/:id
    // resolves there (see pageFromPath in AuthedApp).
    {
        id: 'webpages',
        urlSegment: 'webpages',
        labelKey: 'studio.tab.webpages',
        labelFallback: 'Webpages',
        descKey: 'studio.tab.webpages_desc',
        descFallback: 'Design and publish public webpages',
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
    // Security Scan is no longer a built-in Studio app: it ships as a
    // downloadable module (Modules → Marketplace) and its Studio tab is supplied
    // at runtime by the module registry (moduleRuntime/registry.js) after install.
    {
        id: 'support',
        urlSegment: 'support',
        labelKey: 'studio.tab.support',
        labelFallback: 'Support',
        descKey: 'studio.tab.support_desc',
        descFallback: 'Shared inbox for support tickets',
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
        id: 'apps',
        urlSegment: 'apps',
        labelKey: 'studio.tab.apps',
        labelFallback: 'Apps',
        descKey: 'studio.tab.apps_desc',
        descFallback: 'Build and publish internal apps',
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
        descKey: 'studio.tab.meeting_notes_desc',
        descFallback: 'Transcripts, speakers and actions',
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
