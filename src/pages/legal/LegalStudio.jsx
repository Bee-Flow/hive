import React, { useState, useRef, useEffect } from 'react';
import {
    FileText, Scale, Mail, Activity, Loader2, ChevronDown, ShieldCheck,
    ScrollText, Gavel, ClipboardList, ListChecks, History as HistoryIcon, FileSignature, Clock
} from 'lucide-react';

/*
 * Legal Studio toolbar — Dutch legal document generators grouped by purpose,
 * plus the per-matter strict-citation toggle. Mirrors NotebookStudio's dropdown
 * pattern. Brand palette: blue + emerald only. Generation streams into the editor via
 * the same /generate/:type SSE endpoint, branched server-side for legal matters.
 */
const STUDIO_GROUPS = [
    {
        id: 'adviezen', label: 'Adviezen', icon: FileText, color: '#3b82f6',
        items: [
            { key: 'juridisch_advies', icon: FileText, label: 'Juridisch advies', desc: 'Memo: vraag, kader, beoordeling, advies' },
        ],
    },
    {
        id: 'processtukken', label: 'Processtukken', icon: Gavel, color: '#3b82f6',
        items: [
            { key: 'dagvaarding', icon: ScrollText, label: 'Dagvaarding', desc: 'Concept-dagvaarding met gronden en petitum' },
            { key: 'conclusie_van_antwoord', icon: ScrollText, label: 'Conclusie van antwoord', desc: 'Verweer namens gedaagde' },
            { key: 'pleitnota', icon: Gavel, label: 'Pleitnota', desc: 'Bondige pleitaantekeningen voor de zitting' },
            { key: 'verzoekschrift', icon: ScrollText, label: 'Verzoekschrift', desc: 'Verzoekschriftprocedure' },
            { key: 'bezwaar_beroep', icon: ScrollText, label: 'Bezwaar / beroep', desc: 'Bezwaar- of beroepschrift (Awb)' },
        ],
    },
    {
        id: 'brieven', label: 'Brieven & overeenkomsten', icon: Mail, color: '#10b981',
        items: [
            { key: 'sommatie', icon: Mail, label: 'Sommatie / ingebrekestelling', desc: 'Aanmaning met termijn en gevolgen' },
            { key: 'vaststellingsovereenkomst', icon: FileSignature, label: 'Vaststellingsovereenkomst', desc: 'Schikking met finale kwijting' },
        ],
    },
    {
        id: 'analyse', label: 'Analyse', icon: Activity, color: '#10b981',
        items: [
            { key: 'processtuk_analyse', icon: ClipboardList, label: 'Processtuk-analyse', desc: 'Analyse van stukken wederpartij' },
            { key: 'chronologie', icon: Clock, label: 'Chronologie', desc: 'Feitenrelaas / tijdlijn uit de stukken' },
            { key: 'issue_list', icon: ListChecks, label: 'Geschilpunten', desc: 'Issue list met inschatting per punt' },
        ],
    },
];

function DropdownMenu({ group, onSelect, generating, disabled }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    const isGeneratingHere = group.items.some(i => i.key === generating);
    const GroupIcon = group.icon;
    return (
        <div className="relative" ref={ref}>
            <button disabled={disabled} onClick={() => setOpen(!open)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${open ? 'bg-[var(--bg-tertiary)] border-[var(--border-default)]' : 'bg-transparent border-transparent hover:bg-[var(--bg-tertiary)]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ color: 'var(--text-primary)' }}>
                {isGeneratingHere ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} /> : <GroupIcon className="w-4 h-4" style={{ color: group.color }} />}
                {group.label}
                <ChevronDown className={`w-3.5 h-3.5 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && !disabled && (
                <div className="absolute top-full left-0 mt-1 w-64 rounded-xl shadow-xl border overflow-hidden z-50 text-left" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}>
                    <div className="p-1">
                        {group.items.map(item => {
                            const ItemIcon = item.icon;
                            const isActive = generating === item.key;
                            return (
                                <button key={item.key} disabled={!!generating} onClick={() => { setOpen(false); onSelect(item.key); }}
                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] flex items-start gap-3 disabled:opacity-50 transition-colors">
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

export default function LegalStudio({ onGenerate, generating, disabled, citationMode, onToggleStrict, generationCount = 0, onHistoryClick }) {
    const strict = citationMode === 'strict_formal';
    return (
        <div className="flex items-center gap-2 pl-3 border-l ml-1" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center rounded-full border p-1 gap-0.5" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                {STUDIO_GROUPS.map(group => (
                    <DropdownMenu key={group.id} group={group} onSelect={onGenerate} generating={generating} disabled={disabled} />
                ))}
            </div>

            {/* Strict citation mode toggle — withholds unconfirmed citations in processtukken */}
            <button onClick={onToggleStrict} title={strict ? 'Strikte bronvermelding AAN — onbevestigde verwijzingen worden in processtukken weggelaten' : 'Strikte bronvermelding UIT — onbevestigde verwijzingen worden gemarkeerd maar behouden'}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors"
                style={strict
                    ? { background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.4)', color: '#15803d' }
                    : { background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                <ShieldCheck className="w-3.5 h-3.5" /> Strikt
            </button>

            {generationCount > 0 && (
                <button onClick={onHistoryClick} className="relative p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors" style={{ color: 'var(--text-secondary)' }} title={`${generationCount} generatie(s)`}>
                    <HistoryIcon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1" style={{ background: 'var(--accent-primary)' }}>{generationCount}</span>
                </button>
            )}
        </div>
    );
}
