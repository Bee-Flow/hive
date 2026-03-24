import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { getToolLabel, getToolIcon } from '../../../utils/helpers';

export default function ToolOutput({ msg }) {
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

            const icon = getToolIcon(msg.toolCall.name);
            const label = getToolLabel(msg.toolCall.name);

            return (
                <div className="mt-2 flex items-center gap-1.5">
                    <div
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-300 animate-fade-in"
                        style={{
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                        }}
                    >
                        <span className="text-xs">{icon}</span>
                        <span>{label}</span>
                        <span className="flex items-center gap-0.5 ml-0.5">
                            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--accent-primary)' }}></span>
                            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--accent-primary)', animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--accent-primary)', animationDelay: '300ms' }}></span>
                        </span>
                    </div>
                </div>
            );
        }

        // Don't show finished tool results - just let the content speak for itself
        return null;
    };

    return { renderToolOutput, renderToolCall };
}
