import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { Users, UserPlus, Shield, Trash2, Edit2, Key, Loader2, Tag, Image, Smile, Building, ChevronDown, Unlink, Cloud, Activity } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

import { ORG_ROLES } from '../../config/orgRoles';
import ConfirmDialog from '../shared/ConfirmDialog';
import Modal from '../shared/Modal';
import PeopleDirectory from './security/people/PeopleDirectory';

// BFSF-286: registration provenance labels. Literal keys (no template
// interpolation) so the i18nGuard static scan sees them.
const ORG_SOURCE_KEY = {
    direct: 'admin.org_source_direct',
    admin: 'admin.org_source_admin',
    nextcloud_connector: 'admin.org_source_nextcloud_connector',
};

const UserManagement = ({ activeSection: activeSectionProp = '', onNavigate, user: currentUser }) => {
    const { t } = useTranslation();
    const VALID_SECTIONS = ['users', 'organizations', 'groups', 'roles', 'permissions', 'my-organization'];
    const activeSection = VALID_SECTIONS.includes(activeSectionProp) ? activeSectionProp : 'users';

    // Permission check: full admin can do everything, org-scoped users are limited
    const isFullAdmin = currentUser?.permissions?.includes('all') || currentUser?.isAdmin;
    const canManageUsers = isFullAdmin || (currentUser?.permissions || []).some(p => ['manage_users', 'admin_security'].includes(p));
    const userOrgIds = currentUser?.organizations || [];
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // Modal states
    const [showAddUser, setShowAddUser] = useState(false);
    const [showEditUser, setShowEditUser] = useState(false);
    const [showAddGroup, setShowAddGroup] = useState(false);
    const [showEditGroup, setShowEditGroup] = useState(false);
    const [showAddRole, setShowAddRole] = useState(false);
    const [showEditRole, setShowEditRole] = useState(false);

    // Form states
    const [userData, setUserData] = useState({ id: '', username: '', displayName: '', firstName: '', lastName: '', email: '', phone: '', avatar: '', avatarType: '', password: '', role: 'user', groups: [], organizationId: '', orgRole: '' });
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [orgData, setOrgData] = useState({ id: '', name: '', description: '', tagline: '', address: '', email: '', phone: '', website: '', kvk: '', vat: '', logo: '', footerText: '', defaultGroups: [], allowSignup: false });
    const [groupData, setGroupData] = useState({ id: '', name: '', description: '', permissions: [], roles: [], organizationId: '', allowedAgentTypes: [] });
    const [roleData, setRoleData] = useState({ id: '', name: '', description: '', permissions: [] });

    // Destructive actions route through <ConfirmDialog/> rather than
    // window.confirm: the native dialog is unstyled, unthemeable, blocks the
    // event loop, and cannot be driven by a test.
    const [confirmState, setConfirmState] = useState(null);
    const askConfirm = (opts) => setConfirmState(opts);

    const closeUserModal = () => { setShowAddUser(false); setShowEditUser(false); };
    const closeOrgModal = () => { setShowAddOrg(false); setShowEditOrg(false); };
    const closeGroupModal = () => { setShowAddGroup(false); setShowEditGroup(false); };
    const closeRoleModal = () => { setShowAddRole(false); setShowEditRole(false); };

    // Load data on mount
    useEffect(() => {
        loadData();
    }, []);

    // The caller's own organisation — used by the my-organization section and by
    // the effect below that seeds its form.
    const myOrg = organizations.find(o => userOrgIds.includes(o.id));

    // Seed the org form when the my-organization section opens. This used to run
    // as a `setTimeout(..., 0)` from inside the render path, so it re-fired on
    // every render until the state landed.
    useEffect(() => {
        if (activeSection !== 'my-organization' || !myOrg || orgData.id === myOrg.id) return;
        setOrgData({
            id: myOrg.id,
            name: myOrg.name,
            description: myOrg.description || '',
            tagline: myOrg.tagline || '',
            address: myOrg.address || '',
            email: myOrg.email || '',
            phone: myOrg.phone || '',
            website: myOrg.website || '',
            kvk: myOrg.kvk || '',
            vat: myOrg.vat || '',
            logo: myOrg.logo || '',
            footerText: myOrg.footerText || '',
            defaultGroups: myOrg.defaultGroups || [],
            allowSignup: !!myOrg.allowSignup,
        });
    }, [activeSection, myOrg?.id, orgData.id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersRes, groupsRes, rolesRes, permsRes, orgsRes] = await Promise.all([
                authFetch(`${API_BASE}/auth/users`),
                authFetch(`${API_BASE}/auth/groups`),
                authFetch(`${API_BASE}/auth/roles`),
                authFetch(`${API_BASE}/auth/permissions`),
                authFetch(`${API_BASE}/auth/organizations`)
            ]);

            if (usersRes.ok) setUsers(await usersRes.json());
            if (groupsRes.ok) setGroups(await groupsRes.json());
            if (rolesRes.ok) setRoles(await rolesRes.json());
            if (permsRes.ok) setPermissions(await permsRes.json());
            if (orgsRes.ok) setOrganizations(await orgsRes.json());

        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to load data. Ensure you are admin.' });
        } finally {
            setLoading(false);
        }
    };

    // --- User Actions ---
    const openAddUser = () => {
        setUserData({ id: '', username: '', displayName: '', firstName: '', lastName: '', email: '', phone: '', avatar: '', avatarType: '', password: '', role: 'user', groups: [], organizationId: '', orgRole: '' });
        setShowEmojiPicker(false);
        setShowAddUser(true);
    };

    const openEditUser = (user) => {
        setUserData({
            id: user.id || user.username,
            username: user.username,
            displayName: user.displayName,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            phone: user.phone || '',
            avatar: user.avatar || '',
            avatarType: user.avatarType || '',
            password: '',
            role: user.role || 'user',
            groups: user.groups || [],
            organizationId: user.organizationId || '',
            orgRole: user.orgRole || '',
        });
        setShowEmojiPicker(false);
        setShowEditUser(true);
    };

    const handleAddUser = async () => {
        if (!userData.username || !userData.displayName || !userData.password) {
            const missing = [];
            if (!userData.username) missing.push('username');
            if (!userData.displayName) missing.push('display name');
            if (!userData.password) missing.push('password');
            setMessage({ type: 'error', text: `Required: ${missing.join(', ')}` });
            return;
        }
        try {
            const res = await authFetch(`${API_BASE}/auth/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'User created successfully' });
                setShowAddUser(false);
                loadData();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to create user' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error' });
        }
    };

    const handleUpdateUser = async () => {
        try {
            const res = await authFetch(`${API_BASE}/auth/users/${userData.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'User updated successfully' });
                setShowEditUser(false);
                loadData();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to update user' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error' });
        }
    };

    // BFSF-274: org-admin escape hatch for users locked out of 2FA. Clears the
    // enrollment; forced re-enrollment (when enabled) kicks in at next login.
    const handleResetMfa = (user) => {
        const name = user.displayName || user.username || user.id;
        askConfirm({
            title: t('admin.sec_reset_mfa_title', 'Reset two-factor authentication?'),
            description: t('admin.reset_mfa_confirm', 'Reset two-factor authentication for {name}? Their authenticator and recovery codes stop working immediately; they will be asked to enroll again at their next sign-in.', { name }),
            confirmLabel: t('admin.reset_mfa', 'Reset 2FA'),
            destructive: true,
            onConfirm: () => doResetMfa(user),
        });
    };

    const doResetMfa = async (user) => {
        try {
            const res = await authFetch(`${API_BASE}/auth/users/${user.id}/mfa/reset`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                alert(data.wasEnabled === false
                    ? t('admin.reset_mfa_not_enabled', 'This user has no two-factor authentication enabled.')
                    : t('admin.reset_mfa_done', 'Two-factor authentication was reset.'));
            } else {
                alert(data.error || 'Failed to reset 2FA');
            }
        } catch (err) {
            console.error('Failed to reset 2FA:', err);
            alert('Failed to reset 2FA. Please try again.');
        }
    };

    const handleDeleteUser = (userId) => {
        askConfirm({
            title: t('admin.sec_delete_user_title', 'Delete this user?'),
            description: t('admin.sec_delete_user_desc', 'The account is removed and cannot be restored.'),
            confirmLabel: t('admin.sec_delete', 'Delete'),
            destructive: true,
            onConfirm: () => doDeleteUser(userId),
        });
    };

    const doDeleteUser = async (userId) => {
        try {
            const res = await authFetch(`${API_BASE}/auth/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'User deleted' });
                loadData();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to delete user' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error' });
        }
    };

    // --- Group Actions ---
    const openAddGroup = () => {
        setGroupData({ id: '', name: '', description: '', permissions: [], roles: [], organizationId: '', allowedAgentTypes: [] });
        setShowAddGroup(true);
    };

    const openEditGroup = (group) => {
        setGroupData({
            id: group.id, name: group.name, description: group.description,
            permissions: group.permissions || [], roles: group.roles || [], organizationId: group.organizationId || '',
            allowedAgentTypes: group.allowedAgentTypes || []
        });
        setShowEditGroup(true);
    };

    const handleAddGroup = async () => {
        if (!groupData.name) return;
        try {
            const res = await authFetch(`${API_BASE}/auth/groups`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(groupData)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Group created successfully' });
                setShowAddGroup(false);
                loadData();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to create group' });
            }
        } catch (err) { setMessage({ type: 'error', text: 'Connection error' }); }
    };

    const handleUpdateGroup = async () => {
        try {
            const res = await authFetch(`${API_BASE}/auth/groups/${groupData.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(groupData)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Group updated successfully' });
                setShowEditGroup(false);
                loadData();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to update group' });
            }
        } catch (err) { setMessage({ type: 'error', text: 'Connection error' }); }
    };

    const handleDeleteGroup = (groupId) => {
        askConfirm({
            title: t('admin.sec_delete_group_title', 'Delete this group?'),
            description: t('admin.sec_delete_group_desc', 'Members keep their accounts but lose whatever this group granted them.'),
            confirmLabel: t('admin.sec_delete', 'Delete'),
            destructive: true,
            onConfirm: () => doDeleteGroup(groupId),
        });
    };

    const doDeleteGroup = async (groupId) => {
        try {
            const res = await authFetch(`${API_BASE}/auth/groups/${groupId}`, { method: 'DELETE' });
            if (res.ok) { setMessage({ type: 'success', text: 'Group deleted' }); loadData(); }
            else { const d = await res.json(); setMessage({ type: 'error', text: d.error || 'Failed' }); }
        } catch (err) { setMessage({ type: 'error', text: 'Connection error' }); }
    };

    // --- Role Actions ---
    const openAddRole = () => {
        setRoleData({ id: '', name: '', description: '', permissions: [] });
        setShowAddRole(true);
    };

    const openEditRole = (role) => {
        setRoleData({ id: role.id, name: role.name, description: role.description, permissions: role.permissions || [] });
        setShowEditRole(true);
    };

    const handleAddRole = async () => {
        if (!roleData.name) return;
        try {
            const res = await authFetch(`${API_BASE}/auth/roles`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roleData)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Role created successfully' });
                setShowAddRole(false);
                loadData();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to create role' });
            }
        } catch (err) { setMessage({ type: 'error', text: 'Connection error' }); }
    };

    const handleUpdateRole = async () => {
        try {
            const res = await authFetch(`${API_BASE}/auth/roles/${roleData.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roleData)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Role updated successfully' });
                setShowEditRole(false);
                loadData();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to update role' });
            }
        } catch (err) { setMessage({ type: 'error', text: 'Connection error' }); }
    };

    const handleDeleteRole = (roleId) => {
        askConfirm({
            title: t('admin.sec_delete_role_title', 'Delete this role?'),
            description: t('admin.sec_delete_role_desc', 'Groups and users holding this role lose the permissions it granted.'),
            confirmLabel: t('admin.sec_delete', 'Delete'),
            destructive: true,
            onConfirm: () => doDeleteRole(roleId),
        });
    };

    const doDeleteRole = async (roleId) => {
        try {
            const res = await authFetch(`${API_BASE}/auth/roles/${roleId}`, { method: 'DELETE' });
            if (res.ok) { setMessage({ type: 'success', text: 'Role deleted' }); loadData(); }
            else { const d = await res.json(); setMessage({ type: 'error', text: d.error || 'Failed' }); }
        } catch (err) { setMessage({ type: 'error', text: 'Connection error' }); }
    };

    const getRoleBadge = (roleId) => {
        const role = roles.find(r => r.id === roleId);
        const roleName = role ? role.name : (roleId || 'User');
        const styles = {
            admin: 'bg-purple-500/20 text-purple-400',
            user: 'bg-blue-500/20 text-blue-400'
        };
        return (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[roleId] || 'bg-gray-500/20 text-gray-400'}`}>
                {roleName}
            </span>
        );
    };

    // --- Organization Actions ---
    // NOT a duplicate of config/integrationCatalog.js — a STALE SUBSET of it.
    // The catalog has 44 entries; this has 22. Nothing here is missing from the
    // catalog, but the catalog additionally carries outlook-readonly,
    // agent-search, browser-fetch, transcription, linkedin, github, signrequest,
    // maps, google-groups, kb-search, webpages and all 11 nextcloud-* ids —
    // none of which an org admin can toggle from this modal today.
    //
    // Deliberately NOT swapped for the catalog during the P2 coherence pass:
    // that would double the org's configurable integration surface, which is a
    // product decision, not a tidy-up. The catalog's header says it exists so
    // IntegrationsAdminPanel and OrgFeatureTogglesPanel "stay in sync" — this
    // modal is a third consumer that drifted. Needs an owner decision: adopt the
    // catalog wholesale, or declare this list intentionally curated and say so.
    const ALL_INTEGRATIONS = [
        { id: 'gmail', label: 'Gmail' },
        { id: 'google-calendar', label: 'Calendar (Google)' },
        { id: 'google-drive', label: 'Drive' },
        { id: 'google-slides', label: 'Slides' },
        { id: 'google-sheets', label: 'Sheets' },
        { id: 'google-docs', label: 'Docs' },
        { id: 'google-contacts', label: 'Contacts (Google)' },
        { id: 'google-keep', label: 'Keep' },
        { id: 'outlook', label: 'Outlook' },
        { id: 'ms-calendar', label: 'Calendar (Microsoft)' },
        { id: 'onedrive', label: 'OneDrive' },
        { id: 'ms-contacts', label: 'Contacts (Microsoft)' },
        { id: 'image-gen', label: 'Image Gen' },
        { id: 'music-gen', label: 'Music Gen' },
        { id: 'video-gen', label: 'Video Gen' },
        { id: 'elevenlabs', label: 'ElevenLabs' },
        { id: 'fireflies', label: 'Fireflies' },
        { id: 'youtrack', label: 'YouTrack' },
        { id: 'gamma', label: 'Gamma' },
        { id: 'afas-profit', label: 'AFAS Profit' },
        { id: 'nmbrs', label: 'NMBRS' },
        { id: 'n8n', label: 'n8n' },
    ];
    const [showAddOrg, setShowAddOrg] = useState(false);
    const [showEditOrg, setShowEditOrg] = useState(false);

    const openAddOrg = () => {
        setOrgData({ id: '', name: '', description: '', tagline: '', address: '', email: '', phone: '', website: '', kvk: '', vat: '', logo: '', footerText: '', defaultGroups: [], allowSignup: false });
        setShowAddOrg(true);
    };

    const openEditOrg = (org) => {
        const parsedIntegrations = org.enabledIntegrations
            ? (typeof org.enabledIntegrations === 'string' ? JSON.parse(org.enabledIntegrations) : org.enabledIntegrations)
            : null;
        setOrgData({ id: org.id, name: org.name, description: org.description || '', tagline: org.tagline || '', address: org.address || '', email: org.email || '', phone: org.phone || '', website: org.website || '', kvk: org.kvk || '', vat: org.vat || '', logo: org.logo || '', footerText: org.footerText || '', defaultGroups: org.defaultGroups || [], allowSignup: !!org.allowSignup, enabledIntegrations: parsedIntegrations });
        setShowEditOrg(true);
    };

    const handleAddOrg = async () => {
        if (!orgData.name) return;
        try {
            const res = await authFetch(`${API_BASE}/auth/organizations`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orgData)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Organization created successfully' });
                setShowAddOrg(false);
                loadData();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to create organization' });
            }
        } catch (err) { setMessage({ type: 'error', text: 'Connection error' }); }
    };

    const handleUpdateOrg = async () => {
        try {
            const res = await authFetch(`${API_BASE}/auth/organizations/${orgData.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orgData)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Organization updated successfully' });
                setShowEditOrg(false);
                loadData();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to update organization' });
            }
        } catch (err) { setMessage({ type: 'error', text: 'Connection error' }); }
    };

    const handleDeleteOrg = (orgId) => {
        askConfirm({
            title: t('admin.sec_delete_org_title', 'Delete this organisation?'),
            description: t('admin.sec_delete_org_desc', 'Its groups and settings go with it. Members keep their accounts but lose access to everything scoped to this organisation.'),
            confirmLabel: t('admin.sec_delete', 'Delete'),
            destructive: true,
            onConfirm: () => doDeleteOrg(orgId),
        });
    };

    const doDeleteOrg = async (orgId) => {
        try {
            const res = await authFetch(`${API_BASE}/auth/organizations/${orgId}`, { method: 'DELETE' });
            if (res.ok) { setMessage({ type: 'success', text: 'Organization deleted' }); loadData(); }
            else { const d = await res.json(); setMessage({ type: 'error', text: d.error || 'Failed' }); }
        } catch (err) { setMessage({ type: 'error', text: 'Connection error' }); }
    };

    const handleRemoveNcBinding = (org) => {
        askConfirm({
            title: t('admin.sec_nc_unlink_title', 'Disconnect this Nextcloud instance?'),
            description: t('admin.org_nc_remove_confirm', { name: org.name }),
            confirmLabel: t('admin.sec_nc_unlink_confirm', 'Disconnect'),
            destructive: true,
            onConfirm: () => doRemoveNcBinding(org),
        });
    };

    const doRemoveNcBinding = async (org) => {
        try {
            const res = await authFetch(`${API_BASE}/auth/admin/nc-bindings/org/${org.id}`, { method: 'DELETE' });
            if (res.ok) { setMessage({ type: 'success', text: t('admin.org_nc_remove_success') }); loadData(); }
            else { const d = await res.json(); setMessage({ type: 'error', text: d.error || t('admin.org_nc_remove_error') }); }
        } catch (err) { setMessage({ type: 'error', text: 'Connection error' }); }
    };

    const sections = isFullAdmin ? [
        { key: 'users', labelKey: 'admin.users_tab_users', icon: Users },
        { key: 'organizations', labelKey: 'admin.users_tab_organizations', icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></svg> },
        { key: 'nextcloud', labelKey: 'admin.users_tab_nextcloud', icon: Cloud },
        { key: 'groups', labelKey: 'admin.users_tab_groups', icon: Shield },
        { key: 'roles', labelKey: 'admin.users_tab_roles', icon: Tag },
        { key: 'permissions', labelKey: 'admin.users_tab_permissions', icon: Key },
    ] : [
        { key: 'users', labelKey: 'admin.users_tab_users', icon: Users },
        { key: 'groups', labelKey: 'admin.users_tab_groups', icon: Shield },
        ...(userOrgIds.length > 0 ? [{ key: 'my-organization', labelKey: 'admin.users_tab_my_org', icon: Building }] : []),
    ];

    return (
        <div className="h-full flex flex-col">
            {/* Section Tabs */}
            <div className="px-6 py-4 border-b flex items-center gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
                {sections.map(({ key, labelKey, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => { if (onNavigate) onNavigate(`admin/security/users/${key}`); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeSection === key
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                    >
                        <Icon className="w-4 h-4" />
                        {t(labelKey)}
                    </button>
                ))}
                <div className="flex-1" />
                {message && (
                    <span className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                        {typeof message.text === 'string' ? message.text : JSON.stringify(message.text)}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading data...
                    </div>
                ) : (
                    <>
                        {/* Users Section */}
                        {activeSection === 'users' && (
                            <PeopleDirectory
                                users={users}
                                groups={groups}
                                organizations={organizations}
                                canManageUsers={canManageUsers}
                                onAddUser={openAddUser}
                                onEditUser={openEditUser}
                                onResetMfa={handleResetMfa}
                                onDeleteUser={(user) => handleDeleteUser(user.id)}
                            />
                        )}

                        {/* Organizations Section */}
                        {activeSection === 'organizations' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-6">
                                    <div><h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Organizations</h3><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage organizations and their metadata</p></div>
                                    {isFullAdmin && <button onClick={openAddOrg} className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium" style={{ background: 'var(--accent-primary)', color: 'white' }}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg> Add Organization</button>}
                                </div>
                                <div className="grid gap-4">
                                    {organizations.map(org => (
                                        <div key={org.id} className="p-4 rounded-xl border group hover:border-[var(--accent-primary)]" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    {org.logo ? (
                                                        <img src={org.logo.startsWith('/') ? `${API_BASE}${org.logo}` : org.logo} alt={org.name} className="w-10 h-10 object-contain rounded-lg" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.15)' }}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></svg></div>
                                                    )}
                                                    <div>
                                                        <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{org.name}</h4>
                                                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{org.description}</p>
                                                        {org.nc_instance_id && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('admin.org_nc_bound_label')}: {org.nc_base_url || org.nc_instance_id}</p>}
                                                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('admin.org_source_label')}: {t(ORG_SOURCE_KEY[org.registrationSource] || 'admin.org_source_unknown')}</p>
                                                        {org.registrationSource === 'nextcloud_connector' && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('admin.org_terms_channel')}: {t('admin.org_terms_channel_connector')}</p>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-100 xl:opacity-0 xl:group-hover:opacity-100">
                                                    <button onClick={() => openEditOrg(org)} className="p-1.5 rounded hover:bg-blue-500/10 text-blue-500"><Edit2 className="w-4 h-4" /></button>
                                                    {isFullAdmin && org.nc_instance_id && <button onClick={() => handleRemoveNcBinding(org)} title={t('admin.org_nc_remove_title')} className="p-1.5 rounded hover:bg-amber-500/10 text-amber-500"><Unlink className="w-4 h-4" /></button>}
                                                    {isFullAdmin && <button onClick={() => handleDeleteOrg(org.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-500"><Trash2 className="w-4 h-4" /></button>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Nextcloud Bindings Section (global admin) */}
                        {activeSection === 'nextcloud' && (
                            <div className="space-y-4">
                                <div className="mb-6">
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('admin.nc_bindings_title')}</h3>
                                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('admin.nc_bindings_desc')}</p>
                                </div>
                                {(() => {
                                    const bound = organizations.filter(o => o.nc_instance_id);
                                    if (bound.length === 0) {
                                        return <div className="text-sm p-6 text-center rounded-xl border" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>{t('admin.nc_bindings_empty')}</div>;
                                    }
                                    return (
                                        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--border-default)' }}>
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                                        <th className="text-left font-medium px-4 py-2">{t('admin.nc_bindings_col_org')}</th>
                                                        <th className="text-left font-medium px-4 py-2">{t('admin.nc_bindings_col_url')}</th>
                                                        <th className="text-left font-medium px-4 py-2">{t('admin.nc_bindings_col_instance')}</th>
                                                        <th className="text-left font-medium px-4 py-2">{t('admin.nc_bindings_col_bound')}</th>
                                                        <th className="px-4 py-2"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bound.map(org => (
                                                        <tr key={org.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                                            <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>{org.name}<span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{org.id}</span></td>
                                                            <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{org.nc_base_url || '—'}</td>
                                                            <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{org.nc_instance_id}</td>
                                                            <td className="px-4 py-2" style={{ color: 'var(--text-muted)' }}>{org.nc_provisioned_at ? new Date(org.nc_provisioned_at).toLocaleDateString() : '—'}</td>
                                                            <td className="px-4 py-2 text-right whitespace-nowrap">
                                                                <button onClick={() => { if (onNavigate) onNavigate(`admin/security/connector-health/${org.id}`); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-teal-600 hover:bg-teal-500/10 font-medium"><Activity className="w-4 h-4" /> {t('admin.ch_health_link', 'Health')}</button>
                                                                <button onClick={() => handleRemoveNcBinding(org)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-600 hover:bg-amber-500/10 font-medium"><Unlink className="w-4 h-4" /> {t('admin.org_nc_remove_title')}</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Groups Section */}
                        {activeSection === 'groups' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-6">
                                    <div><h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Groups</h3><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Organize users and assign permissions</p></div>
                                    {canManageUsers && <button onClick={openAddGroup} className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium" style={{ background: 'var(--accent-primary)', color: 'white' }}><Shield className="w-4 h-4" /> Add Group</button>}
                                </div>
                                <div className="space-y-6">
                                    {/* Groups without organization */}
                                    {groups.filter(g => !g.organizationId).length > 0 && (
                                        <div className="space-y-4">
                                            <h4 className="font-medium text-sm uppercase tracking-wider pl-2" style={{ color: 'var(--text-muted)' }}>Global Groups</h4>
                                            <div className="grid gap-4">
                                                {groups.filter(g => !g.organizationId).map(group => (
                                                    <div key={group.id} className="p-4 rounded-xl border group hover:border-[var(--accent-primary)]" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139, 92, 246, 0.15)' }}><Shield className="w-5 h-5 text-purple-400" /></div>
                                                                <div><h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{group.name}</h4><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{group.description}</p></div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#a78bfa' }}>
                                                                    {users.filter(u => (u.groups || []).includes(group.id)).length} members
                                                                </span>
                                                                <div className="flex items-center gap-2 opacity-100 xl:opacity-0 xl:group-hover:opacity-100">
                                                                    <button onClick={() => openEditGroup(group)} className="p-1.5 rounded hover:bg-blue-500/10 text-blue-500"><Edit2 className="w-4 h-4" /></button>
                                                                    {group.id !== 'admins' && group.id !== 'users' && <button onClick={() => handleDeleteGroup(group.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-500"><Trash2 className="w-4 h-4" /></button>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {group.permissions?.map(p => <span key={p} className="text-xs px-2 py-1 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">{p}</span>)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Groups by organization */}
                                    {organizations.map(org => {
                                        const orgGroups = groups.filter(g => g.organizationId === org.id);
                                        if (orgGroups.length === 0) return null;
                                        return (
                                            <div key={org.id} className="space-y-4">
                                                <h4 className="font-medium text-sm uppercase tracking-wider pl-2 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></svg>
                                                    {org.name}
                                                </h4>
                                                <div className="grid gap-4">
                                                    {orgGroups.map(group => (
                                                        <div key={group.id} className="p-4 rounded-xl border group hover:border-[var(--accent-primary)] ml-4" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139, 92, 246, 0.15)' }}><Shield className="w-5 h-5 text-purple-400" /></div>
                                                                    <div><h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{group.name}</h4><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{group.description}</p></div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#a78bfa' }}>
                                                                        {users.filter(u => (u.groups || []).includes(group.id)).length} members
                                                                    </span>
                                                                    <div className="flex items-center gap-2 opacity-100 xl:opacity-0 xl:group-hover:opacity-100">
                                                                        <button onClick={() => openEditGroup(group)} className="p-1.5 rounded hover:bg-blue-500/10 text-blue-500"><Edit2 className="w-4 h-4" /></button>
                                                                        <button onClick={() => handleDeleteGroup(group.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-500"><Trash2 className="w-4 h-4" /></button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {group.permissions?.map(p => <span key={p} className="text-xs px-2 py-1 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">{p}</span>)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Roles Section */}
                        {activeSection === 'roles' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-6">
                                    <div><h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Roles</h3><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Define role templates with permissions</p></div>
                                    <button onClick={openAddRole} className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium" style={{ background: 'var(--accent-primary)', color: 'white' }}><Tag className="w-4 h-4" /> Add Role</button>
                                </div>
                                <div className="grid gap-4">
                                    {roles.map(role => (
                                        <div key={role.id} className="p-4 rounded-xl border group hover:border-[var(--accent-primary)]" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.15)' }}><Tag className="w-5 h-5 text-amber-400" /></div>
                                                    <div><h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{role.name}</h4><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{role.description}</p></div>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-100 xl:opacity-0 xl:group-hover:opacity-100">
                                                    <button onClick={() => openEditRole(role)} className="p-1.5 rounded hover:bg-blue-500/10 text-blue-500"><Edit2 className="w-4 h-4" /></button>
                                                    {role.id !== 'admin' && role.id !== 'user' && <button onClick={() => handleDeleteRole(role.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-500"><Trash2 className="w-4 h-4" /></button>}
                                                </div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {role.permissions?.map(p => <span key={p} className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">{p}</span>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Permissions Section */}
                        {activeSection === 'permissions' && (
                            <div className="space-y-4">
                                <div className="mb-6"><h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Permissions</h3><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Available permissions for roles and groups</p></div>
                                <div className="grid gap-3">
                                    {permissions.map(perm => (
                                        <div key={perm.id} className="p-4 rounded-xl border flex items-center justify-between" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.15)' }}><Key className="w-5 h-5 text-blue-400" /></div>
                                                <div><h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>{perm.name}</h4><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{perm.description}</p></div>
                                            </div>
                                            <code className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{perm.id}</code>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* My Organization Section (for org-scoped users) */}
                        {activeSection === 'my-organization' && (
                            !myOrg ? (
                                <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>No organization found</div>
                            ) : (
                                <div className="max-w-2xl">
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>My Organization</h3>
                                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Edit your organization's information</p>
                                    </div>
                                    <div className="space-y-4 p-6 rounded-2xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                        {/* Company Logo */}
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Company Logo</label>
                                            <div className="flex items-center gap-4">
                                                {orgData.logo && (
                                                    <img src={orgData.logo.startsWith('/') ? `${API_BASE}${orgData.logo}` : orgData.logo} alt="Logo" className="w-16 h-16 object-contain rounded-lg border" style={{ borderColor: 'var(--border-default)' }} />
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <label className="cursor-pointer px-4 py-2 rounded-lg font-medium text-sm" style={{ background: 'var(--accent-primary)', color: 'white' }}>
                                                        Upload Logo
                                                        <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={async (e) => {
                                                            const file = e.target.files[0];
                                                            if (!file || !orgData.id) return;
                                                            const formData = new FormData();
                                                            formData.append('logo', file);
                                                            try {
                                                                const res = await authFetch(`${API_BASE}/auth/organizations/${orgData.id}/logo`, { method: 'POST', body: formData });
                                                                if (res.ok) {
                                                                    const data = await res.json();
                                                                    setOrgData(p => ({ ...p, logo: data.logo }));
                                                                    setMessage({ type: 'success', text: 'Logo uploaded' });
                                                                }
                                                            } catch (err) { setMessage({ type: 'error', text: 'Upload failed' }); }
                                                        }} />
                                                    </label>
                                                    {orgData.logo && (
                                                        <button onClick={async () => {
                                                            if (orgData.id) {
                                                                await authFetch(`${API_BASE}/auth/organizations/${orgData.id}/logo`, { method: 'DELETE' });
                                                            }
                                                            setOrgData(p => ({ ...p, logo: '' }));
                                                        }} className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Remove</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Company Name</label><input type="text" value={orgData.name} onChange={e => setOrgData(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="Company Name" /></div>
                                        <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Company Details / Tagline</label><input type="text" value={orgData.tagline} onChange={e => setOrgData(p => ({ ...p, tagline: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /></div>
                                        <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Description</label><input type="text" value={orgData.description} onChange={e => setOrgData(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /></div>
                                        <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Address</label><input type="text" value={orgData.address} onChange={e => setOrgData(p => ({ ...p, address: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Email</label><input type="email" value={orgData.email} onChange={e => setOrgData(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /></div>
                                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Phone</label><input type="tel" value={orgData.phone} onChange={e => setOrgData(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /></div>
                                        </div>
                                        <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Website</label><input type="url" value={orgData.website} onChange={e => setOrgData(p => ({ ...p, website: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Chamber of Commerce</label><input type="text" value={orgData.kvk} onChange={e => setOrgData(p => ({ ...p, kvk: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /></div>
                                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>VAT Number</label><input type="text" value={orgData.vat} onChange={e => setOrgData(p => ({ ...p, vat: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} /></div>
                                        </div>
                                        <div className="flex justify-end pt-2">
                                            <button onClick={handleUpdateOrg} className="px-6 py-2 rounded-lg font-medium" style={{ background: 'var(--accent-primary)', color: 'white' }}>Save Changes</button>
                                        </div>
                                    </div>
                                </div>
                            )
                        )}
                    </>
                )}
            </div>

            {/* User Modal */}
            <Modal
                open={showAddUser || showEditUser}
                onClose={closeUserModal}
                title={showEditUser ? t('admin.sec_user_edit_title', 'Edit user') : t('admin.sec_user_add_title', 'Add new user')}
                size="md"
                footer={
                    <>
                        <button onClick={closeUserModal} className="px-4 py-2 rounded-lg font-medium text-[var(--text-secondary)]">
                            {t('admin.sec_cancel', 'Cancel')}
                        </button>
                        {(() => {
                            const canSubmit = showEditUser || (userData.username && userData.displayName && userData.password);
                            return (
                                <button
                                    onClick={showEditUser ? handleUpdateUser : handleAddUser}
                                    disabled={!canSubmit}
                                    className="px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--accent-primary)] text-white"
                                >
                                    {showEditUser ? t('admin.sec_save', 'Save') : t('admin.sec_user_add_submit', 'Add user')}
                                </button>
                            );
                        })()}
                    </>
                }
            >
                        <div className="space-y-4">
                            {/* Avatar Picker */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Avatar</label>
                                <div className="flex items-center gap-4">
                                    {/* Avatar preview */}
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden border-2" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-tertiary)' }}>
                                        {userData.avatarType === 'emoji' && userData.avatar ? (
                                            <span className="text-3xl">{userData.avatar}</span>
                                        ) : userData.avatarType === 'image' && userData.avatar ? (
                                            <img src={userData.avatar.startsWith('data:') || userData.avatar.startsWith('/') ? (userData.avatar.startsWith('/') ? `${API_BASE}${userData.avatar}` : userData.avatar) : userData.avatar} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xl font-semibold" style={{ color: 'var(--text-muted)' }}>{(userData.displayName?.[0] || '?').toUpperCase()}</span>
                                        )}
                                    </div>
                                    {/* Mode buttons */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${showEmojiPicker ? 'ring-2 ring-[var(--accent-primary)]' : ''}`} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                                                <Smile className="w-4 h-4" /> Emoji
                                            </button>
                                            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                                                <Image className="w-4 h-4" /> Upload
                                                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    if (showEditUser && userData.id) {
                                                        const formData = new FormData();
                                                        formData.append('avatar', file);
                                                        try {
                                                            const res = await authFetch(`${API_BASE}/auth/users/${userData.id}/avatar`, { method: 'POST', body: formData });
                                                            if (res.ok) {
                                                                const data = await res.json();
                                                                setUserData(p => ({ ...p, avatar: data.avatar, avatarType: 'image' }));
                                                                setMessage({ type: 'success', text: 'Avatar uploaded' });
                                                            }
                                                        } catch (err) { setMessage({ type: 'error', text: 'Upload failed' }); }
                                                    } else {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => setUserData(p => ({ ...p, avatar: ev.target.result, avatarType: 'image' }));
                                                        reader.readAsDataURL(file);
                                                    }
                                                    setShowEmojiPicker(false);
                                                }} />
                                            </label>
                                            {(userData.avatar) && (
                                                <button type="button" onClick={async () => {
                                                    if (showEditUser && userData.id && userData.avatarType === 'image') {
                                                        await authFetch(`${API_BASE}/auth/users/${userData.id}/avatar`, { method: 'DELETE' });
                                                    }
                                                    setUserData(p => ({ ...p, avatar: '', avatarType: '' }));
                                                    setShowEmojiPicker(false);
                                                }} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Remove</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* Emoji grid */}
                                {showEmojiPicker && (
                                    <div className="mt-3 p-3 rounded-lg border grid grid-cols-8 gap-1.5 max-h-40 overflow-auto" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                        {['😀', '😎', '🤖', '👨', '👩', '👤', '🧑‍💻', '👨‍💼', '👩‍💼', '🦸', '🧙', '👷', '🎅', '🐝', '🦊', '🐱', '🐶', '🐻', '🦁', '🐸', '🌟', '⭐', '🔥', '💡', '🎯', '🚀', '💻', '🛡️', '🎨', '📊', '🔧', '⚡'].map(emoji => (
                                            <button key={emoji} type="button" onClick={() => { setUserData(p => ({ ...p, avatar: emoji, avatarType: 'emoji' })); setShowEmojiPicker(false); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer" style={userData.avatar === emoji ? { background: 'var(--accent-primary)', opacity: 0.8 } : {}}>{emoji}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {!showEditUser && <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Username</label><input type="text" value={userData.username} onChange={e => setUserData(p => ({ ...p, username: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="johndoe" /></div>}
                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Display Name</label><input type="text" value={userData.displayName} onChange={e => setUserData(p => ({ ...p, displayName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="John Doe" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>First Name</label><input type="text" value={userData.firstName} onChange={e => setUserData(p => ({ ...p, firstName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="John" /></div>
                                <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Last Name</label><input type="text" value={userData.lastName} onChange={e => setUserData(p => ({ ...p, lastName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="Doe" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Email</label><input type="email" value={userData.email} onChange={e => setUserData(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="john@example.com" /></div>
                                <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Phone</label><input type="tel" value={userData.phone} onChange={e => setUserData(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="+1 555 123 4567" /></div>
                            </div>
                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{showEditUser ? 'New Password (blank to keep)' : 'Password'}</label><input type="password" value={userData.password} onChange={e => setUserData(p => ({ ...p, password: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="••••••••" /></div>
                            {/* ── Organisation Assignment ── */}
                            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-primary)' }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Building className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                                    <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Organisation Assignment</label>
                                </div>

                                {/* Org selector */}
                                <div className="mb-3">
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Organisation</label>
                                    <div className="relative">
                                        <select
                                            value={userData.organizationId || ''}
                                            onChange={e => {
                                                const newOrgId = e.target.value;
                                                // When org changes, auto-assign to org's default groups
                                                const orgGroups = groups.filter(g => g.organizationId === newOrgId);
                                                const otherGroups = (userData.groups || []).filter(gid => {
                                                    const g = groups.find(gr => gr.id === gid);
                                                    return !g?.organizationId; // keep non-org groups
                                                });
                                                const newGroups = newOrgId
                                                    ? [...otherGroups, ...(orgGroups.length > 0 ? [orgGroups[0].id] : [])]
                                                    : otherGroups;
                                                setUserData(p => ({ ...p, organizationId: newOrgId, groups: newGroups, orgRole: newOrgId ? (p.orgRole || 'member') : '' }));
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none appearance-none cursor-pointer focus:border-[var(--accent-primary)]"
                                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="">— No organisation —</option>
                                            {organizations.map(org => (
                                                <option key={org.id} value={org.id}>{org.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                </div>

                                {/* Org role selector */}
                                {userData.organizationId && (
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Organisation Role</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {ORG_ROLES.map(r => {
                                                const isSelected = userData.orgRole === r.id;
                                                return (
                                                    <button
                                                        key={r.id}
                                                        type="button"
                                                        onClick={() => setUserData(p => ({ ...p, orgRole: r.id }))}
                                                        className={`flex items-start gap-2 p-2.5 rounded-lg border-2 text-left transition-all ${isSelected ? 'border-[var(--accent-primary)]' : 'border-[var(--border-default)] hover:border-[var(--accent-primary)]/40'}`}
                                                        style={{ background: isSelected ? `${r.color}08` : 'transparent' }}
                                                    >
                                                        <div className={`w-3 h-3 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${isSelected ? 'border-[var(--accent-primary)]' : 'border-[var(--border-default)]'}`}>
                                                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />}
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-semibold" style={{ color: isSelected ? r.color : 'var(--text-primary)' }}>{r.label}</div>
                                                            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{r.description}</div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {!userData.organizationId && (
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Select an organisation to assign this user and set their role.</p>
                                )}
                            </div>

                            {/* ── Groups ── */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Groups</label>
                                <div className="max-h-48 overflow-auto p-2 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                    {/* Global Groups */}
                                    {groups.filter(g => !g.organizationId).length > 0 && (
                                        <div className="mb-2">
                                            <div className="text-xs font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: 'var(--text-muted)' }}>Global Groups</div>
                                            <div className="space-y-0.5">
                                                {groups.filter(g => !g.organizationId).map(g => (
                                                    <label key={g.id} className="flex items-center gap-2.5 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                                                        <input type="checkbox" checked={(userData.groups || []).includes(g.id)} onChange={e => setUserData(prev => ({ ...prev, groups: e.target.checked ? [...(prev.groups || []), g.id] : (prev.groups || []).filter(x => x !== g.id) }))} className="accent-[var(--accent-primary)] w-4 h-4" />
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>{g.name}</span>
                                                            {g.description && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.description}</span>}
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* Groups by organization */}
                                    {organizations.map(org => {
                                        const orgGroups = groups.filter(g => g.organizationId === org.id);
                                        if (orgGroups.length === 0) return null;
                                        return (
                                            <div key={org.id} className="mb-2">
                                                <div className="text-xs font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: 'var(--text-muted)' }}>{org.name}</div>
                                                <div className="space-y-0.5">
                                                    {orgGroups.map(g => (
                                                        <label key={g.id} className="flex items-center gap-2.5 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                                                            <input type="checkbox" checked={(userData.groups || []).includes(g.id)} onChange={e => setUserData(prev => ({ ...prev, groups: e.target.checked ? [...(prev.groups || []), g.id] : (prev.groups || []).filter(x => x !== g.id) }))} className="accent-[var(--accent-primary)] w-4 h-4" />
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>{g.name}</span>
                                                                {g.description && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.description}</span>}
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {groups.length === 0 && <p className="text-sm px-2 py-1" style={{ color: 'var(--text-muted)' }}>No groups available</p>}
                                </div>
                            </div>
                        </div>
            </Modal>

            {/* Organization Modal */}
            <Modal
                open={showAddOrg || showEditOrg}
                onClose={closeOrgModal}
                title={showEditOrg ? t('admin.sec_org_edit_title', 'Edit organisation') : t('admin.sec_org_add_title', 'Add new organisation')}
                size="lg"
                footer={
                    <>
                        <button onClick={closeOrgModal} className="px-4 py-2 rounded-lg font-medium text-[var(--text-secondary)]">
                            {t('admin.sec_cancel', 'Cancel')}
                        </button>
                        <button
                            onClick={showEditOrg ? handleUpdateOrg : handleAddOrg}
                            className="px-4 py-2 rounded-lg font-medium bg-[var(--accent-primary)] text-white"
                        >
                            {showEditOrg ? t('admin.sec_save', 'Save') : t('admin.sec_org_add_submit', 'Add organisation')}
                        </button>
                    </>
                }
            >
                        <div className="space-y-4">
                            {/* Company Logo */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Company Logo</label>
                                <div className="flex items-center gap-4">
                                    {orgData.logo && (
                                        <img src={orgData.logo.startsWith('/') ? `${API_BASE}${orgData.logo}` : orgData.logo} alt="Logo" className="w-16 h-16 object-contain rounded-lg border" style={{ borderColor: 'var(--border-default)' }} />
                                    )}
                                    <div className="flex items-center gap-2">
                                        <label className="cursor-pointer px-4 py-2 rounded-lg font-medium text-sm" style={{ background: 'var(--accent-primary)', color: 'white' }}>
                                            Upload Logo
                                            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                // Need org ID — for new orgs, save first then upload
                                                if (!orgData.id && !showEditOrg) {
                                                    // Preview locally for new orgs
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => setOrgData(p => ({ ...p, logo: ev.target.result, _logoFile: file }));
                                                    reader.readAsDataURL(file);
                                                    return;
                                                }
                                                const formData = new FormData();
                                                formData.append('logo', file);
                                                try {
                                                    const res = await authFetch(`${API_BASE}/auth/organizations/${orgData.id}/logo`, {
                                                        method: 'POST', body: formData
                                                    });
                                                    if (res.ok) {
                                                        const data = await res.json();
                                                        setOrgData(p => ({ ...p, logo: data.logo }));
                                                        setMessage({ type: 'success', text: 'Logo uploaded' });
                                                    }
                                                } catch (err) { setMessage({ type: 'error', text: 'Upload failed' }); }
                                            }} />
                                        </label>
                                        {orgData.logo && (
                                            <button onClick={async () => {
                                                if (orgData.id) {
                                                    await authFetch(`${API_BASE}/auth/organizations/${orgData.id}/logo`, { method: 'DELETE' });
                                                }
                                                setOrgData(p => ({ ...p, logo: '', _logoFile: null }));
                                            }} className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Remove</button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Recommended: PNG or SVG, max 500x200px</p>
                            </div>
                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Company Name</label><input type="text" value={orgData.name} onChange={e => setOrgData(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="Bee Flow B.V." /></div>
                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Company Details / Tagline</label><input type="text" value={orgData.tagline} onChange={e => setOrgData(p => ({ ...p, tagline: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="Intelligence in Action. Results That Stick" /></div>
                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Description</label><input type="text" value={orgData.description} onChange={e => setOrgData(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="Main organization" /></div>
                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Address</label><input type="text" value={orgData.address} onChange={e => setOrgData(p => ({ ...p, address: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="123 Main Street" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Email</label><input type="email" value={orgData.email} onChange={e => setOrgData(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="info@company.com" /></div>
                                <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Phone</label><input type="tel" value={orgData.phone} onChange={e => setOrgData(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="+1 555 123 4567" /></div>
                            </div>
                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Website</label><input type="url" value={orgData.website} onChange={e => setOrgData(p => ({ ...p, website: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="www.beeflow.nl" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Chamber of Commerce</label><input type="text" value={orgData.kvk} onChange={e => setOrgData(p => ({ ...p, kvk: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="12345678" /></div>
                                <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>VAT Number</label><input type="text" value={orgData.vat} onChange={e => setOrgData(p => ({ ...p, vat: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="XX123456789" /></div>
                            </div>
                            <div>
                                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                    <input type="checkbox" checked={orgData.allowSignup || false} onChange={e => setOrgData(p => ({ ...p, allowSignup: e.target.checked }))} className="accent-[var(--accent-primary)] w-4 h-4" />
                                    <div>
                                        <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>Allow Public Signup</span>
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Users can register themselves for this organization</span>
                                    </div>
                                </label>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Default Groups</label>
                                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>New users will be automatically assigned to these groups</p>
                                <div className="max-h-40 overflow-auto p-2 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                    {groups.filter(g => !g.organizationId || g.organizationId === orgData.id).map(g => (
                                        <label key={g.id} className="flex items-center gap-2.5 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                                            <input type="checkbox" checked={(orgData.defaultGroups || []).includes(g.id)} onChange={e => setOrgData(prev => ({ ...prev, defaultGroups: e.target.checked ? [...(prev.defaultGroups || []), g.id] : (prev.defaultGroups || []).filter(x => x !== g.id) }))} className="accent-[var(--accent-primary)] w-4 h-4" />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>{g.name}</span>
                                                {g.description && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.description}</span>}
                                            </div>
                                        </label>
                                    ))}
                                    {groups.length === 0 && <p className="text-sm px-2 py-1" style={{ color: 'var(--text-muted)' }}>No groups available. Create groups first.</p>}
                                </div>
                            </div>
                            {/* Enabled Integrations (Super Admin only) */}
                            {isFullAdmin && showEditOrg && (
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Enabled Integrations</label>
                                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Control which integrations are available for this organization. Deselect all then re-select to customize.</p>
                                    <div className="flex items-center gap-2 mb-3">
                                        <button
                                            onClick={() => setOrgData(p => ({ ...p, enabledIntegrations: null }))}
                                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${orgData.enabledIntegrations === null ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
                                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                                        >All Enabled</button>
                                        <button
                                            onClick={() => setOrgData(p => ({ ...p, enabledIntegrations: p.enabledIntegrations === null ? ALL_INTEGRATIONS.map(i => i.id) : p.enabledIntegrations }))}
                                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${orgData.enabledIntegrations !== null ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
                                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                                        >Custom</button>
                                    </div>
                                    {orgData.enabledIntegrations !== null && (
                                        <div className="grid grid-cols-2 gap-2 p-2 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                            {ALL_INTEGRATIONS.map(integ => {
                                                const isOn = (orgData.enabledIntegrations || []).includes(integ.id);
                                                return (
                                                    <label key={integ.id} className="flex items-center gap-2.5 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                                                        <input type="checkbox" checked={isOn} onChange={e => {
                                                            setOrgData(prev => ({
                                                                ...prev,
                                                                enabledIntegrations: e.target.checked
                                                                    ? [...(prev.enabledIntegrations || []), integ.id]
                                                                    : (prev.enabledIntegrations || []).filter(x => x !== integ.id)
                                                            }));
                                                        }} className="accent-[var(--accent-primary)] w-4 h-4" />
                                                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{integ.label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
            </Modal>

            {/* Group Modal */}
            <Modal
                open={showAddGroup || showEditGroup}
                onClose={closeGroupModal}
                title={showEditGroup ? t('admin.sec_group_edit_title', 'Edit group') : t('admin.sec_group_add_title', 'Add new group')}
                size="md"
                footer={
                    <>
                        <button onClick={closeGroupModal} className="px-4 py-2 rounded-lg font-medium text-[var(--text-secondary)]">
                            {t('admin.sec_cancel', 'Cancel')}
                        </button>
                        <button
                            onClick={showEditGroup ? handleUpdateGroup : handleAddGroup}
                            className="px-4 py-2 rounded-lg font-medium bg-[var(--accent-primary)] text-white"
                        >
                            {showEditGroup ? t('admin.sec_save', 'Save') : t('admin.sec_group_add_submit', 'Add group')}
                        </button>
                    </>
                }
            >
                        <div className="space-y-4">
                            {!showEditGroup && <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Group Name</label><input type="text" value={groupData.name} onChange={e => setGroupData(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="Editors" /></div>}

                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Organization</label>
                                <select
                                    value={groupData.organizationId || ''}
                                    onChange={e => setGroupData(p => ({ ...p, organizationId: e.target.value || '' }))}
                                    className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]"
                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                >
                                    <option value="" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>None (Global Group)</option>
                                    {organizations.map(org => (
                                        <option key={org.id} value={org.id} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{org.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Description</label><input type="text" value={groupData.description} onChange={e => setGroupData(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="Can edit agents" /></div>
                            <div><label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Permissions</label>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto p-2 rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
                                    {permissions.filter(p => isFullAdmin || (currentUser?.permissions || []).includes(p.id)).map(p => (
                                        <label key={p.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-[var(--bg-tertiary)] rounded">
                                            <input type="checkbox" checked={groupData.permissions.includes(p.id)} onChange={e => setGroupData(prev => ({ ...prev, permissions: e.target.checked ? [...prev.permissions, p.id] : prev.permissions.filter(x => x !== p.id) }))} className="accent-[var(--accent-primary)]" />
                                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div><label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Assigned Roles</label>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto p-2 rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
                                    {roles.filter(r => isFullAdmin || (r.permissions || []).every(rp => (currentUser?.permissions || []).includes(rp))).map(r => (
                                        <label key={r.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-[var(--bg-tertiary)] rounded">
                                            <input type="checkbox" checked={groupData.roles?.includes(r.id)} onChange={e => setGroupData(prev => ({ ...prev, roles: e.target.checked ? [...(prev.roles || []), r.id] : (prev.roles || []).filter(x => x !== r.id) }))} className="accent-[var(--accent-primary)]" />
                                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div><label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Allowed Agent Types</label>
                                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Leave all unchecked to allow all types</p>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto p-2 rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
                                    {[
                                        { id: 'chat', name: 'Chat Agents' },
                                    ].map(t => (
                                        <label key={t.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-[var(--bg-tertiary)] rounded">
                                            <input type="checkbox" checked={(groupData.allowedAgentTypes || []).includes(t.id)} onChange={e => setGroupData(prev => ({ ...prev, allowedAgentTypes: e.target.checked ? [...(prev.allowedAgentTypes || []), t.id] : (prev.allowedAgentTypes || []).filter(x => x !== t.id) }))} className="accent-[var(--accent-primary)]" />
                                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
            </Modal>

            {/* Role Modal */}
            <Modal
                open={showAddRole || showEditRole}
                onClose={closeRoleModal}
                title={showEditRole ? t('admin.sec_role_edit_title', 'Edit role') : t('admin.sec_role_add_title', 'Add new role')}
                size="lg"
                footer={
                    <>
                        <button onClick={closeRoleModal} className="px-4 py-2 rounded-lg font-medium text-[var(--text-secondary)]">
                            {t('admin.sec_cancel', 'Cancel')}
                        </button>
                        <button
                            onClick={showEditRole ? handleUpdateRole : handleAddRole}
                            className="px-4 py-2 rounded-lg font-medium bg-[var(--accent-primary)] text-white"
                        >
                            {showEditRole ? t('admin.sec_save', 'Save') : t('admin.sec_role_add_submit', 'Add role')}
                        </button>
                    </>
                }
            >
                        <div className="space-y-4">
                            {!showEditRole && <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Role Name</label><input type="text" value={roleData.name} onChange={e => setRoleData(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="Editor" /></div>}
                            <div><label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Description</label><input type="text" value={roleData.description} onChange={e => setRoleData(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} placeholder="Can edit content" /></div>
                            <div><label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Permissions</label>
                                <div className="space-y-3 max-h-60 overflow-auto p-3 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                    {/* Group permissions by their group field */}
                                    {[
                                        { key: 'pages', label: '📄 Pages', color: '#3b82f6' },
                                        { key: 'admin', label: '🛡️ Admin Pages', color: '#8b5cf6' },
                                        { key: 'actions', label: '⚡ Actions', color: '#f59e0b' },
                                        { key: 'super', label: '🔑 Super', color: '#ef4444' },
                                    ].map(group => {
                                        const groupPerms = permissions.filter(p => p.group === group.key);
                                        if (groupPerms.length === 0) return null;
                                        return (
                                            <div key={group.key}>
                                                <div className="text-xs font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: group.color }}>{group.label}</div>
                                                <div className="space-y-0.5">
                                                    {groupPerms.map(p => (
                                                        <label key={p.id} className="flex items-center gap-2.5 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                                                            <input type="checkbox" checked={roleData.permissions.includes(p.id)} onChange={e => setRoleData(prev => ({ ...prev, permissions: e.target.checked ? [...prev.permissions, p.id] : prev.permissions.filter(x => x !== p.id) }))} className="accent-[var(--accent-primary)] w-4 h-4" />
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                                                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.description}</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
            </Modal>

            <ConfirmDialog
                open={!!confirmState}
                title={confirmState?.title || ''}
                description={confirmState?.description}
                confirmLabel={confirmState?.confirmLabel}
                cancelLabel={t('admin.sec_cancel', 'Cancel')}
                destructive={confirmState?.destructive}
                onConfirm={async () => {
                    const action = confirmState?.onConfirm;
                    setConfirmState(null);
                    if (action) await action();
                }}
                onCancel={() => setConfirmState(null)}
            />
        </div>
    );
};

export default UserManagement;
