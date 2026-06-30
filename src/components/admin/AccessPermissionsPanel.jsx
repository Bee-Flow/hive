import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Crown, Building2, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useEntitlements } from '../EntitlementsContext';
import GroupAccessMatrix from './GroupAccessMatrix';
import CeilingSection from './access/CeilingSection';

/**
 * AccessPermissionsPanel — the hub for configuring beta / integration / core
 * RIGHTS. A left icon-rail switches between:
 *   - Grants  : distribute capabilities to All members + per group (the matrix)
 *   - Ceiling : what the subscription plan (cloud) / licence (self-hosted)
 *               permits — editable by super-admins, read-only for org-admins
 *
 * MCP server install/config lives on Admin → Integrations (the MCP section);
 * installed servers are ordinary integrations, granted through the matrix here.
 *
 * A super-admin gets an organisation picker (manage any org); an org-admin
 * manages their own org via the /me endpoints. Mode comes from the unified
 * entitlements snapshot. Emerald + blue only.
 */

const EMERALD = '#10b981';
const BLUE = '#3b82f6';

export default function AccessPermissionsPanel({ user, activeSection = 'grants', onNavigate }) {
    const isSuperAdmin = !!(user?.isAdmin || user?.role === 'admin' || (user?.permissions || []).includes('all'));
    const { mode, reload: reloadEntitlements } = useEntitlements();

    const [orgs, setOrgs] = useState(null); // null = loading; [] = none / not super-admin
    const [orgId, setOrgId] = useState(null);

    // Persist the picker selection server-side so a GLOBAL super-admin (no org of
    // their own) has their OWN entitlement resolution governed by the org they're
    // administering — the org access ceiling then binds them like everyone else.
    // Reload the snapshot so the change applies immediately. Non-fatal on error.
    const persistSelectedOrg = useCallback(async (id) => {
        if (!id) return;
        try {
            await authFetch(`${API_BASE}/auth/admin/selected-org`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orgId: id }),
            });
            reloadEntitlements?.();
        } catch (_) { /* picker still works for viewing other orgs */ }
    }, [reloadEntitlements]);

    const selectOrg = useCallback((id) => { setOrgId(id); persistSelectedOrg(id); }, [persistSelectedOrg]);

    useEffect(() => {
        if (!isSuperAdmin) { setOrgs([]); return; }
        let alive = true;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/auth/organizations`);
                if (!res.ok) { if (alive) setOrgs([]); return; }
                const j = await res.json();
                const list = Array.isArray(j) ? j : (j.organizations || j.orgs || []);
                if (!alive) return;
                setOrgs(list);
                if (list.length > 0) { setOrgId(list[0].id); persistSelectedOrg(list[0].id); }
            } catch (_) { if (alive) setOrgs([]); }
        })();
        return () => { alive = false; };
    }, [isSuperAdmin, persistSelectedOrg]);

    const sections = useMemo(() => ([
        { id: 'grants', label: 'Grants', icon: ShieldCheck, color: EMERALD },
        { id: 'ceiling', label: 'Ceiling', icon: Crown, color: BLUE },
    ]), []);

    const validIds = sections.map(s => s.id);
    const active = validIds.includes(activeSection) ? activeSection : 'grants';

    const handleSectionClick = (id) => { if (onNavigate) onNavigate(`admin/access/${id}`); };

    const orgName = useMemo(() => (orgs || []).find(o => o.id === orgId)?.name || orgId, [orgs, orgId]);

    if (isSuperAdmin && orgs === null) {
        return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>;
    }

    const noOrg = isSuperAdmin && (!orgs || orgs.length === 0);

    const renderBody = () => {
        if (noOrg) {
            return (
                <div className="rounded-2xl p-5 text-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    No organisations found.
                </div>
            );
        }
        if (active === 'grants') {
            // Org-admins manage integrations (incl. MCP) on Settings → Organisation
            // → Integrations, so the hub shows them only Features + Beta. Super-admins
            // (org picker) keep all kinds for managing other orgs.
            return (
                <GroupAccessMatrix
                    key={`grants:${orgId || 'me'}`}
                    orgId={isSuperAdmin ? orgId : undefined}
                    kinds={isSuperAdmin ? undefined : ['core', 'beta']}
                />
            );
        }
        if (active === 'ceiling') {
            return (
                <CeilingSection
                    key={`ceiling:${orgId || 'me'}`}
                    mode={mode}
                    isSuperAdmin={isSuperAdmin}
                    orgId={isSuperAdmin ? orgId : undefined}
                    orgName={isSuperAdmin ? orgName : undefined}
                    onCeilingChanged={reloadEntitlements}
                />
            );
        }
        return null;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* ── Org picker bar (super-admin) ── */}
            {isSuperAdmin && orgs && orgs.length > 0 ? (
                <div className="flex items-center gap-2.5 px-4 py-2.5 border-b flex-shrink-0" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                    <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: BLUE }} />
                    <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Organisation</label>
                    <select
                        value={orgId || ''}
                        onChange={e => selectOrg(e.target.value)}
                        className="text-sm rounded-lg px-3 py-1.5 outline-none flex-1 max-w-sm"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                    >
                        {orgs.map(o => <option key={o.id} value={o.id}>{o.name || o.id}</option>)}
                    </select>
                </div>
            ) : null}

            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {/* ── Left rail ── */}
                <div style={{ width: 56, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-default)' }}>
                    {sections.map(sec => {
                        const Icon = sec.icon;
                        const isActive = active === sec.id;
                        return (
                            <button
                                key={sec.id}
                                onClick={() => handleSectionClick(sec.id)}
                                title={sec.label}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                                    padding: '10px 4px', margin: '0 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    background: isActive ? `${sec.color}20` : 'transparent',
                                    borderLeft: isActive ? `3px solid ${sec.color}` : '3px solid transparent',
                                }}
                            >
                                <Icon style={{ width: 20, height: 20, color: isActive ? sec.color : 'var(--text-muted)' }} />
                                <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 500, color: isActive ? sec.color : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.1 }}>{sec.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ── Main panel ── */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }} className="p-6">
                        <div className="mx-auto max-w-5xl">
                            {renderBody()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
