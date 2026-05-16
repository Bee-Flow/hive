import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft, Plus, Trash2, Users, UserPlus, FolderOpen, Share2, Database, ChevronDown, ChevronRight,
    FileText, Globe, Paperclip, Brain, Activity, AlertTriangle, Save, Pencil,
} from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import MemoryPanel from './MemoryPanel';

// Pairs of (hex, screen-reader name) so the colour picker announces a real
// colour instead of the literal hex digits.
const COLORS = [
    { hex: '#6366f1', label: 'Indigo' },
    { hex: '#8b5cf6', label: 'Violet' },
    { hex: '#ec4899', label: 'Pink' },
    { hex: '#f43f5e', label: 'Rose' },
    { hex: '#f97316', label: 'Orange' },
    { hex: '#eab308', label: 'Amber' },
    { hex: '#22c55e', label: 'Green' },
    { hex: '#14b8a6', label: 'Teal' },
    { hex: '#06b6d4', label: 'Cyan' },
    { hex: '#3b82f6', label: 'Blue' },
];

const ICONS = [
    { emoji: '📁', label: 'Folder' },
    { emoji: '🚀', label: 'Rocket' },
    { emoji: '💡', label: 'Lightbulb' },
    { emoji: '🎯', label: 'Target' },
    { emoji: '📊', label: 'Chart' },
    { emoji: '🔬', label: 'Microscope' },
    { emoji: '🎨', label: 'Palette' },
    { emoji: '📝', label: 'Notepad' },
    { emoji: '🏗️', label: 'Construction' },
    { emoji: '⚡', label: 'Bolt' },
    { emoji: '🌟', label: 'Star' },
    { emoji: '🔧', label: 'Wrench' },
];

// Mirror of the backend caps in server/routes/projects.js so the UI gives
// immediate feedback rather than waiting for a 400.
const MAX_NAME = 120;
const MAX_DESCRIPTION = 1000;
const MAX_INSTRUCTIONS = 8000;
const ACTIVITY_PAGE_SIZE = 50;
// Accept both UUID v1-5 and the more permissive crypto.randomUUID v4 format.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TABS = [
    { id: 'general', label: 'General', icon: FolderOpen },
    { id: 'knowledge', label: 'Knowledge', icon: Database },
    { id: 'members', label: 'Members', icon: Share2 },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'danger', label: 'Danger', icon: AlertTriangle },
];

const roleLabel = (perm) => {
    if (perm === 'owner') return 'Owner';
    if (perm === 'editor') return 'Editor';
    return 'Viewer';
};

function formatRelative(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const sec = Math.round(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.round(hr / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
}

export default function ProjectDetailPage({ projectId, user, onClose, onSaved, onDeleted }) {
    const isCreate = !projectId;
    const [project, setProject] = useState(null);
    const [role, setRole] = useState('owner'); // for new projects, current user is the owner
    const [loading, setLoading] = useState(!isCreate);
    const [tab, setTab] = useState('general');

    // ── form state ────────────────────────────────────────────
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [customInstructions, setCustomInstructions] = useState('');
    const [extractMemories, setExtractMemories] = useState(false);
    const [color, setColor] = useState('#6366f1');
    const [icon, setIcon] = useState('📁');
    const [knowledgeBaseIds, setKnowledgeBaseIds] = useState([]);
    const [editingName, setEditingName] = useState(false);

    // Track the last saved snapshot so we can compute "dirty" state.
    const savedSnapshot = useRef({ name: '', description: '', customInstructions: '', extractMemories: false, color: '#6366f1', icon: '📁', knowledgeBaseIds: [] });

    // ── members ───────────────────────────────────────────────
    const [members, setMembers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [allGroups, setAllGroups] = useState([]);
    const [inviteType, setInviteType] = useState('user');
    const [inviteId, setInviteId] = useState('');
    const [invitePermission, setInvitePermission] = useState('viewer');
    // Surface API failures to the user instead of swallowing them into console.
    const [memberError, setMemberError] = useState('');
    const [inviting, setInviting] = useState(false);

    // ── KBs ───────────────────────────────────────────────────
    const [availableKBs, setAvailableKBs] = useState([]);
    const [showCreateKB, setShowCreateKB] = useState(false);
    const [newKBName, setNewKBName] = useState('');
    const [newKBDesc, setNewKBDesc] = useState('');
    const [creatingKB, setCreatingKB] = useState(false);
    const [selectedKB, setSelectedKB] = useState(null);
    const [kbDocs, setKbDocs] = useState([]);
    const [kbInputMode, setKbInputMode] = useState('text');
    const [kbTextContent, setKbTextContent] = useState('');
    const [kbTextTitle, setKbTextTitle] = useState('');
    const [kbUrlInput, setKbUrlInput] = useState('');
    const [kbIngesting, setKbIngesting] = useState(false);
    const [kbIngestStatus, setKbIngestStatus] = useState('');

    // ── activity ──────────────────────────────────────────────
    const [activity, setActivity] = useState([]);
    const [activityHasMore, setActivityHasMore] = useState(false);
    const [activityLoadingMore, setActivityLoadingMore] = useState(false);

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const isOwner = role === 'owner';
    const canEdit = role === 'owner' || role === 'editor';

    // ── load project (edit mode) ──────────────────────────────
    useEffect(() => {
        if (isCreate) {
            // Initialize form for create mode
            setLoading(false);
            savedSnapshot.current = { name: '', description: '', customInstructions: '', extractMemories: false, color: '#6366f1', icon: '📁', knowledgeBaseIds: [] };
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/projects/${projectId}`);
                if (!res.ok) {
                    setSaveError('Could not load project');
                    setLoading(false);
                    return;
                }
                const data = await res.json();
                if (cancelled) return;
                setProject(data);
                setName(data.name || '');
                setDescription(data.description || '');
                setCustomInstructions(data.customInstructions || '');
                setExtractMemories(!!data.extractMemories);
                setColor(data.color || '#6366f1');
                setIcon(data.icon || '📁');
                setKnowledgeBaseIds(data.knowledgeBaseIds || []);
                setRole(data.role || 'viewer');
                savedSnapshot.current = {
                    name: data.name || '',
                    description: data.description || '',
                    customInstructions: data.customInstructions || '',
                    extractMemories: !!data.extractMemories,
                    color: data.color || '#6366f1',
                    icon: data.icon || '📁',
                    knowledgeBaseIds: data.knowledgeBaseIds || [],
                };
                setLoading(false);
            } catch (e) {
                if (!cancelled) {
                    setSaveError(e.message || 'Failed to load');
                    setLoading(false);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [projectId, isCreate]);

    // ── load KBs ──────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/kb`);
                if (res.ok) setAvailableKBs(await res.json());
            } catch (e) { /* ignore */ }
        })();
    }, []);

    // ── load users & groups for invite dropdowns (best-effort) ─
    const loadUsersAndGroups = async () => {
        try {
            const [uRes, gRes] = await Promise.all([
                authFetch(`${API_BASE}/auth/users`),
                authFetch(`${API_BASE}/auth/groups`),
            ]);
            if (uRes.ok) setAllUsers(await uRes.json());
            if (gRes.ok) setAllGroups(await gRes.json());
        } catch (e) { /* non-admin users may not have access — fall back to ID input */ }
    };
    useEffect(() => { loadUsersAndGroups(); }, []);
    // Re-fetch when entering the Members tab so admin changes made elsewhere
    // (a freshly created user, a renamed group) show up without a page reload.
    useEffect(() => {
        if (tab === 'members' && !isCreate) loadUsersAndGroups();
    }, [tab, isCreate]);

    // ── load members ──────────────────────────────────────────
    const refreshMembers = async () => {
        if (isCreate) return;
        try {
            const res = await authFetch(`${API_BASE}/api/projects/${projectId}/members`);
            if (res.ok) {
                const data = await res.json();
                setMembers(data.members || []);
            }
        } catch (e) { /* ignore */ }
    };
    useEffect(() => { refreshMembers(); }, [projectId]);

    // ── activity polling (only when tab is active) ────────────
    useEffect(() => {
        if (isCreate || tab !== 'activity' || !projectId) return;
        let cancelled = false;
        const fetchActivity = async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const res = await authFetch(`${API_BASE}/api/projects/${projectId}/activity?limit=${ACTIVITY_PAGE_SIZE}&offset=0`);
                if (res.ok && !cancelled) {
                    const data = await res.json();
                    // Backend returns { items, hasMore } now, but tolerate older
                    // deployments that still return a bare array.
                    if (Array.isArray(data)) {
                        setActivity(data);
                        setActivityHasMore(data.length >= ACTIVITY_PAGE_SIZE);
                    } else {
                        setActivity(data.items || []);
                        setActivityHasMore(!!data.hasMore);
                    }
                }
            } catch (e) { /* ignore */ }
        };
        fetchActivity();
        const id = setInterval(fetchActivity, 15000);
        return () => { cancelled = true; clearInterval(id); };
    }, [tab, projectId, isCreate]);

    const loadMoreActivity = async () => {
        if (activityLoadingMore || !activityHasMore) return;
        setActivityLoadingMore(true);
        try {
            const res = await authFetch(`${API_BASE}/api/projects/${projectId}/activity?limit=${ACTIVITY_PAGE_SIZE}&offset=${activity.length}`);
            if (res.ok) {
                const data = await res.json();
                const items = Array.isArray(data) ? data : (data.items || []);
                const hasMore = Array.isArray(data) ? items.length >= ACTIVITY_PAGE_SIZE : !!data.hasMore;
                setActivity(prev => [...prev, ...items]);
                setActivityHasMore(hasMore);
            }
        } catch (e) { /* ignore */ }
        finally { setActivityLoadingMore(false); }
    };

    // ── KB doc fetch when expanding ──────────────────────────
    useEffect(() => {
        if (!selectedKB) { setKbDocs([]); return; }
        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/documents`);
                if (res.ok && !cancelled) setKbDocs(await res.json());
            } catch (e) { /* ignore */ }
        })();
        return () => { cancelled = true; };
    }, [selectedKB?.id]);

    // ── dirty state ──────────────────────────────────────────
    const isDirty = useMemo(() => {
        const s = savedSnapshot.current;
        if (s.name !== name) return true;
        if (s.description !== description) return true;
        if (s.customInstructions !== customInstructions) return true;
        if (s.extractMemories !== extractMemories) return true;
        if (s.color !== color) return true;
        if (s.icon !== icon) return true;
        const aKb = s.knowledgeBaseIds || [];
        const bKb = knowledgeBaseIds || [];
        if (aKb.length !== bKb.length) return true;
        const aSet = new Set(aKb);
        for (const id of bKb) if (!aSet.has(id)) return true;
        return false;
    }, [name, description, customInstructions, extractMemories, color, icon, knowledgeBaseIds]);

    // ── save ──────────────────────────────────────────────────
    const handleSave = async () => {
        if (!name.trim()) { setSaveError('Name is required'); return; }
        if (!canEdit) { setSaveError('You do not have permission to edit'); return; }
        setSaving(true); setSaveError('');
        try {
            const body = {
                name: name.trim(),
                description,
                customInstructions,
                color, icon,
                knowledgeBaseIds,
                extractMemories,
            };
            const url = isCreate ? `${API_BASE}/api/projects` : `${API_BASE}/api/projects/${projectId}`;
            const method = isCreate ? 'POST' : 'PUT';
            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setSaveError(err.error || 'Save failed');
                return;
            }
            const data = await res.json();
            savedSnapshot.current = {
                name: data.name || '',
                description: data.description || '',
                customInstructions: data.customInstructions || '',
                extractMemories: !!data.extractMemories,
                color: data.color || '#6366f1',
                icon: data.icon || '📁',
                knowledgeBaseIds: data.knowledgeBaseIds || [],
            };
            onSaved?.(data);
            if (isCreate && data.id) {
                // Tell the parent to switch to the new project's edit page.
                // Parent decides whether to update activeProjectId state.
                onSaved?.(data);
            }
        } catch (e) {
            setSaveError(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    // ── delete ────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!isOwner || isCreate) return;
        if (!window.confirm('Delete this project? Conversations will be unassigned but not deleted.')) return;
        try {
            const res = await authFetch(`${API_BASE}/api/projects/${projectId}`, { method: 'DELETE' });
            if (res.ok) onDeleted?.(projectId);
        } catch (e) { setSaveError(e.message); }
    };

    // ── members ──────────────────────────────────────────────
    const inviteMember = async () => {
        if (!inviteId || inviting) return;
        // When the admin lists aren't available the field becomes a free-text
        // input — reject obvious typos client-side so we don't waste a 400.
        const idIsKnown = (inviteType === 'user' ? allUsers : allGroups).some(x => x.id === inviteId);
        if (!idIsKnown && !UUID_RE.test(inviteId.trim())) {
            setMemberError('Invalid ID. Expected a UUID.');
            return;
        }
        setMemberError('');
        setInviting(true);
        try {
            const res = await authFetch(`${API_BASE}/api/projects/${projectId}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sharedWithType: inviteType, sharedWithId: inviteId.trim(), permission: invitePermission }),
            });
            if (res.ok) {
                const data = await res.json();
                setMembers(data.shares || []);
                setInviteId('');
            } else {
                const err = await res.json().catch(() => ({}));
                setMemberError(err.error || 'Invite failed');
            }
        } catch (e) {
            setMemberError(e.message || 'Invite failed');
        } finally {
            setInviting(false);
        }
    };

    const changeMemberRole = async (memberId, newRole) => {
        setMemberError('');
        try {
            const res = await authFetch(`${API_BASE}/api/projects/${projectId}/members/${memberId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });
            if (res.ok) {
                refreshMembers();
            } else {
                const err = await res.json().catch(() => ({}));
                setMemberError(err.error || 'Role change failed');
            }
        } catch (e) { setMemberError(e.message || 'Role change failed'); }
    };

    const removeMember = async (memberId) => {
        setMemberError('');
        try {
            const res = await authFetch(`${API_BASE}/api/projects/${projectId}/members/${memberId}`, { method: 'DELETE' });
            if (res.ok) {
                refreshMembers();
            } else {
                const err = await res.json().catch(() => ({}));
                setMemberError(err.error || 'Remove failed');
            }
        } catch (e) { setMemberError(e.message || 'Remove failed'); }
    };

    const resolveSubject = (m) => {
        if (m.sharedWithType === 'user') {
            const u = allUsers.find(u => u.id === m.sharedWithId);
            return u ? (u.displayName || u.username || m.sharedWithId) : m.sharedWithId;
        }
        const g = allGroups.find(g => g.id === m.sharedWithId);
        return g ? g.name : m.sharedWithId;
    };

    // ── KB helpers ───────────────────────────────────────────
    const toggleKBLink = (kbId) => {
        setKnowledgeBaseIds(prev =>
            prev.includes(kbId) ? prev.filter(id => id !== kbId) : [...prev, kbId]
        );
    };

    const reloadKBs = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/kb`);
            if (res.ok) setAvailableKBs(await res.json());
        } catch (e) { /* ignore */ }
    };

    const createKB = async () => {
        if (!newKBName.trim()) return;
        setCreatingKB(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKBName, description: newKBDesc }),
            });
            if (res.ok) {
                const kb = await res.json();
                setNewKBName(''); setNewKBDesc(''); setShowCreateKB(false);
                await reloadKBs();
                setSelectedKB(kb);
                setKnowledgeBaseIds(prev => [...prev, kb.id]);
            }
        } catch (e) { console.error('Failed to create KB:', e); }
        finally { setCreatingKB(false); }
    };

    const reloadDocs = async () => {
        if (!selectedKB) return;
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/documents`);
            if (res.ok) setKbDocs(await res.json());
        } catch (e) { /* ignore */ }
    };

    const ingestText = async () => {
        if (!selectedKB || !kbTextContent.trim()) return;
        setKbIngesting(true); setKbIngestStatus('Processing...');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/ingest/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: kbTextContent, title: kbTextTitle || 'Text' }),
            });
            if (res.ok) {
                setKbTextContent(''); setKbTextTitle(''); setKbIngestStatus('');
                await reloadDocs(); await reloadKBs();
            } else {
                const err = await res.json().catch(() => ({}));
                setKbIngestStatus('Error: ' + (err.error || 'failed'));
            }
        } catch (e) { setKbIngestStatus('Failed: ' + e.message); }
        finally { setKbIngesting(false); }
    };

    const ingestUrl = async () => {
        if (!selectedKB || !kbUrlInput.trim()) return;
        setKbIngesting(true); setKbIngestStatus('Fetching URL...');
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/ingest/url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: kbUrlInput.trim() }),
            });
            if (res.ok) {
                setKbUrlInput(''); setKbIngestStatus('');
                await reloadDocs(); await reloadKBs();
            } else {
                const err = await res.json().catch(() => ({}));
                setKbIngestStatus('Error: ' + (err.error || 'failed'));
            }
        } catch (e) { setKbIngestStatus('Failed: ' + e.message); }
        finally { setKbIngesting(false); }
    };

    const ingestFile = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedKB) return;
        setKbIngesting(true); setKbIngestStatus('Uploading...');
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/ingest/file`, {
                method: 'POST', body: fd,
            });
            if (res.ok) {
                setKbIngestStatus('');
                await reloadDocs(); await reloadKBs();
            } else {
                const err = await res.json().catch(() => ({}));
                setKbIngestStatus('Error: ' + (err.error || 'failed'));
            }
        } catch (e2) { setKbIngestStatus('Failed: ' + e2.message); }
        finally { setKbIngesting(false); e.target.value = ''; }
    };

    const deleteDoc = async (docId) => {
        if (!selectedKB || !window.confirm('Delete this document?')) return;
        try {
            await authFetch(`${API_BASE}/api/kb/${selectedKB.id}/documents/${docId}`, { method: 'DELETE' });
            await reloadDocs(); await reloadKBs();
        } catch (e) { /* ignore */ }
    };

    // ── activity row formatter ────────────────────────────────
    const formatActivity = (item) => {
        const actorName = (() => {
            const u = allUsers.find(u => u.id === item.actorId);
            return u ? (u.displayName || u.username) : 'Someone';
        })();
        const tType = item.targetType;
        const tId = item.targetId;
        const subjectName = () => {
            if (tType === 'user') {
                const u = allUsers.find(u => u.id === tId);
                return u ? (u.displayName || u.username) : tId?.slice(0, 8) || '';
            }
            if (tType === 'group') {
                const g = allGroups.find(g => g.id === tId);
                return g ? g.name : tId?.slice(0, 8) || '';
            }
            if (tType === 'kb') {
                const kb = availableKBs.find(k => k.id === tId);
                return kb ? kb.name : 'a knowledge base';
            }
            return tId?.slice(0, 8) || '';
        };

        switch (item.action) {
            case 'project_created': return `${actorName} created the project`;
            case 'project_updated': {
                const fields = item.details?.changes ? Object.keys(item.details.changes).join(', ') : '';
                return `${actorName} updated ${fields || 'the project'}`;
            }
            case 'instructions_updated': return `${actorName} updated the project instructions`;
            case 'member_added': return `${actorName} invited ${subjectName()} as ${item.details?.role || 'viewer'}`;
            case 'member_removed': return item.details?.selfLeave
                ? `${actorName} left the project`
                : `${actorName} removed ${subjectName()}`;
            case 'member_role_changed': return `${actorName} changed ${subjectName()}'s role from ${item.details?.from || '?'} to ${item.details?.to || '?'}`;
            case 'kb_added': return `${actorName} attached "${subjectName()}"`;
            case 'kb_removed': return `${actorName} removed "${subjectName()}"`;
            case 'conversation_assigned': return `${actorName} added a conversation`;
            case 'conversation_unassigned': return `${actorName} removed a conversation`;
            default: return `${actorName} did "${item.action}"`;
        }
    };

    // ── render ───────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                Loading project…
            </div>
        );
    }

    return (
        <div
            className="flex-1 flex flex-col overflow-hidden w-full h-full"
            style={{ background: 'var(--bg-secondary)' }}
            data-testid="project-detail-page"
        >
            {/* Header */}
            <div
                className="h-14 flex items-center justify-between px-4 border-b"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ color: 'var(--text-muted)' }}
                            title="Back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    )}
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: (color || '#6366f1') + '22', fontSize: '1.15rem' }}
                    >
                        {icon}
                    </div>
                    {editingName && canEdit ? (
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onBlur={() => setEditingName(false)}
                            onKeyDown={e => { if (e.key === 'Enter') setEditingName(false); }}
                            autoFocus
                            placeholder="Project name"
                            maxLength={MAX_NAME}
                            className="text-base font-semibold bg-transparent border-b outline-none px-1 min-w-[200px]"
                            style={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
                        />
                    ) : (
                        <button
                            onClick={() => canEdit && setEditingName(true)}
                            className="flex items-center gap-1.5 text-base font-semibold truncate text-left max-w-[40ch]"
                            style={{ color: 'var(--text-primary)', cursor: canEdit ? 'text' : 'default' }}
                            title={name}
                        >
                            {name || (isCreate ? 'New Project' : 'Untitled')}
                            {canEdit && <Pencil className="w-3 h-3 opacity-50" />}
                        </button>
                    )}
                    <span
                        className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                    >
                        {roleLabel(role)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {saveError && (
                        <span className="text-xs text-red-400" role="alert" aria-live="polite">
                            {saveError}
                        </span>
                    )}
                    {isDirty && !saving && canEdit && (
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Unsaved changes</span>
                    )}
                    {canEdit && (
                        <button
                            onClick={handleSave}
                            disabled={saving || !name.trim() || (!isDirty && !isCreate)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 hover:brightness-110"
                            style={{ background: color || 'var(--accent-primary)' }}
                            data-testid="project-save-btn"
                        >
                            <Save className="w-3.5 h-3.5" />
                            {saving ? 'Saving…' : isCreate ? 'Create Project' : 'Save'}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            {!isCreate && (
                <div className="flex border-b overflow-x-auto" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                    {TABS.map(t => {
                        const active = tab === t.id;
                        const TabIcon = t.icon;
                        const isDanger = t.id === 'danger';
                        if (isDanger && !isOwner) return null;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 shrink-0"
                                style={{
                                    borderColor: active ? 'var(--accent-primary)' : 'transparent',
                                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                                }}
                                data-testid={`project-tab-${t.id}`}
                            >
                                <TabIcon className="w-3.5 h-3.5" />
                                {t.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {(isCreate || tab === 'general') && (
                    <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</label>
                            <input
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Brief description..."
                                disabled={!canEdit}
                                maxLength={MAX_DESCRIPTION}
                                className="w-full px-3 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Custom Instructions</label>
                            <textarea
                                value={customInstructions}
                                onChange={e => setCustomInstructions(e.target.value)}
                                placeholder="Instructions applied to every chat in this project..."
                                rows={4}
                                disabled={!canEdit}
                                maxLength={MAX_INSTRUCTIONS}
                                className="w-full px-3 py-2.5 rounded-xl text-sm border transition-colors outline-none resize-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                            />
                            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                These instructions are added to the system prompt for every chat in this project.
                            </p>
                        </div>

                        <label
                            className={`flex items-start gap-2.5 p-3 rounded-xl border border-dashed transition-colors ${canEdit ? 'cursor-pointer hover:bg-[var(--bg-tertiary)]' : 'opacity-60'}`}
                            style={{ borderColor: 'var(--border-subtle)' }}
                        >
                            <input
                                type="checkbox"
                                checked={extractMemories}
                                onChange={e => setExtractMemories(e.target.checked)}
                                disabled={!canEdit}
                                className="mt-0.5"
                            />
                            <div>
                                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Extract Project Memories</div>
                                <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    Automatically learn and recall facts from conversations within this project.
                                </div>
                            </div>
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label id="project-color-label" className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Color</label>
                                <div className="flex gap-1.5 flex-wrap" role="radiogroup" aria-labelledby="project-color-label">
                                    {COLORS.map(c => (
                                        <button
                                            key={c.hex}
                                            type="button"
                                            role="radio"
                                            aria-checked={color === c.hex}
                                            onClick={() => canEdit && setColor(c.hex)}
                                            disabled={!canEdit}
                                            className={`w-7 h-7 rounded-lg transition-all ${color === c.hex ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'} disabled:opacity-50`}
                                            style={{ background: c.hex }}
                                            aria-label={c.label}
                                            title={c.label}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label id="project-icon-label" className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Icon</label>
                                <div className="flex gap-1 flex-wrap" role="radiogroup" aria-labelledby="project-icon-label">
                                    {ICONS.map(i => (
                                        <button
                                            key={i.emoji}
                                            type="button"
                                            role="radio"
                                            aria-checked={icon === i.emoji}
                                            aria-label={i.label}
                                            title={i.label}
                                            onClick={() => canEdit && setIcon(i.emoji)}
                                            disabled={!canEdit}
                                            className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${icon === i.emoji ? 'bg-[var(--accent-primary)]/10 ring-2 ring-[var(--accent-primary)]/30 scale-110' : 'hover:bg-[var(--bg-tertiary)]'} disabled:opacity-50`}
                                        >
                                            {i.emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!isCreate && tab === 'knowledge' && (
                    <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                                <Database className="w-3.5 h-3.5" />Knowledge Bases
                            </label>
                            {canEdit && (
                                <button
                                    onClick={() => setShowCreateKB(!showCreateKB)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-white transition-all hover:brightness-110"
                                    style={{ background: 'var(--accent-primary)' }}
                                >
                                    <Plus className="w-3 h-3" />Create KB
                                </button>
                            )}
                        </div>

                        {showCreateKB && (
                            <div className="p-3 rounded-xl border space-y-2" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                                <input value={newKBName} onChange={e => setNewKBName(e.target.value)} placeholder="KB Name" autoFocus
                                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                <input value={newKBDesc} onChange={e => setNewKBDesc(e.target.value)} placeholder="Description (optional)"
                                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => { setShowCreateKB(false); setNewKBName(''); setNewKBDesc(''); }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
                                    <button onClick={createKB} disabled={creatingKB || !newKBName.trim()}
                                        className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                                        style={{ background: 'var(--accent-primary)' }}>
                                        {creatingKB ? 'Creating...' : 'Create'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {availableKBs.length === 0 ? (
                            <div className="text-center py-4 text-xs rounded-xl border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                No knowledge bases yet. Create one to attach it to this project.
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {availableKBs.map(kb => {
                                    const isLinked = knowledgeBaseIds.includes(kb.id);
                                    const isExpanded = selectedKB?.id === kb.id;
                                    return (
                                        <div key={kb.id}>
                                            <div
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all group ${isExpanded ? 'ring-2 ring-[var(--accent-primary)]/40' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                                style={{ background: isExpanded ? 'var(--bg-tertiary)' : (isLinked ? 'var(--bg-tertiary)' : 'transparent') }}
                                                onClick={() => setSelectedKB(isExpanded ? null : kb)}
                                            >
                                                {isExpanded
                                                    ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                                                    : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                                                }
                                                <input type="checkbox" checked={isLinked}
                                                    disabled={!canEdit}
                                                    onChange={(e) => { e.stopPropagation(); toggleKBLink(kb.id); }}
                                                    onClick={e => e.stopPropagation()} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                                        📚 {kb.name}
                                                    </div>
                                                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                        {kb.document_count || 0} docs · {kb.total_chunks || 0} chunks
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="mt-2 ml-6 p-3 rounded-xl border space-y-3"
                                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                                    {/* Ingest mode tabs */}
                                                    <div className="flex gap-1 p-0.5 rounded-lg w-fit" style={{ background: 'var(--bg-tertiary)' }}>
                                                        {[{ id: 'text', label: '📝 Text' }, { id: 'url', label: '🌐 URL' }].map(t => (
                                                            <button
                                                                key={t.id}
                                                                onClick={() => setKbInputMode(t.id)}
                                                                className={`px-3 py-1 rounded-md text-[11px] font-medium ${kbInputMode === t.id ? 'bg-[var(--accent-primary)] text-white' : ''}`}
                                                                style={kbInputMode === t.id ? {} : { color: 'var(--text-secondary)' }}
                                                            >
                                                                {t.label}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {kbInputMode === 'text' && (
                                                        <div className="space-y-2">
                                                            <input value={kbTextTitle} onChange={e => setKbTextTitle(e.target.value)} placeholder="Title (optional)"
                                                                className="w-full px-3 py-1.5 rounded-lg border text-xs"
                                                                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                                            <textarea value={kbTextContent} onChange={e => setKbTextContent(e.target.value)}
                                                                placeholder="Paste text content here..." rows={3}
                                                                className="w-full px-3 py-1.5 rounded-lg border text-xs resize-none"
                                                                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                                        </div>
                                                    )}

                                                    {kbInputMode === 'url' && (
                                                        <input type="url" value={kbUrlInput} onChange={e => setKbUrlInput(e.target.value)}
                                                            placeholder="https://example.com/page"
                                                            className="w-full px-3 py-1.5 rounded-lg border text-xs"
                                                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                            onKeyDown={e => { if (e.key === 'Enter' && !kbIngesting) ingestUrl(); }} />
                                                    )}

                                                    <div className="flex gap-2 justify-end items-center">
                                                        {kbIngestStatus && (
                                                            <span
                                                                className="text-[11px]"
                                                                style={{ color: 'var(--accent-primary)' }}
                                                                role="status"
                                                                aria-live="polite"
                                                            >
                                                                {kbIngestStatus}
                                                            </span>
                                                        )}
                                                        <label className="cursor-pointer px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1"
                                                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                                            <input type="file" accept=".pdf,.txt,.md,.docx,.csv" className="hidden" onChange={ingestFile} disabled={kbIngesting} />
                                                            <Paperclip className="w-3 h-3" /> File
                                                        </label>
                                                        <button onClick={kbInputMode === 'url' ? ingestUrl : ingestText}
                                                            disabled={kbIngesting || (kbInputMode === 'text' ? !kbTextContent.trim() : !kbUrlInput.trim())}
                                                            className="px-3 py-1 rounded-lg text-[11px] font-medium text-white disabled:opacity-50"
                                                            style={{ background: 'var(--accent-primary)' }}>
                                                            {kbIngesting ? 'Processing...' : 'Ingest'}
                                                        </button>
                                                    </div>

                                                    <div>
                                                        <h5 className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                                            Documents ({kbDocs.length})
                                                        </h5>
                                                        {kbDocs.length === 0 ? (
                                                            <div className="text-center py-3 text-[11px] rounded-lg border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                                                No documents yet.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                                                {kbDocs.map(doc => (
                                                                    <div key={doc.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg group" style={{ background: 'var(--bg-tertiary)' }}>
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <span className="text-xs flex-shrink-0">
                                                                                {doc.source_type === 'web' ? '🌐' : doc.source_type === 'upload' ? '📄' : '📝'}
                                                                            </span>
                                                                            <div className="min-w-0">
                                                                                <div className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.title || 'Untitled'}</div>
                                                                                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                                                    {doc.chunk_count || 0} chunks · {new Date(doc.created_at).toLocaleDateString()}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <button onClick={() => deleteDoc(doc.id)}
                                                                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 flex-shrink-0">
                                                                            <Trash2 className="w-3 h-3 text-red-500" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Linked KBs are searched automatically when chatting in this project.
                            {canEdit && ' Save your changes to apply.'}
                        </p>
                    </div>
                )}

                {!isCreate && tab === 'members' && (
                    <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
                        {isOwner && (
                            <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                                <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Invite Member</h3>
                                <div className="flex flex-wrap gap-2">
                                    <select value={inviteType} onChange={e => { setInviteType(e.target.value); setInviteId(''); }}
                                        className="px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                                        <option value="user">User</option>
                                        <option value="group">Group</option>
                                    </select>
                                    {(inviteType === 'user' ? allUsers : allGroups).length > 0 ? (
                                        <select value={inviteId} onChange={e => setInviteId(e.target.value)}
                                            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-sm border outline-none"
                                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                                            <option value="">Select {inviteType}...</option>
                                            {inviteType === 'user'
                                                ? allUsers.map(u => <option key={u.id} value={u.id}>{u.displayName || u.username}</option>)
                                                : allGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)
                                            }
                                        </select>
                                    ) : (
                                        <input
                                            value={inviteId}
                                            onChange={e => setInviteId(e.target.value)}
                                            placeholder={`${inviteType === 'user' ? 'User' : 'Group'} ID`}
                                            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-sm border outline-none"
                                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                        />
                                    )}
                                    <select value={invitePermission} onChange={e => setInvitePermission(e.target.value)}
                                        className="px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                                        <option value="viewer">Viewer</option>
                                        <option value="editor">Editor</option>
                                    </select>
                                    <button
                                        onClick={inviteMember}
                                        disabled={!inviteId || inviting}
                                        aria-busy={inviting}
                                        className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center gap-1.5"
                                        style={{ background: 'var(--accent-primary)' }}>
                                        <UserPlus className="w-4 h-4" />
                                        {inviting ? 'Inviting…' : 'Invite'}
                                    </button>
                                </div>
                                <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                                    Editors can update project settings and KBs. Viewers can read and chat in the project.
                                </p>
                                {memberError && (
                                    <p
                                        className="text-[11px] mt-2 text-red-400"
                                        role="alert"
                                        aria-live="polite"
                                    >
                                        {memberError}
                                    </p>
                                )}
                            </div>
                        )}

                        <div>
                            <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Owner</h3>
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                                <div className="flex items-center gap-2">
                                    <UserPlus className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                        {(() => {
                                            const u = allUsers.find(u => u.id === project?.ownerId);
                                            return u ? (u.displayName || u.username) : (project?.ownerId === user?.id ? 'You' : (project?.ownerId?.slice(0, 8) || 'Unknown'));
                                        })()}
                                    </span>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>Owner</span>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                                Members ({members.length})
                            </h3>
                            {memberError && !isOwner && (
                                <p
                                    className="text-[11px] mb-2 text-red-400"
                                    role="alert"
                                    aria-live="polite"
                                >
                                    {memberError}
                                </p>
                            )}
                            {members.length === 0 ? (
                                <p className="text-sm py-4 text-center rounded-lg border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                    No members yet. {isOwner && 'Invite people to collaborate.'}
                                </p>
                            ) : (
                                <div className="space-y-1.5">
                                    {members.map(m => {
                                        const isSelf = m.sharedWithType === 'user' && m.sharedWithId === user?.id;
                                        return (
                                            <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {m.sharedWithType === 'group' ? <Users className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                                        {resolveSubject(m)}
                                                    </span>
                                                    {isSelf && (
                                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>(you)</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={m.permission}
                                                        disabled={!isOwner}
                                                        onChange={(e) => changeMemberRole(m.id, e.target.value)}
                                                        className="text-xs px-2 py-1 rounded-md border outline-none disabled:opacity-70"
                                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                                    >
                                                        <option value="viewer">Viewer</option>
                                                        <option value="editor">Editor</option>
                                                    </select>
                                                    {(isOwner || isSelf) && (
                                                        <button onClick={() => removeMember(m.id)}
                                                            className="p-1.5 rounded hover:bg-red-500/10"
                                                            title={isSelf && !isOwner ? 'Leave project' : 'Remove member'}>
                                                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!isCreate && tab === 'activity' && (
                    <div className="max-w-3xl mx-auto px-6 py-6">
                        {activity.length === 0 ? (
                            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                                No activity yet.
                            </p>
                        ) : (
                            <>
                                <ul className="space-y-2">
                                    {activity.map(item => (
                                        <li key={item.id} className="flex items-start gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                                style={{ background: 'var(--bg-tertiary)' }}>
                                                <Activity className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatActivity(item)}</p>
                                                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatRelative(item.createdAt)}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                {activityHasMore && (
                                    <div className="mt-3 text-center">
                                        <button
                                            onClick={loadMoreActivity}
                                            disabled={activityLoadingMore}
                                            className="px-4 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
                                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                        >
                                            {activityLoadingMore ? 'Loading…' : 'Load more'}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {!isCreate && tab === 'memory' && (
                    <div className="w-full h-full min-h-[500px]">
                        <MemoryPanel projectId={projectId} />
                    </div>
                )}

                {!isCreate && tab === 'danger' && isOwner && (
                    <div className="max-w-3xl mx-auto px-6 py-6">
                        <div className="p-4 rounded-xl border" style={{ background: 'rgba(244,63,94,0.04)', borderColor: 'rgba(244,63,94,0.3)' }}>
                            <h3 className="text-sm font-semibold mb-1" style={{ color: '#f43f5e' }}>Delete Project</h3>
                            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                                Conversations will be unassigned but not deleted. Members and activity history will be removed.
                            </p>
                            <button onClick={handleDelete}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                                style={{ background: '#f43f5e' }}>
                                Delete Project
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
