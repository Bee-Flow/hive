import { Vault, Loader2, Trash2, Search, AlertTriangle, RefreshCw, EyeOff } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';

/**
 * The user's tokenization vault.
 *
 * Privacy Shield swaps personal details for placeholders before a message
 * reaches the model. This is the dictionary behind that: which real value each
 * placeholder stands for. It is the user's own data and nobody else's — there
 * is no admin view of this screen anywhere in the product.
 *
 * Values are shown, not masked. A vault the user cannot read is a vault they
 * cannot audit, and auditing it is the entire point of showing it.
 */

const PAGE_SIZE = 100;

const TokenVaultSection = () => {
    const { t } = useTranslation();
    const [state, setState] = useState({ entries: [], total: 0, loading: true, error: '' });
    const [search, setSearch] = useState('');
    const [offset, setOffset] = useState(0);
    const [busyId, setBusyId] = useState(null);
    const [confirmClear, setConfirmClear] = useState(false);

    const load = useCallback(async (nextOffset = 0, nextSearch = '') => {
        setState(s => ({ ...s, loading: true, error: '' }));
        try {
            const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
            if (nextSearch) qs.set('search', nextSearch);
            const res = await authFetch(`${API_BASE}/api/privacy/token-vault?${qs}`);
            if (!res.ok) throw new Error(String(res.status));
            const data = await res.json();
            setState({ entries: data.entries || [], total: data.total || 0, loading: false, error: '' });
        } catch {
            setState(s => ({
                ...s, loading: false,
                error: t('vault.load_failed', 'Could not load your vault. Please try again.'),
            }));
        }
    }, [t]);

    useEffect(() => { load(0, ''); }, [load]);

    // Debounced so typing doesn't fire a request per keystroke against a
    // rate-limited endpoint.
    useEffect(() => {
        const id = setTimeout(() => { setOffset(0); load(0, search); }, 300);
        return () => clearTimeout(id);
    }, [search, load]);

    const removeEntry = async (entry) => {
        const ok = window.confirm(t(
            'vault.delete_confirm',
            'Forget "{{value}}"?\n\nAny saved message that still shows {{token}} will keep showing the placeholder — this cannot be undone.',
        ).replace('{{value}}', entry.value || entry.token).replace('{{token}}', entry.token));
        if (!ok) return;
        setBusyId(entry.id);
        try {
            const res = await authFetch(`${API_BASE}/api/privacy/token-vault/${entry.id}`, { method: 'DELETE' });
            if (res.ok) {
                setState(s => ({ ...s, entries: s.entries.filter(e => e.id !== entry.id), total: Math.max(0, s.total - 1) }));
            }
        } finally {
            setBusyId(null);
        }
    };

    const clearAll = async () => {
        setBusyId('__all__');
        try {
            const res = await authFetch(`${API_BASE}/api/privacy/token-vault`, { method: 'DELETE' });
            if (res.ok) { setConfirmClear(false); setOffset(0); await load(0, search); }
        } finally {
            setBusyId(null);
        }
    };

    const { entries, total, loading, error } = state;
    const hasMore = offset + entries.length < total;

    return (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Vault className="w-5 h-5 text-[var(--accent-primary)]" />
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                            {t('vault.title', 'Your placeholder vault')}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 max-w-2xl leading-relaxed">
                            {t('vault.description',
                                'When Privacy Shield hides a personal detail from the AI, it stores which placeholder stood for which value here. Keeping the list means the same person or company gets the same placeholder in every conversation. Only you can see this.')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => load(offset, search)}
                    className="shrink-0 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                    title={t('common.refresh', 'Refresh')}
                    aria-label={t('common.refresh', 'Refresh')}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('vault.search_placeholder', 'Search a value or placeholder…')}
                        aria-label={t('vault.search_placeholder', 'Search a value or placeholder…')}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    />
                </div>
                <span className="text-xs text-[var(--text-muted)] shrink-0">
                    {t('vault.count', '{{n}} stored').replace('{{n}}', String(total))}
                </span>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: 'rgb(153,27,27)' }}>
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center gap-2 py-8 justify-center text-sm text-[var(--text-muted)]">
                    <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading', 'Loading…')}
                </div>
            ) : entries.length === 0 ? (
                <div className="py-8 text-center">
                    <p className="text-sm text-[var(--text-secondary)]">
                        {search
                            ? t('vault.empty_search', 'Nothing matches that search.')
                            : t('vault.empty', 'Nothing stored yet.')}
                    </p>
                    {!search && (
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            {t('vault.empty_hint', 'Entries appear here once Privacy Shield hides a personal detail in one of your conversations.')}
                        </p>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                                <th scope="col" className="py-2 pr-3 font-medium">{t('vault.col_placeholder', 'Placeholder')}</th>
                                <th scope="col" className="py-2 pr-3 font-medium">{t('vault.col_value', 'Stands for')}</th>
                                <th scope="col" className="py-2 pr-3 font-medium">{t('vault.col_used', 'Used')}</th>
                                <th scope="col" className="py-2 pr-3 font-medium">{t('vault.col_last', 'Last used')}</th>
                                <th scope="col" className="py-2 w-10"><span className="sr-only">{t('common.actions', 'Actions')}</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                            {entries.map(e => (
                                <tr key={e.id} className="hover:bg-[var(--bg-tertiary)]">
                                    <td className="py-2 pr-3">
                                        <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--accent-primary)]">{e.token}</code>
                                    </td>
                                    <td className="py-2 pr-3 text-[var(--text-primary)] break-all">
                                        {e.unreadable ? (
                                            /* The server holds this row but can no longer open it — usually a
                                               key change. Say so rather than rendering a blank cell. */
                                            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] italic">
                                                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                                                {t('vault.unreadable', 'Cannot be opened — you can delete it')}
                                            </span>
                                        ) : e.value}
                                    </td>
                                    <td className="py-2 pr-3 text-xs text-[var(--text-muted)] whitespace-nowrap">{e.useCount}×</td>
                                    <td className="py-2 pr-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                                        {e.lastUsedAt ? new Date(e.lastUsedAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="py-2">
                                        <button
                                            onClick={() => removeEntry(e)}
                                            disabled={busyId === e.id}
                                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                                            title={t('vault.delete', 'Forget this')}
                                            aria-label={`${t('vault.delete', 'Forget this')}: ${e.token}`}
                                        >
                                            {busyId === e.id
                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {hasMore && (
                        <button
                            onClick={() => { const next = offset + PAGE_SIZE; setOffset(next); load(next, search); }}
                            className="mt-3 w-full py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)]"
                        >
                            {t('vault.load_more', 'Show more')}
                        </button>
                    )}
                </div>
            )}

            {/* Destructive action, kept below the list and behind a second step. */}
            {total > 0 && (
                <div className="pt-3 border-t border-[var(--border-subtle)]">
                    {confirmClear ? (
                        <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" aria-hidden="true" />
                            <div className="flex-1">
                                <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                                    {t('vault.clear_warning',
                                        'Forget all stored values? Placeholders already saved in your conversations will stay as placeholders — this cannot be undone.')}
                                </p>
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={clearAll}
                                        disabled={busyId === '__all__'}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                    >
                                        {busyId === '__all__'
                                            ? t('vault.clearing', 'Forgetting…')
                                            : t('vault.clear_confirm', 'Yes, forget everything')}
                                    </button>
                                    <button
                                        onClick={() => setConfirmClear(false)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                                    >
                                        {t('common.cancel', 'Cancel')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setConfirmClear(true)}
                            className="text-xs font-medium text-red-500 hover:underline"
                        >
                            {t('vault.clear', 'Forget everything in this vault')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default TokenVaultSection;
