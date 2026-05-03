import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { getToolLabel, getToolIcon, toolNameToCatalogId } from '../../../utils/helpers';
import AppEmoji from '../../AppEmoji';

const SESSION_SKILL_TOOL_NAMES = new Set(['activate_session_skill', 'activate_skill']);

/**
 * For activate_session_skill / activate_skill, resolve the running tool's
 * first skill_id arg to a friendlier `Step N: <Name>` label when the
 * conversation's chat-local skills are known. Falls back to the default label.
 */
function skillAwareLabel(toolEntry, sessionSkills) {
    if (!toolEntry || !SESSION_SKILL_TOOL_NAMES.has(toolEntry.name)) return null;
    const ids = Array.isArray(toolEntry.args?.skill_ids) ? toolEntry.args.skill_ids : [];
    if (ids.length === 0 || !Array.isArray(sessionSkills) || sessionSkills.length === 0) return null;
    const match = sessionSkills.find(s => s.id === ids[0]);
    if (!match) return null;
    const prefix = typeof match.order === 'number' ? `Step ${match.order}: ` : '';
    return `${prefix}${match.name}`;
}

export default function ToolOutput({ msg, sessionSkills = [] }) {
    const [showRawToolOutput, setShowRawToolOutput] = useState(false);

    const renderToolOutput = () => {
        let content = msg.content;
        let isJson = false;
        let parsed = null;

        try {
            if (typeof content === 'string' && (content.startsWith('{') || content.startsWith('['))) {
                parsed = JSON.parse(content);
                isJson = true;
            }
        } catch (e) {
            // Not JSON
        }

        return (
            <div className="flex flex-col gap-2 w-full">
                {/* Tool Card Header */}
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-primary)] uppercase tracking-wider mb-1">
                    <Terminal className="w-3 h-3" />
                    <span>Tool Output: {msg.name || 'System Function'}</span>
                </div>

                {/* Main Content (Summary/Snippet) */}
                <div className="text-sm text-[var(--text-primary)]">
                    {isJson ? (
                        <div className="flex flex-col gap-2">
                            {/* Try to extract meaningful fields */}
                            {parsed.results && Array.isArray(parsed.results) ? (
                                <div className="space-y-2">
                                    <div className="text-xs text-muted font-medium">{parsed.results.length} Result(s) Found</div>
                                    {parsed.results.slice(0, 3).map((res, i) => (
                                        <div key={i} className="p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
                                            {res.title && <div className="font-semibold mb-1 truncate">{res.title}</div>}
                                            {res.url && (
                                                <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mb-1">
                                                    {res.url} <ExternalLink className="w-2.5 h-2.5" />
                                                </a>
                                            )}
                                            {res.content && <div className="text-xs text-muted line-clamp-2">{res.content}</div>}
                                            {/* Fallback if no specific structure */}
                                            {!res.title && !res.url && !res.content && (
                                                <div className="text-xs opacity-70 truncate">{JSON.stringify(res)}</div>
                                            )}
                                        </div>
                                    ))}
                                    {parsed.results.length > 3 && (
                                        <div className="text-xs text-muted italic">+ {parsed.results.length - 3} more results...</div>
                                    )}
                                </div>
                            ) : parsed.summary ? (
                                <div>{parsed.summary}</div>
                            ) : parsed.error ? (
                                <div className="text-red-500 font-medium">Error: {parsed.error}</div>
                            ) : (
                                <div className="opacity-80 italic">Data returned successfully. Check debug view for details.</div>
                            )}
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap font-mono text-xs opacity-80">{content}</div>
                    )}
                </div>

                {/* Debug Toggle */}
                <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                    <button
                        onClick={() => setShowRawToolOutput(!showRawToolOutput)}
                        className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors font-medium border border-transparent hover:bg-white/5 rounded px-1.5 py-0.5"
                    >
                        {showRawToolOutput ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        {showRawToolOutput ? 'Hide' : 'Show'} Raw Output
                    </button>

                    {showRawToolOutput && (
                        <div className="mt-2 p-3 rounded-lg bg-black/30 border border-white/10 font-mono text-[10px] text-green-400 overflow-x-auto whitespace-pre animate-fade-in custom-scrollbar">
                            {content}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderToolCall = () => {
        // Show subtle tool activity chip when a tool is running
        if (msg.toolCall && msg.toolCall.status === 'running') {
            // Don't show generic indicator for sequential thinking — handled by renderSequentialThinking
            if (msg.toolCall.name === 'sequentialthinking') return null;
            // Don't show when reasoning model thinking header is already visible
            if (msg.isStreaming && !msg.content) return null;

            const toolCallId = toolNameToCatalogId(msg.toolCall.name);
            const toolCallDefault = getToolIcon(msg.toolCall.name);
            // Find the in-flight entry in toolHistory so we can read its args;
            // args is the only place the skill_ids live at render time.
            const runningEntry = (msg.toolHistory || []).find(t => t.status === 'running' && t.name === msg.toolCall.name);
            const label = skillAwareLabel(runningEntry, sessionSkills) || getToolLabel(msg.toolCall.name);

            // Completed tools from history (excluding sequentialthinking and the currently running one)
            const completedTools = (msg.toolHistory || []).filter(
                t => t.status === 'done' && t.name !== 'sequentialthinking'
            );

            return (
                <div className="mt-2 flex flex-col gap-1 animate-fade-in">
                    {/* Completed steps mini-timeline */}
                    {completedTools.length > 0 && (
                        <div className="flex flex-col gap-0.5 mb-0.5">
                            {completedTools.map((t, i) => {
                                const dur = t.endTime && t.startTime ? (t.endTime - t.startTime) / 1000 : null;
                                return (
                                    <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                        <span className="flex-shrink-0" style={{ color: 'var(--accent-primary)', opacity: 0.7 }}>✓</span>
                                        <AppEmoji id={toolNameToCatalogId(t.name)} default={getToolIcon(t.name)} className="text-xs" />
                                        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{skillAwareLabel(t, sessionSkills) || getToolLabel(t.name)}</span>
                                        {dur !== null && (
                                            <span className="tabular-nums opacity-60">
                                                {dur < 1 ? `${Math.round(dur * 1000)}ms` : `${dur.toFixed(1)}s`}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {/* Currently running chip */}
                    <div className="flex items-center gap-1.5">
                        <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-300"
                            style={{
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-subtle)',
                            }}
                        >
                            <AppEmoji id={toolCallId} default={toolCallDefault} className="text-xs" />
                            <span>{label}</span>
                            <span className="flex items-center gap-0.5 ml-0.5">
                                <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--accent-primary)' }}></span>
                                <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--accent-primary)', animationDelay: '150ms' }}></span>
                                <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--accent-primary)', animationDelay: '300ms' }}></span>
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        // Don't show finished tool results - just let the content speak for itself
        return null;
    };

    return { renderToolOutput, renderToolCall };
}
