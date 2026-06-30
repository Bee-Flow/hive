import React, { useEffect, useState } from 'react';
import { Download, Linkedin, Link2, Globe, Loader2, Check } from 'lucide-react';
import { Modal } from '../../../components/admin/subscriptions/ui/Modal';
import { fetchAssetObjectUrl, downloadAsset } from '../../../components/onboarding/achievements';

/**
 * CertificateModal — preview the rendered certificate with Download PNG / PDF
 * (always), plus a "Make public & share" opt-in that reveals Add-to-LinkedIn and a
 * copyable verify link. Reuses the shared Modal primitive. Honey/amber, no purple.
 *
 * Props: cert (issued entry with imageUrl/pdfUrl/verifyUrl/linkedInUrl/isPublic),
 *        busy, onTogglePublic(makePublic), onClose, t
 */
export default function CertificateModal({ cert, busy, onTogglePublic, onClose, t }) {
    const [imgSrc, setImgSrc] = useState(null);
    const [imgError, setImgError] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let url;
        let cancelled = false;
        setImgSrc(null); setImgError(false);
        (async () => {
            try {
                url = await fetchAssetObjectUrl(cert.imageUrl);
                if (!cancelled) setImgSrc(url);
            } catch (_) { if (!cancelled) setImgError(true); }
        })();
        return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
    }, [cert.imageUrl]);

    const copyVerify = async () => {
        try { await navigator.clipboard.writeText(cert.verifyUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (_) { /* ignore */ }
    };

    const footer = (
        <div className="flex items-center gap-2 flex-wrap w-full justify-end">
            <button type="button" onClick={() => downloadAsset(cert.imageUrl, `beeflow-certificate-${cert.serial || 'cert'}.png`)}
                className="px-3 py-2 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 border transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                <Download className="w-4 h-4" /> {t('learn.cert.download_png', 'PNG')}
            </button>
            <button type="button" onClick={() => downloadAsset(cert.pdfUrl, `beeflow-certificate-${cert.serial || 'cert'}.pdf`)}
                className="px-3 py-2 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 border transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                <Download className="w-4 h-4" /> {t('learn.cert.download_pdf', 'PDF')}
            </button>
            {cert.isPublic && cert.linkedInUrl && (
                <button type="button" onClick={() => window.open(cert.linkedInUrl, '_blank', 'noopener')}
                    className="px-3 py-2 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5"
                    style={{ background: 'var(--accent-primary)', color: 'var(--accent-primary-fg, #fff)' }}>
                    <Linkedin className="w-4 h-4" /> {t('learn.cert.add_linkedin', 'Add to LinkedIn')}
                </button>
            )}
        </div>
    );

    return (
        <Modal open onClose={onClose} title={cert.title} subtitle={cert.level || undefined} footer={footer} width="max-w-2xl">
            <div className="rounded-lg overflow-hidden border mb-4" style={{ borderColor: 'var(--border-subtle)' }}>
                {imgSrc ? (
                    <img src={imgSrc} alt={cert.title} className="w-full h-auto block" />
                ) : (
                    <div className="h-[200px] flex items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
                        {imgError ? t('learn.cert.preview_failed', 'Could not load the preview — the download still works.') : <Loader2 className="w-5 h-5 animate-spin" />}
                    </div>
                )}
            </div>

            {/* Sharing controls */}
            {!cert.isPublic ? (
                <div className="rounded-lg border p-3 flex items-start gap-3" style={{ borderColor: 'var(--border-default)', background: 'color-mix(in srgb, var(--accent-primary) 5%, transparent)' }}>
                    <Globe className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                    <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t('learn.cert.share_title', 'Share it on LinkedIn')}</div>
                        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {t('learn.cert.share_body', 'Make a public verification page (your name, organisation and courses — never your email) so you can add it to your LinkedIn profile.')}
                        </p>
                    </div>
                    <button type="button" onClick={() => onTogglePublic(true)} disabled={busy}
                        className="px-3 py-2 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 transition-opacity disabled:opacity-50 flex-shrink-0"
                        style={{ background: 'var(--accent-primary)', color: 'var(--accent-primary-fg, #fff)' }}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                        {t('learn.cert.make_public', 'Make public & share')}
                    </button>
                </div>
            ) : cert.verifyUrl ? (
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-default)' }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[12px] font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
                            <Globe className="w-3.5 h-3.5" /> {t('learn.cert.is_public', 'Public verification link')}
                        </span>
                        <button type="button" onClick={() => onTogglePublic(false)} disabled={busy}
                            className="text-[11px] font-medium transition-colors hover:underline" style={{ color: 'var(--text-tertiary)' }}>
                            {t('learn.cert.make_private', 'Make private')}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <input readOnly value={cert.verifyUrl}
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border text-[12px] font-mono truncate"
                            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }} />
                        <button type="button" onClick={copyVerify}
                            className="px-2.5 py-1.5 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 border flex-shrink-0 transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                            {copied ? <Check className="w-3.5 h-3.5" style={{ color: '#15803d' }} /> : <Link2 className="w-3.5 h-3.5" />}
                            {copied ? t('learn.cert.copied', 'Copied') : t('learn.cert.copy', 'Copy')}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="rounded-lg border p-3 text-[12px]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                    {t('learn.cert.no_public_url', 'A public verify link isn’t available on this deployment — your certificate PNG/PDF download still works.')}
                </div>
            )}
        </Modal>
    );
}
