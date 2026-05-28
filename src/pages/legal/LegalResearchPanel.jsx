import React, { useState, useRef, useCallback } from 'react';
import {
    Search, Loader2, ExternalLink, Quote, BookmarkPlus, AlertCircle, Scale, X
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

/*
 * Legal Research panel — drives the Dutch legal tools directly (no chat) via
 * POST /api/legal-matters/:id/research. The lawyer searches case law / EU law /
 * disciplinary law / parliamentary docs / official publications, then cites a
 * result into the draft or adds it to the bronnenlijst (Table of Authorities).
 *
 * rechtspraak search is metadata-driven (rechtsgebied + instantie + date), NOT
 * full-text — the UI makes that explicit and offers a client-side keyword
 * filter over the returned inhoudsindicatie.
 */

// Mirrors the controlled keys in server/integrations/rechtspraakTools.js.
const RECHTSGEBIED_OPTIONS = [
    ['', 'Alle rechtsgebieden'],
    ['civiel', 'Civiel recht'],
    ['personen-en-familierecht', 'Personen- & familierecht'],
    ['arbeidsrecht', 'Arbeidsrecht'],
    ['ondernemingsrecht', 'Ondernemingsrecht'],
    ['insolventierecht', 'Insolventierecht'],
    ['verbintenissenrecht', 'Verbintenissenrecht'],
    ['huurrecht', 'Huurrecht'],
    ['goederenrecht', 'Goederenrecht'],
    ['intellectuele-eigendom', 'Intellectuele eigendom'],
    ['aanbestedingsrecht', 'Aanbestedingsrecht'],
    ['internationaal-privaatrecht', 'Internationaal privaatrecht'],
    ['bestuursrecht', 'Bestuursrecht'],
    ['belastingrecht', 'Belastingrecht'],
    ['socialezekerheidsrecht', 'Sociale zekerheid'],
    ['vreemdelingenrecht', 'Vreemdelingenrecht'],
    ['omgevingsrecht', 'Omgevingsrecht'],
    ['ambtenarenrecht', 'Ambtenarenrecht'],
    ['strafrecht', 'Strafrecht'],
    ['europees', 'Europees recht'],
];

const INSTANTIE_OPTIONS = [
    ['', 'Alle instanties'],
    ['Hoge Raad', 'Hoge Raad'],
    ['Raad van State', 'Raad van State'],
    ['Centrale Raad van Beroep', 'Centrale Raad van Beroep'],
    ['College van Beroep voor het bedrijfsleven', 'College van Beroep voor het bedrijfsleven'],
    ['Gerechtshof Amsterdam', 'Gerechtshof Amsterdam'],
    ['Gerechtshof Den Haag', 'Gerechtshof Den Haag'],
    ['Gerechtshof Arnhem-Leeuwarden', 'Gerechtshof Arnhem-Leeuwarden'],
    ["Gerechtshof 's-Hertogenbosch", "Gerechtshof 's-Hertogenbosch"],
];

const BRON_OPTIONS = [
    ['rechtspraak', 'Jurisprudentie'],
    ['eurlex', 'EU-recht'],
    ['tuchtrecht', 'Tuchtrecht'],
    ['kamerstukken', 'Parlementair'],
    ['bekendmakingen', 'Officiële publicaties'],
];

const KIND_BY_BRON = {
    rechtspraak: 'jurisprudentie',
    eurlex: 'eu',
    tuchtrecht: 'tuchtrecht',
    kamerstukken: 'kamerstuk',
    bekendmakingen: 'bekendmaking',
};

// Normalise a tool result row into a common card shape across the 5 sources.
function normalizeRow(bron, r) {
    return {
        identifier: r.ecli || r.celex || r.identifier || null,
        title: r.title || r.identifier || r.ecli || r.celex || '(zonder titel)',
        date: r.date || null,
        creator: r.instantie || r.creator || r.publicatienaam || r.type || null,
        snippet: r.inhoudsindicatie || r.beslissing || r.summary || '',
        url: r.link || r.preferredUrl || r.url || null,
        bron,
    };
}

export default function LegalResearchPanel({ matterId, onCite, onAddAuthority, onOpenFullText, onClose }) {
    const [bron, setBron] = useState('rechtspraak');
    const [rechtsgebied, setRechtsgebied] = useState('');
    const [instantie, setInstantie] = useState('');
    const [query, setQuery] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);
    const [note, setNote] = useState(null);
    const abortRef = useRef(null);

    const isRechtspraak = bron === 'rechtspraak';

    const buildArgs = useCallback(() => {
        if (isRechtspraak) {
            const args = { max_results: 15 };
            if (rechtsgebied) args.rechtsgebied = rechtsgebied;
            if (instantie) args.instantie = instantie;
            if (from) args.from = from;
            if (to) args.to = to;
            return args;
        }
        const args = { query: query.trim(), max_results: 15 };
        if (from) args.date_from = from;
        if (to) args.date_to = to;
        return args;
    }, [isRechtspraak, rechtsgebied, instantie, from, to, query]);

    const runSearch = useCallback(async () => {
        if (isRechtspraak && !rechtsgebied && !instantie && !from && !to) {
            setError('Kies minstens een rechtsgebied, instantie of datumbereik — jurisprudentie is een metadata-filter, geen vrije-tekstzoekmachine.');
            return;
        }
        if (!isRechtspraak && !query.trim()) {
            setError('Voer een zoekterm in.');
            return;
        }
        abortRef.current?.abort?.();
        const controller = new AbortController();
        abortRef.current = controller;
        setSearching(true);
        setError(null);
        setNote(null);
        try {
            const res = await authFetch(`${API_BASE}/api/legal-matters/${matterId}/research`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bron, args: buildArgs() }),
                signal: controller.signal,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Zoeken mislukt (${res.status})`);
            const result = data.result || {};
            if (result.error) { setError(result.error); setResults([]); return; }
            let rows = (result.results || []).map(r => normalizeRow(bron, r));
            // Client-side keyword filter for rechtspraak (the feed itself has no
            // free-text search — we filter the returned inhoudsindicatie).
            if (isRechtspraak && query.trim()) {
                const q = query.trim().toLowerCase();
                rows = rows.filter(r =>
                    (r.snippet && r.snippet.toLowerCase().includes(q)) ||
                    (r.title && r.title.toLowerCase().includes(q))
                );
            }
            setResults(rows);
            if (rows.length === 0) setNote('Geen resultaten. Verruim het datumbereik of pas de filters aan.');
            else if (result.note) setNote(result.note);
        } catch (e) {
            if (e.name !== 'AbortError') setError(e.message);
        } finally {
            setSearching(false);
            if (abortRef.current === controller) abortRef.current = null;
        }
    }, [matterId, bron, isRechtspraak, rechtsgebied, instantie, from, to, query, buildArgs]);

    const toCitation = (row) => ({
        kind: KIND_BY_BRON[row.bron] || 'literatuur',
        identifier: row.identifier,
        title: row.title,
        url: row.url,
        verified: true,
        verificationMethod: `${row.bron}_search`,
    });

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <Scale className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <span className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>Juridische bronnen</span>
                {onClose && (
                    <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-tertiary)]" title="Sluiten" style={{ color: 'var(--text-tertiary)' }}>
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="shrink-0 p-3 space-y-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex flex-wrap gap-1">
                    {BRON_OPTIONS.map(([val, label]) => (
                        <button
                            key={val}
                            onClick={() => { setBron(val); setResults([]); setError(null); setNote(null); }}
                            className="px-2 py-1 rounded-full text-[11px] font-medium border transition-colors"
                            style={bron === val
                                ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: '#fff' }
                                : { background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {isRechtspraak ? (
                    <>
                        <select value={rechtsgebied} onChange={e => setRechtsgebied(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg border" style={selectStyle}>
                            {RECHTSGEBIED_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <select value={instantie} onChange={e => setInstantie(e.target.value)} className="w-full px-2 py-1.5 text-xs rounded-lg border" style={selectStyle}>
                            {INSTANTIE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </>
                ) : null}

                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                        placeholder={isRechtspraak ? 'Trefwoord in samenvatting (optioneel)…' : 'Zoekterm…'}
                        className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border focus:outline-none"
                        style={selectStyle}
                    />
                </div>

                <div className="flex items-center gap-1.5">
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} title="Vanaf" className="flex-1 px-2 py-1.5 text-xs rounded-lg border" style={selectStyle} />
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>–</span>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} title="Tot" className="flex-1 px-2 py-1.5 text-xs rounded-lg border" style={selectStyle} />
                </div>

                <button
                    onClick={runSearch}
                    disabled={searching}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Zoeken
                </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {error && (
                    <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg text-[11px]" style={{ background: 'rgba(239,68,68,0.08)', color: '#b91c1c' }}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}
                {note && !error && (
                    <div className="px-2.5 py-2 rounded-lg text-[11px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>{note}</div>
                )}
                {results.map((row, i) => (
                    <div key={`${row.identifier || i}`} className="rounded-lg border p-2.5" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                        <div className="text-xs font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{row.title}</div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                            {row.identifier && <span className="font-mono">{row.identifier}</span>}
                            {row.creator && <span>· {row.creator}</span>}
                            {row.date && <span>· {row.date}</span>}
                        </div>
                        {row.snippet && (
                            <p className="mt-1 text-[11px] leading-snug line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{row.snippet}</p>
                        )}
                        <div className="flex items-center gap-1 mt-2">
                            {row.url && (
                                <button onClick={() => onOpenFullText?.(row)} title="Open volledige tekst"
                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}>
                                    <ExternalLink className="w-3 h-3" /> Open
                                </button>
                            )}
                            <button onClick={() => onCite?.(toCitation(row))} title="Citeer in document"
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--accent-primary)' }}>
                                <Quote className="w-3 h-3" /> Citeer
                            </button>
                            <button onClick={() => onAddAuthority?.(toCitation(row))} title="Toevoegen aan bronnenlijst"
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}>
                                <BookmarkPlus className="w-3 h-3" /> Bronnenlijst
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const selectStyle = {
    borderColor: 'var(--border-subtle)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
};
