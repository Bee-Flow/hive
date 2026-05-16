import React, { useState } from 'react';
import { KeyRound, Plus, Upload, Copy, CalendarPlus, Trash2 } from 'lucide-react';
import { SectionHeader } from '../ui/SectionHeader';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Banner } from '../ui/Banner';
import { Spinner } from '../ui/Spinner';
import { ConfirmModal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { useResource, apiJson } from '../hooks/useApi';
import { useToast } from '../ui/Toast';
import { TIER_PRESETS } from '../constants';
import { GrantWizard } from './GrantWizard';

const STATUS_TONE = { active: 'success', pending: 'success', grace: 'warning', expired: 'neutral', revoked: 'danger' };

export function GrantsView() {
    const toast = useToast();
    const orgsRes  = useResource('/auth/organizations', { initial: [], transform: data => {
        const list = Array.isArray(data) ? data : (data.organizations || data.orgs || []);
        return list.map(o => ({ id: o.id, name: o.name || o.id })).filter(o => o.id);
    }});
    const capsRes  = useResource('/api/admin/licenses/capabilities', {
        initial: { tiers: TIER_PRESETS },
    });
    const listRes  = useResource('/api/admin/licenses?includeInactive=true', {
        initial: { licenses: [] },
        transform: j => ({ licenses: j.licenses || [] }),
    });

    const [issuing, setIssuing]   = useState(false);
    const [revoking, setRevoking] = useState(null);
    const [busy, setBusy]         = useState(false);

    const grants = listRes.data?.licenses || [];
    const orgs   = orgsRes.data || [];
    const tiers  = capsRes.data?.tiers || TIER_PRESETS;

    const copyBlob = async (blob) => {
        try { await navigator.clipboard.writeText(blob); toast.success('Blob copied.'); }
        catch { window.prompt('Copy this blob:', blob); }
    };

    const handleExtend = async (id, current) => {
        const def = current ? new Date(current).toISOString().slice(0, 10) : '';
        const next = window.prompt('New expiry date (YYYY-MM-DD):', def);
        if (!next) return;
        try {
            await apiJson(`/api/admin/licenses/${id}/extend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expiresAt: new Date(next + 'T23:59:59Z').toISOString() }),
            });
            toast.success('Expiry extended.');
            listRes.reload();
        } catch (e) { toast.error(e.message || 'Extend failed'); }
    };

    const handleRevoke = async () => {
        if (!revoking) return;
        setBusy(true);
        try {
            await apiJson(`/api/admin/licenses/${revoking.id}/revoke`, { method: 'POST' });
            toast.success('License revoked.');
            setRevoking(null);
            listRes.reload();
        } catch (e) { toast.error(e.message || 'Revoke failed'); }
        finally { setBusy(false); }
    };

    const handleImport = async () => {
        const blob = window.prompt('Paste a beeflow-admin-v1.* license blob to import:');
        if (!blob) return;
        const orgId = window.prompt('Target organization id (leave blank to use the org embedded in the blob):', '');
        try {
            await apiJson('/api/admin/licenses/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blob: blob.trim(), organizationId: orgId || null }),
            });
            toast.success('License imported.');
            listRes.reload();
        } catch (e) { toast.error(e.message || 'Import failed'); }
    };

    const fmtDate = s => s ? new Date(s).toLocaleDateString() : '—';

    if (issuing) {
        return (
            <GrantWizard
                orgs={orgs}
                tiers={tiers}
                onBack={() => setIssuing(false)}
                onCreated={() => { setIssuing(false); listRes.reload(); }}
            />
        );
    }

    const loading = orgsRes.loading || capsRes.loading || listRes.loading;

    return (
        <div className="px-6 py-6 max-w-[1280px] mx-auto">
            <SectionHeader
                title="Admin License Grants"
                description="Mint licenses directly without Stripe. Org members pick up the new tier on next request."
                action={
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" icon={Upload} onClick={handleImport}>Import blob</Button>
                        <Button icon={Plus} onClick={() => setIssuing(true)}>Issue license</Button>
                    </div>
                }
            />

            {loading ? (
                <Spinner label="Loading grants…" />
            ) : grants.length === 0 ? (
                <EmptyState
                    icon={KeyRound}
                    title="No admin grants yet"
                    description="Issue your first license to an organization."
                    action={<Button icon={Plus} onClick={() => setIssuing(true)}>Issue license</Button>}
                />
            ) : (
                <Card padded={false}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-left">
                                <tr>
                                    <th className="font-semibold px-4 py-2.5">Organization</th>
                                    <th className="font-semibold px-4 py-2.5">Tier</th>
                                    <th className="font-semibold px-4 py-2.5">Status</th>
                                    <th className="font-semibold px-4 py-2.5">Issued</th>
                                    <th className="font-semibold px-4 py-2.5">Expires</th>
                                    <th className="font-semibold px-4 py-2.5">Notes</th>
                                    <th className="font-semibold px-4 py-2.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grants.map(g => (
                                    <tr key={g.id} className="border-t border-[var(--border-default)]">
                                        <td className="px-4 py-2.5 text-[var(--text-primary)]">
                                            {g.scope === 'server' || (!g.organizationId && !g.organizationName)
                                                ? <span className="italic text-[var(--text-muted)]">Server license</span>
                                                : (g.organizationName || g.organizationId)}
                                        </td>
                                        <td className="px-4 py-2.5 capitalize text-[var(--text-secondary)]">{g.tier}</td>
                                        <td className="px-4 py-2.5">
                                            <Badge tone={STATUS_TONE[g.refreshStatus] || 'neutral'} size="sm">{g.refreshStatus}</Badge>
                                        </td>
                                        <td className="px-4 py-2.5 text-[var(--text-muted)]">{fmtDate(g.issuedAt)}</td>
                                        <td className="px-4 py-2.5 text-[var(--text-muted)]">{fmtDate(g.expiresAt)}</td>
                                        <td className="px-4 py-2.5 max-w-[200px] truncate text-[var(--text-secondary)]" title={g.metadata?.admin_notes || ''}>
                                            {g.metadata?.admin_notes || '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1">
                                                {g.blob && <IconButton icon={Copy} size="sm" title="Copy blob" onClick={() => copyBlob(g.blob)} />}
                                                {g.refreshStatus !== 'revoked' && (
                                                    <>
                                                        <IconButton icon={CalendarPlus} size="sm" title="Extend expiry" onClick={() => handleExtend(g.id, g.expiresAt)} />
                                                        <IconButton icon={Trash2} size="sm" variant="danger" title="Revoke" onClick={() => setRevoking(g)} />
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <ConfirmModal
                open={!!revoking}
                onClose={() => setRevoking(null)}
                onConfirm={handleRevoke}
                busy={busy}
                title="Revoke license?"
                message="Members of the organization will fall back to community tier on their next request. This cannot be undone."
                confirmLabel="Revoke license"
            />
        </div>
    );
}
