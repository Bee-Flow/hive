// Step config for the new-user product tour (see OnboardingTour.jsx).
//
// Each step:
//   id             — stable key (React keys + analytics)
//   target         — CSS selector to spotlight. Omit for a centered card.
//   navigateTo     — page key passed to App's navigateToPage() before highlight.
//   placement      — right | left | top | bottom | center (clamped to viewport).
//   optional       — skip the step if the target never appears (vs centered card).
//   requiresStudio — only for users who can reach Studio / create agents.
//   ensureSidebarOpen — engine dispatches `beeflow:tour-ensure-sidebar-open`
//                    first so sidebar anchors render (the rail auto-collapses).
//   timeoutMs      — per-step resolve timeout override (lazy panels need longer).
//   requiresAgentCreated — only show if the user actually created an agent.
//
//   INTERACTIVE steps (let the user actually do the thing):
//   interactive    — spotlight hole is click-through; card hides Next and shows
//                    an action hint; keyboard Next/Back disabled so typing works.
//   advanceOn      — auto-advance trigger. Any of:
//                      { input: { minLength } } — user types into `target`
//                      { targetGone: true }     — `target` leaves the DOM after
//                                                 being shown (submit happened)
//                      { event, predicate }     — a window CustomEvent fires
//                    plus optional `timeoutMs` fallback.
//   actionHintKey / actionHintFallback — copy shown in place of Next.
//
//   icon, titleKey/titleFallback, bodyKey/bodyFallback — header + body copy.
//
// Copy avoids the internal term "Direct chat" — to users this is just "chat".

export const TOUR_STEPS = [
    {
        id: 'welcome',
        placement: 'center',
        icon: '👋',
        titleKey: 'tour.welcome.title',
        titleFallback: 'Welcome to Bee Flow',
        bodyKey: 'tour.welcome.body',
        bodyFallback: "Let's take a quick tour of the basics — under a minute. You can skip or replay it anytime.",
    },
    {
        id: 'chat',
        target: '[data-tour="nav-new-chat"]',
        placement: 'right',
        ensureSidebarOpen: true,
        icon: '💬',
        titleKey: 'tour.chat.title',
        titleFallback: 'Chat with AI',
        bodyKey: 'tour.chat.body',
        bodyFallback: 'Start here. Ask a question, draft an email, or brainstorm — “New Chat” opens a fresh conversation whenever you need one.',
    },
    {
        id: 'agentsEditor',
        target: '[data-tour="nav-studio"]',
        placement: 'right',
        optional: true,
        requiresStudio: true,
        ensureSidebarOpen: true,
        icon: '🛠️',
        titleKey: 'tour.agents_editor.title',
        titleFallback: 'Build your own agents',
        bodyKey: 'tour.agents_editor.body',
        bodyFallback: 'Studio is where you create and fine-tune AI agents for the way your team works.',
    },
    {
        id: 'marketplace',
        target: '[data-tour="nav-agents"]',
        placement: 'right',
        ensureSidebarOpen: true,
        icon: '✨',
        titleKey: 'tour.marketplace.title',
        titleFallback: 'Discover agents',
        bodyKey: 'tour.marketplace.body',
        bodyFallback: 'Browse ready-made agents your team has shared, then pick one to start chatting right away.',
    },
    {
        id: 'knowledge',
        navigateTo: 'studio/knowledge',
        placement: 'center',
        optional: true,
        requiresStudio: true,
        timeoutMs: 6000,
        icon: '📚',
        titleKey: 'tour.knowledge.title',
        titleFallback: 'Add your knowledge',
        bodyKey: 'tour.knowledge.body',
        bodyFallback: 'Give your agents your own documents and data with a knowledge base — then they can answer using your content.',
    },
    {
        id: 'account',
        target: '[data-tour="account"]',
        placement: 'right',
        ensureSidebarOpen: true,
        icon: '👤',
        titleKey: 'tour.account.title',
        titleFallback: 'Your account & settings',
        bodyKey: 'tour.account.body',
        bodyFallback: 'Open your account menu here for settings, appearance, and to sign out.',
    },
    {
        id: 'preferences',
        target: '[data-testid="settings-nav-preferences"]',
        navigateTo: 'settings/preferences',
        placement: 'right',
        timeoutMs: 6000,
        icon: '⚙️',
        titleKey: 'tour.preferences.title',
        titleFallback: 'Make it yours',
        bodyKey: 'tour.preferences.body',
        bodyFallback: 'Tune your defaults — language, model, and more — in Preferences.',
    },

    // ── Interactive: create your first agent (gated to users who can) ──────
    {
        id: 'createIntro',
        placement: 'center',
        requiresStudio: true,
        icon: '🤖',
        titleKey: 'tour.create_intro.title',
        titleFallback: 'Create your first agent',
        bodyKey: 'tour.create_intro.body',
        bodyFallback: 'Bee Flow can build a custom agent from a plain-English description. Want to try it now? You can skip and do this later.',
    },
    {
        id: 'createType',
        navigateTo: 'agentWizard',
        target: '[data-tour="agent-wizard-prompt"]',
        placement: 'bottom',
        requiresStudio: true,
        optional: true,
        interactive: true,
        timeoutMs: 8000,
        // Advance when the user types, OR when the prompt box leaves the DOM
        // (they clicked a template, which submits immediately).
        advanceOn: { input: { minLength: 4 }, targetGone: true },
        actionHintKey: 'tour.create_type.hint',
        actionHintFallback: '👉 Describe what your agent should do…',
        icon: '✍️',
        titleKey: 'tour.create_type.title',
        titleFallback: 'Describe your agent',
        bodyKey: 'tour.create_type.body',
        bodyFallback: 'Type what you want your agent to do — for example, “An assistant that drafts friendly customer-support replies.”',
    },
    {
        id: 'createSubmit',
        target: '[data-tour="agent-wizard-prompt"]',
        placement: 'bottom',
        requiresStudio: true,
        optional: true,
        interactive: true,
        advanceOn: { targetGone: true, timeoutMs: 30000 },
        actionHintKey: 'tour.create_submit.hint',
        actionHintFallback: '👉 Press Enter to create it',
        icon: '🚀',
        titleKey: 'tour.create_submit.title',
        titleFallback: 'Send it',
        bodyKey: 'tour.create_submit.body',
        bodyFallback: 'Press Enter (or the send button) and Bee Flow will build your agent from the description.',
    },
    {
        id: 'createDone',
        placement: 'center',
        requiresStudio: true,
        requiresAgentCreated: true,
        icon: '🎉',
        titleKey: 'tour.create_done.title',
        titleFallback: 'Your agent is ready',
        bodyKey: 'tour.create_done.body',
        bodyFallback: "Nice! It's saved as a draft. Refine it in the chat on the left, then publish it to share with your team.",
    },

    {
        id: 'done',
        placement: 'center',
        icon: '🐝',
        titleKey: 'tour.done.title',
        titleFallback: "You're all set",
        bodyKey: 'tour.done.body',
        bodyFallback: 'That covers the basics. You can replay this tour anytime from Settings → Help & Support.',
    },
];

// Mirrors the Studio nav-item visibility check in Sidebar.jsx so we never point
// a user at a Studio they can't open (or ask them to create an agent they
// can't create).
export function canUseStudio(user) {
    const perms = user?.permissions || [];
    return (
        !!user?.isAdmin ||
        perms.includes('all') ||
        perms.includes('manage_agents') ||
        perms.includes('manage_skills') ||
        user?.orgRole === 'admin' ||
        user?.orgRole === 'org_admin'
    );
}

// Steps actually shown to this user (drops Studio-gated stops — including the
// whole create-an-agent sequence — for members who can't reach Studio).
export function resolveTourSteps(user) {
    return TOUR_STEPS.filter((s) => !(s.requiresStudio && !canUseStudio(user)));
}

// Per-user completion flag (server user-settings blob + local guard).
export const TOUR_SEEN_KEY = 'hasSeenIntroTour';

// Window events.
export const TOUR_START_EVENT = 'beeflow:start-tour';
export const TOUR_ENSURE_SIDEBAR_EVENT = 'beeflow:tour-ensure-sidebar-open';
