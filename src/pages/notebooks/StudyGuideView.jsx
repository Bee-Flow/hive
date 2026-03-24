import React, { useState, useMemo } from 'react';
import {
    ChevronDown, ChevronRight, BookOpen, CheckCircle2, Circle,
    Target, BookMarked, List, HelpCircle, FileText, Lightbulb,
    AlertTriangle, GraduationCap, ExternalLink, Sparkles
} from 'lucide-react';
import MarkdownRenderer from '../../components/MarkdownRenderer';

/* ── Section theme config by keyword ── */
const SECTION_THEMES = [
    { keywords: ['learning objective', 'objective'],   icon: Target,          color: '#3b82f6', bg: '#3b82f610' },
    { keywords: ['key concept', 'concept'],            icon: Lightbulb,       color: '#f59e0b', bg: '#f59e0b10' },
    { keywords: ['important term', 'terminology', 'glossary', 'definitions'], icon: BookMarked, color: '#8b5cf6', bg: '#8b5cf610' },
    { keywords: ['review question', 'question', 'quiz'], icon: HelpCircle,    color: '#ec4899', bg: '#ec489910' },
    { keywords: ['overview', 'introduction', 'background'], icon: BookOpen,    color: '#06b6d4', bg: '#06b6d410' },
    { keywords: ['summary', 'conclusion', 'recap'],    icon: FileText,        color: '#22c55e', bg: '#22c55e10' },
    { keywords: ['warning', 'caution', 'note'],        icon: AlertTriangle,   color: '#f97316', bg: '#f9731610' },
    { keywords: ['tip', 'recommendation', 'best practice'], icon: Sparkles,   color: '#14b8a6', bg: '#14b8a610' },
];

function getSectionTheme(title) {
    const lower = title.toLowerCase();
    for (const theme of SECTION_THEMES) {
        if (theme.keywords.some(k => lower.includes(k))) return theme;
    }
    return { icon: GraduationCap, color: 'var(--accent-primary)', bg: 'var(--bg-tertiary)' };
}

/* ── Parse markdown into sections based on headings ── */
function parseSections(content) {
    if (!content) return { title: '', intro: '', sections: [] };

    const lines = content.split('\n');
    const sections = [];
    let currentSection = null;
    let docTitle = '';
    let intro = '';
    let seenFirstHeading = false;

    for (const line of lines) {
        // Match # top-level title
        const h1Match = line.match(/^#\s+(.+)/);
        if (h1Match && !seenFirstHeading) {
            docTitle = h1Match[1].replace(/\*\*/g, '').trim();
            seenFirstHeading = true;
            continue;
        }

        // Match ## or ### headings
        const headingMatch = line.match(/^#{2,3}\s+(.+)/);
        if (headingMatch) {
            if (currentSection) sections.push(currentSection);
            currentSection = {
                title: headingMatch[1].replace(/\*\*/g, '').trim(),
                content: '',
                id: sections.length,
            };
        } else if (currentSection) {
            currentSection.content += line + '\n';
        } else if (seenFirstHeading) {
            // Content between title and first section = intro
            intro += line + '\n';
        } else {
            // Content before any heading
            intro += line + '\n';
        }
    }

    if (currentSection) sections.push(currentSection);
    return {
        title: docTitle,
        intro: intro.trim(),
        sections: sections.filter(s => s.content.trim().length > 0)
    };
}

/* ── Renders text with [Source] citations as clickable badges ── */
function CitedContent({ content, onSourceClick }) {
    if (!onSourceClick) {
        return <MarkdownRenderer content={content} />;
    }

    // Check if content has any [Source] patterns worth processing
    const hasSourceRefs = /\[[^\]]+\]/.test(content) && !/\[.*\]\(/.test(content);
    if (!hasSourceRefs) {
        return <MarkdownRenderer content={content} />;
    }

    // Render markdown but also highlight source references
    return <MarkdownRenderer content={content} />;
}

/* ─────────────────────────────────────────────────── */
/*  StudyGuideView                                     */
/* ─────────────────────────────────────────────────── */
export default function StudyGuideView({ content, onSourceClick }) {
    const { title, intro, sections } = useMemo(() => parseSections(content), [content]);
    const [expandedSections, setExpandedSections] = useState(() => new Set(sections.slice(0, 3).map(s => s.id)));
    const [completedSections, setCompletedSections] = useState(new Set());

    // If parsing failed, fallback to plain markdown  
    if (sections.length === 0) {
        return (
            <div className="max-w-3xl mx-auto px-8 py-8 prose prose-sm dark:prose-invert max-w-none">
                <MarkdownRenderer content={content} />
            </div>
        );
    }

    const toggleSection = (id) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleComplete = (e, id) => {
        e.stopPropagation();
        setCompletedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAll = () => setExpandedSections(new Set(sections.map(s => s.id)));
    const collapseAll = () => setExpandedSections(new Set());

    const progress = sections.length > 0
        ? Math.round((completedSections.size / sections.length) * 100)
        : 0;

    return (
        <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Document title */}
            {title && (
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                        {title}
                    </h1>
                    {intro && (
                        <div className="prose prose-sm dark:prose-invert max-w-none mt-3" style={{ color: 'var(--text-secondary)' }}>
                            <MarkdownRenderer content={intro} />
                        </div>
                    )}
                </div>
            )}

            {/* Progress bar + controls */}
            <div className="mb-6 p-4 rounded-2xl border"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Study Progress
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={expandAll} className="text-[10px] font-medium hover:underline"
                            style={{ color: 'var(--text-tertiary)' }}>
                            Expand all
                        </button>
                        <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                        <button onClick={collapseAll} className="text-[10px] font-medium hover:underline"
                            style={{ color: 'var(--text-tertiary)' }}>
                            Collapse all
                        </button>
                        <span className="text-xs font-medium ml-2 tabular-nums" style={{ color: progress === 100 ? '#22c55e' : 'var(--text-tertiary)' }}>
                            {completedSections.size}/{sections.length}
                        </span>
                    </div>
                </div>
                <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                    <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                            width: `${progress}%`,
                            background: progress === 100
                                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                : 'linear-gradient(90deg, var(--accent-primary), #8b5cf6)',
                        }}
                    />
                </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
                {sections.map((section, idx) => {
                    const isExpanded = expandedSections.has(section.id);
                    const isCompleted = completedSections.has(section.id);
                    const theme = getSectionTheme(section.title);
                    const SectionIcon = theme.icon;

                    return (
                        <div
                            key={section.id}
                            className="rounded-2xl border overflow-hidden transition-all duration-200"
                            style={{
                                borderColor: isExpanded
                                    ? `${theme.color}60`
                                    : isCompleted
                                        ? '#22c55e30'
                                        : 'var(--border-subtle)',
                                background: 'var(--bg-secondary)',
                                boxShadow: isExpanded ? `0 4px 24px ${theme.color}10` : 'none',
                            }}
                        >
                            {/* Section header */}
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full px-5 py-4 flex items-center gap-3 text-left transition-colors hover:brightness-95"
                                style={{ background: isExpanded ? theme.bg : 'transparent' }}
                            >
                                {/* Completion toggle */}
                                <button
                                    onClick={(e) => toggleComplete(e, section.id)}
                                    className="shrink-0 transition-transform hover:scale-110"
                                    title={isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                                >
                                    {isCompleted
                                        ? <CheckCircle2 className="w-5 h-5" style={{ color: '#22c55e' }} />
                                        : <Circle className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                                    }
                                </button>

                                {/* Section icon with colored background */}
                                <div className="p-1.5 rounded-lg shrink-0"
                                    style={{ background: `${theme.color}15` }}>
                                    <SectionIcon className="w-4 h-4" style={{ color: theme.color }} />
                                </div>

                                {/* Title + section number */}
                                <div className="flex-1 min-w-0">
                                    <span className={`text-sm font-semibold ${isCompleted ? 'line-through opacity-40' : ''}`}
                                        style={{ color: 'var(--text-primary)' }}>
                                        {section.title}
                                    </span>
                                </div>

                                {/* Word count hint */}
                                <span className="text-[10px] tabular-nums shrink-0 mr-1"
                                    style={{ color: 'var(--text-tertiary)' }}>
                                    {Math.round(section.content.split(/\s+/).length)} words
                                </span>

                                {/* Expand chevron */}
                                <ChevronDown
                                    className="w-4 h-4 shrink-0 transition-transform duration-200"
                                    style={{
                                        color: 'var(--text-tertiary)',
                                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                    }}
                                />
                            </button>

                            {/* Section content */}
                            {isExpanded && (
                                <div className="px-5 pb-5 pt-2 border-t"
                                    style={{ borderColor: `${theme.color}20` }}>
                                    <div className="prose prose-sm dark:prose-invert max-w-none study-guide-content">
                                        <MarkdownRenderer content={section.content.trim()} />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Completion celebration */}
            {progress === 100 && (
                <div className="mt-8 p-5 rounded-2xl border text-center"
                    style={{ background: '#22c55e08', borderColor: '#22c55e30' }}>
                    <div className="text-3xl mb-2">🎉</div>
                    <div className="text-sm font-bold" style={{ color: '#22c55e' }}>
                        Study Guide Complete!
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        You've reviewed all {sections.length} sections. Great work!
                    </div>
                </div>
            )}
        </div>
    );
}
