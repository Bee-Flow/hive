/**
 * ExportMenu — the document export action cluster for the workspace header:
 * PDF / Word dropdown + optional SignRequest and Nextcloud buttons. Shared by
 * NotebooksPage and LegalStudioPage. Generation (Reports/Visuals) was removed;
 * this is the only top-right action cluster now.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Download, FileDown, Loader2, ChevronDown, PenTool, FileType2 } from 'lucide-react';
import useTranslation from '../../hooks/useTranslation';

export default function ExportMenu({
    onExport,
    exporting,
    hasContent = true,
    signRequestConfigured = false,
    onSignRequest,
    nextcloudConfigured = false,
    onNextcloudExport,
    nextcloudExporting = false,
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const isExporting = !!exporting;
    const select = (format) => { setOpen(false); onExport?.(format); };

    return (
        <div className="flex items-center gap-1">
            <div className="relative" ref={ref}>
                <button
                    disabled={!hasContent || isExporting}
                    onClick={() => setOpen((p) => !p)}
                    className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    title={t('notebooks.export', 'Export')}
                >
                    {isExporting
                        ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                        : <Download className="w-4 h-4" />}
                    <span className="text-sm font-medium">{t('notebooks.export', 'Export')}</span>
                    <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && hasContent && (
                    <div
                        className="absolute top-full right-0 mt-1 w-52 rounded-xl shadow-xl border overflow-hidden z-50 text-left"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', animation: 'slideDown 0.2s ease-out' }}
                    >
                        <div className="p-1">
                            <button
                                disabled={isExporting}
                                onClick={() => select('pdf')}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] flex items-center gap-3 disabled:opacity-50 transition-colors"
                            >
                                <div className="p-1 rounded-md" style={{ background: '#ef444415', color: '#ef4444' }}>
                                    {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                                </div>
                                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('notebooks.download_pdf', 'Download as PDF')}</div>
                            </button>
                            <button
                                disabled={isExporting}
                                onClick={() => select('docx')}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] flex items-center gap-3 disabled:opacity-50 transition-colors"
                            >
                                <div className="p-1 rounded-md" style={{ background: '#3b82f615', color: '#3b82f6' }}>
                                    {exporting === 'docx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileType2 className="w-4 h-4" />}
                                </div>
                                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('notebooks.download_word', 'Download as Word')}</div>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {signRequestConfigured && (
                <button
                    disabled={!hasContent || isExporting}
                    onClick={onSignRequest}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    title={t('notebooks.send_for_signing', 'Send for signing')}
                >
                    <PenTool className="w-4 h-4 text-green-500" />
                </button>
            )}
            {nextcloudConfigured && (
                <button
                    disabled={!hasContent || isExporting || nextcloudExporting}
                    onClick={onNextcloudExport}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    title={t('notebooks.export_nextcloud', 'Save to Nextcloud')}
                >
                    {nextcloudExporting
                        ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#0082C9' }} />
                        : <svg viewBox="0 0 32 32" fill="none" className="w-4 h-4"><path d="M11.5 11.2c-2 0-3.7 1.4-4.2 3.3a3.5 3.5 0 1 0 0 3 4.4 4.4 0 0 0 7 1.7l1.5-1.4 1.6 1.4a4.4 4.4 0 0 0 7-1.7 3.5 3.5 0 1 0 0-3 4.4 4.4 0 0 0-7-1.7l-1.6 1.4-1.5-1.4a4.4 4.4 0 0 0-2.8-1.6zm0 2.2a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zm9 0a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z" fill="#0082C9" /></svg>
                    }
                </button>
            )}
        </div>
    );
}
