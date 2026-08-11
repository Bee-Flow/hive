import { ArrowRight, History } from 'lucide-react';
import React from 'react';
import useTranslation from '../../../hooks/useTranslation';
import { formatRelativeDate } from '../lib/format';

/**
 * "Previously in this series" — context card for recurring meetings (same
 * Google Meet code / Talk room): the prior note's summary preview and its
 * still-open action items, with a jump to that note. Renders nothing when
 * there is no earlier note (first meeting of a series, uploads).
 */
export default function SeriesPreviousCard({ previous, onOpenNote }) {
    const { t } = useTranslation();
    if (!previous) return null;

    const openItems = (previous.openActionItems || []).slice(0, 5);
    // The summary is markdown; strip headers/markup for a plain-text preview.
    const preview = String(previous.summary || '')
        .replace(/^#+\s.*$/gm, '')
        .replace(/[*_`>]/g, '')
        .replace(/\n{2,}/g, ' ')
        .replace(/\n/g, ' ')
        .trim();

    return (
        <div
            className="rounded-xl border px-4 py-3 flex flex-col gap-2"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
        >
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold flex items-center gap-2 min-w-0" style={{ color: 'var(--text-primary)' }}>
                    <History className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                        {t('meeting_notes.series_previous', 'Previously in this series')}
                        <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
                            {' — '}{previous.title}{previous.createdAt ? ` · ${formatRelativeDate(previous.createdAt)}` : ''}
                        </span>
                    </span>
                </h2>
                {onOpenNote && (
                    <button
                        type="button"
                        onClick={() => onOpenNote(previous.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium shrink-0 hover:underline"
                        style={{ color: 'var(--accent-primary)' }}
                    >
                        {t('meeting_notes.series_open_note', 'Open note')}
                        <ArrowRight className="w-3 h-3" />
                    </button>
                )}
            </div>

            {preview && (
                <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {preview}
                </p>
            )}

            {openItems.length > 0 && (
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {t('meeting_notes.series_open_items', 'Still open')}
                        {': '}
                    </span>
                    {openItems.map((item, i) => (
                        <span key={item.id || i}>
                            {i > 0 && ' · '}
                            {item.text}
                            {item.assignee && item.assignee !== 'Unassigned' && item.assignee !== 'Niet toegewezen' && (
                                <span style={{ color: 'var(--text-muted)' }}> ({item.assignee})</span>
                            )}
                        </span>
                    ))}
                    {(previous.openActionItems || []).length > openItems.length && (
                        <span style={{ color: 'var(--text-muted)' }}> · +{previous.openActionItems.length - openItems.length}</span>
                    )}
                </div>
            )}
        </div>
    );
}
