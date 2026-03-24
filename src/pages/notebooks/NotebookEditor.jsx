import React, { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { Markdown } from 'tiptap-markdown';
import MermaidExtension from './MermaidExtension';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, Quote, Heading1, Heading2, Heading3,
    AlignLeft, AlignCenter, AlignRight, Undo, Redo,
    Highlighter, Wand2, RefreshCw, Scissors, Expand, Sparkles, Code, Link as LinkIcon, FileUp,
    Loader2, Table2, Plus, Trash2, ChevronDown
} from 'lucide-react';

/* ── AI Actions for selection bubble menu ─────────────────────── */
const AI_ACTIONS = [
    { key: 'rewrite', icon: RefreshCw, label: 'Rewrite' },
    { key: 'shorten', icon: Scissors, label: 'Shorten' },
    { key: 'expand', icon: Expand, label: 'Expand' },
];

/* ── Table Dropdown Button ───────────────────────────────────── */
function TableDropdown({ editor }) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef(null);
    const isInTable = editor.isActive('table');

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
                className={`flex items-center gap-0.5 p-1.5 rounded-md transition-all duration-150 ${
                    isInTable
                        ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }`}
                title="Table"
            >
                <Table2 className="w-3.5 h-3.5" strokeWidth={2} />
                <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {open && (
                <div
                    className="absolute top-full left-0 mt-1 z-50 min-w-[180px] py-1 rounded-lg shadow-xl border backdrop-blur-md"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
                >
                    {!isInTable ? (
                        <DropItem
                            icon={Plus}
                            label="Insert Table (3×3)"
                            onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setOpen(false); }}
                        />
                    ) : (
                        <>
                            <DropItem icon={Plus} label="Add Row Below" onClick={() => { editor.chain().focus().addRowAfter().run(); setOpen(false); }} />
                            <DropItem icon={Plus} label="Add Row Above" onClick={() => { editor.chain().focus().addRowBefore().run(); setOpen(false); }} />
                            <DropItem icon={Plus} label="Add Column Right" onClick={() => { editor.chain().focus().addColumnAfter().run(); setOpen(false); }} />
                            <DropItem icon={Plus} label="Add Column Left" onClick={() => { editor.chain().focus().addColumnBefore().run(); setOpen(false); }} />
                            <div className="h-px mx-2 my-1" style={{ background: 'var(--border-subtle)' }} />
                            <DropItem icon={Trash2} label="Delete Row" danger onClick={() => { editor.chain().focus().deleteRow().run(); setOpen(false); }} />
                            <DropItem icon={Trash2} label="Delete Column" danger onClick={() => { editor.chain().focus().deleteColumn().run(); setOpen(false); }} />
                            <DropItem icon={Trash2} label="Delete Table" danger onClick={() => { editor.chain().focus().deleteTable().run(); setOpen(false); }} />
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function DropItem({ icon: Icon, label, onClick, danger }) {
    return (
        <button
            onMouseDown={e => { e.preventDefault(); onClick(); }}
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-[var(--bg-tertiary)] ${
                danger ? 'text-red-400 hover:text-red-300' : 'text-[var(--text-secondary)]'
            }`}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    );
}

/* ── Toolbar Button ──────────────────────────────────────────── */
function ToolbarBtn({ onClick, active, icon: Icon, title, disabled }) {
    return (
        <button
            onMouseDown={e => { e.preventDefault(); onClick(); }}
            className={`p-1.5 rounded-md transition-all duration-150 ${active ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
            title={title}
            disabled={disabled}
        >
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
    );
}

/* ── Main Editor Component ───────────────────────────────────── */
const NotebookEditor = forwardRef(function NotebookEditorInner({ content, onChange, onSave, onAIAction, onAIFill, saving, onImportClick, generating, aiFilling }, ref) {
    const saveTimerRef = useRef(null);
    const [wordCount, setWordCount] = useState(0);
    const [showAskInput, setShowAskInput] = useState(false);
    const [askQuery, setAskQuery] = useState('');
    const askInputRef = useRef(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: { HTMLAttributes: { class: 'notebook-code-block' } },
            }),
            Placeholder.configure({
                placeholder: 'Start writing your document... Use the toolbar above or press / for commands',
            }),
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Highlight.configure({ multicolor: true }),
            Link.configure({
                openOnClick: true,
                autolink: true,
                HTMLAttributes: {
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    class: 'notebook-link',
                },
            }),
            MermaidExtension,
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
            Markdown.configure({
                html: true,
                tightLists: true,
                tightListClass: 'tight',
                bulletListMarker: '-',
                linkify: true,
                breaks: false,
                transformPastedText: true,
                transformCopiedText: true,
            }),
        ],
        content: content || '',
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onChange?.(html);

            // Word count
            const text = editor.getText();
            setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);

            // Auto-save debounce
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
                onSave?.(html);
            }, 2000);
        },
    });

    // Sync content from props (e.g. when switching notebooks)
    useEffect(() => {
        if (!editor) return;
        const currentHTML = editor.getHTML();
        if (content !== currentHTML && content !== undefined) {
            editor.commands.setContent(content || '', false);
        }
    }, [content, editor]);

    // Handle AI action on selected text
    const handleAIAction = useCallback((actionKey, customQuery = null) => {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        if (!selectedText.trim()) return;
        
        onAIAction?.(actionKey, selectedText, { from, to }, customQuery);
        
        if (actionKey === 'ask') {
            setShowAskInput(false);
            setAskQuery('');
        }
    }, [editor, onAIAction]);

    // Focus input when Ask AI is clicked
    useEffect(() => {
        if (showAskInput && askInputRef.current) {
            askInputRef.current.focus();
        }
    }, [showAskInput]);

    // Expose insert function via ref
    useImperativeHandle(ref, () => ({
        insertContent: (text) => {
            if (!editor) return;
            editor.chain().focus().insertContent(text).run();
        },
        setContent: (html) => {
            if (!editor) return;
            editor.commands.setContent(html || '', false);
        },
        /**
         * Insert markdown content — converts to TipTap nodes via the Markdown extension.
         * This is used to insert Studio-generated content.
         */
        insertMarkdown: (md) => {
            if (!editor) return;
            // The tiptap-markdown extension can parse markdown if we set it as content
            // We'll get the current content, append the new markdown-converted content
            editor.chain().focus().insertContent(md).run();
        },
        /**
         * Replace all editor content with markdown content.
         */
        setMarkdownContent: (md) => {
            if (!editor) return;
            editor.commands.setContent(md || '', false);
        },
        getEditor: () => editor,
    }), [editor]);

    if (!editor) return null;

    return (
        <div className="flex flex-col h-full relative" style={{ background: 'var(--bg-primary)' }}>
            {/* ── Generating Overlay ── */}
            {generating && (
                <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(var(--bg-primary-rgb, 255,255,255), 0.6)', backdropFilter: 'blur(2px)' }}>
                    <div className="flex flex-col items-center gap-3 pointer-events-auto px-6 py-5 rounded-2xl shadow-2xl border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}>
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'var(--accent-primary)', opacity: 0.15 }} />
                            <div className="relative w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.15))' }}>
                                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Generating {generating.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                Content will appear in the document...
                            </p>
                        </div>
                        <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent-primary)', animationDelay: `${i * 0.15}s` }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Top Toolbar ── */}
            <div className="shrink-0 flex items-center gap-0.5 px-3 py-1.5 border-b flex-wrap" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                {/* Text formatting */}
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={Bold} title="Bold" />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={Italic} title="Italic" />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} icon={UnderlineIcon} title="Underline" />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} icon={Strikethrough} title="Strikethrough" />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} icon={Highlighter} title="Highlight" />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} icon={Code} title="Inline Code" />

                <div className="w-px h-5 mx-1" style={{ background: 'var(--border-subtle)' }} />

                {/* Headings */}
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={Heading1} title="Heading 1" />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={Heading2} title="Heading 2" />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} icon={Heading3} title="Heading 3" />

                <div className="w-px h-5 mx-1" style={{ background: 'var(--border-subtle)' }} />

                {/* Lists */}
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={List} title="Bullet List" />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={ListOrdered} title="Numbered List" />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} icon={Quote} title="Quote" />

                <div className="w-px h-5 mx-1" style={{ background: 'var(--border-subtle)' }} />

                {/* Table */}
                <TableDropdown editor={editor} />

                <div className="w-px h-5 mx-1" style={{ background: 'var(--border-subtle)' }} />

                {/* Alignment */}
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} icon={AlignLeft} title="Align Left" />
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} icon={AlignCenter} title="Center" />
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} icon={AlignRight} title="Align Right" />

                <div className="w-px h-5 mx-1" style={{ background: 'var(--border-subtle)' }} />

                {/* Undo/Redo */}
                <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} icon={Undo} title="Undo" />
                <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} icon={Redo} title="Redo" />

                <div className="w-px h-5 mx-1" style={{ background: 'var(--border-subtle)' }} />

                {/* Import */}
                {onImportClick && (
                    <ToolbarBtn onClick={onImportClick} icon={FileUp} title="Import Text Database (PDF, DOCX, TXT)" />
                )}

                {/* AI Fill */}
                {onAIFill && (
                    <ToolbarBtn
                        onClick={onAIFill}
                        icon={aiFilling ? Loader2 : Wand2}
                        title="AI Fill — Replace {{parameters}} using sources"
                        disabled={aiFilling}
                        className={aiFilling ? 'animate-pulse' : ''}
                    />
                )}

                {/* Spacer + word count + save indicator */}
                <div className="flex-1" />
                <span className="text-[10px] mr-2" style={{ color: 'var(--text-tertiary)' }}>{wordCount} words</span>
                {saving && <span className="text-[10px] animate-pulse" style={{ color: 'var(--accent-primary)' }}>Saving...</span>}
            </div>

            {/* ── Official TipTap BubbleMenu — AI Actions on text selection ── */}
            <BubbleMenu
                editor={editor}
                tippyOptions={{
                    placement: 'top',
                    animation: 'shift-toward-subtle',
                    duration: 150,
                    onHidden: () => {
                        setShowAskInput(false);
                        setAskQuery('');
                    }
                }}
            >
                <div
                    className="flex items-center px-1.5 py-1 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-200"
                    style={{
                        background: 'var(--bg-primary)',
                        borderColor: 'var(--border-default)',
                        gap: showAskInput ? '6px' : '2px',
                    }}
                >
                    {!showAskInput ? (
                        <>
                            {AI_ACTIONS.map(action => {
                                const Icon = action.icon;
                                return (
                                    <button key={action.key}
                                        onMouseDown={e => { e.preventDefault(); handleAIAction(action.key); }}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all hover:bg-[var(--bg-tertiary)]"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        <Icon className="w-3 h-3" /> {action.label}
                                    </button>
                                );
                            })}
                            <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-subtle)' }} />
                            <button
                                onMouseDown={e => { 
                                    e.preventDefault(); 
                                    setShowAskInput(true); 
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all hover:bg-[var(--bg-tertiary)]"
                                style={{ color: 'var(--accent-primary)' }}
                            >
                                <Wand2 className="w-3 h-3" /> Ask AI
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 pl-2">
                            <Wand2 className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
                            <input
                                ref={askInputRef}
                                type="text"
                                placeholder="Ask AI about this text..."
                                value={askQuery}
                                onChange={e => setAskQuery(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && askQuery.trim()) {
                                        e.preventDefault();
                                        handleAIAction('ask', askQuery.trim());
                                    } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setShowAskInput(false);
                                        setAskQuery('');
                                    }
                                }}
                                className="bg-transparent border-none outline-none text-[11px] w-[200px] font-medium placeholder-[var(--text-tertiary)] text-[var(--text-primary)]"
                            />
                            <button
                                onMouseDown={e => {
                                    e.preventDefault();
                                    if (askQuery.trim()) handleAIAction('ask', askQuery.trim());
                                }}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                                disabled={!askQuery.trim()}
                            >
                                Send
                            </button>
                            <button
                                onMouseDown={e => {
                                    e.preventDefault();
                                    setShowAskInput(false);
                                    setAskQuery('');
                                }}
                                className="px-1.5 py-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                            >
                                &times;
                            </button>
                        </div>
                    )}
                </div>
            </BubbleMenu>

            {/* ── Editor Content ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ background: 'var(--bg-primary)' }}>
                <div className="max-w-[800px] mx-auto px-8 py-6">
                    <EditorContent editor={editor} className="notebook-editor" />
                </div>
            </div>
        </div>
    );
});

export default NotebookEditor;
