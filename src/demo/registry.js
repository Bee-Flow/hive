/**
 * Which product features have a public, playable demo — and what each one
 * needs to render.
 *
 * A descriptor deliberately owns THREE things together, because they only
 * make sense as a set: the real component, the fixture state it reads, and
 * the route table that stands in for its API. Adding a feature means adding
 * one entry here plus one fixtures module; nothing else in the app changes.
 *
 * `expectText` is a string that MUST appear once the demo has rendered its
 * sample data. It is not decoration: DemoHost.test.jsx waits for it before
 * asserting nothing crashed, because both demos that shipped broken did so
 * while technically "mounted" — the fixture list simply had not arrived yet
 * when a fixed-delay assertion ran, so the crash happened after the test.
 *
 * IMPORT DISCIPLINE mirrors studioApps.jsx: the feature components and their
 * fixtures are referenced only inside `lazy()` / dynamic import callbacks, so
 * none of this lands in the marketing bundle. The demo route is the only
 * thing that ever pulls them in.
 */

import { lazy } from 'react';
import scopedStorage from '../utils/scopedStorage';

export const DEMO_FEATURES = {
    routines: {
        id: 'routines',
        label: 'Routines & automations',
        // Shown in the demo chrome so a visitor always knows what they are
        // looking at and that nothing they do is real.
        blurb: 'Build a workflow: drag steps, open a node, change the prompt. Nothing is saved and nothing leaves your browser.',
        appPath: '/app/studio/routines',
        expectText: 'Weekly AI/SaaS spend report',
        Component: lazy(() => import('../components/admin/AITasksDesigner')),
        loadFixtures: () => import('./fixtures/routines'),
        // Props the real Studio shell passes; `embedded` keeps the component
        // inside our frame instead of trying to own the page chrome.
        props: {
            embedded: true,
            onClose: null,
            onNavigate: null,
            modelTiers: {},
            // Open a real, populated workflow instead of the empty
            // "New automation" canvas. Without this the demo lands on a blank
            // grid, which shows the chrome but none of the point — a visitor
            // has to build something before they can see anything.
            // The id must exist in fixtures/routines.js.
            initialTaskId: 'auto_demo_spend_report',
        },
    },
    'privacy-shield': {
        id: 'privacy-shield',
        label: 'Privacy Shield',
        blurb: 'The organisation shield an admin actually configures: what it looks for, what it does when it finds it, what leaves your network — and a month of what it caught.',
        appPath: '/app/settings/organisation/privacy',
        // A row from the Overview posture list, so the test waits for the
        // shield document to have landed rather than for the tab strip, which
        // renders before it.
        expectText: 'Kinds of data we look for',
        /* The real organisation shield. This used to be a composite of the
           CONSUMER privacy panel ("for your account") and a chat — a readable
           demo of a screen no administrator is looking for. The evaluator's
           question is "what can I enforce for everyone", and that is this
           component, on this path. */
        Component: lazy(() => import('../components/admin/guardrails/orgShield/OrgShieldEditor')),
        loadFixtures: () => import('./fixtures/privacyShield'),
        props: {
            // Pinned. useOrgShield refuses to guess which organisation it is
            // editing, and without a picker a guess would be invisible and
            // writable. Must match the org in fixtures/privacyShield.js.
            orgId: 'org_demo_vandael',
            // No URL sync. The editor normally keeps the active tab in a query
            // param; inside the marketing page's iframe that would write to a
            // URL it does not own. `null` switches it to local state.
            urlParam: null,
            // The "What happened" tab — the evidence half. Opt-in per mount in
            // the product because its endpoints scope by session; the
            // org-settings mount is the one that offers it, and that is the
            // mount this demo is standing in for.
            showActivityTab: true,
        },
    },
    agents: {
        id: 'agents',
        label: 'Agent editor',
        blurb: 'Open an assistant and change its instructions, model or knowledge. Sample assistants; nothing is saved.',
        appPath: '/app/studio/agents',
        expectText: 'LinkedIn Schrijver',
        Component: lazy(() => import('../components/admin/AgentStudio')),
        loadFixtures: () => import('./fixtures/agents'),
        props: {
            // Land on a filled-in editor rather than the "create your first
            // assistant" wizard. Must exist in fixtures/agents.js.
            initialAgentId: 'agent_demo_linkedin',
            onClose: null,
            onNavigate: null,
        },
    },
    notebooks: {
        id: 'notebooks',
        label: 'Notebooks',
        blurb: 'A notebook built from six documents: the draft, the sources, and a chat that cites them. Sample data only.',
        appPath: '/app/notebooks',
        expectText: 'Tender 2026-114',
        Component: lazy(() => import('../pages/NotebooksPage')),
        loadFixtures: () => import('./fixtures/notebooks'),
        props: {
            initialNotebookId: 'nb_demo_tender',
            onBack: null,
            onNotebookChange: null,
        },
    },
    'meeting-notes': {
        id: 'meeting-notes',
        label: 'Meeting notes',
        blurb: 'A finished meeting: transcript, speakers, summary and action items. Sample data only — no audio is uploaded or recorded.',
        appPath: '/app/studio/meeting-notes',
        expectText: 'Intake flow',
        Component: lazy(() => import('../pages/meeting-notes/MeetingNotesPage')),
        loadFixtures: () => import('./fixtures/meetingNotes'),
        props: {
            embedded: true,
            onBack: null,
        },
        // Open the sample meeting instead of the "Select a meeting" empty
        // pane. MeetingNotesPage already reads this global in its selectedId
        // initialiser (it is how a finished capture auto-opens), so the demo
        // uses the product's own seam rather than a prop added for it.
        beforeMount: () => { window.__beeflowPendingMeetingId = 'tr_demo_platform_review'; },
    },
    support: {
        id: 'support',
        label: 'Support inbox',
        blurb: 'A support mailbox with eight tickets: filter by status, open a thread, change the priority or draft a reply. Sample tickets — nothing is sent and no mailbox is connected.',
        appPath: '/app/studio/support',
        expectText: 'SSO login fails for three colleagues',
        Component: lazy(() => import('../components/admin/Studio/SupportStudio')),
        loadFixtures: () => import('./fixtures/support'),
        props: {
            // Open a ticket instead of the "Select a ticket" pane. A filled
            // sidebar next to an empty right-hand column is the shape four of
            // these demos shipped in — it reads as a broken screen, not as an
            // invitation. Must exist in fixtures/support.js.
            initialTicketId: 'sth_demo_sso',
        },
    },
    skills: {
        id: 'skills',
        label: 'Skills',
        blurb: 'Reusable instructions an assistant can pull in on demand: house style, triage rules, review checklists. Open one and edit it — sample skills, nothing is saved.',
        appPath: '/app/studio/skills',
        expectText: 'House writing style',
        Component: lazy(() => import('../components/admin/Studio/SkillsStudio')),
        loadFixtures: () => import('./fixtures/skills'),
        props: {
            // Land in a skill, not on "Create your first skill" beside a list
            // of six. Must exist in fixtures/skills.js.
            initialSkillId: 'skl_demo_tone',
            onNavigate: null,
        },
    },
    knowledge: {
        id: 'knowledge',
        label: 'Knowledge bases',
        blurb: 'The knowledge bases an organisation indexes, grouped by category, with the document counts that drive retrieval. Sample data only.',
        appPath: '/app/studio/knowledge',
        expectText: 'How retrieval works',
        Component: lazy(() => import('../components/admin/Studio/KBsStudio')),
        loadFixtures: () => import('./fixtures/knowledge'),
        props: {
            // Open a base instead of the "Create a knowledge base to get
            // started" pane. Without it the demo showed a full sidebar beside
            // an empty-state invitation to create the first one — and the
            // sidebar was not clickable out of it either, because the detail
            // view's own endpoint was unfixtured. Must exist in
            // fixtures/knowledge.js.
            initialKbId: 'kb_demo_productdocs',
            onNavigate: null,
        },
    },
    monitoring: {
        id: 'monitoring',
        label: 'Organisation monitoring',
        blurb: 'A week of usage across models, assistants, people and app areas — including a local model carrying real traffic at zero provider cost. Synthetic figures that add up.',
        appPath: '/app/settings/organisation/usage',
        expectText: 'qwen3-8b (local)',
        /* pages/settings/UsageSection, NOT components/admin/MonitoringPanel.
           Both are "monitoring" and they are different screens: this is the
           organisation view the marketing page sells (tabs across the top,
           filter row, plan and billed-per-cycle cards), the other is the
           standalone AI Monitor with its own left sidebar. Pointing the demo
           at the wrong one showed a visitor a screen they will never find. */
        Component: lazy(() => import('../pages/settings/UsageSection')),
        loadFixtures: () => import('./fixtures/monitoring'),
        props: {},
    },
    compliance: {
        id: 'compliance',
        label: 'Compliance Center',
        blurb: 'A fictional Dutch insurance intermediary, graded against 44 checks across GDPR, the EU AI Act and ISO 27001 — with the DSR inbox, breach register, ROPA and Statement of Applicability behind the score.',
        appPath: '/app/settings/organisation/compliance',
        // A check TITLE, not the score. The ring renders from `overview`
        // alone, so pinning a number would pass while the 44-row check list
        // was still missing. This string only appears once the checks have
        // landed AND the fail/warn sort has run — it is the top open item.
        expectText: 'AI disclosure to users',
        /* ComplianceDemo, NOT ComplianceHub. The hub is a controlled
           component: it reports a section click through `onNavigate` and
           never moves itself. Mounted directly with `onNavigate: null` the
           whole left rail and the GDPR/ISO switch were dead, so a visitor
           saw the Overview and none of the sixteen sections behind it. The
           wrapper holds the section the way the URL does in the product. */
        Component: lazy(() => import('./ComplianceDemo')),
        loadFixtures: () => import('./fixtures/compliance'),
        props: {},
    },
    'app-studio': {
        id: 'app-studio',
        label: 'App Studio',
        blurb: 'A real internal app open in the real editor: a policy-renewal pipeline over its own three-table database. Drag cards in Preview, edit components, read how the AI built it. Sample data; nothing is saved.',
        appPath: '/app/studio/apps',
        // A canvas heading from the fixture DEFINITION — it renders only after
        // getApp resolved and the definition parsed. The editor header shows
        // the app row's name earlier, so pinning that would pass on an empty
        // canvas.
        expectText: 'Policy renewals this quarter',
        Component: lazy(() => import('../components/admin/Studio/AppStudio')),
        loadFixtures: () => import('./fixtures/appStudio'),
        props: {
            // Land in the editor on the pipeline, not on the gallery.
            initialAppId: 'app_demo_pipeline',
            // Optional-chained in AppStudio/index.jsx — null is a complete
            // URL-disable, which matters inside the marketing iframe.
            onNavigate: null,
            onEditingChange: null,
        },
        beforeMount: () => {
            // scopedStorage is user-namespaced and INERT until a current user
            // is registered — nothing in the demo path calls setCurrentUser
            // (only the authed app shell does). Register the demo user, then
            // start the inspector closed: at the marketing block's 1280
            // logical px the chat pane (340) plus the inspector (320) leave
            // ~610px of canvas, too tight for a five-column kanban. The shell
            // shows its own reopen toggle. The user id is a global for the
            // life of this document only — /__demo__/ is a full-document
            // destination, and login overwrites it.
            scopedStorage.setCurrentUser('demo-user');
            scopedStorage.setItem('appStudioInspectorOpen', '0');
        },
    },
};

export const DEMO_FEATURE_IDS = Object.keys(DEMO_FEATURES);

export function getDemoFeature(id) {
    return Object.prototype.hasOwnProperty.call(DEMO_FEATURES, id)
        ? DEMO_FEATURES[id]
        : null;
}
