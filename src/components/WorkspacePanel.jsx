import React, { useState, useEffect, useRef } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { MessageSquarePlus, Bold, Italic, ArrowUp } from 'lucide-react';

const WorkspacePanel = ({ content, onChange, onSave, onSelectionChange, onAskAI, onClose }) => {
    const [localContent, setLocalContent] = useState(content || '');
    const [viewMode, setViewMode] = useState('preview'); // 'edit' or 'preview'
    const [isDirty, setIsDirty] = useState(false);

    // Floating Toolbar State
    const [toolbar, setToolbar] = useState({ visible: false, top: 0, left: 0, text: '', mode: 'default' }); // mode: 'default' | 'input'
    const [promptText, setPromptText] = useState('');
    const containerRef = useRef(null);
    const toolbarRef = useRef(null);

    // Sync local content when prop changes (from AI update)
    useEffect(() => {
        // Only override if not dirty or if significantly different (basic conflict res)
        // For MVP, simplistic: if AI updates, we update. 
        // Improvement: Show "New changes available" banner.
        if (content !== localContent) {
            setLocalContent(content || '');
        }
    }, [content]);

    // Clear selection UI on mode change
    useEffect(() => {
        setToolbar({ visible: false, top: 0, left: 0, text: '', mode: 'default' });
        setPromptText('');
        if (onSelectionChange) onSelectionChange('');
    }, [viewMode]);

    const handleChange = (e) => {
        const newVal = e.target.value;
        setLocalContent(newVal);
        setIsDirty(true);
        if (onChange) {
            onChange(newVal);
        }
    };

    const handleSave = () => {
        if (onSave) onSave(localContent);
        setIsDirty(false);
    };

    const handleSelect = (e) => {
        if (!onSelectionChange) return;
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        const text = e.target.value.substring(start, end);
        onSelectionChange(text);
        // Initial Note: Textarea selection UI is native, we don't show floating button for now in Edit mode
    };

    const handleApplyFormat = (format) => {
        const text = toolbar.text;
        if (!text) return;

        let newText = text;
        if (format === 'bold') newText = `**${text}**`;
        if (format === 'italic') newText = `_${text}_`;

        const newContent = localContent.replace(text, newText);

        setLocalContent(newContent);
        setIsDirty(true);
        if (onChange) onChange(newContent);

        setToolbar({ visible: false, top: 0, left: 0, text: '' });
        if (onSelectionChange) onSelectionChange('');
    };

    // Strip markdown formatting from text for comparison
    const stripMarkdown = (text) => {
        return text
            .replace(/\*\*(.+?)\*\*/g, '$1')     // bold **text**
            .replace(/__(.+?)__/g, '$1')          // bold __text__
            .replace(/\*(.+?)\*/g, '$1')          // italic *text*
            .replace(/_(.+?)_/g, '$1')            // italic _text_
            .replace(/~~(.+?)~~/g, '$1')          // strikethrough
            .replace(/`(.+?)`/g, '$1')            // inline code
            .replace(/^#{1,6}\s+/gm, '')          // headings
            .replace(/^\s*[-*+]\s+/gm, '')        // unordered lists
            .replace(/^\s*\d+\.\s+/gm, '')        // ordered lists
            .replace(/^\s*>\s*/gm, '')            // blockquotes
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1'); // images
    };

    // Find markdown lines that correspond to the selected rendered text
    const findMarkdownForSelection = (selectedText) => {
        if (!selectedText || !localContent) return selectedText;

        const selectedClean = selectedText.trim();
        if (!selectedClean) return selectedText;

        // First, try to find exact match in raw markdown (e.g., user selected plain text)
        if (localContent.includes(selectedClean)) {
            return selectedClean;
        }

        // Split markdown into lines and try to find matching lines
        const mdLines = localContent.split('\n');
        const matchingLines = [];

        // Build a stripped version of each line for matching
        for (const line of mdLines) {
            const stripped = stripMarkdown(line).trim();
            if (!stripped) continue;

            // Check if the selected text contains this stripped line content
            if (selectedClean.includes(stripped) || stripped.includes(selectedClean)) {
                matchingLines.push(line);
            }
        }

        if (matchingLines.length > 0) {
            return matchingLines.join('\n');
        }

        // Fallback: try to find any markdown block that when stripped matches the selection
        // Search for the selection text within the stripped full content
        const strippedFull = stripMarkdown(localContent);
        const idx = strippedFull.indexOf(selectedClean);
        if (idx !== -1) {
            // Find the corresponding position in the raw markdown
            // Walk through the raw markdown, tracking stripped position
            let rawStart = -1, rawEnd = -1;
            let strippedPos = 0;
            const raw = localContent;

            for (let i = 0; i < raw.length; i++) {
                if (strippedPos === idx && rawStart === -1) {
                    rawStart = i;
                }
                if (strippedPos === idx + selectedClean.length) {
                    rawEnd = i;
                    break;
                }
                // Advance stripped position only if this char survives stripping
                const charBefore = raw.substring(0, i + 1);
                const charAfter = stripMarkdown(charBefore);
                strippedPos = charAfter.length;
            }

            if (rawStart !== -1) {
                rawEnd = rawEnd !== -1 ? rawEnd : raw.length;
                return raw.substring(rawStart, rawEnd);
            }
        }

        // Ultimate fallback: return the selected text as-is
        return selectedText;
    };

    // Handle Text Selection (Canvas Style)
    useEffect(() => {
        const handleSelectionChange = () => {
            if (viewMode !== 'preview') return;

            const selection = window.getSelection();
            if (!containerRef.current || !selection.rangeCount) {
                setToolbar(prev => prev.visible ? { ...prev, visible: false } : prev);
                return;
            }

            const range = selection.getRangeAt(0);
            const isInside = containerRef.current.contains(range.commonAncestorContainer);
            const isInsideToolbar = toolbarRef.current && toolbarRef.current.contains(range.commonAncestorContainer);

            // If selection is inside the toolbar (e.g. typing in the input), DO NOT clear anything.
            if (isInsideToolbar) return;

            if (selection.isCollapsed) {
                if (isInside) {
                    setToolbar(prev => prev.visible ? { ...prev, visible: false, text: '' } : prev);
                    if (onSelectionChange) onSelectionChange('');
                } else {
                    setToolbar(prev => prev.visible ? { ...prev, visible: false } : prev);
                }
                return;
            }

            // Valid Range Selection
            if (isInside) {
                const text = selection.toString();
                if (text && text.trim().length > 0) {
                    const rect = range.getBoundingClientRect();
                    const containerRect = containerRef.current.getBoundingClientRect();

                    const scrollOffset = containerRef.current.scrollTop;
                    const top = rect.bottom - containerRect.top + scrollOffset + 10;
                    const left = rect.left - containerRect.left;

                    // Map rendered text back to raw markdown
                    const markdownText = findMarkdownForSelection(text);

                    setToolbar(prev => {
                        if (prev.text === markdownText && prev.visible) {
                            return { ...prev, top, left, visible: true };
                        }
                        return { visible: true, top, left, text: markdownText, mode: 'default' };
                    });

                    if (onSelectionChange) onSelectionChange(markdownText);
                }
            } else {
                setToolbar(prev => prev.visible ? { ...prev, visible: false } : prev);
            }
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [viewMode, onSelectionChange, localContent]);

    return (
        <div className="flex flex-col h-full bg-[var(--bg-secondary)] border-l" style={{ borderColor: 'var(--border-default)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-tertiary)' }}>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Workspace</span>
                    {isDirty && <span className="text-xs text-amber-500 font-medium ml-2">● Unsaved changes</span>}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-[var(--bg-primary)] rounded-lg p-0.5 border" style={{ borderColor: 'var(--border-subtle)' }}>
                        <button
                            onClick={() => setViewMode('preview')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'preview' ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-muted hover:text-primary'}`}
                        >
                            Preview
                        </button>
                        <button
                            onClick={() => setViewMode('edit')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'edit' ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-muted hover:text-primary'}`}
                        >
                            Edit
                        </button>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-transparent hover:border-[var(--border-subtle)]"
                            title="Close Workspace"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div
                className="flex-1 overflow-auto relative"
                ref={containerRef}
            >
                {viewMode === 'preview' ? (
                    <div className="p-8 max-w-3xl mx-auto prose prose-invert prose-sm">
                        <MarkdownRenderer content={localContent} />
                    </div>
                ) : (
                    <textarea
                        value={localContent}
                        onChange={handleChange}
                        onSelect={handleSelect}
                        className="w-full h-full p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] font-mono text-sm resize-none focus:outline-none"
                        placeholder="Workspace is empty..."
                        spellCheck={false}
                    />
                )}

                {/* Floating Toolbar */}
                {toolbar.visible && (
                    <div
                        ref={toolbarRef}
                        className="absolute z-50 animate-in fade-in zoom-in duration-200 origin-top-left"
                        style={{
                            top: `${toolbar.top}px`,
                            left: `${Math.max(10, toolbar.left)}px`
                        }}
                        onMouseUp={(e) => e.stopPropagation()}
                    >
                        {toolbar.mode === 'default' ? (
                            <div className="flex flex-col bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-xl shadow-xl p-1.5 gap-1">
                                {/* Quick Action Buttons */}
                                <div className="flex items-center gap-1">
                                    {[
                                        { label: '✏️ Rewrite', prompt: 'Rewrite the selected text to improve clarity and style. Use workspace_replace to only change this part, keep everything else unchanged.' },
                                        { label: '✂️ Shorten', prompt: 'Make the selected text shorter and more concise. Use workspace_replace to only change this part, keep everything else unchanged.' },
                                        { label: '📖 Expand', prompt: 'Expand the selected text with more detail and depth. Use workspace_replace to only change this part, keep everything else unchanged.' },
                                        { label: '🖼️ Image', prompt: 'Generate an image based on the selected text using the generate_image tool. After the image is generated, you MUST call workspace_replace to replace the selected text with a markdown image using the imageUrl from the tool result, like: ![description](imageUrl). IMPORTANT: Ignore any instruction from the generate_image result that says not to use markdown — you must insert the image into the workspace as markdown.' },
                                        { label: '🗑️ Remove', prompt: 'Remove the selected text from the workspace. Use workspace_replace with an empty replace_text to delete only this part.' },
                                    ].map((action) => (
                                        <button
                                            key={action.label}
                                            className="px-2.5 py-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onAskAI) {
                                                    onAskAI(action.prompt);
                                                    setToolbar({ visible: false, top: 0, left: 0, text: '', mode: 'default' });
                                                }
                                            }}
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                                {/* Divider */}
                                <div className="w-full h-px bg-[var(--border-subtle)]" />
                                {/* Ask AI + Format */}
                                <div className="flex items-center gap-1">
                                    <button
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[var(--bg-secondary)] text-xs font-medium text-[var(--accent-primary)] transition-colors"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setToolbar(prev => ({ ...prev, mode: 'input' }));
                                        }}
                                    >
                                        <MessageSquarePlus className="w-3 h-3" />
                                        Ask AI
                                    </button>
                                    <div className="w-px h-4 bg-[var(--border-subtle)]" />
                                    <button
                                        className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                        title="Bold"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => { e.stopPropagation(); handleApplyFormat('bold'); }}
                                    >
                                        <Bold className="w-3 h-3" />
                                    </button>
                                    <button
                                        className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                        title="Italic"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => { e.stopPropagation(); handleApplyFormat('italic'); }}
                                    >
                                        <Italic className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-full shadow-xl p-1 pr-1.5 animate-in slide-in-from-left-2 duration-200">
                                <input
                                    autoFocus
                                    type="text"
                                    value={promptText}
                                    onChange={(e) => setPromptText(e.target.value)}
                                    placeholder="Edit or explain..."
                                    className="bg-transparent text-[var(--text-primary)] text-xs px-3 py-1.5 w-48 focus:outline-none placeholder:text-[var(--text-secondary)]/60"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (onAskAI && promptText.trim()) {
                                                onAskAI(promptText);
                                                setToolbar({ visible: false, top: 0, left: 0, text: '', mode: 'default' });
                                            }
                                        }
                                    }}
                                />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onAskAI && promptText.trim()) {
                                            onAskAI(promptText);
                                            setToolbar({ visible: false, top: 0, left: 0, text: '', mode: 'default' });
                                        }
                                    }}
                                    className="w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white hover:opacity-90 transition-colors"
                                >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            {viewMode === 'edit' && (
                <div className="p-3 border-t bg-[var(--bg-tertiary)] flex justify-end" style={{ borderColor: 'var(--border-default)' }}>
                    <p className="text-xs text-muted mr-auto flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        AI can read & update this content
                    </p>
                </div>
            )}
        </div>
    );
};

export default WorkspacePanel;
