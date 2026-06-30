// Learning Center lesson catalog.
//
// Each lesson is a short guided walkthrough that runs on the SAME engine as the
// new-user product tour (see OnboardingTour.jsx). A lesson reuses the exact step
// schema documented in tourSteps.js, so anything the intro tour can do — spotlight
// a [data-tour] selector, navigate between views, run an interactive "do it
// yourself" step, fall back to a centered card when a target is missing — a lesson
// can do too.
//
// The original 12-step intro tour is the canonical `getting-started` lesson: its
// steps ARE TOUR_STEPS (no copy), so the first-login auto-start and the "Take the
// tour" button keep running the same sequence.
//
// Lesson descriptor:
//   id          — stable key (React keys, completion map, analytics)
//   group       — 'basics' | 'building' | 'power' | 'admin' (card grouping)
//   icon        — emoji, rendered in the engine's 36px tinted tile (never purple)
//   estMinutes  — rough time, shown on the card
//   titleKey/titleFallback, descKey/descFallback — card copy (fallback always renders)
//   gate        — { permission?: string|string[], feature?: string }. Omit → everyone.
//                 A lesson the user can't access (missing permission OR plan
//                 feature) is hidden entirely (resolveLessons).
//   steps       — array of tour steps (same schema as tourSteps.js)

import { checkPermission } from '../../hooks/usePermissionCheck';
import {
    TOUR_STEPS,
    filterStepsForUser,
    TOUR_SEEN_KEY,
    TOUR_START_EVENT,
    TOUR_ENSURE_SIDEBAR_EVENT,
} from './tourSteps';
import { stepType, STEP_TYPES } from './stepTypes';

export const DEFAULT_LESSON_ID = 'getting-started';

// Engine → page signal so an open Learning Center can flip a card to "Replay"
// the moment a lesson finishes.
export const LESSON_COMPLETE_EVENT = 'beeflow:lesson-complete';

// Page → LessonPlayerHost signal to open a rich (slide/quiz/exercise) lesson in
// the focused player. Pure-tour lessons skip the player and dispatch
// TOUR_START_EVENT straight to the engine instead (see lessonIsPureTour).
export const LESSON_PLAYER_OPEN_EVENT = 'beeflow:open-lesson';

// Re-export the event names so the Learning Center page has a single import
// surface (it dispatches TOUR_START_EVENT and listens for LESSON_COMPLETE_EVENT).
export { TOUR_START_EVENT, TOUR_ENSURE_SIDEBAR_EVENT, TOUR_SEEN_KEY };

/* ── Lesson 2: Writing effective prompts ─────────────────────────────────── */
const PROMPTS_STEPS = [
    {
        id: 'prompts-intro', placement: 'center', icon: '💬',
        titleKey: 'learn.effective-prompts.intro.title', titleFallback: 'Writing effective prompts',
        bodyKey: 'learn.effective-prompts.intro.body',
        bodyFallback: 'A great prompt is context + a clear ask + the format you want back. Four quick tips to get better answers — in any chat.',
    },
    {
        id: 'prompts-where', navigateTo: 'agents', target: '[data-tour="chat-composer"]',
        placement: 'top', optional: true, timeoutMs: 6000, icon: '⌨️',
        titleKey: 'learn.effective-prompts.where.title', titleFallback: 'This is where you ask',
        bodyKey: 'learn.effective-prompts.where.body',
        bodyFallback: 'Type here for quick, free-form questions. For specialised help, pick an agent first — same tips apply.',
    },
    {
        id: 'prompts-context', placement: 'center', icon: '🧭',
        titleKey: 'learn.effective-prompts.context.title', titleFallback: '1. Give context',
        bodyKey: 'learn.effective-prompts.context.body',
        bodyFallback: 'Say who you are and what you are working on — e.g. “I run support for a SaaS company.” Context steers the whole answer.',
    },
    {
        id: 'prompts-specific', placement: 'center', icon: '🎯',
        titleKey: 'learn.effective-prompts.specific.title', titleFallback: '2. Make the ask specific',
        bodyKey: 'learn.effective-prompts.specific.body',
        bodyFallback: 'Instead of “write an email”, try “draft a 3-sentence reply apologising for a late delivery and offering 10% off.”',
    },
    {
        id: 'prompts-format', placement: 'center', icon: '📐',
        titleKey: 'learn.effective-prompts.format.title', titleFallback: '3. Ask for a format, then iterate',
        bodyKey: 'learn.effective-prompts.format.body',
        bodyFallback: 'Request bullet points, a table, or a tone (“friendly”, “formal”). Not quite right? Just say “shorter” or “more detail”.',
    },
    {
        id: 'prompts-done', placement: 'center', icon: '✅',
        titleKey: 'learn.effective-prompts.done.title', titleFallback: 'Try it now',
        bodyKey: 'learn.effective-prompts.done.body',
        bodyFallback: 'Open a chat and give one a go. You can replay this lesson anytime from the Learning Center.',
    },
];

/* ── Lesson 3: Creating an agent (rich: slides + live build + quiz) ───────── */
const CREATE_AGENT_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'ca-what', icon: '🤖',
        titleKey: 'learn.creating-agents.what.title', titleFallback: 'What is an agent?',
        bodyMdKey: 'learn.creating-agents.what.body',
        bodyMdFallback: 'An **agent** is an AI assistant you shape for a specific job. Every agent has three parts:\n\n- **A system prompt** — its role, tone and rules.\n- **Tools** — the things it can actually do (email, calendar, web search…).\n- **Knowledge** — your documents it can answer from.\n\nThe quickest way to start: describe what you want in plain English and let Bee Flow draft it. Nothing is created until you submit.',
    },
    {
        id: 'ca-studio', target: '[data-tour="nav-studio"]', placement: 'right',
        ensureSidebarOpen: true, requiresStudio: true, optional: true, icon: '🛠️',
        titleKey: 'learn.creating-agents.studio.title', titleFallback: 'Studio is home base',
        bodyKey: 'learn.creating-agents.studio.body',
        bodyFallback: 'Your agents live in Studio. Each one has a system prompt, tools, and knowledge. Let’s make one.',
    },
    {
        id: 'ca-describe', navigateTo: 'agentWizard', target: '[data-tour="agent-wizard-prompt"]',
        placement: 'bottom', requiresStudio: true, optional: true, interactive: true, timeoutMs: 8000,
        advanceOn: { input: { minLength: 4 }, targetGone: true },
        actionHintKey: 'learn.creating-agents.describe.hint', actionHintFallback: '👉 Describe your agent…',
        icon: '✍️',
        titleKey: 'learn.creating-agents.describe.title', titleFallback: 'Describe what it should do',
        bodyKey: 'learn.creating-agents.describe.body',
        bodyFallback: 'Type a sentence, e.g. “An assistant that turns meeting notes into action items.” Then press Enter to build it.',
    },
    {
        type: STEP_TYPES.SLIDE, id: 'ca-refine', icon: '🎉',
        titleKey: 'learn.creating-agents.refine.title', titleFallback: 'Refine, then publish',
        bodyMdKey: 'learn.creating-agents.refine.body',
        bodyMdFallback: 'Your draft is **private** until you publish it. Next, you’ll tune the system prompt, switch on tools, and attach knowledge in the **Agent Designer** — then publish to share it with your team.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'ca-quiz', icon: '❓',
        questionKey: 'learn.creating-agents.quiz.q', questionFallback: 'Which three parts shape how an agent behaves?',
        choices: [
            { id: 'a', labelFallback: 'System prompt, tools, and knowledge.', correct: true },
            { id: 'b', labelFallback: 'Its name, its colour, and its avatar.', correct: false },
            { id: 'c', labelFallback: 'The model price, the speed, and the region.', correct: false },
        ],
        explanationFallback: 'An agent is its system prompt (role/tone/rules) + the tools it can use + the knowledge it can draw on.',
    },
];

/* ── Lesson 4: Refining an agent (rich: slides + reliable designer tour + exercise) ── */
const REFINE_PROMPT_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'rp-what', icon: '🛠️',
        titleKey: 'learn.refining-prompt.what.title', titleFallback: 'The three dials of an agent',
        bodyMdKey: 'learn.refining-prompt.what.body',
        bodyMdFallback: 'The **Agent Designer** is where you shape behaviour. You’ll spend most of your time on three dials:\n\n1. **System prompt** — the agent’s role, tone and rules.\n2. **Tools** — what it’s allowed to do.\n3. **Knowledge** — the documents it answers from.\n\nNext we’ll spotlight each one in the real Designer — open an agent to follow along.',
    },
    {
        id: 'rp-open', navigateTo: 'studio/agents', placement: 'center', optional: true, timeoutMs: 6000, icon: '🗂️',
        titleKey: 'learn.refining-prompt.open.title', titleFallback: 'Open an agent',
        bodyKey: 'learn.refining-prompt.open.body',
        bodyFallback: 'Pick any agent in Studio to open its designer. The three things below are what you’ll tune most.',
    },
    {
        id: 'rp-system', target: '[data-tour="agent-system-prompt"]', placement: 'top', optional: true, timeoutMs: 6000, icon: '📝',
        titleKey: 'learn.refining-prompt.system.title', titleFallback: 'The system prompt',
        bodyKey: 'learn.refining-prompt.system.body',
        bodyFallback: 'This sets the agent’s role, tone, and rules. Be specific: who it is, what it always/never does, and how it should respond.',
    },
    {
        id: 'rp-tools', target: '[data-tour="agent-tools"]', placement: 'top', optional: true, timeoutMs: 6000, icon: '🧰',
        titleKey: 'learn.refining-prompt.tools.title', titleFallback: 'Tools & integrations',
        bodyKey: 'learn.refining-prompt.tools.body',
        bodyFallback: 'Give the agent abilities — email, calendar, web search, and more — by switching on the tools it’s allowed to use.',
    },
    {
        id: 'rp-knowledge', target: '[data-tour="agent-knowledge"]', placement: 'top', optional: true, timeoutMs: 6000, icon: '📚',
        titleKey: 'learn.refining-prompt.knowledge.title', titleFallback: 'Knowledge',
        bodyKey: 'learn.refining-prompt.knowledge.body',
        bodyFallback: 'Attach a knowledge base so the agent answers from your documents instead of guessing.',
    },
    {
        type: STEP_TYPES.EXERCISE, id: 'rp-ex', exerciseId: 'ex-system-prompt', icon: '🎯',
        titleKey: 'learn.refining-prompt.ex.title', titleFallback: 'Your turn: write a system prompt',
        instructionKey: 'learn.refining-prompt.ex.instruction',
        instructionFallback: 'Write a system prompt for an agent of your choice. Define its role, set a tone, and give it at least one clear rule (something it should always or never do).',
        placeholderFallback: 'e.g. “You are a friendly customer-support assistant for an online bookstore. Always be concise and warm. Never promise refunds — instead, direct the customer to the returns page. If you don’t know an answer, say so and offer to escalate.”',
        passScore: 70, maxAttempts: 4,
    },
    {
        type: STEP_TYPES.QUIZ, id: 'rp-quiz', icon: '❓',
        questionKey: 'learn.refining-prompt.quiz.q', questionFallback: 'An agent keeps answering off-topic and too casually. Where do you look first?',
        choices: [
            { id: 'a', labelFallback: 'The system prompt — tighten its role, tone and rules.', correct: true },
            { id: 'b', labelFallback: 'The agent’s avatar.', correct: false },
            { id: 'c', labelFallback: 'Delete it and start over.', correct: false },
        ],
        explanationFallback: 'Tone and scope live in the system prompt — make the role and rules more specific before anything else.',
    },
];

/* ── Lesson 5: Creating a skill (rich) ───────────────────────────────────── */
const SKILLS_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'sk-intro', icon: '🧩',
        titleKey: 'learn.creating-skills.intro.title', titleFallback: 'Package a reusable skill',
        bodyMdKey: 'learn.creating-skills.intro.body',
        bodyMdFallback: 'A **skill** is a repeatable workflow you teach once and reuse everywhere — attach it to any agent and it triggers when the task fits. A skill has four parts:\n\n- **Instructions** — what to do.\n- **Workflow** — the steps to follow.\n- **Rules** — the dos and don’ts.\n- **Examples** — what good output looks like.',
    },
    {
        id: 'sk-create', navigateTo: 'studio/skills', target: '[data-tour="skill-create"]',
        placement: 'bottom', optional: true, timeoutMs: 6000, icon: '➕',
        titleKey: 'learn.creating-skills.create.title', titleFallback: 'Start a new skill',
        bodyKey: 'learn.creating-skills.create.body',
        bodyFallback: 'This is the Skills library. Create a new skill to open the editor with its four sections.',
    },
    {
        type: STEP_TYPES.SLIDE, id: 'sk-attach', icon: '🔗',
        titleKey: 'learn.creating-skills.attach.title', titleFallback: 'Attach it to an agent',
        bodyMdKey: 'learn.creating-skills.attach.body',
        bodyMdFallback: 'Save the skill, then add it to an agent from the **Agent Designer**. From then on, the agent triggers the skill automatically whenever a task matches it — so your best workflow runs the same way every time.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'sk-quiz', icon: '❓',
        questionKey: 'learn.creating-skills.quiz.q', questionFallback: 'What’s the point of a skill?',
        choices: [
            { id: 'a', labelFallback: 'Teach a workflow once and reuse it across agents, consistently.', correct: true },
            { id: 'b', labelFallback: 'Make an agent reply in a different language.', correct: false },
            { id: 'c', labelFallback: 'Speed up the model.', correct: false },
        ],
        explanationFallback: 'A skill packages a repeatable workflow (instructions, steps, rules, examples) so any agent can run it the same way every time.',
    },
];

/* ── Lesson 6: Adding a knowledge base (rich: slides + live create + quiz) ── */
const KNOWLEDGE_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'kb-what', icon: '📚',
        titleKey: 'learn.knowledge-bases.what.title', titleFallback: 'Give agents your knowledge',
        bodyMdKey: 'learn.knowledge-bases.what.body',
        bodyMdFallback: 'Out of the box, an agent only knows general information. A **knowledge base** lets it answer from **your** content — PDFs, docs, spreadsheets — accurately and **with sources**.\n\nHow it works:\n1. Create a knowledge base and upload files.\n2. Bee Flow indexes them so the agent can search inside.\n3. Attach it to an agent under **Knowledge**.',
    },
    {
        id: 'kb-create', navigateTo: 'studio/knowledge', target: '[data-tour="knowledge-create"]',
        placement: 'bottom', optional: true, timeoutMs: 6000, icon: '⬆️',
        titleKey: 'learn.knowledge-bases.create.title', titleFallback: 'Create a knowledge base',
        bodyKey: 'learn.knowledge-bases.create.body',
        bodyFallback: 'Add a knowledge base and upload files — PDFs, docs, spreadsheets. Bee Flow indexes them so agents can search inside.',
    },
    {
        type: STEP_TYPES.SLIDE, id: 'kb-attach', icon: '🔗',
        titleKey: 'learn.knowledge-bases.attach.title', titleFallback: 'Attach it, then ask away',
        bodyMdKey: 'learn.knowledge-bases.attach.body',
        bodyMdFallback: 'In the **Agent Designer → Knowledge**, attach your knowledge base. Now when you chat with the agent and ask about your content, it answers from your documents and **cites the source** it used.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'kb-quiz', icon: '❓',
        questionKey: 'learn.knowledge-bases.quiz.q', questionFallback: 'Why attach a knowledge base to an agent?',
        choices: [
            { id: 'a', labelFallback: 'So it answers from your own documents, with sources, instead of guessing.', correct: true },
            { id: 'b', labelFallback: 'To make the agent respond faster.', correct: false },
            { id: 'c', labelFallback: 'To change the agent’s name.', correct: false },
        ],
        explanationFallback: 'A knowledge base grounds the agent in your content, so answers are accurate and cite where they came from.',
    },
];

/* ── Lesson 7: Connecting integrations (rich) ────────────────────────────── */
const INTEGRATIONS_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'int-intro', icon: '🔌',
        titleKey: 'learn.connecting-integrations.intro.title', titleFallback: 'Connect your tools',
        bodyMdKey: 'learn.connecting-integrations.intro.body',
        bodyMdFallback: 'Link the apps your team already uses — **email, calendar, drive** and more — so agents can act on your behalf. Once a service is connected, any agent with the matching **tool** switched on can use it: read your calendar, send mail, search your drive.',
    },
    {
        id: 'int-card', navigateTo: 'settings/integrations', target: '[data-tour="integration-card"]',
        placement: 'top', optional: true, timeoutMs: 6000, icon: '🧩',
        titleKey: 'learn.connecting-integrations.card.title', titleFallback: 'Pick a service to connect',
        bodyKey: 'learn.connecting-integrations.card.body',
        bodyFallback: 'Choose a service and connect it securely. Once linked, agents with the matching tool enabled can use it.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'int-quiz', icon: '❓',
        questionKey: 'learn.connecting-integrations.quiz.q', questionFallback: 'After you connect an integration, what makes an agent able to use it?',
        choices: [
            { id: 'a', labelFallback: 'Switching on the matching tool for that agent in the Agent Designer.', correct: true },
            { id: 'b', labelFallback: 'Nothing — every agent uses it automatically.', correct: false },
            { id: 'c', labelFallback: 'Re-installing the app.', correct: false },
        ],
        explanationFallback: 'Connecting the service is step one; the agent also needs the matching tool enabled before it can act on it.',
    },
];

/* ── Lesson 8: Using memory (rich) ───────────────────────────────────────── */
const MEMORY_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'mem-intro', icon: '🧠',
        titleKey: 'learn.using-memory.intro.title', titleFallback: 'Let Bee Flow remember',
        bodyMdKey: 'learn.using-memory.intro.body',
        bodyMdFallback: 'Memory keeps useful **facts and preferences** across conversations, so you don’t repeat yourself every time. Mention something once — “I prefer concise replies”, “our company is called Acme” — and Bee Flow remembers it for next time. You’re always in control: every memory can be reviewed, edited, or removed.',
    },
    {
        id: 'mem-manage', navigateTo: 'settings/memory', target: '[data-tour="memory-manage"]',
        placement: 'top', optional: true, timeoutMs: 6000, icon: '🗃️',
        titleKey: 'learn.using-memory.manage.title', titleFallback: 'Review what’s remembered',
        bodyKey: 'learn.using-memory.manage.body',
        bodyFallback: 'Memories are saved automatically as you chat. Here you can review, edit, or remove anything — you’re always in control.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'mem-quiz', icon: '❓',
        questionKey: 'learn.using-memory.quiz.q', questionFallback: 'How do you get Bee Flow to remember a preference?',
        choices: [
            { id: 'a', labelFallback: 'Just mention it in chat — it’s saved automatically, and you can review it in settings.', correct: true },
            { id: 'b', labelFallback: 'You can’t — it forgets everything between chats.', correct: false },
            { id: 'c', labelFallback: 'Email support to add it manually.', correct: false },
        ],
        explanationFallback: 'Memory is automatic — mention a fact or preference and it persists across chats, fully under your control.',
    },
];

/* ── Lesson 9: Automations & routines (rich) ─────────────────────────────── */
const AUTOMATIONS_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'auto-intro', icon: '⏱️',
        titleKey: 'learn.automations.intro.title', titleFallback: 'Run agents on a schedule',
        bodyMdKey: 'learn.automations.intro.body',
        bodyMdFallback: '**Routines** let an agent run automatically — a morning briefing, a weekly report — without you lifting a finger. You pick an agent, write what it should do, and choose **when** it runs. The results land where you ask for them, and you can pause, edit, or run a routine on demand anytime.',
    },
    {
        id: 'auto-create', navigateTo: 'studio/routines', target: '[data-tour="routine-create"]',
        placement: 'bottom', optional: true, timeoutMs: 6000, icon: '🗓️',
        titleKey: 'learn.automations.create.title', titleFallback: 'Create a routine',
        bodyKey: 'learn.automations.create.body',
        bodyFallback: 'Pick an agent, write what it should do, and choose when it runs. Results land where you ask for them.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'auto-quiz', icon: '❓',
        questionKey: 'learn.automations.quiz.q', questionFallback: 'What does a routine let you do?',
        choices: [
            { id: 'a', labelFallback: 'Run an agent automatically on a schedule, with results delivered where you choose.', correct: true },
            { id: 'b', labelFallback: 'Permanently delete an agent.', correct: false },
            { id: 'c', labelFallback: 'Translate the interface.', correct: false },
        ],
        explanationFallback: 'Routines schedule an agent to run on its own — briefings, reports and more — and you stay in control to pause or edit anytime.',
    },
];

/* ── Lesson 10: Usage & monitoring (admin, rich) ─────────────────────────── */
const ORG_USAGE_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'usage-intro', icon: '📊',
        titleKey: 'learn.org-usage.intro.title', titleFallback: 'Keep an eye on usage',
        bodyMdKey: 'learn.org-usage.intro.body',
        bodyMdFallback: 'As an admin you can see how your organisation uses Bee Flow — **activity** and where **spend** is going, broken down by source and model over any date range. The Workspace area also holds **Privacy Shield** and monitoring: your controls for PII handling and oversight.',
    },
    {
        id: 'usage-summary', navigateTo: 'settings/organisation/usage', target: '[data-tour="usage-summary"]',
        placement: 'bottom', optional: true, timeoutMs: 6000, icon: '📈',
        titleKey: 'learn.org-usage.summary.title', titleFallback: 'Usage at a glance',
        bodyKey: 'learn.org-usage.summary.body',
        bodyFallback: 'See activity and cost broken down by source and model, over the date range you choose.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'usage-quiz', icon: '❓',
        questionKey: 'learn.org-usage.quiz.q', questionFallback: 'Where do admins track activity, spend, and privacy controls?',
        choices: [
            { id: 'a', labelFallback: 'The Workspace area — usage by source/model plus Privacy Shield and monitoring.', correct: true },
            { id: 'b', labelFallback: 'Only by contacting support.', correct: false },
            { id: 'c', labelFallback: 'In each individual chat.', correct: false },
        ],
        explanationFallback: 'The org Workspace area surfaces usage and cost breakdowns alongside Privacy Shield and monitoring controls.',
    },
];

/* ════════════════════════════════════════════════════════════════════════════
 * Prompt Engineering course — five rich lessons (slides + quizzes + AI-graded
 * exercises). These use the extended step schema (see stepTypes.js): steps carry
 * a `type` of 'slide' | 'quiz' | 'exercise', plus optional 'tour' steps that hand
 * off to the live-app engine. Exercise steps reference a server-side rubric by
 * `exerciseId` (see server/learning/rubrics.js) — the rubric never ships to the
 * client. `passScore` gates the soft pass; `maxAttempts` enables skip-after-N.
 * ══════════════════════════════════════════════════════════════════════════ */

/* ── Lesson: Anatomy of a great prompt ───────────────────────────────────── */
const PROMPT_BASICS_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'pb-anatomy', icon: '🧬',
        titleKey: 'learn.prompt-basics.anatomy.title', titleFallback: 'The anatomy of a great prompt',
        bodyMdKey: 'learn.prompt-basics.anatomy.body',
        bodyMdFallback: 'Almost every strong prompt has **three parts**:\n\n1. **Context** — who you are and what you’re working on.\n2. **A clear task** — exactly what you want done.\n3. **The output format** — how you want the answer back (bullets, a table, a tone, a length).\n\nMiss one and the model has to guess. Include all three and you steer the whole answer.',
    },
    {
        type: STEP_TYPES.SLIDE, id: 'pb-compare', icon: '⚖️',
        titleKey: 'learn.prompt-basics.compare.title', titleFallback: 'Vague in, vague out',
        bodyMdKey: 'learn.prompt-basics.compare.body',
        bodyMdFallback: '**Vague:** “write an email about the delay”\n\n**Specific:** “Draft a 3-sentence email to a customer apologising for a 2-day shipping delay, offering 10% off their next order, in a warm but professional tone.”\n\nThe second one names the audience, the task, the length, the offer and the tone — so there’s almost nothing left to guess.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'pb-q1', icon: '❓',
        questionKey: 'learn.prompt-basics.q1.q', questionFallback: 'Which prompt will reliably get the most useful first answer?',
        choices: [
            { id: 'a', labelFallback: '“Summarise this.”', correct: false },
            { id: 'b', labelFallback: '“Summarise the report below into 5 bullet points a busy executive can read in 30 seconds.”', correct: true },
            { id: 'c', labelFallback: '“Can you help me with this report?”', correct: false },
        ],
        explanationFallback: 'Option B names the task (summarise), the format (5 bullets) and the audience (a busy executive) — so the model knows exactly what “good” looks like.',
    },
    {
        type: STEP_TYPES.EXERCISE, id: 'pb-ex', exerciseId: 'ex-basics-specific', icon: '🎯',
        titleKey: 'learn.prompt-basics.ex.title', titleFallback: 'Your turn: make it specific',
        instructionKey: 'learn.prompt-basics.ex.instruction',
        instructionFallback: 'Rewrite this weak prompt into a strong one. Start from: “write something about our new feature.” Add context, a specific task, and the format you want back.',
        placeholderFallback: 'e.g. “You’re writing for our SaaS blog. Draft a 150-word announcement of our new dark-mode feature for existing users, in a friendly tone, ending with a one-line call to action.”',
        passScore: 70, maxAttempts: 4,
    },
];

/* ── Lesson: Give context ────────────────────────────────────────────────── */
const PROMPT_CONTEXT_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'pc-why', icon: '🧭',
        titleKey: 'learn.prompt-context.why.title', titleFallback: 'Context steers everything',
        bodyMdKey: 'learn.prompt-context.why.body',
        bodyMdFallback: 'The model doesn’t know your situation unless you tell it. A single sentence of context changes the entire answer.\n\nTry giving it:\n- **Your role** — “I run support for a SaaS company.”\n- **The audience** — “for non-technical small-business owners.”\n- **The goal** — “I want to reduce refund requests.”',
    },
    {
        type: STEP_TYPES.SLIDE, id: 'pc-roles', icon: '🎭',
        titleKey: 'learn.prompt-context.roles.title', titleFallback: 'Set a role for the model too',
        bodyMdKey: 'learn.prompt-context.roles.body',
        bodyMdFallback: 'You can also tell the model **who to be**: “Act as a senior copywriter” or “You are a careful financial analyst.” A role primes its tone, vocabulary and level of caution — a fast way to raise the quality of the first draft.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'pc-q1', icon: '❓',
        questionKey: 'learn.prompt-context.q1.q', questionFallback: 'A prompt gives a generic, off-target answer. What’s the most likely fix?',
        choices: [
            { id: 'a', labelFallback: 'Add who you are, who it’s for, and what you’re trying to achieve.', correct: true },
            { id: 'b', labelFallback: 'Ask the exact same question again, but louder (ALL CAPS).', correct: false },
            { id: 'c', labelFallback: 'Make the prompt as short as possible.', correct: false },
        ],
        explanationFallback: 'Generic answers usually mean missing context. Telling the model your role, audience and goal is the highest-leverage fix.',
    },
    {
        type: STEP_TYPES.EXERCISE, id: 'pc-ex', exerciseId: 'ex-context-add', icon: '🎯',
        titleKey: 'learn.prompt-context.ex.title', titleFallback: 'Your turn: add the context',
        instructionKey: 'learn.prompt-context.ex.instruction',
        instructionFallback: 'Take the bare task “suggest three blog post ideas” and add real context — your role, your audience, and your goal — so the ideas come back genuinely on-target.',
        placeholderFallback: 'e.g. “I’m the marketing lead for a B2B accounting tool aimed at freelancers. Suggest three blog post ideas that would attract freelancers worried about tax season and nudge them to try our free trial.”',
        passScore: 70, maxAttempts: 4,
    },
];

/* ── Lesson: Structure & format ──────────────────────────────────────────── */
const PROMPT_STRUCTURE_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'pst-format', icon: '📐',
        titleKey: 'learn.prompt-structure.format.title', titleFallback: 'Ask for the shape you want',
        bodyMdKey: 'learn.prompt-structure.format.body',
        bodyMdFallback: 'Tell the model the **format** and you’ll rarely have to reformat by hand:\n\n- “Reply as a **table** with columns Name, Risk, Action.”\n- “Give me **exactly 5 bullets**, each under 12 words.”\n- “Answer in a **friendly, plain-English** tone.”\n- “Keep it under **100 words**.”',
    },
    {
        type: STEP_TYPES.SLIDE, id: 'pst-delimit', icon: '🧱',
        titleKey: 'learn.prompt-structure.delimit.title', titleFallback: 'Separate instructions from content',
        bodyMdKey: 'learn.prompt-structure.delimit.body',
        bodyMdFallback: 'For longer prompts, keep your **instructions** and the **material** apart so the model never confuses them:\n\n```\nSummarise the text between the lines in 3 bullets.\n---\n<paste your text here>\n---\n```\n\nClear sections beat one long run-on paragraph every time.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'pst-q1', icon: '❓',
        questionKey: 'learn.prompt-structure.q1.q', questionFallback: 'You keep having to reformat the model’s answers by hand. Best first move?',
        choices: [
            { id: 'a', labelFallback: 'State the exact output format in the prompt (table / bullet count / length / tone).', correct: true },
            { id: 'b', labelFallback: 'Accept it — the model can’t follow formatting requests.', correct: false },
            { id: 'c', labelFallback: 'Switch to a different app.', correct: false },
        ],
        explanationFallback: 'Models follow formatting instructions well — the trick is to actually state them: the structure, the length, and the tone.',
    },
    {
        // Optional "try it live" — opens the real chat composer. Marked optional so
        // a missing anchor degrades to a centered card and never blocks the lesson.
        type: STEP_TYPES.TOUR, id: 'pst-trylive', navigateTo: 'agents',
        target: '[data-tour="chat-composer"]', placement: 'top', optional: true, timeoutMs: 6000, icon: '⌨️',
        titleKey: 'learn.prompt-structure.trylive.title', titleFallback: 'This is where you ask',
        bodyKey: 'learn.prompt-structure.trylive.body',
        bodyFallback: 'This is the chat composer. After the lesson, paste a structured prompt here and watch how cleanly the answer comes back.',
    },
    {
        type: STEP_TYPES.EXERCISE, id: 'pst-ex', exerciseId: 'ex-structure-format', icon: '🎯',
        titleKey: 'learn.prompt-structure.ex.title', titleFallback: 'Your turn: specify the format',
        instructionKey: 'learn.prompt-structure.ex.instruction',
        instructionFallback: 'Write a prompt that asks the model to compare three project-management tools — and pin down the output format precisely (a table, named columns, a row limit, and a tone).',
        placeholderFallback: 'e.g. “Compare Asana, Trello and Linear for a 5-person startup. Reply as a table with columns Tool, Best for, Price, One catch. Keep each cell under 10 words and stay neutral.”',
        passScore: 70, maxAttempts: 4,
    },
];

/* ── Lesson: Iterate to perfection ───────────────────────────────────────── */
const PROMPT_ITERATING_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'pit-mindset', icon: '🔁',
        titleKey: 'learn.prompt-iterating.mindset.title', titleFallback: 'The first answer is a draft',
        bodyMdKey: 'learn.prompt-iterating.mindset.body',
        bodyMdFallback: 'Great results rarely come from the first prompt — they come from a quick **follow-up**. The model remembers the conversation, so you can steer with tiny nudges instead of rewriting from scratch.',
    },
    {
        type: STEP_TYPES.SLIDE, id: 'pit-moves', icon: '🛠️',
        titleKey: 'learn.prompt-iterating.moves.title', titleFallback: 'High-leverage follow-ups',
        bodyMdKey: 'learn.prompt-iterating.moves.body',
        bodyMdFallback: 'Keep a few refinements in your back pocket:\n\n- “Make it **shorter** / **more detailed**.”\n- “More **formal** / more **casual**.”\n- “Add a concrete **example**.”\n- “**Why** did you choose that? Now redo it avoiding X.”\n- “Give me **two more options**.”',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'pit-q1', icon: '❓',
        questionKey: 'learn.prompt-iterating.q1.q', questionFallback: 'The answer is 90% right but too long and a bit stiff. What do you do?',
        choices: [
            { id: 'a', labelFallback: 'Start a brand-new chat and rewrite the whole prompt.', correct: false },
            { id: 'b', labelFallback: 'Reply in the same chat: “Cut this to half the length and make the tone warmer.”', correct: true },
            { id: 'c', labelFallback: 'Give up and edit it all by hand.', correct: false },
        ],
        explanationFallback: 'A short follow-up in the same conversation is faster and keeps all the context — no need to start over.',
    },
    {
        type: STEP_TYPES.EXERCISE, id: 'pit-ex', exerciseId: 'ex-iterating-refine', icon: '🎯',
        titleKey: 'learn.prompt-iterating.ex.title', titleFallback: 'Your turn: write the follow-up',
        instructionKey: 'learn.prompt-iterating.ex.instruction',
        instructionFallback: 'Imagine the model just wrote a product description that’s accurate but generic, too long, and salesy. Write the single follow-up message you’d send to fix it — be specific about what to change.',
        placeholderFallback: 'e.g. “Cut this to 60 words, drop the hype words (‘revolutionary’, ‘game-changing’), lead with the one benefit a busy parent cares about, and end with a plain call to action.”',
        passScore: 70, maxAttempts: 4,
    },
];

/* ── Lesson: Advanced techniques ─────────────────────────────────────────── */
const PROMPT_ADVANCED_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'pad-fewshot', icon: '🧪',
        titleKey: 'learn.prompt-advanced.fewshot.title', titleFallback: 'Show, don’t just tell (few-shot)',
        bodyMdKey: 'learn.prompt-advanced.fewshot.body',
        bodyMdFallback: 'When you need a very specific style or pattern, give **one or two examples** of input → output. The model matches the pattern far more reliably than from a description alone.\n\n```\nTurn features into benefits. Examples:\n“256-bit encryption” → “Your data stays private.”\n“Offline mode” → “Works even with no signal.”\nNow do: “Auto-save every 5 seconds” →\n```',
    },
    {
        type: STEP_TYPES.SLIDE, id: 'pad-reasoning', icon: '🪜',
        titleKey: 'learn.prompt-advanced.reasoning.title', titleFallback: 'Ask for a plan, then the work',
        bodyMdKey: 'learn.prompt-advanced.reasoning.body',
        bodyMdFallback: 'For anything multi-step, ask the model to **think first**: “Before answering, outline your approach in 3 steps, then carry it out.” You catch wrong assumptions early — and on big tasks, “give me the plan first, I’ll approve it” saves a lot of redo.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'pad-q1', icon: '❓',
        questionKey: 'learn.prompt-advanced.q1.q', questionFallback: 'You need outputs in a very particular format the model keeps missing. Most reliable technique?',
        choices: [
            { id: 'a', labelFallback: 'Include one or two worked examples of the exact input→output you want (few-shot).', correct: true },
            { id: 'b', labelFallback: 'Repeat “please use the right format” several times.', correct: false },
            { id: 'c', labelFallback: 'Make the temperature as high as possible.', correct: false },
        ],
        explanationFallback: 'A couple of concrete examples (few-shot prompting) pin down a pattern far better than describing it in words.',
    },
    {
        type: STEP_TYPES.EXERCISE, id: 'pad-ex', exerciseId: 'ex-advanced-technique', icon: '🎯',
        titleKey: 'learn.prompt-advanced.ex.title', titleFallback: 'Your turn: use an advanced technique',
        instructionKey: 'learn.prompt-advanced.ex.instruction',
        instructionFallback: 'Write a prompt that uses few-shot examples OR an explicit step-by-step plan to get a hard task right. Pick any task you like — just make the technique visible in your prompt.',
        placeholderFallback: 'e.g. “Classify each support message as Bug / Billing / How-to. Examples: ‘I was charged twice’ → Billing; ‘the app crashes on save’ → Bug. Now classify: …”',
        passScore: 70, maxAttempts: 4,
    },
];

/* ── Lesson: Anatomy of an automation (rich: slides + quiz) ───────────────── */
const AUTOMATION_ANATOMY_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'aa-what', icon: '⚙️',
        titleKey: 'learn.automation-anatomy.what.title', titleFallback: 'What makes an automation',
        bodyMdKey: 'learn.automation-anatomy.what.body',
        bodyMdFallback: 'An **automation** is a workflow that runs without you. Every automation has the same skeleton:\n\n- **A trigger** — when it runs: a schedule (“every Monday 08:00”), a webhook, or an app event.\n- **Steps** — what it does: integration actions (send mail, create tasks), AI reasoning steps, conditions, and loops.\n- **A result** — where the outcome lands: a notification, a document, a chat thread.\n\nYou don’t draw diagrams to build one — describe what you want in plain English and Bee Flow assembles the flow for you.',
    },
    {
        type: STEP_TYPES.SLIDE, id: 'aa-triggers', icon: '⏰',
        titleKey: 'learn.automation-anatomy.triggers.title', titleFallback: 'Pick the right trigger',
        bodyMdKey: 'learn.automation-anatomy.triggers.body',
        bodyMdFallback: 'The trigger decides everything about *when* work happens:\n\n- **Schedule** — recurring work: daily briefings, weekly reports, monthly clean-ups.\n- **Webhook** — another system calls Bee Flow the moment something happens there.\n- **App event** — react to things inside Bee Flow itself.\n\nRule of thumb: if you find yourself doing something *every* Monday, that’s a schedule. If you’re *waiting* for something external, that’s a webhook.',
    },
    {
        type: STEP_TYPES.SLIDE, id: 'aa-dryrun', icon: '🧪',
        titleKey: 'learn.automation-anatomy.dryrun.title', titleFallback: 'Dry-run before you trust it',
        bodyMdKey: 'learn.automation-anatomy.dryrun.body',
        bodyMdFallback: 'Before an automation goes live, use the **dry-run preview** to watch it execute step by step without side effects — no emails sent, nothing written. Once it looks right, enable it and check **run history** after the first few real runs. Treat an automation like a new colleague: trust, but verify the first week.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'aa-quiz', icon: '❓',
        questionKey: 'learn.automation-anatomy.quiz.q', questionFallback: 'You want a summary of new support tickets in your inbox every morning. Which trigger fits?',
        choices: [
            { id: 'a', labelFallback: 'A schedule — it’s recurring, time-based work.', correct: true },
            { id: 'b', labelFallback: 'A webhook — wait for an external system to call in.', correct: false },
            { id: 'c', labelFallback: 'No trigger — run it by hand each morning.', correct: false },
        ],
        explanationFallback: 'Recurring, time-based work is a schedule. Webhooks are for reacting to events in other systems the moment they happen.',
    },
];

/* ── Lesson: Design your own automation (rich: slide + AI-coached exercise) ── */
const AUTOMATION_PRACTICE_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'ap-brief', icon: '📝',
        titleKey: 'learn.automation-practice.brief.title', titleFallback: 'A good brief beats a good diagram',
        bodyMdKey: 'learn.automation-practice.brief.body',
        bodyMdFallback: 'Because you build automations by describing them, the quality of your description IS the quality of your automation. A strong brief names:\n\n- **The trigger** — when should it run?\n- **The source** — what data does it read?\n- **The work** — what should happen with it (including any conditions)?\n- **The destination** — where does the result go, and who is told?\n\nWeak: “automate my reports”. Strong: “Every Friday at 16:00, collect this week’s closed deals from the CRM, have AI write a 5-bullet summary, and email it to the sales channel.”',
    },
    {
        type: STEP_TYPES.EXERCISE, id: 'ap-ex', exerciseId: 'ex-automation-brief', icon: '🎯',
        titleKey: 'learn.automation-practice.ex.title', titleFallback: 'Your turn: brief an automation',
        instructionKey: 'learn.automation-practice.ex.instruction',
        instructionFallback: 'Describe an automation you would actually use, in plain English. Include when it should run (the trigger), what data it works with, what should happen, and where the result should go.',
        placeholderFallback: 'e.g. “Every weekday at 08:30, read yesterday’s new entries from our feedback form, group them by theme, have AI draft a short digest with the top 3 issues, and post it to the product channel. Skip the digest when there are no new entries.”',
        passScore: 70, maxAttempts: 4,
    },
    {
        type: STEP_TYPES.QUIZ, id: 'ap-quiz', icon: '❓',
        questionKey: 'learn.automation-practice.quiz.q', questionFallback: 'Your new automation ran for the first time last night. What’s the right next step?',
        choices: [
            { id: 'a', labelFallback: 'Check its run history to confirm it did what you expected.', correct: true },
            { id: 'b', labelFallback: 'Nothing — automations never need checking.', correct: false },
            { id: 'c', labelFallback: 'Delete and rebuild it to be safe.', correct: false },
        ],
        explanationFallback: 'Run history shows exactly what each run did. Verify the first few runs of any new automation before relying on it.',
    },
];

/* ── Lesson: Users, groups & access (admin, rich: slides + quiz) ──────────── */
const ADMIN_ACCESS_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'ac-roles', icon: '🛡️',
        titleKey: 'learn.admin-access.roles.title', titleFallback: 'Who can do what',
        bodyMdKey: 'learn.admin-access.roles.body',
        bodyMdFallback: 'Access in Bee Flow has three layers:\n\n- **Org role** — *admin* runs the organisation (users, plan, settings); *member* uses the workspace.\n- **Groups** — collect people by team or function. Permissions and feature access attach to groups, not individuals.\n- **Permissions** — fine-grained abilities (manage agents, manage knowledge, see monitoring…), granted through groups.\n\nManage all of this in **Settings → Organisation → Users & Groups**.',
    },
    {
        type: STEP_TYPES.SLIDE, id: 'ac-grants', icon: '✅',
        titleKey: 'learn.admin-access.grants.title', titleFallback: 'Grants only add — they never take away',
        bodyMdKey: 'learn.admin-access.grants.body',
        bodyMdFallback: 'Bee Flow’s access model is **grant-only**: a group grant can give its members *more* than the org default, never less. A user’s effective access is the org baseline **plus** everything their groups grant — capped by what the subscription plan includes.\n\nPractical pattern: keep the org default modest, then create groups like *Builders* (manage agents & knowledge) or *Ops* (monitoring) and add people to the group that matches their job.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'ac-quiz', icon: '❓',
        questionKey: 'learn.admin-access.quiz.q', questionFallback: 'A member needs to build agents, but the org default doesn’t allow it. What’s the right move?',
        choices: [
            { id: 'a', labelFallback: 'Add them to a group that grants agent-building permissions.', correct: true },
            { id: 'b', labelFallback: 'Make them an org admin.', correct: false },
            { id: 'c', labelFallback: 'Share an admin’s login with them.', correct: false },
        ],
        explanationFallback: 'Grants flow through groups — give the smallest grant that does the job. Org admin is for running the organisation, not for building agents.',
    },
];

/* ── Lesson: Running a healthy hive (admin, rich: slides + quiz + exercise) ── */
const ADMIN_GOVERNANCE_STEPS = [
    {
        type: STEP_TYPES.SLIDE, id: 'ag-watch', icon: '📊',
        titleKey: 'learn.admin-governance.watch.title', titleFallback: 'Watch usage before it surprises you',
        bodyMdKey: 'learn.admin-governance.watch.body',
        bodyMdFallback: '**Settings → Organisation → Usage & Monitoring** shows what your organisation actually consumes: requests, tokens and cost per user and per agent over time.\n\nMake it a habit:\n- Skim it **weekly** — spikes usually mean a runaway automation or an unusually heavy workflow.\n- Compare **per-user** numbers — wildly uneven usage is a coaching opportunity, not a policing one.\n- Check it **after enabling something new** — a new integration or beta feature shows up here first.',
    },
    {
        type: STEP_TYPES.SLIDE, id: 'ag-rollout', icon: '🚀',
        titleKey: 'learn.admin-governance.rollout.title', titleFallback: 'Roll out features deliberately',
        bodyMdKey: 'learn.admin-governance.rollout.body',
        bodyMdFallback: 'New capabilities (beta features, integrations) are enabled per organisation and granted to groups — which means you can roll out gradually:\n\n1. **Pilot** — enable for one small group; ask them to use it for a week.\n2. **Review** — check usage and ask the pilots what worked.\n3. **Broaden** — grant the next groups, with a one-line “what this is for” note.\n\nThe Academy helps here too: point new users at the Learning Center courses, and track who completed what in the **Academy** tab.',
    },
    {
        type: STEP_TYPES.QUIZ, id: 'ag-quiz', icon: '❓',
        questionKey: 'learn.admin-governance.quiz.q', questionFallback: 'Token usage doubled this week. What’s the best first step?',
        choices: [
            { id: 'a', labelFallback: 'Open Usage & Monitoring and find which user or agent changed.', correct: true },
            { id: 'b', labelFallback: 'Disable AI for the whole organisation.', correct: false },
            { id: 'c', labelFallback: 'Ignore it — costs even out eventually.', correct: false },
        ],
        explanationFallback: 'Diagnose before acting: per-user and per-agent breakdowns usually point straight at the source — often a new automation doing more than intended.',
    },
    {
        type: STEP_TYPES.EXERCISE, id: 'ag-ex', exerciseId: 'ex-admin-rollout', icon: '🎯',
        titleKey: 'learn.admin-governance.ex.title', titleFallback: 'Your turn: plan a rollout',
        instructionKey: 'learn.admin-governance.ex.instruction',
        instructionFallback: 'Write a short rollout plan for introducing a new Bee Flow capability (pick any — e.g. automations or a new integration) to your organisation. Name who pilots it first, how you’ll check it’s working, and how you’ll expand from there.',
        placeholderFallback: 'e.g. “Week 1: enable automations for the 4-person ops team; they each build one real automation. Week 2: review their run history and usage in monitoring, collect feedback in a 30-minute call. Week 3: grant the support and sales groups, share the two best automations as examples, and point newcomers at the Academy course.”',
        passScore: 70, maxAttempts: 4,
    },
];

/* ── The catalog ─────────────────────────────────────────────────────────────
 * NOTE: the `gate` fields and the full id list are mirrored server-side in
 * server/learning/courseCatalog.js (LESSON_GATES / LESSON_IDS) so the server can
 * compute completion against the lessons a user can actually see. Keep both in
 * lockstep when adding or re-gating a lesson.
 * ──────────────────────────────────────────────────────────────────────────── */
export const LESSONS = [
    {
        id: DEFAULT_LESSON_ID, group: 'basics', icon: '👋', estMinutes: 1,
        titleKey: 'learn.getting-started.title', titleFallback: 'Getting started',
        descKey: 'learn.getting-started.desc',
        descFallback: 'A one-minute tour of the basics — chat, agents, and where everything lives.',
        gate: {},
        steps: TOUR_STEPS, // reuse the intro tour verbatim — single source of truth
    },
    {
        id: 'effective-prompts', group: 'basics', icon: '💬', estMinutes: 3,
        titleKey: 'learn.effective-prompts.title', titleFallback: 'Writing effective prompts',
        descKey: 'learn.effective-prompts.desc',
        descFallback: 'Get better answers in chat — context, a clear ask, and the right format.',
        gate: {},
        steps: PROMPTS_STEPS,
    },

    /* ── Prompt Engineering course lessons (rich: slides + quiz + exercise) ── */
    {
        id: 'prompt-basics', group: 'basics', icon: '🧬', estMinutes: 5,
        titleKey: 'learn.prompt-basics.title', titleFallback: 'Anatomy of a great prompt',
        descKey: 'learn.prompt-basics.desc',
        descFallback: 'The three ingredients of every strong prompt — with a hands-on rewrite.',
        gate: {},
        steps: PROMPT_BASICS_STEPS,
    },
    {
        id: 'prompt-context', group: 'basics', icon: '🧭', estMinutes: 5,
        titleKey: 'learn.prompt-context.title', titleFallback: 'Give it context',
        descKey: 'learn.prompt-context.desc',
        descFallback: 'Role, audience and goal — the highest-leverage thing you can add.',
        gate: {},
        steps: PROMPT_CONTEXT_STEPS,
    },
    {
        id: 'prompt-structure', group: 'basics', icon: '📐', estMinutes: 5,
        titleKey: 'learn.prompt-structure.title', titleFallback: 'Structure & format',
        descKey: 'learn.prompt-structure.desc',
        descFallback: 'Ask for the exact shape you want back and stop reformatting by hand.',
        gate: {},
        steps: PROMPT_STRUCTURE_STEPS,
    },
    {
        id: 'prompt-iterating', group: 'basics', icon: '🔁', estMinutes: 4,
        titleKey: 'learn.prompt-iterating.title', titleFallback: 'Iterate to perfection',
        descKey: 'learn.prompt-iterating.desc',
        descFallback: 'Steer the first draft to great with quick, targeted follow-ups.',
        gate: {},
        steps: PROMPT_ITERATING_STEPS,
    },
    {
        id: 'prompt-advanced', group: 'basics', icon: '🧪', estMinutes: 6,
        titleKey: 'learn.prompt-advanced.title', titleFallback: 'Advanced techniques',
        descKey: 'learn.prompt-advanced.desc',
        descFallback: 'Few-shot examples and step-by-step reasoning for the hard tasks.',
        gate: {},
        steps: PROMPT_ADVANCED_STEPS,
    },
    {
        id: 'creating-agents', group: 'building', icon: '🤖', estMinutes: 4,
        titleKey: 'learn.creating-agents.title', titleFallback: 'Creating an agent',
        descKey: 'learn.creating-agents.desc',
        descFallback: 'Build a custom agent from a plain-English description.',
        gate: { permission: 'manage_agents' },
        steps: CREATE_AGENT_STEPS,
    },
    {
        id: 'refining-prompt', group: 'building', icon: '🛠️', estMinutes: 4,
        titleKey: 'learn.refining-prompt.title', titleFallback: 'Refining an agent',
        descKey: 'learn.refining-prompt.desc',
        descFallback: 'Tune the system prompt, tools, and knowledge in the Agent Designer.',
        gate: { permission: 'manage_agents' },
        steps: REFINE_PROMPT_STEPS,
    },
    {
        id: 'creating-skills', group: 'building', icon: '🧩', estMinutes: 4,
        titleKey: 'learn.creating-skills.title', titleFallback: 'Creating a skill',
        descKey: 'learn.creating-skills.desc',
        descFallback: 'Package reusable instructions, workflow, rules and examples.',
        gate: { permission: 'manage_skills', feature: 'skills' },
        steps: SKILLS_STEPS,
    },
    {
        id: 'knowledge-bases', group: 'building', icon: '📚', estMinutes: 3,
        titleKey: 'learn.knowledge-bases.title', titleFallback: 'Adding a knowledge base',
        descKey: 'learn.knowledge-bases.desc',
        descFallback: 'Give agents your own documents to answer from.',
        gate: { permission: ['manage_knowledge', 'manage_agents'] },
        steps: KNOWLEDGE_STEPS,
    },
    {
        id: 'connecting-integrations', group: 'power', icon: '🔌', estMinutes: 3,
        titleKey: 'learn.connecting-integrations.title', titleFallback: 'Connecting integrations',
        descKey: 'learn.connecting-integrations.desc',
        descFallback: 'Connect email, calendar and the apps your team already uses.',
        gate: { feature: 'integrations' },
        steps: INTEGRATIONS_STEPS,
    },
    {
        id: 'using-memory', group: 'power', icon: '🧠', estMinutes: 2,
        titleKey: 'learn.using-memory.title', titleFallback: 'Using memory',
        descKey: 'learn.using-memory.desc',
        descFallback: 'Let Bee Flow remember facts and preferences across chats.',
        gate: {},
        steps: MEMORY_STEPS,
    },
    {
        id: 'automations', group: 'power', icon: '⏱️', estMinutes: 3,
        titleKey: 'learn.automations.title', titleFallback: 'Automations & routines',
        descKey: 'learn.automations.desc',
        descFallback: 'Run agents on a schedule — briefings, reports, and more.',
        gate: { feature: 'automations' },
        steps: AUTOMATIONS_STEPS,
    },
    {
        id: 'org-usage', group: 'admin', icon: '📊', estMinutes: 3,
        titleKey: 'learn.org-usage.title', titleFallback: 'Usage & monitoring',
        descKey: 'learn.org-usage.desc',
        descFallback: 'Track spend and activity across your organisation.',
        gate: { permission: 'manage_users' },
        steps: ORG_USAGE_STEPS,
    },
    {
        id: 'automation-anatomy', group: 'power', icon: '⚙️', estMinutes: 5,
        titleKey: 'learn.automation-anatomy.title', titleFallback: 'Anatomy of an automation',
        descKey: 'learn.automation-anatomy.desc',
        descFallback: 'Triggers, steps and results — and why you dry-run before trusting.',
        gate: { feature: 'automations' },
        steps: AUTOMATION_ANATOMY_STEPS,
    },
    {
        id: 'automation-practice', group: 'power', icon: '📝', estMinutes: 6,
        titleKey: 'learn.automation-practice.title', titleFallback: 'Design your own automation',
        descKey: 'learn.automation-practice.desc',
        descFallback: 'Write an automation brief worth building — graded by the AI coach.',
        gate: { feature: 'automations' },
        steps: AUTOMATION_PRACTICE_STEPS,
    },
    {
        id: 'admin-access-control', group: 'admin', icon: '🛡️', estMinutes: 4,
        titleKey: 'learn.admin-access.title', titleFallback: 'Users, groups & access',
        descKey: 'learn.admin-access.desc',
        descFallback: 'Org roles, groups and the grant-only access model.',
        gate: { permission: 'manage_users' },
        steps: ADMIN_ACCESS_STEPS,
    },
    {
        id: 'admin-governance', group: 'admin', icon: '📈', estMinutes: 6,
        titleKey: 'learn.admin-governance.title', titleFallback: 'Running a healthy hive',
        descKey: 'learn.admin-governance.desc',
        descFallback: 'Usage monitoring habits and deliberate feature rollouts.',
        gate: { permission: 'manage_users' },
        steps: ADMIN_GOVERNANCE_STEPS,
    },
];

/* ── Server-provided lessons (org-authored, Phase 3) ─────────────────────────
 * Published org courses arrive with their lesson docs inline via
 * GET /ai/learning/catalog (already sanitized: quiz keys stripped + serverGraded,
 * exercise rubrics replaced by an exerciseId). They register here at runtime so
 * getLesson()/the player resolve them exactly like built-ins. Org ids are
 * 'orgl-…' so they can never shadow a bundled lesson.
 * ──────────────────────────────────────────────────────────────────────────── */
const serverLessons = new Map();

export function registerServerLessons(lessonDocs) {
    (lessonDocs || []).forEach((doc) => {
        if (!doc || !doc.id) return;
        serverLessons.set(doc.id, {
            id: doc.id,
            group: 'org',
            icon: doc.icon || '📘',
            estMinutes: doc.estMinutes || 5,
            titleFallback: doc.title || doc.id,
            descFallback: doc.desc || '',
            gate: {},
            steps: Array.isArray(doc.steps) ? doc.steps : [],
            source: 'org',
        });
    });
}

/* ── Lookups & resolvers ─────────────────────────────────────────────────── */

export function getLesson(lessonId) {
    return LESSONS.find((l) => l.id === lessonId) || serverLessons.get(lessonId);
}

// True when the user may see/launch this lesson. Hides BOTH permission-gated and
// plan/license-gated lessons the user can't access. `hasFeature` is optional: in
// engine context (no license provider) it's undefined and feature gates are
// treated as visible — the Learning Center page is the authoritative filter.
export function lessonVisible(lesson, user, hasFeature) {
    const gate = lesson?.gate || {};
    if (gate.permission && !checkPermission(user, gate.permission)) return false;
    if (gate.feature && typeof hasFeature === 'function' && !hasFeature(gate.feature)) return false;
    return true;
}

// The lessons to show on the Learning Center page, filtered by permission + plan.
export function resolveLessons(user, { hasFeature } = {}) {
    return LESSONS.filter((l) => lessonVisible(l, user, hasFeature));
}

// True when every step of a lesson is a live-app tour step. Such lessons skip the
// LessonPlayer entirely and dispatch TOUR_START_EVENT straight to the engine, so
// the legacy 10 lessons behave exactly as before.
export function lessonIsPureTour(lesson) {
    const steps = lesson?.steps || [];
    return steps.length > 0 && steps.every((s) => stepType(s) === STEP_TYPES.TOUR);
}

export function lessonIdIsPureTour(lessonId) {
    return lessonIsPureTour(getLesson(lessonId));
}

/* ── Ephemeral tour registry ──────────────────────────────────────────────────
 * A rich lesson mixes inline steps (slide/quiz/exercise, rendered by the
 * LessonPlayer) with live-app tour steps (rendered by OnboardingTour). To replay
 * just the tour sub-segment through the existing engine WITHOUT changing it, the
 * player registers that contiguous run of tour steps here under a throwaway id and
 * dispatches TOUR_START_EVENT with it. resolveLessonSteps() returns the registered
 * steps for that id; the engine plays them and fires LESSON_COMPLETE_EVENT, which
 * the player listens for to resume. The id is recognisable (EPHEMERAL_PREFIX) so
 * markLessonComplete() can skip persisting it as a real lesson.
 * ──────────────────────────────────────────────────────────────────────────── */
export const EPHEMERAL_PREFIX = '__eph_';
const ephemeralTours = new Map();
let ephemeralCounterSeed = 0;

export function isEphemeralLessonId(id) {
    return typeof id === 'string' && id.startsWith(EPHEMERAL_PREFIX);
}

export function registerEphemeralTour(steps) {
    const id = `${EPHEMERAL_PREFIX}${++ephemeralCounterSeed}`;
    ephemeralTours.set(id, Array.isArray(steps) ? steps : []);
    return id;
}

export function clearEphemeralTour(id) {
    if (id) ephemeralTours.delete(id);
}

// The steps the engine should run for a lesson, with the same requiresStudio
// filter the intro tour applies. Ephemeral ids resolve from the registry first;
// otherwise falls back to the getting-started lesson for an unknown id so a stale
// event can never run an empty tour.
export function resolveLessonSteps(lessonId, user) {
    if (isEphemeralLessonId(lessonId)) {
        return filterStepsForUser(ephemeralTours.get(lessonId) || [], user);
    }
    const lesson = getLesson(lessonId) || getLesson(DEFAULT_LESSON_ID);
    return filterStepsForUser(lesson?.steps || [], user);
}

// The full ordered step list for a rich lesson, as the LessonPlayer should render
// it (inline steps + tour steps interleaved). Same requiresStudio filtering as the
// engine so a member never sees a Studio-only step they can't action.
export function resolveLessonPlayerSteps(lessonId, user) {
    const lesson = getLesson(lessonId) || getLesson(DEFAULT_LESSON_ID);
    return filterStepsForUser(lesson?.steps || [], user);
}
