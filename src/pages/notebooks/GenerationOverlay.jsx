import React, { useState, useRef, useEffect } from 'react';
import {
    X, FileText, ClipboardList, ListChecks, Layers,
    HelpCircle, FileQuestion, Activity, Mic, Table2,
    Download, FileDown, Clock, ChevronLeft,
    ChevronRight as ChevronRightIcon
} from 'lucide-react';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import AudioPlayerInline from '../../components/chat/MessageItem/AudioPlayer';
import FlashcardsView from './FlashcardsView';
import StudyGuideView from './StudyGuideView';
import QuizView from './QuizView';

/* ── Generation type metadata (matches NotebookStudio groups) ── */
const TYPE_META = {
    summary:      { icon: ClipboardList, label: 'Executive Summary', color: '#3b82f6', group: 'Reports' },
    briefing_doc: { icon: Layers, label: 'Briefing Doc', color: '#3b82f6', group: 'Reports' },
    blog_post:    { icon: FileText, label: 'Blog Post', color: '#3b82f6', group: 'Reports' },
    faq:          { icon: HelpCircle, label: 'FAQ', color: '#3b82f6', group: 'Reports' },
    studyGuide:   { icon: ListChecks, label: 'Study Guide', color: '#22c55e', group: 'Study Aids' },
    flashcards:   { icon: Layers, label: 'Flashcards', color: '#22c55e', group: 'Study Aids' },
    quiz:         { icon: FileQuestion, label: 'Knowledge Quiz', color: '#22c55e', group: 'Study Aids' },
    audio_overview: { icon: Mic, label: 'Audio Podcast', color: '#8b5cf6', group: 'Media & Visuals' },
    mind_map:     { icon: Activity, label: 'Mind Map', color: '#8b5cf6', group: 'Media & Visuals' },
    data_table:   { icon: Table2, label: 'Data Table', color: '#8b5cf6', group: 'Media & Visuals' },
};

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ── GenerationOverlay                              ── */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function GenerationOverlay({ generation, history, onClose, onSelectHistory, onInsertToDocument, onSourceClick }) {
    if (!generation) return null;

    const meta = TYPE_META[generation.type] || { icon: FileText, label: generation.type, color: '#6b7280', group: 'Other' };
    const Icon = meta.icon;
    const [showHistory, setShowHistory] = useState(false);

    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleExportPdf = () => {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;
        printWindow.document.write(`<!DOCTYPE html>
<html><head>
    <title>${meta.label}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: white; color: #1a1a1a; padding: 48px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.75; font-size: 15px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 1.8em; font-weight: 700; margin: 1.2em 0 0.6em; }
        h2 { font-size: 1.4em; font-weight: 600; margin: 1.2em 0 0.5em; }
        h3 { font-size: 1.15em; font-weight: 600; margin: 1em 0 0.4em; }
        p { margin: 0.6em 0; }
        ul, ol { margin: 0.5em 0; padding-left: 1.8em; }
        li { margin: 0.25em 0; }
        strong { font-weight: 600; }
        blockquote { border-left: 3px solid #d1d5db; margin: 0.8em 0; padding: 0.5em 1em; color: #555; background: #f9fafb; }
        pre { background: #f3f4f6; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 0.8em 0; font-size: 13px; }
        code { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.88em; }
        table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
        th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
        th { background: #f3f4f6; font-weight: 600; }
        @media print { body { padding: 20px; } }
    </style>
</head><body>
    <h1>${meta.label}</h1>
    <div id="content"></div>
    <div style="text-align:right;color:#9ca3af;font-size:11px;margin-top:40px;border-top:1px solid #e5e7eb;padding-top:10px;">
        Generated on ${new Date(generation.timestamp).toLocaleString()}
    </div>
</body></html>`);
        // Inject raw markdown text as preformatted — the printWindow doesn't have React
        const contentEl = printWindow.document.getElementById('content');
        contentEl.innerHTML = generation.content
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
        printWindow.document.close();
        setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400);
    };

    return (
        <div className="fixed inset-0 z-[200] flex" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            <div
                className="relative flex w-full h-full"
                onClick={e => e.stopPropagation()}
            >
                {/* ── History Sidebar ── */}
                {showHistory && history.length > 0 && (
                    <div className="w-[280px] shrink-0 flex flex-col border-r overflow-hidden"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                            <Clock className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Generation History</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {history.map((item) => {
                                const itemMeta = TYPE_META[item.type] || { icon: FileText, label: item.type, color: '#6b7280', group: 'Other' };
                                const ItemIcon = itemMeta.icon;
                                const isActive = generation.id === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => onSelectHistory(item)}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-2.5 transition-all ${
                                            isActive
                                                ? 'bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30'
                                                : 'hover:bg-[var(--bg-tertiary)] border border-transparent'
                                        }`}
                                    >
                                        <div className="mt-0.5 p-1 rounded-md shrink-0"
                                            style={{ background: `${itemMeta.color}15`, color: itemMeta.color }}>
                                            <ItemIcon className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                                {itemMeta.label}
                                            </div>
                                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                                {formatTime(item.timestamp)}
                                                {item.audioFiles?.length > 0 && ' · 🎙️ Audio'}
                                            </div>
                                        </div>
                                        {isActive && (
                                            <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: 'var(--accent-primary)' }} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Main Content Panel ── */}
                <div className="flex-1 flex flex-col min-w-0 max-w-5xl mx-auto"
                    style={{ background: 'var(--bg-primary)' }}>

                    {/* Header */}
                    <div className="shrink-0 px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
                        {/* History toggle */}
                        <button
                            onClick={() => setShowHistory(p => !p)}
                            className={`p-2 rounded-xl transition-all ${showHistory ? 'bg-[var(--accent-primary)]/10' : 'hover:bg-[var(--bg-tertiary)]'}`}
                            title="Generation History"
                        >
                            <Clock className="w-4 h-4" style={{ color: showHistory ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        </button>

                        {/* Type badge */}
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`, boxShadow: `0 4px 15px ${meta.color}30` }}>
                                <Icon className="w-4.5 h-4.5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {meta.label}
                                </h2>
                                <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                    {meta.group} · Generated {formatTime(generation.timestamp)}
                                </p>
                            </div>
                        </div>

                        <div className="flex-1" />

                        {/* Actions */}
                        <button
                            onClick={handleExportPdf}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-tertiary)] border"
                            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                            title="Export as PDF"
                        >
                            <FileDown className="w-3.5 h-3.5" />
                            PDF
                        </button>
                        {onInsertToDocument && !['flashcards', 'studyGuide', 'quiz'].includes(generation.type) && (
                            <button
                                onClick={() => { onInsertToDocument(generation.content); onClose(); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110"
                                style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}dd)` }}
                            >
                                <Download className="w-3.5 h-3.5" />
                                Insert to Doc
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors ml-1"
                        >
                            <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                    </div>

                    {/* Audio Player (for audio_overview) */}
                    {generation.audioFiles && generation.audioFiles.length > 0 && (
                        <div className="shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                            {generation.audioFiles.map((audio, i) => (
                                <AudioPlayerInline
                                    key={i}
                                    src={audio.url}
                                    title="AI Podcast"
                                    subtitle="ElevenLabs · 2-Host Discussion"
                                />
                            ))}
                        </div>
                    )}

                    {/* Scrollable content area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar h-full relative">
                        {generation.type === 'flashcards' ? (
                            <FlashcardsView content={generation.content} onSourceClick={onSourceClick} />
                        ) : generation.type === 'studyGuide' ? (
                            <StudyGuideView content={generation.content} onSourceClick={onSourceClick} />
                        ) : generation.type === 'quiz' ? (
                            <QuizView content={generation.content} />
                        ) : (
                            <div className="max-w-3xl mx-auto px-8 py-8">
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <MarkdownRenderer content={generation.content} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 px-6 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                            {history.length} generation{history.length !== 1 ? 's' : ''} in this session
                        </span>
                        <div className="flex items-center gap-2">
                            {/* Navigate prev/next */}
                            {history.length > 1 && (() => {
                                const idx = history.findIndex(h => h.id === generation.id);
                                return (
                                    <div className="flex items-center gap-1">
                                        <button
                                            disabled={idx <= 0}
                                            onClick={() => idx > 0 && onSelectHistory(history[idx - 1])}
                                            className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-30 transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                                        </button>
                                        <span className="text-[10px] font-medium px-1" style={{ color: 'var(--text-tertiary)' }}>
                                            {idx + 1} / {history.length}
                                        </span>
                                        <button
                                            disabled={idx >= history.length - 1}
                                            onClick={() => idx < history.length - 1 && onSelectHistory(history[idx + 1])}
                                            className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-30 transition-colors"
                                        >
                                            <ChevronRightIcon className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                                        </button>
                                    </div>
                                );
                            })()}
                            <button
                                onClick={onClose}
                                className="px-4 py-1.5 text-xs font-medium rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
