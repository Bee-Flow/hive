import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import Modal from './shared/Modal';
import { API_BASE } from '../utils/helpers';
import { useTranslation } from '../hooks/useTranslation';

/**
 * LegalDocModal — read a legal document INSIDE the app instead of navigating
 * away to the standalone public page (/legal/:doc) in a new tab. Used by the
 * settings consent center, the signup consent step, and the re-consent gate.
 *
 * Fetches the localized markdown from the public legal endpoint (English is
 * authoritative; the API falls back to English when a locale has no current
 * translation) and renders it in a scrollable dialog. A machine-translation
 * banner is shown when a localized version is served, and an "Open full page"
 * link offers the printable standalone view.
 */
export default function LegalDocModal({ open, docId, title, onClose }) {
    const { t, locale } = useTranslation();
    const [doc, setDoc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open || !docId) return undefined;
        let cancelled = false;
        setLoading(true); setError(''); setDoc(null);
        const loc = encodeURIComponent((locale || 'en').toLowerCase());
        fetch(`${API_BASE}/api/languages/public/legal/${docId}/${loc}`)
            .then(r => (r.ok ? r.json() : Promise.reject(new Error('not_found'))))
            .then(d => { if (!cancelled) setDoc(d); })
            .catch(() => { if (!cancelled) setError(t('legal.load_failed', 'Could not load this document. Please try again.')); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, docId, locale, t]);

    const effectiveTitle = (doc && doc.title) || title || '';
    const fullPageHref = doc?.route ? `${doc.route}?locale=${encodeURIComponent((locale || 'en').toLowerCase())}` : null;

    const headerActions = (
        <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
        </button>
    );

    const footer = (
        <div className="flex items-center justify-between w-full">
            {fullPageHref ? (
                <a href={fullPageHref} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {t('legal.open_full_page', 'Open full page')} <ExternalLink className="w-3.5 h-3.5" />
                </a>
            ) : <span />}
            <button type="button" onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent-primary)' }}>
                {t('common.close', 'Close')}
            </button>
        </div>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="xl"
            title={effectiveTitle}
            description={doc?.lastUpdated ? t('legal.last_updated', 'Last updated: {date}', { date: doc.lastUpdated }) : null}
            headerActions={headerActions}
            footer={footer}
        >
            <style>{LEGAL_MD_CSS}</style>
            {loading ? (
                <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                    <Loader2 className="w-5 h-5 animate-spin inline" />
                </div>
            ) : error ? (
                <div className="p-3 rounded-lg flex items-center gap-2 text-sm bg-red-500/10 border border-red-500/30 text-red-500">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
            ) : (
                <>
                    {doc?.isTranslation && (
                        <div className="mb-5 p-3 rounded-lg text-xs border-l-4"
                            style={{ borderColor: 'var(--accent-primary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                            {t('legal.machine_translation', 'This is a machine translation provided for your convenience. The English version is the authoritative, legally binding text.')}
                        </div>
                    )}
                    <div className="legal-doc-md text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc?.markdown || ''}</ReactMarkdown>
                    </div>
                </>
            )}
        </Modal>
    );
}

// Scoped, theme-aware markdown styling (mirrors the public LegalPage rules but
// uses the app's CSS variables so it reads correctly in light + dark themes).
const LEGAL_MD_CSS = `
.legal-doc-md { line-height: 1.7; }
.legal-doc-md h1 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.75rem; color: var(--text-primary); }
.legal-doc-md h2 { font-size: 1.15rem; font-weight: 700; margin: 1.75rem 0 0.5rem; color: var(--text-primary); }
.legal-doc-md h3 { font-size: 1rem; font-weight: 600; margin: 1.25rem 0 0.4rem; color: var(--text-primary); }
.legal-doc-md p { margin: 0 0 0.85rem; }
.legal-doc-md a { color: var(--accent-primary); text-decoration: underline; text-underline-offset: 2px; }
.legal-doc-md a:hover { text-decoration: none; }
.legal-doc-md strong { color: var(--text-primary); font-weight: 600; }
.legal-doc-md ul, .legal-doc-md ol { margin: 0 0 0.85rem; padding-left: 1.5rem; }
.legal-doc-md li { margin: 0.2rem 0; }
.legal-doc-md blockquote { margin: 0 0 1.25rem; padding: 0.75rem 1rem; border-left: 4px solid var(--accent-primary); background: var(--bg-tertiary); border-radius: 4px; }
.legal-doc-md blockquote p:last-child { margin-bottom: 0; }
.legal-doc-md table { border-collapse: collapse; width: 100%; margin: 0 0 1.25rem; font-size: 0.85rem; }
.legal-doc-md th, .legal-doc-md td { border: 1px solid var(--border-default); padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
.legal-doc-md th { background: var(--bg-tertiary); font-weight: 600; color: var(--text-primary); }
.legal-doc-md code { background: var(--bg-tertiary); padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.9em; }
.legal-doc-md hr { border: 0; border-top: 1px solid var(--border-default); margin: 1.5rem 0; }
`;
