import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import Modal from '../shared/Modal';

/**
 * In-app invoice PDF viewer (BFSF-250). Fetches the invoice PDF through the
 * backend proxy (`GET /api/stripe/invoices/:id/pdf`) via the caller-supplied
 * `pdfFetcher` — so it works with both the consumer `authFetch` and the org
 * `cloudFetch` auth contexts — turns it into a same-origin blob URL, and
 * renders it inline in an iframe. No disk download, no leaving the app; an
 * explicit Download action lives inside the overlay.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   invoice: { id: string, number?: string } | null,
 *   pdfFetcher: (invoiceId: string) => Promise<Response>,
 * }} props
 */
export default function InvoicePdfModal({ open, onClose, invoice, pdfFetcher }) {
    const [url, setUrl] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const urlRef = useRef(null);

    useEffect(() => {
        if (!open || !invoice?.id || typeof pdfFetcher !== 'function') return undefined;
        let alive = true;
        setLoading(true);
        setError(null);
        setUrl(null);
        (async () => {
            try {
                const res = await pdfFetcher(invoice.id);
                if (!res.ok) throw new Error(`Failed to load invoice (${res.status})`);
                const blob = await res.blob();
                if (!alive) return;
                const objectUrl = URL.createObjectURL(blob);
                urlRef.current = objectUrl;
                setUrl(objectUrl);
            } catch (e) {
                if (alive) setError(e?.message || 'Failed to load invoice PDF');
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
            if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
        };
    }, [open, invoice?.id, pdfFetcher]);

    const label = invoice?.number || invoice?.id || 'document';
    const filename = `invoice-${label}.pdf`;

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="full"
            title={invoice?.number ? `Invoice ${invoice.number}` : 'Invoice'}
            className="w-[min(900px,95vw)] h-[90vh]"
            headerActions={url ? (
                <a
                    href={url}
                    download={filename}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90"
                >
                    <Download className="w-3.5 h-3.5" /> Download
                </a>
            ) : null}
        >
            <div className="w-full h-full min-h-[60vh]">
                {loading ? (
                    <div className="flex items-center justify-center h-full min-h-[60vh] text-[var(--text-muted)]">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="px-2 py-6 text-sm text-rose-400">{error}</div>
                ) : url ? (
                    <iframe
                        title={filename}
                        src={url}
                        className="w-full h-full min-h-[70vh] rounded-lg border border-[var(--border-subtle)] bg-white"
                    />
                ) : null}
            </div>
        </Modal>
    );
}
