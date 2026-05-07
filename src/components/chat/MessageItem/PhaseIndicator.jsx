import React from 'react';
import {
    Cpu, Wrench, Brain, BookOpen, FileText, Layers, Sparkles, Shield, Loader, History, ListTree
} from 'lucide-react';
import useTranslation from '../../../hooks/useTranslation';

const STAGE_ICONS = {
    tier_classify:          Cpu,
    model_resolved:         Cpu,
    loading_tools:          Wrench,
    memory_lookup:          Brain,
    kb_search:              BookOpen,
    processing_attachments: FileText,
    compacting:             Layers,
    building_prompt:        Sparkles,
    guardrails:             Shield,
    tool_pre_check:         ListTree,
    processed_history:      History,
    streaming_start:        Loader,
};

/**
 * Renders the current pre-LLM phase as a single status line above the typing
 * dots. Replaces the static "Thinking…" placeholder so the user sees what is
 * actually happening during the seconds before the first token arrives.
 *
 * `phase` is `{ stage, detail }` set by the `phase` SSE event in
 * useChatEngine.js. Keyed by stage so React remounts the line and replays the
 * fade-in transition on each phase transition.
 */
export function PhaseIndicator({ phase }) {
    const { t } = useTranslation();
    if (!phase?.stage) return null;
    const Icon = STAGE_ICONS[phase.stage] || Loader;
    // Translation keys live under `chat.phase.<stage>` and may use {detail} for
    // values like the resolved model id or attachment filename. `t()` echoes
    // the raw key when no translation exists — detect that and humanise the
    // stage name instead so unmapped stages still read sensibly.
    const key = `chat.phase.${phase.stage}`;
    const translated = t(key, phase.detail ? { detail: phase.detail } : undefined);
    const fallback = phase.detail
        ? `${phase.stage.replace(/_/g, ' ')}: ${phase.detail}`
        : phase.stage.replace(/_/g, ' ');
    const label = translated === key ? fallback : translated;
    return (
        <div
            key={phase.stage}
            className="flex items-center gap-2 py-1 animate-fade-in"
            data-phase={phase.stage}
        >
            <Icon
                className="w-3.5 h-3.5 animate-pulse"
                style={{ color: 'var(--text-muted)' }}
            />
            <span
                className="text-xs italic"
                style={{ color: 'var(--text-tertiary)' }}
            >
                {label}
            </span>
        </div>
    );
}

export default PhaseIndicator;
