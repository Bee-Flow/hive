import React from 'react';
import {
    Cpu, Wrench, Brain, BookOpen, FileText, Layers, Sparkles, Shield, Loader, History, ListTree
} from 'lucide-react';
import useTranslation from '../../../hooks/useTranslation';
import { getToolLabel, getToolIcon, toolNameToCatalogId } from '../../../utils/helpers';
import AppEmoji from '../../AppEmoji';

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
    privacy_scan:           Shield,
    privacy_scan_large:     Shield,
    tool_pre_check:         ListTree,
    processed_history:      History,
    streaming_start:        Loader,
};

const SESSION_SKILL_TOOL_NAMES = new Set(['activate_session_skill', 'activate_skill']);

function skillAwareLabel(toolEntry, sessionSkills) {
    if (!toolEntry || !SESSION_SKILL_TOOL_NAMES.has(toolEntry.name)) return null;
    const ids = Array.isArray(toolEntry.args?.skill_ids) ? toolEntry.args.skill_ids : [];
    if (ids.length === 0 || !Array.isArray(sessionSkills) || sessionSkills.length === 0) return null;
    const match = sessionSkills.find(s => s.id === ids[0]);
    if (!match) return null;
    const prefix = typeof match.order === 'number' ? `Step ${match.order}: ` : '';
    return `${prefix}${match.name}`;
}

/**
 * Single source of truth for the "what is the AI doing right now" line shown
 * while a message is streaming but no content has arrived yet.
 *
 * Priority (most informative first):
 *   1. A tool is currently running       → "🔍 Searching the web"
 *   2. A pre-LLM phase is active         → "Searching knowledge base…"
 *   3. The last tool just finished       → "✓ Searched the web"
 *   4. Generic fallback                  → "Thinking…" (translated)
 *
 * The completed steps mini-timeline (✓ rows) lives in ToolOutput.jsx and
 * complements this single live line.
 */
export function ActivityIndicator({ msg, sessionSkills = [] }) {
    const { t } = useTranslation();

    const runningTool = msg.toolCall?.status === 'running' && msg.toolCall?.name !== 'sequentialthinking'
        ? msg.toolCall
        : null;

    const phase = !runningTool && msg.currentPhase?.stage ? msg.currentPhase : null;

    const lastDoneTool = !runningTool && !phase
        ? (msg.toolHistory || [])
            .filter(entry => entry.status === 'done' && entry.name !== 'sequentialthinking')
            .slice(-1)[0] || null
        : null;

    let icon = null;
    let label;
    let key;
    let dim = false;

    if (runningTool) {
        const runningEntry = (msg.toolHistory || []).find(
            t => t.status === 'running' && t.name === runningTool.name
        );
        label = skillAwareLabel(runningEntry, sessionSkills) || getToolLabel(runningTool.name);
        const catalogId = toolNameToCatalogId(runningTool.name);
        const defaultEmoji = getToolIcon(runningTool.name);
        icon = <AppEmoji id={catalogId} default={defaultEmoji} className="text-xs" />;
        key = `tool:${runningTool.name}`;
    } else if (phase) {
        const Icon = STAGE_ICONS[phase.stage] || Loader;
        const tkey = `chat.phase.${phase.stage}`;
        const translated = t(tkey, phase.detail ? { detail: phase.detail } : undefined);
        const fallback = phase.detail
            ? `${phase.stage.replace(/_/g, ' ')}: ${phase.detail}`
            : phase.stage.replace(/_/g, ' ');
        label = translated === tkey ? fallback : translated;
        icon = (
            <Icon
                className="w-3.5 h-3.5 animate-pulse"
                style={{ color: 'var(--text-muted)' }}
            />
        );
        key = `phase:${phase.stage}`;
    } else if (lastDoneTool) {
        label = skillAwareLabel(lastDoneTool, sessionSkills) || getToolLabel(lastDoneTool.name);
        const catalogId = toolNameToCatalogId(lastDoneTool.name);
        const defaultEmoji = getToolIcon(lastDoneTool.name);
        icon = (
            <span className="inline-flex items-center gap-1">
                <span style={{ color: 'var(--accent-primary)', opacity: 0.7 }}>✓</span>
                <AppEmoji id={catalogId} default={defaultEmoji} className="text-xs" />
            </span>
        );
        dim = true;
        key = `done:${lastDoneTool.name}:${lastDoneTool.endTime || ''}`;
    } else {
        const tkey = 'chat.activity.thinking';
        const translated = t(tkey);
        label = translated === tkey ? 'Thinking…' : translated;
        key = 'fallback';
    }

    return (
        <div
            key={key}
            className="flex items-center gap-2 py-1 animate-fade-in"
            data-activity={key}
        >
            {icon}
            <span
                className="text-xs italic"
                style={{
                    color: dim ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                    opacity: dim ? 0.75 : 1,
                }}
            >
                {label}
            </span>
            <span className="flex items-center gap-0.5 ml-0.5">
                <span
                    className="w-1 h-1 rounded-full animate-pulse"
                    style={{ background: 'var(--accent-primary)' }}
                />
                <span
                    className="w-1 h-1 rounded-full animate-pulse"
                    style={{ background: 'var(--accent-primary)', animationDelay: '150ms' }}
                />
                <span
                    className="w-1 h-1 rounded-full animate-pulse"
                    style={{ background: 'var(--accent-primary)', animationDelay: '300ms' }}
                />
            </span>
        </div>
    );
}

export default ActivityIndicator;
