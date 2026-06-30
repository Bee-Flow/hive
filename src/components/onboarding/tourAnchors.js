// Central registry of every [data-tour] anchor a lesson can spotlight.
//
// WHY THIS EXISTS: a tour step that targets an element which isn't currently in the
// DOM silently falls back to a centered card — the "sometimes the GUI step doesn't
// work" complaint. The worst offenders live inside the Agent Designer, which renders
// its sections by `activeSection` state: the anchor only exists when the right
// section is open. This registry records, for each anchor, WHAT must be true for it
// to render (which Designer section, whether the sidebar must be open). The engine
// reads it to REVEAL that context before targeting, and a build-time test asserts
// every anchor a lesson references is registered (so a rename fails CI, not a user).
//
// reveal:
//   sidebar:true        — dispatch TOUR_ENSURE_SIDEBAR_EVENT first (rail auto-collapses)
//   designerSection:'…' — dispatch TOUR_OPEN_DESIGNER_SECTION first (open that section)

export const TOUR_ANCHORS = {
    'nav-new-chat': { selector: '[data-tour="nav-new-chat"]', owner: 'Sidebar.jsx', reveal: { sidebar: true } },
    'nav-studio': { selector: '[data-tour="nav-studio"]', owner: 'Sidebar.jsx', reveal: { sidebar: true } },
    'nav-agents': { selector: '[data-tour="nav-agents"]', owner: 'Sidebar.jsx', reveal: { sidebar: true } },
    'account': { selector: '[data-tour="account"]', owner: 'Sidebar.jsx', reveal: { sidebar: true } },
    'settings-nav-preferences': { selector: '[data-testid="settings-nav-preferences"]', owner: 'Settings nav', reveal: {} },

    'chat-composer': { selector: '[data-tour="chat-composer"]', owner: 'InputArea.jsx', reveal: {} },
    'agent-wizard-prompt': { selector: '[data-tour="agent-wizard-prompt"]', owner: 'AgentWizard/index.jsx', reveal: {}, ephemeral: true },

    // Agent Designer — these only render when their section is the active one.
    'agent-system-prompt': { selector: '[data-tour="agent-system-prompt"]', owner: 'AgentDesigner/sections/IdentitySection.jsx', reveal: { designerSection: 'identity' } },
    'agent-tools': { selector: '[data-tour="agent-tools"]', owner: 'AgentDesigner/sections/ToolsSection.jsx', reveal: { designerSection: 'tools' } },
    'agent-knowledge': { selector: '[data-tour="agent-knowledge"]', owner: 'KnowledgePanel.jsx (Designer knowledge section)', reveal: { designerSection: 'knowledge' } },

    'skill-create': { selector: '[data-tour="skill-create"]', owner: 'skills/SkillsGrid.jsx', reveal: {} },
    'knowledge-create': { selector: '[data-tour="knowledge-create"]', owner: 'Studio/KBsStudio/index.jsx', reveal: {} },
    'integration-card': { selector: '[data-tour="integration-card"]', owner: 'settings/IntegrationsSection.jsx', reveal: {} },
    'memory-manage': { selector: '[data-tour="memory-manage"]', owner: 'settings/MemorySection.jsx', reveal: {} },
    'routine-create': { selector: '[data-tour="routine-create"]', owner: 'AITasksDesigner/index.jsx', reveal: {} },
    'usage-summary': { selector: '[data-tour="usage-summary"]', owner: 'settings/UsageSection.jsx', reveal: {} },
};

// All registered selectors (for the validator test).
export const KNOWN_SELECTORS = new Set(Object.values(TOUR_ANCHORS).map((a) => a.selector));

// Reveal directives for a given target selector, or null when the selector isn't a
// registered anchor (e.g. an ad-hoc selector). The engine calls this before
// targeting so it can open the owning Designer section / sidebar first.
export function revealForTarget(selector) {
    if (!selector) return null;
    const anchor = Object.values(TOUR_ANCHORS).find((a) => a.selector === selector);
    return anchor ? (anchor.reveal || {}) : null;
}
