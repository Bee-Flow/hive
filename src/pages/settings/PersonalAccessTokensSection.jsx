import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Loader2, Plus, Trash2, Copy, Check, AlertTriangle, KeyRound } from 'lucide-react';

export default function PersonalAccessTokensSection() {
    const [tokens, setTokens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createdToken, setCreatedToken] = useState(null);
    const [copied, setCopied] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/pat`);
            const data = await res.json();
            setTokens(data.tokens || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const res = await authFetch(`${API_BASE}/api/pat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            setCreatedToken(data.token);
            setShowCreate(false);
            setNewName('');
            load();
        } catch (err) {
            alert('Failed to create token: ' + err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleRevoke = async (id, name) => {
        if (!confirm(`Revoke token "${name}"? Any apps using it will stop working.`)) return;
        try {
            await authFetch(`${API_BASE}/api/pat/${id}`, { method: 'DELETE' });
            load();
        } catch (err) {
            alert('Failed to revoke: ' + err.message);
        }
    };

    const handleCopy = () => {
        if (!createdToken?.token) return;
        navigator.clipboard.writeText(createdToken.token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <KeyRound className="w-5 h-5" />
                        Personal Access Tokens
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        Long-lived API tokens for external clients (Chrome extension, CLI, automation).
                    </p>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90">
                    <Plus className="w-4 h-4" /> Generate token
                </button>
            </div>

            {/* Token created — show once */}
            {createdToken && (
                <div className="p-4 rounded-lg border-2 border-emerald-400 bg-emerald-50">
                    <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-900 font-medium">
                            Save this token now — you won't be able to see it again.
                        </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white rounded border border-emerald-200">
                        <code className="flex-1 text-xs font-mono break-all text-emerald-900">{createdToken.token}</code>
                        <button onClick={handleCopy}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600">
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <button onClick={() => setCreatedToken(null)}
                        className="mt-2 text-xs text-emerald-700 hover:underline">
                        I've saved it — dismiss
                    </button>
                </div>
            )}

            {/* Create modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
                    <div className="w-full max-w-md p-5 rounded-2xl shadow-2xl space-y-4"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', borderWidth: 1 }}
                        onClick={e => e.stopPropagation()}>
                        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Generate new token</h3>
                        <div>
                            <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Token name</label>
                            <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                placeholder="e.g. Chrome Extension"
                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:border-[var(--accent-primary)]"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                A label to help you identify this token later.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowCreate(false)}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
                                Cancel
                            </button>
                            <button onClick={handleCreate} disabled={!newName.trim() || creating}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50">
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Token list */}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-primary)]" />
                </div>
            ) : tokens.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    No tokens yet. Generate one to connect external clients.
                </div>
            ) : (
                <div className="rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
                    <table className="w-full text-sm">
                        <thead style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                            <tr>
                                <th className="text-left px-3 py-2 font-medium">Name</th>
                                <th className="text-left px-3 py-2 font-medium">Token</th>
                                <th className="text-left px-3 py-2 font-medium">Last used</th>
                                <th className="text-left px-3 py-2 font-medium">Created</th>
                                <th className="text-right px-3 py-2 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tokens.map(tok => {
                                const isRevoked = !!tok.revoked_at;
                                return (
                                    <tr key={tok.id} className="border-t" style={{ borderColor: 'var(--border-subtle)', opacity: isRevoked ? 0.5 : 1 }}>
                                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                                            {tok.name} {isRevoked && <span className="text-xs text-red-500 ml-1">(revoked)</span>}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                            {tok.token_prefix}...
                                        </td>
                                        <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                            {tok.last_used_at ? new Date(tok.last_used_at).toLocaleString() : 'Never'}
                                        </td>
                                        <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                            {new Date(tok.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {!isRevoked && (
                                                <button onClick={() => handleRevoke(tok.id, tok.name)}
                                                    className="p-1 rounded text-red-500 hover:bg-red-50">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
