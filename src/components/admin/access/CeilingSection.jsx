import React from 'react';
import CeilingReadOnly from './CeilingReadOnly';
import CloudCeilingEditor from './CloudCeilingEditor';
import SelfHostedCeilingEditor from './SelfHostedCeilingEditor';
import OrgAccessEditor from './OrgAccessEditor';

/**
 * CeilingSection — routes the ceiling surface by role + deployment mode:
 *   - org-admin (any mode)        → read-only view of the org's access
 *   - super-admin + cloud         → assign plan + edit plan allow-lists
 *   - super-admin + self-hosted   → server licence + global feature switches
 *
 * For super-admins the plan/licence editor (the tier-wide max) is followed by
 * the per-org "Organisation access" menu — which of that max THIS org may use.
 * The grant layer (Grants section) then distributes within that menu.
 */
export default function CeilingSection({ mode, isSuperAdmin, orgId, orgName, onCeilingChanged }) {
    if (!isSuperAdmin) return <CeilingReadOnly orgId={orgId} />;

    return (
        <div className="space-y-6">
            {mode === 'self-hosted'
                ? <SelfHostedCeilingEditor />
                : <CloudCeilingEditor orgId={orgId} orgName={orgName} onCeilingChanged={onCeilingChanged} />}
            {orgId ? <OrgAccessEditor orgId={orgId} onChanged={onCeilingChanged} /> : null}
        </div>
    );
}
