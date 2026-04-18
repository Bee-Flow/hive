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
import MermaidExtension, { preprocessMermaidContent } from './MermaidExtension';
import Mathematics from '@tiptap/extension-mathematics';
import { TableOfContents } from '@tiptap/extension-table-of-contents';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import Emoji, { gitHubEmojis } from '@tiptap/extension-emoji';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Typography from '@tiptap/extension-typography';
import ResizableImage from './ResizableImage';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { SectionDragExtension } from './SectionDragExtension';
import { API_BASE } from '../../utils/helpers';
import useTranslation from '../../hooks/useTranslation';

// KaTeX CSS for math formula rendering
import 'katex/dist/katex.min.css';

import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, Quote, Heading1, Heading2, Heading3,
    AlignLeft, AlignCenter, AlignRight, Undo, Redo,
    Highlighter, Wand2, RefreshCw, Scissors, Expand, Code, Link as LinkIcon, FileUp,
    Loader2, Table2, Plus, Trash2, ChevronDown, Sigma, GripVertical,
    CheckSquare, ImageIcon, Palette, WrapText, Maximize2, Minimize2, Type,
} from 'lucide-react';

/* ── AI Actions for selection bubble menu ─────────────────────── */
const getAIActions = (t) => [
    { key: 'rewrite', icon: RefreshCw, label: t('notebooks.ai_action_rewrite') },
    { key: 'shorten', icon: Scissors, label: t('notebooks.ai_action_shorten') },
    { key: 'expand', icon: Expand, label: t('notebooks.ai_action_expand') },
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

/* ── Font Family Picker ──────────────────────────────────────── */
const FONT_FAMILIES = [
    { label: 'Default',          value: null,               css: "'Inter', sans-serif" },
    { label: 'Inter',            value: 'Inter',            css: "'Inter', sans-serif" },
    { label: 'Georgia',          value: 'Georgia',          css: "Georgia, serif" },
    { label: 'Merriweather',     value: 'Merriweather',     css: "'Merriweather', serif" },
    { label: 'Playfair Display', value: 'Playfair Display', css: "'Playfair Display', serif" },
    { label: 'Lora',             value: 'Lora',             css: "'Lora', serif" },
    { label: 'Poppins',          value: 'Poppins',          css: "'Poppins', sans-serif" },
    { label: 'Nunito',           value: 'Nunito',           css: "'Nunito', sans-serif" },
    { label: 'Source Sans 3',    value: 'Source Sans 3',    css: "'Source Sans 3', sans-serif" },
    { label: 'Roboto Mono',      value: 'Roboto Mono',      css: "'Roboto Mono', monospace" },
    { label: 'Fira Code',        value: 'Fira Code',        css: "'Fira Code', monospace" },
];

function FontPicker({ editor }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const currentFont = editor.getAttributes('textStyle').fontFamily || null;
    const activeLabel = FONT_FAMILIES.find(f => f.value === currentFont)?.label || 'Font';

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            <button
                onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
                className={`flex items-center gap-1 px-1.5 py-1 rounded-md transition-all duration-150 text-[11px] font-medium ${
                    currentFont
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }`}
                title="Font Family"
                style={{ maxWidth: '110px' }}
            >
                <Type className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                <span className="truncate">{activeLabel}</span>
                <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />
            </button>
            {open && (
                <div
                    className="absolute top-full left-0 mt-1 z-50 py-1 rounded-xl shadow-2xl border overflow-y-auto"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', minWidth: '180px', maxHeight: '320px' }}
                >
                    {FONT_FAMILIES.map(font => (
                        <button
                            key={font.label}
                            onMouseDown={e => {
                                e.preventDefault();
                                if (font.value) {
                                    editor.chain().focus().setFontFamily(font.value).run();
                                } else {
                                    editor.chain().focus().unsetFontFamily().run();
                                }
                                setOpen(false);
                            }}
                            className={`flex items-center w-full px-3 py-1.5 text-[12px] transition-colors hover:bg-[var(--bg-tertiary)] ${
                                (font.value === currentFont || (!font.value && !currentFont))
                                    ? 'text-[var(--accent-primary)] font-semibold bg-[var(--accent-primary)]/5'
                                    : 'text-[var(--text-secondary)]'
                            }`}
                            style={{ fontFamily: font.css }}
                        >
                            {font.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Color Picker Button ─────────────────────────────────────── */
// Color palette grouped by section
const PALETTE = [
    // Reds / Oranges / Yellows
    '#ef4444', '#f97316', '#eab308', '#84cc16',
    // Greens / Teals / Blues
    '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
    // Purples / Pinks
    '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
    // Grays / Neutrals
    '#64748b', '#94a3b8', '#cbd5e1', '#000000',
];

function ColorPicker({ editor }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const currentColor = editor.getAttributes('textStyle').color || null;

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            <button
                onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
                className={`flex items-center gap-1 p-1.5 rounded-md transition-all duration-150 ${
                    currentColor
                        ? 'bg-[var(--accent-primary)]/10'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }`}
                title="Text Color"
            >
                <Palette className="w-3.5 h-3.5" strokeWidth={2} style={{ color: currentColor || 'currentColor' }} />
                {/* Color swatch indicator */}
                <span
                    className="w-3 h-1.5 rounded-sm"
                    style={{ background: currentColor || 'var(--text-muted)' }}
                />
            </button>
            {open && (
                <div
                    className="absolute top-full left-0 mt-1 z-50 p-2.5 rounded-xl shadow-2xl border"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', minWidth: '176px' }}
                >
                    {/* Color grid */}
                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                        {PALETTE.map(color => (
                            <button
                                key={color}
                                onMouseDown={e => {
                                    e.preventDefault();
                                    editor.chain().focus().setColor(color).run();
                                    setOpen(false);
                                }}
                                className="w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 active:scale-95"
                                style={{
                                    background: color,
                                    borderColor: currentColor === color ? 'white' : 'transparent',
                                    boxShadow: currentColor === color ? `0 0 0 2px ${color}` : 'none',
                                }}
                                title={color}
                            />
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="h-px my-1.5" style={{ background: 'var(--border-subtle)' }} />

                    {/* Custom + Reset row */}
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="color"
                                value={currentColor || '#ffffff'}
                                onChange={e => editor.chain().focus().setColor(e.target.value).run()}
                                className="w-7 h-7 rounded-lg cursor-pointer p-0 border-0 bg-transparent"
                                title="Custom color"
                            />
                            <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Custom</span>
                        </label>
                        {currentColor && (
                            <button
                                onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setOpen(false); }}
                                className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                ✕ Reset
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
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

/* ── More Formatting Dropdown ────────────────────────────────── */
function MoreFormattingDropdown({ editor, insertMath, imageInputRef, onImportClick, onAIFill, aiFilling, askAiEnabled, t }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const hasActiveSecondary = editor.isActive('strike') || editor.isActive('highlight')
        || editor.isActive('code') || editor.isActive('blockquote')
        || editor.isActive({ textAlign: 'center' }) || editor.isActive({ textAlign: 'right' });

    return (
        <div className="relative" ref={ref}>
            <button
                onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
                className={`flex items-center gap-0.5 p-1.5 rounded-md transition-all duration-150 ${
                    hasActiveSecondary
                        ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }`}
                title="More formatting"
            >
                <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            {open && (
                <div
                    className="absolute top-full left-0 mt-1 z-50 py-1.5 rounded-xl shadow-2xl border min-w-[200px]"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
                >
                    {/* Section: Text */}
                    <div className="px-3 pt-1 pb-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Text</span>
                    </div>
                    <MoreItem icon={Strikethrough} label="Strikethrough" active={editor.isActive('strike')}
                        onClick={() => { editor.chain().focus().toggleStrike().run(); }} />
                    <MoreItem icon={Highlighter} label="Highlight" active={editor.isActive('highlight')}
                        onClick={() => { editor.chain().focus().toggleHighlight().run(); }} />
                    <MoreItem icon={Code} label="Inline Code" active={editor.isActive('code')}
                        onClick={() => { editor.chain().focus().toggleCode().run(); }} />
                    <MoreItem icon={Quote} label="Blockquote" active={editor.isActive('blockquote')}
                        onClick={() => { editor.chain().focus().toggleBlockquote().run(); }} />
                    <MoreItem icon={LinkIcon} label="Insert Link"
                        onClick={() => {
                            const url = window.prompt('URL');
                            if (url) editor.chain().focus().setLink({ href: url }).run();
                            setOpen(false);
                        }} />

                    <div className="h-px mx-2 my-1" style={{ background: 'var(--border-subtle)' }} />

                    {/* Section: Align */}
                    <div className="px-3 pt-1 pb-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Alignment</span>
                    </div>
                    <MoreItem icon={AlignLeft} label="Align Left" active={editor.isActive({ textAlign: 'left' })}
                        onClick={() => { editor.chain().focus().setTextAlign('left').run(); }} />
                    <MoreItem icon={AlignCenter} label="Center" active={editor.isActive({ textAlign: 'center' })}
                        onClick={() => { editor.chain().focus().setTextAlign('center').run(); }} />
                    <MoreItem icon={AlignRight} label="Align Right" active={editor.isActive({ textAlign: 'right' })}
                        onClick={() => { editor.chain().focus().setTextAlign('right').run(); }} />

                    <div className="h-px mx-2 my-1" style={{ background: 'var(--border-subtle)' }} />

                    {/* Section: Insert */}
                    <div className="px-3 pt-1 pb-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Insert</span>
                    </div>
                    <MoreItem icon={ImageIcon} label="Upload Image"
                        onClick={() => { imageInputRef.current?.click(); setOpen(false); }} />
                    <MoreItem icon={Sigma} label="Math Formula" active={editor.isActive('math')}
                        onClick={() => { insertMath(); setOpen(false); }} />
                    {onImportClick && (
                        <MoreItem icon={FileUp} label="Import File (PDF, DOCX)"
                            onClick={() => { onImportClick(); setOpen(false); }} />
                    )}
                    {onAIFill && askAiEnabled && (
                        <MoreItem icon={aiFilling ? Loader2 : Wand2} label={t('notebooks.ai_fill')} disabled={aiFilling}
                            onClick={() => { onAIFill(); setOpen(false); }} />
                    )}
                </div>
            )}
        </div>
    );
}

function MoreItem({ icon: Icon, label, onClick, active, danger, disabled }) {
    return (
        <button
            onMouseDown={e => { e.preventDefault(); if (!disabled) onClick?.(); }}
            className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--bg-tertiary)]'
            } ${active ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : danger ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}
            disabled={disabled}
        >
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
            {label}
        </button>
    );
}

/* ── Main Editor Component ───────────────────────────────────────────────────── */
const NotebookEditor = forwardRef(function NotebookEditorInner(
    { content, onChange, onSave, onAIAction, onAIFill, saving, onImportClick, generating, aiFilling, onTocUpdate, notebookId, askAiEnabled = true },
    ref
) {
    const saveTimerRef = useRef(null);
    const [wordCount, setWordCount] = useState(0);
    const [showAskInput, setShowAskInput] = useState(false);
    const [askQuery, setAskQuery] = useState('');
    const askInputRef = useRef(null);
    // Position of the floating ask-input portal (captured from selection rect)
    const [askAnchor, setAskAnchor] = useState(null);
    // Frozen selected text + range used when the ask input is open
    const frozenSelectionRef = useRef(null);
    const imageInputRef = useRef(null);
    // Always-fresh ref so the image upload closure never captures a stale notebookId
    const notebookIdRef = useRef(notebookId);
    useEffect(() => { notebookIdRef.current = notebookId; }, [notebookId]);

    const { t } = useTranslation();
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: { HTMLAttributes: { class: 'notebook-code-block' } },
            }),
            Placeholder.configure({
                placeholder: t('notebooks.placeholder'),
            }),
            // NOTE: Underline and Link are NOT part of StarterKit v3 — they must
            // be listed explicitly. The "duplicate extension" tiptap warning is caused
            // by tiptap-markdown internally registering its own Link extension. This
            // is a cosmetic warning only and does not affect functionality.
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Highlight.configure({ multicolor: true }),
            Link.configure({
                openOnClick: true,
                autolink: true,
                HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer', class: 'notebook-link' },
            }),
            MermaidExtension,
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
            Markdown.configure({
                html: true, tightLists: true, tightListClass: 'tight',
                bulletListMarker: '-', linkify: true, breaks: false,
                transformPastedText: true, transformCopiedText: true,
            }),

            // ── BATCH 1 (prev session) ───────────────────────────────
            Mathematics,
            TableOfContents.configure({ onUpdate: (items) => onTocUpdate?.(items) }),
            Emoji.configure({ emojis: gitHubEmojis, enableEmoticons: true }),

            // ── BATCH 2 (this session) ───────────────────────────────
            // TextStyle must come before Color
            TextStyle,
            Color,
            FontFamily,
            Typography,
            ResizableImage,
            TaskList,
            TaskItem.configure({ nested: true }),

            // ── Section-aware drag (heading grabs entire section) ────
            SectionDragExtension,

            // (Removed Letter-format paginated page view — the editor now
            // renders as a single flowing document. Printing / PDF export
            // still paginates server-side via the export pipeline.)
        ],
        content: content || '',
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onChange?.(html);
            const text = editor.getText();
            setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => onSave?.(html), 2000);
        },
    });

    // Track what node the DragHandle is hovering over (for heading indicator)
    const [dragNodeType, setDragNodeType] = useState(null);


    // Resolve relative /api/ image URLs → full API_BASE URLs when loading saved content
    // Production (nginx): API_BASE='', no-op. Dev: prepends server.dev.beeflow.ai
    const resolveContentUrls = useCallback((html) => {
        if (!html || !API_BASE) return html;
        return html.replace(/(src=["'])(\/(api\/storage\/[^"']+))/gi, `$1${API_BASE}/$3`);
    }, []);

    // Sync content from props (e.g. when switching notebooks)
    useEffect(() => {
        if (!editor) return;
        const currentHTML = editor.getHTML();
        if (content !== currentHTML && content !== undefined) {
            const resolved = resolveContentUrls(content) || '';
            const processed = preprocessMermaidContent(resolved);
            editor.commands.setContent(processed, false);
        }
    }, [content, editor, resolveContentUrls]);

    // Handle AI action on selected text
    const handleAIAction = useCallback((actionKey, customQuery = null) => {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        if (!selectedText.trim()) return;
        onAIAction?.(actionKey, selectedText, { from, to }, customQuery);
        if (actionKey === 'ask') { setShowAskInput(false); setAskQuery(''); }
    }, [editor, onAIAction]);

    // Insert inline math at cursor / wrap selection
    const insertMath = useCallback(() => {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        editor.chain().focus().insertContent(selectedText.trim() ? `$${selectedText}$` : '$formula$').run();
    }, [editor]);

    // Upload image to RustFS via notebook image endpoint
    const handleImageUpload = useCallback(async (file) => {
        if (!editor) return;
        const nbId = notebookIdRef.current;
        if (!nbId) {
            console.warn('[NotebookEditor] Image upload skipped — notebookId not set yet');
            return;
        }
        if (!file || !/^image\//.test(file.type)) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch(`${API_BASE}/api/notebooks/${nbId}/images`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const text = await res.text();
                throw new Error(`Server returned ${res.status}: ${text.slice(0, 120)}`);
            }
            const data = await res.json();
            if (data.url) {
                // Prepend API_BASE so images resolve correctly:
                // - Production (nginx): API_BASE='', stays relative → goes through proxy
                // - Dev deployment: API_BASE='https://server.dev.beeflow.ai' → hits backend directly
                const imgSrc = `${API_BASE}${data.url}`;
                editor.chain().focus().setImage({ src: imgSrc, alt: file.name }).run();
            } else {
                throw new Error(data.error || 'No URL returned');
            }
        } catch (err) {
            console.error('[NotebookEditor] Image upload failed:', err.message);
        }
    }, [editor]);

    // Handle image paste from clipboard
    useEffect(() => {
        if (!editor) return;
        const el = editor.view.dom;

        const handlePaste = (e) => {
            const items = Array.from(e.clipboardData?.items || []);
            const imageItem = items.find(i => i.type.startsWith('image/'));
            if (!imageItem) return;
            e.preventDefault();
            const file = imageItem.getAsFile();
            if (file) handleImageUpload(file);
        };

        const handleDrop = (e) => {
            const files = Array.from(e.dataTransfer?.files || []);
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            if (imageFiles.length === 0) return;
            e.preventDefault();
            imageFiles.forEach(f => handleImageUpload(f));
        };

        el.addEventListener('paste', handlePaste);
        el.addEventListener('drop', handleDrop);
        return () => {
            el.removeEventListener('paste', handlePaste);
            el.removeEventListener('drop', handleDrop);
        };
    }, [editor, handleImageUpload]);

    // Focus Ask AI input whenever the portal appears
    useEffect(() => {
        if (showAskInput && askInputRef.current) {
            // tiny delay so the portal has painted before we focus
            requestAnimationFrame(() => askInputRef.current?.focus());
        }
    }, [showAskInput]);

    // Close ask input on outside click. Use the data attribute directly rather
    // than dereferencing `askInputRef.current` — the ref can be null for a tick
    // on first render, which made the handler a no-op AND was the reason the
    // portal sometimes appeared to "do nothing" right after click.
    useEffect(() => {
        if (!showAskInput) return;
        const handler = (e) => {
            const portal = document.querySelector('[data-ask-portal]');
            if (portal && !portal.contains(e.target)) {
                setShowAskInput(false);
                setAskQuery('');
                frozenSelectionRef.current = null;
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showAskInput]);

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
        insertContent: (text) => editor?.chain().focus().insertContent(text).run(),
        setContent: (html) => editor?.commands.setContent(preprocessMermaidContent(html) || '', false),
        insertMarkdown: (md) => editor?.chain().focus().insertContent(md).run(),
        setMarkdownContent: (md) => editor?.commands.setContent(preprocessMermaidContent(md) || '', false),
        getEditor: () => editor,
    }), [editor]);

    if (!editor) return null;

    return (
        <div className="flex flex-col h-full relative" style={{ background: 'var(--bg-primary)' }}>
            {/* Invisible image file input */}
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }}
            />

            {/* DragHandle — floating block reorder; heading-aware section drag */}
            <DragHandle
                editor={editor}
                onNodeChange={({ node }) => {
                    setDragNodeType(node?.type?.name === 'heading' ? node.attrs.level : null);
                }}
            >
                <div
                    className="flex items-center justify-center rounded cursor-grab transition-all"
                    style={{
                        background: dragNodeType ? 'rgba(99,102,241,0.12)' : 'transparent',
                        border: dragNodeType ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                        color: dragNodeType ? '#818cf8' : 'var(--text-tertiary)',
                        padding: dragNodeType ? '1px 4px' : '2px',
                        borderRadius: '5px',
                        minWidth: '20px',
                        height: '20px',
                    }}
                    title={dragNodeType
                        ? `Drag to move entire H${dragNodeType} section (all content until next H${dragNodeType})`
                        : 'Drag to reorder block'
                    }
                >
                    {dragNodeType ? (
                        /* Section indicator: shows H1/H2/H3 level */
                        <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, userSelect: 'none' }}>
                            H{dragNodeType}≡
                        </span>
                    ) : (
                        <GripVertical className="w-3.5 h-3.5" strokeWidth={2} />
                    )}
                </div>
            </DragHandle>

            {/* Generating Overlay */}
            {generating && (
                <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(var(--bg-primary-rgb, 255,255,255), 0.6)', backdropFilter: 'blur(2px)' }}>
                    <div className="flex flex-col items-center gap-3 pointer-events-auto px-6 py-5 rounded-2xl shadow-2xl border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}>
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'var(--accent-primary)', opacity: 0.15 }} />
                            <div className="relative w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.15))' }}>
                                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Generating {generating.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Content will appear in the document...</p>
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
            <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                {/* ─ Text Style ─ */}
                <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={Bold} title="Bold (Ctrl+B)" />
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={Italic} title="Italic (Ctrl+I)" />
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} icon={UnderlineIcon} title="Underline (Ctrl+U)" />
                    <FontPicker editor={editor} />
                    <ColorPicker editor={editor} />
                </div>

                {/* ─ Headings ─ */}
                <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={Heading1} title="Heading 1" />
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={Heading2} title="Heading 2" />
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} icon={Heading3} title="Heading 3" />
                </div>

                {/* ─ Lists ─ */}
                <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={List} title="Bullet List" />
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={ListOrdered} title="Numbered List" />
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} icon={CheckSquare} title="Task List" />
                </div>

                {/* ─ Insert ─ */}
                <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <TableDropdown editor={editor} />
                    <MoreFormattingDropdown
                        editor={editor}
                        insertMath={insertMath}
                        imageInputRef={imageInputRef}
                        onImportClick={onImportClick}
                        onAIFill={onAIFill}
                        aiFilling={aiFilling}
                        askAiEnabled={askAiEnabled}
                        t={t}
                    />
                </div>

                {/* ─ History ─ */}
                <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} icon={Undo} title="Undo" />
                    <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} icon={Redo} title="Redo" />
                </div>

                <div className="flex-1" />
                <span className="text-[10px] mr-2" style={{ color: 'var(--text-tertiary)' }}>{wordCount} {t('notebooks.words')}</span>
                {saving && <span className="text-[10px] animate-pulse" style={{ color: 'var(--accent-primary)' }}>{t('notebooks.saving')}</span>}
            </div>

            {/* Math / Tips hint banner */}
            <MathHint />

            {/* BubbleMenu — AI quick-actions on text selection (no input here) */}
            <BubbleMenu
                editor={editor}
                tippyOptions={{
                    placement: 'top',
                    animation: 'shift-toward-subtle',
                    duration: 150,
                    onHidden: () => { /* portal handles its own lifecycle */ }
                }}
                shouldShow={({ editor }) => {
                    // Hide the action-button bar while the ask portal is open
                    if (showAskInput) return false;
                    if (editor.isActive('resizableImage')) return false;
                    return editor.view.state.selection.content().size > 0;
                }}
            >
                    <div
                        className="flex items-center px-1.5 py-1 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-200"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', gap: '2px' }}
                    >
                        {getAIActions(t).map(action => {
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
                    {askAiEnabled && (
                        <>
                            <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-subtle)' }} />
                            <button
                                onMouseDown={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Capture the selection range + screen position NOW,
                                    // before the BubbleMenu unmounts and selection may clear.
                                    const { from, to } = editor.state.selection;
                                    const selectedText = editor.state.doc.textBetween(from, to, ' ');
                                    if (!selectedText.trim()) return; // guard — no text, nothing to ask about
                                    frozenSelectionRef.current = { from, to, selectedText };

                                    // Position the input portal above the selection. Clamp so it
                                    // stays inside the viewport — the previous `coords.top - 52`
                                    // pushed the portal above the top edge when the user clicked
                                    // on text near the top of the window, which looked like the
                                    // button did nothing.
                                    const coords = editor.view.coordsAtPos(from);
                                    const PORTAL_HEIGHT = 44;
                                    const PORTAL_WIDTH = 320;
                                    const margin = 8;
                                    let top = coords.top - PORTAL_HEIGHT - margin;
                                    // Not enough room above? Drop below the selection instead.
                                    if (top < margin) top = (coords.bottom || coords.top) + margin;
                                    // Keep within horizontal bounds.
                                    let left = coords.left;
                                    const maxLeft = window.innerWidth - PORTAL_WIDTH - margin;
                                    if (left > maxLeft) left = Math.max(margin, maxLeft);
                                    if (left < margin) left = margin;
                                    setAskAnchor({ top, left });
                                    setShowAskInput(true);
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all hover:bg-[var(--bg-tertiary)]"
                                style={{ color: 'var(--accent-primary)' }}
                            >
                                <Wand2 className="w-3 h-3" /> {t('notebooks.ask_ai')}
                            </button>
                        </>
                    )}
                </div>
            </BubbleMenu>

            {/* ── Ask AI floating portal — rendered outside the BubbleMenu so
                   it never loses focus due to TipTap re-render cycles ── */}
            {showAskInput && askAnchor && (() => {
                const frozen = frozenSelectionRef.current;
                const rawPreview = frozen?.selectedText?.trim() ?? '';
                const preview = rawPreview.length > 120 ? rawPreview.slice(0, 120) + '…' : rawPreview;
                const submit = () => {
                    if (!askQuery.trim()) return;
                    const f = frozenSelectionRef.current;
                    if (f) onAIAction?.('ask', f.selectedText, { from: f.from, to: f.to }, askQuery.trim());
                    setShowAskInput(false);
                    setAskQuery('');
                    frozenSelectionRef.current = null;
                };
                const dismiss = () => {
                    setShowAskInput(false);
                    setAskQuery('');
                    frozenSelectionRef.current = null;
                };
                return (
                    <div
                        data-ask-portal
                        className="fixed z-[9999] flex flex-col rounded-xl shadow-2xl border backdrop-blur-md overflow-hidden"
                        style={{
                            top: askAnchor.top,
                            left: askAnchor.left,
                            minWidth: '280px',
                            maxWidth: '360px',
                            background: 'var(--bg-primary)',
                            borderColor: 'var(--border-default)',
                        }}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        {/* Selected text preview — shows which text the question is about
                            because clicking Ask AI deselects the editor text visually */}
                        {preview && (
                            <div
                                className="px-3 pt-2.5 pb-1.5 text-[10px] leading-snug border-b"
                                style={{
                                    borderColor: 'var(--border-subtle)',
                                    background: 'rgba(99,102,241,0.04)',
                                    color: 'var(--text-secondary)',
                                }}
                            >
                                <span className="font-semibold text-[9px] uppercase tracking-wider" style={{ color: 'var(--accent-primary)', opacity: 0.7 }}>
                                    Selected text
                                </span>
                                <p className="mt-0.5 italic line-clamp-3">{preview}</p>
                            </div>
                        )}
                        {/* Input row */}
                        <div className="flex items-center gap-2 px-3 py-1.5">
                            <Wand2 className="w-3 h-3 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                            <input
                                ref={askInputRef}
                                type="text"
                                placeholder={t('notebooks.ask_ai_placeholder')}
                                value={askQuery}
                                onChange={e => setAskQuery(e.target.value)}
                                onKeyDown={e => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') { e.preventDefault(); submit(); }
                                    else if (e.key === 'Escape') { e.preventDefault(); dismiss(); }
                                }}
                                className="bg-transparent border-none outline-none text-[11px] w-[200px] font-medium placeholder-[var(--text-tertiary)] text-[var(--text-primary)]"
                            />
                            <button
                                onMouseDown={e => { e.preventDefault(); submit(); }}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                                disabled={!askQuery.trim()}
                            >
                                Send
                            </button>
                            <button
                                onMouseDown={e => { e.preventDefault(); dismiss(); }}
                                className="px-1.5 py-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Image Bubble Menu — alignment, size, wrap, delete */}
            <BubbleMenu
                editor={editor}
                tippyOptions={{
                    placement: 'top',
                    animation: 'shift-toward-subtle',
                    duration: 150,
                }}
                shouldShow={({ editor }) => editor.isActive('resizableImage')}
            >
                <div
                    className="flex items-center gap-0.5 px-1.5 py-1 rounded-xl shadow-xl border backdrop-blur-md"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
                >
                    {/* Alignment */}
                    {['left', 'center', 'right'].map(align => {
                        const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
                        const attrs = editor.getAttributes('resizableImage');
                        const isActive = (attrs.alignment || 'center') === align;
                        return (
                            <button
                                key={align}
                                onMouseDown={e => { e.preventDefault(); editor.chain().focus().updateAttributes('resizableImage', { alignment: align }).run(); }}
                                className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                                title={`Align ${align}`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                            </button>
                        );
                    })}

                    <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-subtle)' }} />

                    {/* Text Wrap toggle */}
                    {(() => {
                        const attrs = editor.getAttributes('resizableImage');
                        const isWrapped = attrs.textWrap === true;
                        return (
                            <button
                                onMouseDown={e => { e.preventDefault(); editor.chain().focus().updateAttributes('resizableImage', { textWrap: !isWrapped }).run(); }}
                                className={`p-1.5 rounded-lg transition-all ${isWrapped ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                                title={isWrapped ? 'Remove text wrap' : 'Wrap text around image'}
                            >
                                <WrapText className="w-3.5 h-3.5" />
                            </button>
                        );
                    })()}

                    <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-subtle)' }} />

                    {/* Size presets */}
                    {[25, 50, 75, 100].map(pct => {
                        const editorWidth = editor?.view?.dom?.clientWidth - 40 || 760;
                        const targetWidth = pct === 100 ? null : Math.round((editorWidth * pct) / 100);
                        return (
                            <button
                                key={pct}
                                onMouseDown={e => { e.preventDefault(); editor.chain().focus().updateAttributes('resizableImage', { width: targetWidth }).run(); }}
                                className="px-1.5 py-1 rounded-lg text-[10px] font-semibold transition-all text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                                title={`Set to ${pct}% width`}
                            >
                                {pct}%
                            </button>
                        );
                    })}

                    <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-subtle)' }} />

                    {/* Delete */}
                    <button
                        onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteSelection().run(); }}
                        className="p-1.5 rounded-lg transition-all text-red-400 hover:bg-red-500/10"
                        title="Delete image"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </BubbleMenu>

            {/* Editor Content — single flowing document, no page view. */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-[820px] mx-auto px-8 py-6">
                    <EditorContent editor={editor} className="notebook-editor" />
                </div>
            </div>
        </div>
    );
});

/* ── Math hint banner — dismissible ─────────────────────────── */
function MathHint() {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(() => {
        try { return localStorage.getItem('nb_math_hint_dismissed') === '1'; } catch { return false; }
    });

    useEffect(() => {
        if (!dismissed) {
            const t = setTimeout(() => setVisible(true), 800);
            return () => clearTimeout(t);
        }
    }, [dismissed]);

    if (!visible || dismissed) return null;

    return (
        <div
            className="shrink-0 flex items-center justify-between px-4 py-1.5 text-[11px] border-b"
            style={{ background: 'var(--brand-gradient-soft)', borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
        >
            <span>
                💡 <strong className="text-[var(--text-secondary)]">{t('notebooks.tips')}</strong>{' '}
                <code className="bg-[var(--bg-tertiary)] px-1 py-0.5 rounded text-[10px]">$formula$</code> {t('notebooks.tips_math')} ·{' '}
                <code className="bg-[var(--bg-tertiary)] px-1 py-0.5 rounded text-[10px]">:emoji:</code> {t('notebooks.tips_emoji')} ·{' '}
                <code className="bg-[var(--bg-tertiary)] px-1 py-0.5 rounded text-[10px]">☑</code> {t('notebooks.tips_tasks')} ·{' '}
                {t('notebooks.tips_drag')} ⠿
            </span>
            <button
                onClick={() => { setDismissed(true); setVisible(false); try { localStorage.setItem('nb_math_hint_dismissed', '1'); } catch {} }}
                className="ml-3 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
                ×
            </button>
        </div>
    );
}

export default NotebookEditor;
