// BeeFlow-contextual starter prompts (BFSF-192). These reflect what people
// actually do in Bee Flow — meetings, knowledge bases, agents, notebooks,
// automations, reports — instead of the old generic ChatGPT-style list. They
// use dedicated `starter.sp_*` keys so a stale DB override of the legacy
// `starter.prompt_*` keys can't bring the generic prompts back; the `text`
// field is passed to t() as the fallback so they render even before any
// translation exists.
export const ALL_PROMPTS = [
    { text: "Summarize my latest meeting notes into action items", icon: "📝", i18nKey: "starter.sp_0" },
    { text: "Draft a project proposal for a new client", icon: "📋", i18nKey: "starter.sp_1" },
    { text: "Help me design an AI agent for customer support", icon: "🤖", i18nKey: "starter.sp_2" },
    { text: "Find the key insights across my knowledge base", icon: "📚", i18nKey: "starter.sp_3" },
    { text: "Write a polished email to a client", icon: "📧", i18nKey: "starter.sp_4" },
    { text: "Plan my week and prioritize my tasks", icon: "📅", i18nKey: "starter.sp_5" },
    { text: "Turn this transcript into a clear summary", icon: "🎙️", i18nKey: "starter.sp_6" },
    { text: "Draft a structured report from my notes", icon: "📊", i18nKey: "starter.sp_7" },
    { text: "Brainstorm ideas for our next team project", icon: "💡", i18nKey: "starter.sp_8" },
    { text: "Help me automate a repetitive workflow", icon: "⚙️", i18nKey: "starter.sp_9" },
    { text: "Write a clear job description for a new role", icon: "💼", i18nKey: "starter.sp_10" },
    { text: "Compare a few options and recommend the best one", icon: "⚖️", i18nKey: "starter.sp_11" },
    { text: "Create a checklist for onboarding a new hire", icon: "✅", i18nKey: "starter.sp_12" },
    { text: "Draft a follow-up message after a meeting", icon: "📨", i18nKey: "starter.sp_13" },
    { text: "Help me prepare for an important meeting", icon: "🤝", i18nKey: "starter.sp_14" },
    { text: "Review this text and suggest improvements", icon: "✍️", i18nKey: "starter.sp_15" },
    { text: "Organize my ideas into a clear outline", icon: "🗂️", i18nKey: "starter.sp_16" },
    { text: "Research a topic and cite the sources", icon: "🔎", i18nKey: "starter.sp_17" },
    { text: "Write the minutes from my meeting notes", icon: "🗒️", i18nKey: "starter.sp_18" },
    { text: "Suggest the next steps for my project", icon: "🚀", i18nKey: "starter.sp_19" },
    { text: "Build a simple webpage for our product", icon: "🌐", i18nKey: "starter.sp_20" },
    { text: "Explain a complex topic to my team simply", icon: "🧩", i18nKey: "starter.sp_21" },
    { text: "Draft an agenda for our team meeting", icon: "📌", i18nKey: "starter.sp_22" },
    { text: "Help me get started with Bee Flow", icon: "🐝", i18nKey: "starter.sp_23" }
];

export const WELCOME_MESSAGES = [
    { text: "Where should we start?", i18nKey: "starter.welcome_0" },
    { text: "How can I help you today?", i18nKey: "starter.welcome_1" },
    { text: "What's on your mind?", i18nKey: "starter.welcome_2" },
    { text: "Let's build something great.", i18nKey: "starter.welcome_3" },
    { text: "Ready to explore?", i18nKey: "starter.welcome_4" },
    { text: "What are we working on?", i18nKey: "starter.welcome_5" },
    { text: "Ask me anything.", i18nKey: "starter.welcome_6" },
    { text: "Let's get started.", i18nKey: "starter.welcome_7" },
    { text: "How can I assist you?", i18nKey: "starter.welcome_8" },
    { text: "Need a hand with something?", i18nKey: "starter.welcome_9" }
];
