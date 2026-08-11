import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Loader2, Plus, Trash2, AtSign, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';

/**
 * FreeEmailDomainsPanel — super-admin editor for the free/public email-provider
 * blocklist. Domains on this list can never auto-bind a user to an organisation
 * via email-domain matching (OAuth login, Nextcloud connector, password signup).
 *
 * The built-in floor (gmail.com, …) is shown read-only and can never be removed;
 * admins add extra domains, persisted via PUT /auth/free-email-domains.
 */
export default function FreeEmailDomainsPanel() {
    const { t } = useTranslation();
    const [builtin, setBuiltin] = useState([]);
    const [extra, setExtra] = useState([]);
    const [newDomain, setNewDomain] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [showBuiltin, setShowBuiltin] = useState(false);

    const notify = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/free-email-domains`);
            if (res.ok) {
                const data = await res.json();
                setBuiltin(Array.isArray(data.builtin) ? data.builtin : []);
                setExtra(Array.isArray(data.extra) ? data.extra : []);
            } else {
                notify('error', t('admin.fed_load_failed', 'Failed to load email domains'));
            }
        } catch {
            notify('error', t('admin.fed_load_failed', 'Failed to load email domains'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { load(); }, [load]);

    // Persist a new extra list. Sends {extra} and adopts the server-normalised
    // list from the response so the UI reflects exactly what was stored.
    const persist = async (nextExtra) => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/free-email-domains`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extra: nextExtra }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setExtra(Array.isArray(data.extra) ? data.extra : nextExtra);
                notify('success', t('admin.fed_saved', 'Email-domain blocklist updated'));
                return true;
            }
            notify('error', data.error || t('admin.fed_save_failed', 'Failed to save'));
            return false;
        } catch {
            notify('error', t('admin.fed_save_failed', 'Failed to save'));
            return false;
        } finally {
            setSaving(false);
        }
    };

    const addDomain = async () => {
        const raw = newDomain.trim().toLowerCase();
        if (!raw) return;
        const domain = raw.includes('@') ? raw.split('@').pop() : raw;
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
            notify('error', t('admin.fed_invalid', 'Not a valid domain: "{domain}"').replace('{domain}', domain));
            return;
        }
        if (builtin.includes(domain)) {
            notify('error', t('admin.fed_builtin_dup', '"{domain}" is already a built-in domain').replace('{domain}', domain));
            return;
        }
        if (extra.includes(domain)) {
            notify('error', t('admin.fed_dup', '"{domain}" is already on the list').replace('{domain}', domain));
            return;
        }
        const ok = await persist([...extra, domain]);
        if (ok) setNewDomain('');
    };

    const removeDomain = async (domain) => {
        await persist(extra.filter(d => d !== domain));
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addDomain(); }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary, #6b7280)', padding: '1rem' }}>
                <Loader2 size={18} className="animate-spin" />
                {t('admin.fed_loading', 'Loading email domains…')}
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 760 }}>
            {message && (
                <div style={{
                    position: 'sticky', top: 0, zIndex: 10, marginBottom: '1rem',
                    padding: '0.65rem 0.9rem', borderRadius: 8, fontSize: '0.875rem',
                    background: message.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    color: message.type === 'success' ? '#059669' : '#dc2626',
                    border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                <AtSign size={20} style={{ color: '#8b5cf6' }} />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>
                    {t('admin.fed_title', 'Free email-provider domains')}
                </h2>
            </div>
            <p style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.9rem', lineHeight: 1.5, marginTop: 0, marginBottom: '1.25rem' }}>
                {t('admin.fed_desc', 'Users signing in with an address at one of these domains are never automatically added to an organisation by email-domain matching. This stops a shared consumer domain (like gmail.com) from binding a stranger into someone else’s workspace. The built-in list always applies; add any extra domains your organisation should also treat as public.')}
            </p>

            {/* Add domain */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={t('admin.fed_placeholder', 'e.g. proton.me or someone@proton.me')}
                    disabled={saving}
                    style={{
                        flex: 1, padding: '0.55rem 0.75rem', borderRadius: 8,
                        border: '1px solid var(--border-color, #d1d5db)', fontSize: '0.9rem',
                        background: 'var(--input-bg, #fff)', color: 'var(--text-primary, #111827)',
                    }}
                />
                <button
                    onClick={addDomain}
                    disabled={saving || !newDomain.trim()}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.55rem 0.9rem', borderRadius: 8, border: 'none',
                        background: '#8b5cf6', color: '#fff', fontSize: '0.9rem', fontWeight: 500,
                        cursor: saving || !newDomain.trim() ? 'not-allowed' : 'pointer',
                        opacity: saving || !newDomain.trim() ? 0.6 : 1,
                    }}
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {t('admin.fed_add', 'Add')}
                </button>
            </div>

            {/* Extra (editable) domains */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-secondary, #6b7280)', marginBottom: '0.5rem' }}>
                    {t('admin.fed_custom', 'Custom domains')} ({extra.length})
                </div>
                {extra.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                        {t('admin.fed_none', 'No custom domains added.')}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {extra.map(domain => (
                            <span key={domain} style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.35rem 0.6rem', borderRadius: 999, fontSize: '0.85rem',
                                background: 'rgba(139,92,246,0.12)', color: '#7c3aed',
                                border: '1px solid rgba(139,92,246,0.3)',
                            }}>
                                {domain}
                                <button
                                    onClick={() => removeDomain(domain)}
                                    disabled={saving}
                                    title={t('admin.fed_remove', 'Remove')}
                                    style={{ display: 'inline-flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#7c3aed', padding: 0 }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Built-in (read-only) domains */}
            <div>
                <button
                    onClick={() => setShowBuiltin(v => !v)}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '0.03em', color: 'var(--text-secondary, #6b7280)', padding: 0,
                    }}
                >
                    {showBuiltin ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <ShieldCheck size={14} />
                    {t('admin.fed_builtin', 'Built-in domains')} ({builtin.length})
                </button>
                {showBuiltin && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.6rem' }}>
                        {builtin.map(domain => (
                            <span key={domain} style={{
                                padding: '0.3rem 0.55rem', borderRadius: 999, fontSize: '0.8rem',
                                background: 'var(--surface-2, #f3f4f6)', color: 'var(--text-secondary, #6b7280)',
                                border: '1px solid var(--border-color, #e5e7eb)',
                            }}>
                                {domain}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
