import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, Trash2, ListChecks, FileDown, X, ShieldCheck, Loader2 } from 'lucide-react';

/*
 * Bronnenlijst / Table of Authorities — the verified list of sources the lawyer
 * relies on in this matter. Verified vs unverified is shown with the brand
 * palette (emerald / amber / red). "Verifieer alle bronnen" arrives in Phase 2;
 * for now the badge reflects how each authority entered the list (a tool
 * retrieval / research add is verified; a manual entry without a check is not).
 */

const KIND_LABELS = {
    jurisprudentie: 'Jurisprudentie',
    wet: 'Wetgeving',
    eu: 'EU-recht',
    tuchtrecht: 'Tuchtrecht',
    kamerstuk: 'Parlementair',
    bekendmaking: 'Officiële publicaties',
    literatuur: 'Literatuur',
};
const KIND_ORDER = ['jurisprudentie', 'wet', 'eu', 'tuchtrecht', 'kamerstuk', 'bekendmaking', 'literatuur'];

function VerifyBadge({ citation }) {
    if (citation.verified) {
        return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#22c55e' }} title="Geverifieerd" />;
    }
    if (citation.verificationMethod === 'not_found') {
        return <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#ef4444' }} title="Niet gevonden" />;
    }
    return <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#f59e0b' }} title="Niet geverifieerd" />;
}

export default function TableOfAuthorities({ citations = [], onRemove, onInsertList, onVerify, verifying, onClose, busy }) {
    const grouped = KIND_ORDER
        .map(k => [k, citations.filter(c => c.kind === k)])
        .filter(([, list]) => list.length > 0);
    const verifiedCount = citations.filter(c => c.verified).length;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <ListChecks className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <span className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>Bronnenlijst</span>
                {onClose && (
                    <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-tertiary)]" title="Sluiten" style={{ color: 'var(--text-tertiary)' }}>
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Primary action: verify every citation in the draft */}
            <div className="shrink-0 p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <button onClick={onVerify} disabled={verifying}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }} title="Controleer alle ECLI/CELEX/wetsverwijzingen in het document tegen de officiële bronnen">
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Verifieer alle bronnen
                </button>
            </div>

            <div className="shrink-0 px-3 py-2 border-b text-[11px] flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                <span>{citations.length} bron{citations.length !== 1 ? 'nen' : ''} · {verifiedCount} geverifieerd</span>
                {citations.length > 0 && (
                    <button onClick={onInsertList} disabled={busy} className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[var(--bg-tertiary)] disabled:opacity-50" style={{ color: 'var(--accent-primary)' }} title="Voeg bronnenlijst toe aan document">
                        <FileDown className="w-3 h-3" /> In document
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
                {citations.length === 0 && (
                    <p className="text-[11px] text-center px-2 py-6" style={{ color: 'var(--text-tertiary)' }}>
                        Nog geen bronnen. Voeg jurisprudentie of wetgeving toe via het paneel "Juridische bronnen".
                    </p>
                )}
                {grouped.map(([kind, list]) => (
                    <div key={kind}>
                        <div className="text-[10px] uppercase font-semibold tracking-wide mb-1 px-1" style={{ color: 'var(--text-tertiary)' }}>
                            {KIND_LABELS[kind]} ({list.length})
                        </div>
                        <div className="space-y-1">
                            {list.map(c => (
                                <div key={c.id} className="group flex items-start gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                                    <VerifyBadge citation={c} />
                                    <div className="flex-1 min-w-0">
                                        {c.url ? (
                                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium hover:underline block truncate" style={{ color: 'var(--text-primary)' }} title={c.title || c.identifier}>
                                                {c.title || c.identifier}
                                            </a>
                                        ) : (
                                            <span className="text-[11px] font-medium block truncate" style={{ color: 'var(--text-primary)' }} title={c.title || c.identifier}>{c.title || c.identifier}</span>
                                        )}
                                        {c.identifier && <div className="text-[10px] font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>{c.identifier}{c.pinpoint ? ` · ${c.pinpoint}` : ''}</div>}
                                    </div>
                                    <button onClick={() => onRemove?.(c.id)} title="Verwijderen" className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
