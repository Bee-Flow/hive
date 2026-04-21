import React from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import CheckCard from './shared/CheckCard';

/**
 * Generic checks list page used by both GDPR and AIA tabs.
 * Groups by article and renders a CheckCard per item.
 */
export default function ChecksPage({ checks, regulation, onNavigate, onRerun, rerunningId }) {
    const { t } = useTranslation();
    const list = (checks || []).filter(c => c.regulation === regulation);

    if (list.length === 0) {
        return <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted, #888)' }}>
            {t('compliance.no_checks_yet')}
        </div>;
    }

    const byArticle = {};
    for (const c of list) {
        const key = c.article || '—';
        (byArticle[key] = byArticle[key] || []).push(c);
    }
    const articles = Object.keys(byArticle).sort((a, b) => {
        const na = parseInt(a, 10); const nb = parseInt(b, 10);
        if (isNaN(na) || isNaN(nb)) return a.localeCompare(b);
        return na - nb;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {articles.map(art => (
                <div key={art} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{
                        fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: 'var(--text-muted, #888)', padding: '4px 2px',
                    }}>
                        {t('compliance.article_label')} {art}
                    </div>
                    {byArticle[art].map(c => (
                        <CheckCard key={c.check_id} check={c}
                            onNavigate={onNavigate}
                            onRerun={onRerun}
                            rerunning={rerunningId === c.check_id} />
                    ))}
                </div>
            ))}
        </div>
    );
}
