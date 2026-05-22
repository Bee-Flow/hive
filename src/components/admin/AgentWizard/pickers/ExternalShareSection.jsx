/**
 * ExternalShareSection — owner-only UI for creating, listing, and revoking
 * external (public) share links on a webpage.
 *
 * Mounted inside the PublishMenu popover below the existing Personal / Org /
 * Groups picker. Shares are managed via the /api/webpages/:id/public-shares
 * endpoints; the raw URL is shown to the user exactly once at creation
 * (the server only stores its hash).
 */

import { ExternalLink, Globe, Lock, Mail, Copy, Check, Trash2, Plus, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE, authFetch } from '../../../../utils/helpers';

const EXPIRY_OPTIONS = [
    { value: '1', label: '1 day' },
    { value: '7', label: '7 days' },
    { value: '30', label: '30 days' },
    { value: '90', label: '90 days' },
    { value: 'never', label: 'No expiry' },
];

function plusDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

function formatExpiry(iso) {
    if (!iso) return 'No expiry';
    const d = new Date(iso);
    const now = Date.now();
    const diff = d.getTime() - now;
    if (diff < 0) return 'Expired';
    const days = Math.round(diff / 86_400_000);
    if (days <= 1) return 'Expires today';
    if (days < 30) return `Expires in ${days} days`;
    return `Expires ${d.toLocaleDateString()}`;
}

export default function ExternalShareSection({ webpageId, webpageName }) {
    const [shares, setShares] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [creating, setCreating] = useState(false);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [accessMode, setAccessMode] = useState('unlisted');
    const [password, setPassword] = useState('');
    const [emailsRaw, setEmailsRaw] = useState('');
    const [expiry, setExpiry] = useState('30');

    // One-time URL state — shown right after create.
    const [justCreated, setJustCreated] = useState(null); // { url, shareId }
    const [copiedId, setCopiedId] = useState(null);

    const fetchShares = useCallback(async () => {
        if (!webpageId) return;
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/webpages/${webpageId}/public-shares`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
            setShares(Array.isArray(data.shares) ? data.shares : []);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [webpageId]);

    useEffect(() => { fetchShares(); }, [fetchShares]);

    const activeShares = useMemo(
        () => shares.filter(s => !s.revokedAt && !(s.expiresAt && new Date(s.expiresAt).getTime() < Date.now())),
        [shares]
    );

    const resetForm = () => {
        setAccessMode('unlisted');
        setPassword('');
        setEmailsRaw('');
        setExpiry('30');
        setShowForm(false);
    };

    const handleCreate = useCallback(async () => {
        if (creating || !webpageId) return;
        setCreating(true);
        setError(null);
        try {
            let allowedEmails;
            if (accessMode === 'email') {
                allowedEmails = emailsRaw
                    .split(/[\s,;]+/)
                    .map(s => s.trim().toLowerCase())
                    .filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
                if (allowedEmails.length === 0) {
                    throw new Error('Enter at least one valid email address.');
                }
            }
            if (accessMode === 'password' && password.length < 6) {
                throw new Error('Password must be at least 6 characters.');
            }
            const body = {
                accessMode,
                title: webpageName || '',
                expiresAt: expiry === 'never' ? null : plusDays(parseInt(expiry, 10)),
                ...(accessMode === 'password' ? { password } : {}),
                ...(accessMode === 'email' ? { allowedEmails } : {}),
            };
            const res = await authFetch(`${API_BASE}/api/webpages/${webpageId}/public-shares`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
            setJustCreated({ url: data.url, shareId: data.share?.id });
            resetForm();
            await fetchShares();
        } catch (e) {
            setError(e.message);
        } finally {
            setCreating(false);
        }
    }, [creating, webpageId, accessMode, password, emailsRaw, expiry, webpageName, fetchShares]);

    const handleRevoke = useCallback(async (shareId) => {
        if (!webpageId) return;
        if (!window.confirm('Revoke this link? Existing recipients will lose access immediately.')) return;
        try {
            const res = await authFetch(`${API_BASE}/api/webpages/${webpageId}/public-shares/${shareId}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Failed (${res.status})`);
            }
            await fetchShares();
        } catch (e) {
            setError(e.message);
        }
    }, [webpageId, fetchShares]);

    const handleRefresh = useCallback(async (shareId) => {
        if (!webpageId) return;
        try {
            const res = await authFetch(`${API_BASE}/api/webpages/${webpageId}/public-shares/${shareId}/refresh`, {
                method: 'POST',
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Failed (${res.status})`);
            }
            await fetchShares();
        } catch (e) {
            setError(e.message);
        }
    }, [webpageId, fetchShares]);

    const copyToClipboard = (text, id) => {
        try {
            navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(c => (c === id ? null : c)), 1500);
        } catch { /* clipboard unavailable */ }
    };

    return (
        <div className="border-t border-[var(--border-default)] mt-1">
            <div className="px-4 py-2 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                    External link
                </div>
                {!showForm && (
                    <button
                        type="button"
                        onClick={() => { setShowForm(true); setJustCreated(null); }}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                    >
                        <Plus size={12} /> New link
                    </button>
                )}
            </div>

            {/* One-time URL banner — shown only right after successful create. */}
            {justCreated && (
                <div className="mx-3 mb-2 p-3 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                        Share link created — copy it now, this is shown once.
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={justCreated.url}
                            readOnly
                            onFocus={(e) => e.target.select()}
                            className="flex-1 text-xs px-2 py-1.5 rounded border border-[var(--border-default)] bg-[var(--bg-card,#fff)] text-[var(--text-primary)]"
                        />
                        <button
                            type="button"
                            onClick={() => copyToClipboard(justCreated.url, justCreated.shareId)}
                            className="text-xs px-2 py-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1"
                        >
                            {copiedId === justCreated.shareId ? <><Check size={12}/> Copied</> : <><Copy size={12}/> Copy</>}
                        </button>
                    </div>
                </div>
            )}

            {/* Create form */}
            {showForm && (
                <div className="mx-3 mb-2 p-3 rounded-lg border border-[var(--border-default)] space-y-2">
                    <div className="text-xs font-medium text-[var(--text-primary)]">Who can access this link?</div>
                    <div className="space-y-1">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="radio" name="amode" value="unlisted" checked={accessMode === 'unlisted'} onChange={() => setAccessMode('unlisted')} />
                            <Globe size={12} className="text-[var(--text-secondary)]" />
                            <span>Anyone with the link</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="radio" name="amode" value="password" checked={accessMode === 'password'} onChange={() => setAccessMode('password')} />
                            <Lock size={12} className="text-[var(--text-secondary)]" />
                            <span>Password-protected</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="radio" name="amode" value="email" checked={accessMode === 'email'} onChange={() => setAccessMode('email')} />
                            <Mail size={12} className="text-[var(--text-secondary)]" />
                            <span>Email-gated (one-time link)</span>
                        </label>
                    </div>

                    {accessMode === 'password' && (
                        <input
                            type="password"
                            placeholder="Set a password (min 6 chars)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full text-xs px-2 py-1.5 rounded border border-[var(--border-default)] bg-[var(--bg-card,#fff)]"
                        />
                    )}
                    {accessMode === 'email' && (
                        <textarea
                            placeholder="emails, comma- or newline-separated"
                            value={emailsRaw}
                            onChange={(e) => setEmailsRaw(e.target.value)}
                            rows={2}
                            className="w-full text-xs px-2 py-1.5 rounded border border-[var(--border-default)] bg-[var(--bg-card,#fff)] resize-none"
                        />
                    )}

                    <div>
                        <label className="text-xs text-[var(--text-tertiary)] block mb-1">Expires</label>
                        <select
                            value={expiry}
                            onChange={(e) => setExpiry(e.target.value)}
                            className="w-full text-xs px-2 py-1.5 rounded border border-[var(--border-default)] bg-[var(--bg-card,#fff)]"
                        >
                            {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={creating}
                            className="flex-1 text-xs py-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                            {creating ? 'Creating…' : 'Create link'}
                        </button>
                        <button
                            type="button"
                            onClick={resetForm}
                            disabled={creating}
                            className="text-xs py-1.5 px-3 rounded border border-[var(--border-default)] hover:bg-[var(--bg-secondary)]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="mx-3 mb-2 text-xs text-red-600 dark:text-red-400">{error}</div>
            )}

            {/* Existing shares list */}
            {!loading && activeShares.length > 0 && (
                <div className="max-h-44 overflow-y-auto pb-2">
                    {activeShares.map(s => (
                        <div key={s.id} className="px-3 py-2 border-t border-[var(--border-default)] first:border-t-0">
                            <div className="flex items-center gap-2 mb-1">
                                {s.accessMode === 'unlisted' && <Globe size={12} className="text-[var(--text-secondary)]" />}
                                {s.accessMode === 'password' && <Lock size={12} className="text-[var(--text-secondary)]" />}
                                {s.accessMode === 'email' && <Mail size={12} className="text-[var(--text-secondary)]" />}
                                <div className="text-xs font-medium text-[var(--text-primary)] truncate flex-1">
                                    {s.accessMode === 'unlisted' && 'Anyone with the link'}
                                    {s.accessMode === 'password' && 'Password-protected'}
                                    {s.accessMode === 'email' && `Email-gated (${(s.allowedEmails || []).length})`}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRefresh(s.id)}
                                    title="Re-snapshot — update the public copy to match current edits"
                                    className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                                >
                                    <RefreshCw size={12} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRevoke(s.id)}
                                    title="Revoke link"
                                    className="p-1 rounded hover:bg-red-500/10 text-red-500"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                            <div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-2">
                                <span>{formatExpiry(s.expiresAt)}</span>
                                <span>·</span>
                                <span>{s.viewCount} view{s.viewCount === 1 ? '' : 's'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {!loading && activeShares.length === 0 && !showForm && !justCreated && (
                <div className="px-4 pb-3 text-xs text-[var(--text-tertiary)]">
                    No external links yet. <ExternalLink size={10} className="inline" /> Anyone with a published link can view a read-only snapshot — no Bee Flow account needed.
                </div>
            )}
        </div>
    );
}
