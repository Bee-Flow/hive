import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { AlertCircle } from 'lucide-react';

/**
 * RequiredConnectionsBanner — recipient pre-flight for a shared resource. Shows
 * which integrations the running user must connect (bring-your-own) before the
 * resource's tools will work, and which are already lent to them. Driven by
 * GET /api/integrations/connections/required.
 *
 * Renders nothing when there's nothing to connect (the common case), so it's
 * safe to mount unconditionally on a resource the user is about to use.
 */

const BASE = `${API_BASE}/api/integrations/connections`;

const RequiredConnectionsBanner = ({ resourceType, resourceId, providers }) => {
    const [required, setRequired] = useState([]);
    const list = (providers || []).filter(Boolean);

    useEffect(() => {
        let alive = true;
        (async () => {
            if (!resourceId || list.length === 0) return;
            try {
                const qs = new URLSearchParams({ resourceType, resourceId, providers: list.join(',') });
                const res = await authFetch(`${BASE}/required?${qs.toString()}`);
                if (!res.ok) return;
                const data = await res.json();
                if (alive) setRequired(data.requiresConnection || []);
            } catch (_) { /* silent */ }
        })();
        return () => { alive = false; };
    }, [resourceType, resourceId, list.join(',')]);

    if (required.length === 0) return null;

    return (
        <div className="rounded-lg px-3 py-2 text-[12px] flex items-start gap-2"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--text-primary)' }}>
            <AlertCircle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
            <span>
                Connect {required.map(r => r.provider).join(', ')} in{' '}
                <a href="/settings?tab=integrations" className="underline" style={{ color: 'var(--accent-primary)' }}>Settings → Integrations</a>{' '}
                to use all of this agent's tools.
            </span>
        </div>
    );
};

export default RequiredConnectionsBanner;
