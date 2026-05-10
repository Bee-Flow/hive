import React, { useState, useRef, useEffect } from 'react';
import {
    FileText, HelpCircle, ClipboardList,
    Layers, Activity,
    Download, FileDown, Loader2, ChevronDown, Table2, PenTool
} from 'lucide-react';

// Generation types kept after the NotebookLM-gimmick cut:
// removed Audio Podcast / Flashcards / Quiz / Study Guide — low usage,
// high generation cost, and duplicated by the Report / Briefing Doc flows.
const STUDIO_GROUPS = [
    {
        id: 'reports',
        label: 'Reports',
        icon: FileText,
        color: '#3b82f6', // blue
        items: [
            { key: 'summary', icon: ClipboardList, label: 'Executive Summary', desc: 'High-level briefing document' },
            { key: 'briefing_doc', icon: Layers, label: 'Briefing Doc', desc: 'Detailed comprehensive overview' },
            { key: 'blog_post', icon: FileText, label: 'Blog Post', desc: 'Engaging article format' },
            { key: 'faq', icon: HelpCircle, label: 'FAQ', desc: 'Frequently asked questions' },
        ]
    },
    {
        id: 'visuals',
        label: 'Visuals',
        icon: Activity,
        color: '#10b981', // emerald
        items: [
            { key: 'mind_map', icon: Activity, label: 'Mind Map', desc: 'Mermaid visualization of concepts' },
            { key: 'data_table', icon: Table2, label: 'Data Table', desc: 'Extract info into Markdown tables' },
        ]
    }
];

function DropdownMenu({ group, onSelect, generating, disabled }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const isGeneratingHere = group.items.some(i => i.key === generating);
    const GroupIcon = group.icon;

    return (
        <div className="relative" ref={ref}>
            <button
                disabled={disabled}
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    open ? 'bg-[var(--bg-tertiary)] border-[var(--border-default)]' : 'bg-transparent border-transparent hover:bg-[var(--bg-tertiary)]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ color: 'var(--text-primary)' }}
            >
                {isGeneratingHere ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                ) : (
                    <GroupIcon className="w-4 h-4" style={{ color: group.color }} />
                )}
                {group.label}
                <ChevronDown className={`w-3.5 h-3.5 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && !disabled && (
                <div
                    className="absolute top-full left-0 mt-1 w-56 rounded-xl shadow-xl border overflow-hidden z-50 text-left"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', animation: 'slideDown 0.2s ease-out' }}
                >
                    <div className="p-1">
                        {group.items.map(item => {
                            const ItemIcon = item.icon;
                            const isActive = generating === item.key;
                            return (
                                <button
                                    key={item.key}
                                    disabled={!!generating}
                                    onClick={() => {
                                        setOpen(false);
                                        onSelect(item.key);
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] flex items-start gap-3 disabled:opacity-50 transition-colors"
                                >
                                    <div className="mt-0.5 p-1 rounded-md" style={{ background: `${group.color}15`, color: group.color }}>
                                        {isActive ? <Loader2 className="w-4 h-4 animate-spin" /> : <ItemIcon className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</div>
                                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function NotebookStudio({ onGenerate, generating, onExport, exporting, hasContent, readySourceCount, generationCount = 0, onHistoryClick, onSignRequest, signRequestConfigured, nextcloudConfigured, onNextcloudExport, nextcloudExporting }) {
    const disabled = readySourceCount === 0;
    const groups = STUDIO_GROUPS;

    return (
        <div className="flex items-center space-x-2 pl-4 border-l ml-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center rounded-full border p-1 gap-0.5" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                {groups.map(group => (
                    <DropdownMenu
                        key={group.id}
                        group={group}
                        onSelect={onGenerate}
                        generating={generating}
                        disabled={disabled}
                    />
                ))}
            </div>

            <div className="flex items-center gap-1 pl-2">
                <button
                    disabled={!hasContent || !!exporting}
                    onClick={() => onExport('pdf')}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    title="Export PDF"
                >
                    {exporting === 'pdf' ? <Loader2 className="w-4 h-4 text-red-500 animate-spin" /> : <FileDown className="w-4 h-4 text-red-500" />}
                </button>
                <button
                    disabled={!hasContent || !!exporting}
                    onClick={() => onExport('docx')}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    title="Export Word"
                >
                    {exporting === 'docx' ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" /> : <Download className="w-4 h-4 text-blue-500" />}
                </button>
                {signRequestConfigured && (
                    <button
                        disabled={!hasContent || !!exporting}
                        onClick={onSignRequest}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        title="Send for Signing (SignRequest)"
                    >
                        <PenTool className="w-4 h-4 text-green-500" />
                    </button>
                )}
                {nextcloudConfigured && (
                    <button
                        disabled={!hasContent || !!exporting || !!nextcloudExporting}
                        onClick={onNextcloudExport}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        title="Save PDF to Nextcloud"
                    >
                        {nextcloudExporting
                            ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#0082C9' }} />
                            : <svg viewBox="0 0 32 32" fill="none" className="w-4 h-4"><path d="M11.5 11.2c-2 0-3.7 1.4-4.2 3.3a3.5 3.5 0 1 0 0 3 4.4 4.4 0 0 0 7 1.7l1.5-1.4 1.6 1.4a4.4 4.4 0 0 0 7-1.7 3.5 3.5 0 1 0 0-3 4.4 4.4 0 0 0-7-1.7l-1.6 1.4-1.5-1.4a4.4 4.4 0 0 0-2.8-1.6zm0 2.2a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zm9 0a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z" fill="#0082C9" /></svg>
                        }
                    </button>
                )}
                {generationCount > 0 && (
                    <button
                        onClick={onHistoryClick}
                        className="relative p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors ml-1"
                        style={{ color: 'var(--text-secondary)' }}
                        title={`${generationCount} generation${generationCount !== 1 ? 's' : ''} — click to view`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-primary)' }}>
                            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1"
                            style={{ background: 'var(--accent-primary)', boxShadow: 'var(--shadow-sm)' }}>
                            {generationCount}
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
