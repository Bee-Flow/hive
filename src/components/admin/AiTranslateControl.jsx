// Shared "AI Translate" toolbar for the admin Languages panel — replaces the
// model-tier <select> + translate <button> cluster (and its result banner)
// that was duplicated three times (GUI strings / system prompts / email
// templates). Pair it with the useAiTranslate hook, which owns the state and
// the submit handler.
//
// The disable guard `translating || missing === 0` lives here so it applies
// uniformly: the email-templates copy previously omitted the `missing === 0`
// half and could fire a no-op translate — using this control fixes that.
//
// Callers vary only the surrounding layout (`className`) and, for emails, the
// flat-accent button with a Languages icon and no missing-count badge.
//
// Tier options are kept local rather than sourced from tierMeta.js: TIER_META
// renames these keys (thinking→"Think", writer→"Write", pro→"Deep Thinking"
// with a different emoji), so reusing it would change the visible labels.

import { AlertCircle, Check, Languages } from 'lucide-react';

const TIER_OPTIONS = [
    { value: 'fast', label: '⚡ Fast' },
    { value: 'thinking', label: '🧠 Thinking' },
    { value: 'writer', label: '✍️ Writer' },
    { value: 'pro', label: '🔬 Pro' },
];

export default function AiTranslateControl({
    tier,
    onTierChange,
    onTranslate,
    translating,
    missing,
    icon = '🤖',
    gradient = true,
    showCount = true,
    className = 'flex items-center gap-1.5 shrink-0',
}) {
    return (
        <div className={className}>
            <select
                value={tier}
                onChange={e => onTierChange(e.target.value)}
                disabled={translating}
                className="px-2 py-1 rounded-lg text-xs border bg-[var(--bg-secondary)]"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
            >
                {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
                onClick={onTranslate}
                disabled={translating || missing === 0}
                className="px-3 py-1 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 disabled:opacity-40 transition-opacity"
                style={{ background: gradient ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'var(--accent-primary)' }}
            >
                {translating ? (
                    <><span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Translating...</>
                ) : (
                    <>{icon} AI Translate{showCount ? ` (${missing || 0})` : ''}</>
                )}
            </button>
        </div>
    );
}

// The status banner shown under the toolbar after a translate run. Renders
// nothing until there is a result. `result` is `{ message }` on success or
// `{ error }` on failure (see useAiTranslate).
export function AiTranslateResult({ result }) {
    if (!result) return null;
    return (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{
            background: result.error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
            color: result.error ? '#ef4444' : '#22c55e',
        }}>
            {result.error ? (
                <><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {result.error}</>
            ) : (
                <><Check className="w-3.5 h-3.5 shrink-0" /> {result.message}</>
            )}
        </div>
    );
}
