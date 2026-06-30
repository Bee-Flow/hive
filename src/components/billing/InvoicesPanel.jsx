import React, { useEffect, useState } from 'react';
import { Loader2, Eye, FileText } from 'lucide-react';
import InvoicePdfModal from './InvoicePdfModal';

/**
 * In-app invoice list. Fetches the caller's invoices from
 * `GET /api/stripe/invoices` (via the injected `fetcher`, so it works with
 * both the consumer `authFetch` and the org `cloudFetch` paths) and renders
 * a compact table with a per-invoice action.
 *
 * When `pdfFetcher` is supplied, the PDF action opens an in-app viewer modal
 * (BFSF-250) instead of downloading the file to disk; the modal also offers a
 * Download button. Without it, the action falls back to opening the
 * Stripe-hosted PDF in a new tab.
 *
 * Stateless about *which* customer — the backend resolves that from the
 * session. Renders nothing while the customer has no billing account
 * (endpoint returns an empty list); parents typically only mount this once
 * a Stripe customer exists.
 *
 * @param {{
 *   fetcher: () => Promise<Array>,
 *   pdfFetcher?: (invoiceId: string) => Promise<Response>,
 *   title?: string,
 * }} props
 */
const STATUS_TONE = {
    paid:          { label: 'Paid',          color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    open:          { label: 'Open',          color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    uncollectible: { label: 'Uncollectible', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    void:          { label: 'Void',          color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

function formatAmount(amount, currency) {
    if (amount === null || amount === undefined) return '—';
    try {
        return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: (currency || 'EUR') }).format(amount);
    } catch (_) {
        return `${currency || 'EUR'} ${amount}`;
    }
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return '—'; }
}

export default function InvoicesPanel({ fetcher, pdfFetcher, title = 'Invoices' }) {
    const [invoices, setInvoices] = useState(null); // null = loading
    const [error, setError] = useState(null);
    const [viewing, setViewing] = useState(null); // invoice being previewed in the modal

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const list = await fetcher();
                if (alive) setInvoices(Array.isArray(list) ? list : []);
            } catch (e) {
                if (alive) { setError(e?.message || 'Failed to load invoices'); setInvoices([]); }
            }
        })();
        return () => { alive = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
                <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
            </div>

            {invoices === null ? (
                <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
            ) : error ? (
                <div className="px-4 py-6 text-sm text-rose-400">{error}</div>
            ) : invoices.length === 0 ? (
                <div className="px-4 py-6 text-sm text-[var(--text-muted)]">No invoices yet.</div>
            ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                    {invoices.map(inv => {
                        const tone = STATUS_TONE[inv.status] || { label: inv.status, color: 'var(--text-muted)', bg: 'var(--bg-tertiary)' };
                        const amount = inv.amountPaid != null ? inv.amountPaid : inv.amountDue;
                        return (
                            <div key={inv.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                                <div className="w-24 shrink-0 text-[var(--text-secondary)]">{formatDate(inv.created)}</div>
                                <div className="flex-1 min-w-0 truncate text-[var(--text-primary)] font-medium">
                                    {inv.number || inv.id}
                                </div>
                                <div className="w-24 text-right text-[var(--text-primary)]">{formatAmount(amount, inv.currency)}</div>
                                <span
                                    className="w-24 text-center text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                                    style={{ color: tone.color, background: tone.bg }}
                                >
                                    {tone.label}
                                </span>
                                {inv.invoicePdf && pdfFetcher ? (
                                    <button
                                        type="button"
                                        onClick={() => setViewing(inv)}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline shrink-0"
                                    >
                                        <Eye className="w-3.5 h-3.5" /> PDF
                                    </button>
                                ) : inv.invoicePdf ? (
                                    <a
                                        href={inv.invoicePdf}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline shrink-0"
                                    >
                                        <Eye className="w-3.5 h-3.5" /> PDF
                                    </a>
                                ) : (
                                    <span className="w-[44px] shrink-0" />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
        {pdfFetcher && (
            <InvoicePdfModal
                open={!!viewing}
                invoice={viewing}
                pdfFetcher={pdfFetcher}
                onClose={() => setViewing(null)}
            />
        )}
        </>
    );
}
