import React from 'react';
import { ORG_ROLES } from '../../config/orgRoles';

/**
 * Colour-coded chip for an organisation role, reading its label and colour from
 * config/orgRoles.js (the single source of truth). Extracted verbatim from
 * OrgUsersPanel's local `getRoleBadge` so Settings and Security render a role
 * identically.
 *
 * Behaviour-preserving extraction — two known gaps are carried over rather than
 * fixed here, because changing them inside a refactor would hide a semantic
 * change inside a "no visual diff" commit:
 *
 *  1. ORG_ROLES has no legacy `admin` entry, while the server's OrgRoles
 *     (permissions.js:33-48) has it — `admin` being the pre-rename alias for
 *     `org_admin`. It falls through to the plain grey chip. (`dpo` is present
 *     since the Compliance Center became reachable from org settings.)
 *  2. Callers pass `u.orgRole || u.role`, which conflates the org role with the
 *     system role. Mapping legacy `admin` → `org_admin` here would therefore
 *     mislabel a *super-admin* (users.role === 'admin', no orgRole) as an
 *     Organisation Admin — a worse bug than the one it fixes.
 *
 * Fixing this properly means separating the two columns at the call site first.
 */
export default function RoleBadge({ role }) {
    const orgRole = ORG_ROLES.find((r) => r.id === role);

    if (orgRole) {
        return (
            <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                style={{ background: orgRole.color }}
            >
                {orgRole.name}
            </span>
        );
    }

    return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
            {role || 'user'}
        </span>
    );
}
