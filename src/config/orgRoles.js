/**
 * Shared Organisation Role definitions
 * 
 * Single source of truth for orgRole IDs, labels, descriptions, and colors.
 * Used by both UserManagement.jsx and OrgUsersPanel.jsx.
 */

export const ORG_ROLES = [
    {
        id: 'org_admin',
        label: 'Organisation Admin',
        name: 'Organisation Admin',
        description: 'Full organisation control — manage users, groups, permissions, Privacy Shield settings, and all agent capabilities.',
        color: '#8b5cf6',
        permissions: [
            { label: 'Manage Users', desc: 'Add, remove, and assign roles to organisation members' },
            { label: 'Edit Organisation Settings', desc: 'Change branding, legal details, and configuration' },
            { label: 'Privacy Shield', desc: 'Configure data redaction and compliance rules' },
            { label: 'All Agent Permissions', desc: 'Create, edit, and publish all agents' },
        ],
    },
    {
        id: 'agent_admin',
        label: 'Agent Admin',
        name: 'Agent Admin',
        description: 'Create and manage all agents — both published and in-progress drafts.',
        color: '#f59e0b',
        permissions: [
            { label: 'Create Agents', desc: 'Build new agents from scratch or templates' },
            { label: 'Edit Published Agents', desc: 'Modify agents that are live and available to users' },
            { label: 'Edit Unpublished Agents', desc: 'Work on draft agents before publishing' },
        ],
    },
    {
        id: 'agent_editor',
        label: 'Agent Editor',
        name: 'Agent Editor',
        description: 'Create agents and edit published ones, but cannot modify unpublished drafts from others.',
        color: '#10b981',
        permissions: [
            { label: 'Create Agents', desc: 'Build new agents from scratch or templates' },
            { label: 'Edit Published Agents', desc: 'Modify agents that are live and available to users' },
        ],
    },
    {
        id: 'member',
        label: 'Member',
        name: 'Member',
        description: 'Basic access with no editing capabilities.',
        color: '#6b7280',
        permissions: [],
    },
];

/**
 * Helper for permission checks — returns true if a permission array includes
 * 'all' (full admin) or the specific permission ID.
 */
export const hasPermissionCheck = (permissions, permId) => {
    if (!Array.isArray(permissions)) return false;
    return permissions.includes('all') || permissions.includes(permId);
};

/**
 * Org roles that have agent management capabilities.
 * Used for gating access to agent-related UI in org settings.
 */
export const AGENT_MANAGEMENT_ROLES = ['org_admin', 'agent_admin', 'agent_editor'];

/**
 * Org roles that have user management capabilities.
 */
export const USER_MANAGEMENT_ROLES = ['org_admin'];
