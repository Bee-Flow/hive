// Shared emoji-icon palettes used by the various skill/agent pickers.
//
// SKILL_EMOJI_ICONS — used by SkillFormModal and Studio/SkillsStudio.
// BEHAVIOR_EMOJI_ICONS — used by AgentWizard/pickers/BehaviorPicker (the
// set diverges from skills intentionally; that picker covers behaviour
// archetypes rather than skills).

export const SKILL_EMOJI_ICONS = [
    '⚡', '🎯', '📝', '📧', '📊', '🔍', '💡', '🚀', '🎨', '🤝',
    '📋', '🏆', '🔧', '⚙️', '🌟', '💬', '📞', '🖊️', '🗂️', '🔑',
] as const;

export type SkillEmojiIcon = typeof SKILL_EMOJI_ICONS[number];
