import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Plus, Target, Search, RefreshCw, Loader2, StopCircle, Play, CheckCircle2, AlertTriangle, Pencil, Layers, LayoutGrid, ListChecks } from 'lucide-react';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import StudioShell from '../../../shared/StudioShell';
import CampaignModal from './CampaignModal';
import LeadTable from './LeadTable';
import EmailDraftModal from './EmailDraftModal';
import PipelineBoard from './PipelineBoard';
import LeadDetailPanel from './LeadDetailPanel';
import TasksView from './TasksView';
import useLeadEvents from './useLeadEvents';

const CAMPAIGN_STATUS_COLORS = {
    draft: 'text-[var(--text-tertiary)]',
    queued: 'text-amber-500',
    running: 'text-amber-500',
    completed: 'text-emerald-500',
    error: 'text-rose-500',
    cancelled: 'text-[var(--text-tertiary)]',
};

const isRunning = (s) => s === 'queued' || s === 'running';

/**
 * LeadStudio — AI lead generation + collaborative, checkable lead list.
 * Backend: /api/lead-studio/* (lead_studio license + beta + permission).
 */
export default function LeadStudio({ user, modelTiers: modelTiersProp = {} }) {
    const { t } = useTranslation();
    const [campaigns, setCampaigns] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [activeCampaign, setActiveCampaign] = useState(null);
    const [leads, setLeads] = useState([]);
    const [providers, setProviders] = useState([]);
    const [teammates, setTeammates] = useState([]);
    const [modelTiers, setModelTiers] = useState(modelTiersProp);
    const [statusFilter, setStatusFilter] = useState('');
    const [verifiedFilter, setVerifiedFilter] = useState('');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null); // campaign being edited, or null = create
    const [activity, setActivity] = useState([]); // live AI status messages for the active campaign
    const [loadingLeads, setLoadingLeads] = useState(false);
    const [view, setView] = useState('campaign'); // 'campaign' | 'all' | 'pipeline' | 'tasks'
    const [busyResearchId, setBusyResearchId] = useState(null); // lead currently being deep-enriched
    const [emailLead, setEmailLead] = useState(null); // lead whose e-mail composer is open
    const [detailLead, setDetailLead] = useState(null); // lead whose CRM detail panel is open
    const [tasks, setTasks] = useState([]); // open tasks (board due chips)
    const [pipelineSummary, setPipelineSummary] = useState({ stages: {}, totalValue: 0 });
    const [digest, setDigest] = useState(null);
    const [busyDigest, setBusyDigest] = useState(false);
    const [busyScore, setBusyScore] = useState(false);
    const [tasksVersion, setTasksVersion] = useState(0); // bumped on task SSE → refetch board/tasks views

    const activeIdRef = useRef(null);
    useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
    const viewRef = useRef('campaign');
    useEffect(() => { viewRef.current = view; }, [view]);
    // Reset the live activity log when switching campaigns.
    useEffect(() => { setActivity([]); }, [activeId]);

    // Tiers: prefer the prop; otherwise self-fetch (mirrors SecurityStudio).
    useEffect(() => {
        if (modelTiersProp && Object.keys(modelTiersProp).length) { setModelTiers(modelTiersProp); return; }
        let alive = true;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config/tiers-for-user?taskType=direct_chat`);
                if (res.ok && alive) setModelTiers((await res.json()) || {});
            } catch (_) { /* selector falls back to default */ }
        })();
        return () => { alive = false; };
    }, [modelTiersProp]);

    const fetchCampaigns = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/campaigns`);
            if (res.ok) { const d = await res.json(); setCampaigns(d.campaigns || []); }
        } catch (_) {}
    }, []);

    const fetchLeads = useCallback(async () => {
        const id = activeIdRef.current;
        if (!id) { setLeads([]); return; }
        setLoadingLeads(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.set('status', statusFilter);
            if (verifiedFilter) params.set('verified', verifiedFilter);
            if (search.trim()) params.set('q', search.trim());
            const res = await authFetch(`${API_BASE}/api/lead-studio/campaigns/${id}/leads?${params.toString()}`);
            if (res.ok) { const d = await res.json(); setLeads(d.leads || []); }
            const cRes = await authFetch(`${API_BASE}/api/lead-studio/campaigns/${id}`);
            if (cRes.ok) { const cd = await cRes.json(); setActiveCampaign({ ...cd.campaign, counts: cd.counts }); }
        } catch (_) {} finally { setLoadingLeads(false); }
    }, [statusFilter, verifiedFilter, search]);

    // Combined cross-campaign overview (deduped server-side).
    const fetchAllLeads = useCallback(async () => {
        setLoadingLeads(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.set('status', statusFilter);
            if (verifiedFilter) params.set('verified', verifiedFilter);
            if (search.trim()) params.set('q', search.trim());
            const res = await authFetch(`${API_BASE}/api/lead-studio/leads?${params.toString()}`);
            if (res.ok) { const d = await res.json(); setLeads(d.leads || []); }
        } catch (_) {} finally { setLoadingLeads(false); }
    }, [statusFilter, verifiedFilter, search]);

    useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);
    useEffect(() => {
        authFetch(`${API_BASE}/api/lead-studio/providers`).then(r => r.ok ? r.json() : { providers: [] }).then(d => setProviders(d.providers || [])).catch(() => {});
        authFetch(`${API_BASE}/api/lead-studio/teammates`).then(r => r.ok ? r.json() : { teammates: [] }).then(d => setTeammates(d.teammates || [])).catch(() => {});
    }, []);
    const fetchTasks = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/tasks?status=open&limit=500`);
            if (res.ok) { const d = await res.json(); setTasks(d.tasks || []); }
        } catch (_) {}
    }, []);
    const fetchPipeline = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/pipeline`);
            if (res.ok) setPipelineSummary(await res.json());
        } catch (_) {}
    }, []);

    useEffect(() => {
        const run = () => ((view === 'all' || view === 'pipeline') ? fetchAllLeads() : view === 'campaign' ? fetchLeads() : null);
        const id = setTimeout(run, search ? 250 : 0);
        return () => clearTimeout(id);
    }, [fetchLeads, fetchAllLeads, view, activeId, search]);

    // Board aux data (task due-chips + per-stage € totals); refresh on task changes.
    useEffect(() => {
        if (view !== 'pipeline') return;
        fetchTasks(); fetchPipeline();
    }, [view, tasksVersion, fetchTasks, fetchPipeline]);

    // Live updates over SSE: update leads in place, reflect run status.
    const onEvent = useCallback((type, data) => {
        if (!data) return;
        if ((type === 'lead_created' || type === 'lead_updated') && data.lead) {
            // Keep the open CRM detail panel in sync.
            setDetailLead(prev => (prev && prev.id === data.lead.id ? { ...prev, ...data.lead } : prev));
            // Cross-campaign / pipeline views reflect every org lead by id; a single
            // campaign only its own.
            if (viewRef.current !== 'all' && viewRef.current !== 'pipeline' && data.campaignId !== activeIdRef.current) return;
            setLeads(prev => {
                const idx = prev.findIndex(l => l.id === data.lead.id);
                if (idx === -1) return [data.lead, ...prev];
                const next = prev.slice(); next[idx] = data.lead; return next;
            });
        } else if (type === 'task_created' || type === 'task_updated' || type === 'activity_created' || type === 'contact_created' || type === 'contact_updated' || type === 'contact_deleted') {
            // Refresh board due-chips / tasks view; the detail panel reloads its own lists.
            setTasksVersion(v => v + 1);
        } else if (type === 'run_status' || type === 'run_progress') {
            setCampaigns(prev => prev.map(c => c.id === data.campaignId
                ? { ...c, status: data.status || c.status, leadsFound: data.leadsFound ?? c.leadsFound }
                : c));
            if (data.campaignId === activeIdRef.current) {
                setActiveCampaign(prev => prev ? { ...prev, status: data.status || prev.status, leadsFound: data.leadsFound ?? prev.leadsFound } : prev);
                // Live "what the AI is doing now" — keep the most recent messages.
                if (type === 'run_progress' && data.message) {
                    setActivity(prev => {
                        if (prev[0]?.message === data.message) return prev;
                        return [{ message: data.message, phase: data.phase, at: Date.now() }, ...prev].slice(0, 12);
                    });
                }
                if (type === 'run_status' && data.status === 'queued') setActivity([]);
                if (type === 'run_status' && ['completed', 'error', 'cancelled'].includes(data.status)) fetchLeads();
            }
        } else if (type === 'campaign_created' || type === 'campaign_updated') {
            fetchCampaigns();
        }
    }, [fetchLeads, fetchCampaigns]);
    useLeadEvents(onEvent);

    const submitCampaign = async (payload) => {
        let campaignId;
        if (editing) {
            // Edit existing → PATCH then re-run with the new criteria.
            const res = await authFetch(`${API_BASE}/api/lead-studio/campaigns/${editing.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || d.error || 'update_failed'); }
            campaignId = editing.id;
        } else {
            const res = await authFetch(`${API_BASE}/api/lead-studio/campaigns`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'create_failed'); }
            campaignId = (await res.json()).campaign.id;
        }
        await authFetch(`${API_BASE}/api/lead-studio/campaigns/${campaignId}/run`, { method: 'POST' });
        setShowModal(false);
        setEditing(null);
        setActivity([]);
        setActiveId(campaignId);
        fetchCampaigns();
        fetchLeads();
    };

    const openCreate = () => { setEditing(null); setShowModal(true); };
    const openEdit = (c) => { setEditing(c); setShowModal(true); };

    const runCampaign = async (c) => {
        await authFetch(`${API_BASE}/api/lead-studio/campaigns/${c.id}/run`, { method: 'POST' });
        fetchCampaigns();
    };

    const cancelCampaign = async (c) => {
        const res = await authFetch(`${API_BASE}/api/lead-studio/campaigns/${c.id}/cancel`, { method: 'POST' });
        if (res.ok || res.status === 409) fetchCampaigns();
    };

    // Optimistic patch + reconcile over SSE.
    const patchLead = async (leadId, body) => {
        const patch = mapPatch(body);
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...patch } : l));
        setDetailLead(prev => (prev && prev.id === leadId ? { ...prev, ...patch } : prev));
        await authFetch(`${API_BASE}/api/lead-studio/leads/${leadId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        }).catch(() => { fetchLeads(); });
    };

    // Open the CRM detail panel for a lead id (used by the board + tasks view).
    const openLeadById = async (id) => {
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/leads/${id}`);
            if (res.ok) { const d = await res.json(); if (d.lead) setDetailLead(d.lead); }
        } catch (_) {}
    };

    const runDigest = async () => {
        setBusyDigest(true);
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/pipeline/digest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            if (res.ok) setDigest(await res.json());
        } catch (_) {} finally { setBusyDigest(false); }
    };
    const runScore = async () => {
        setBusyScore(true);
        try {
            await authFetch(`${API_BASE}/api/lead-studio/pipeline/score`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            fetchAllLeads(); // hotness now cached on the leads (SSE also updates them)
        } catch (_) {} finally { setBusyScore(false); }
    };

    const toggleVerify = async (lead) => {
        const verified = !lead.verified;
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, verified, checkedByUserId: verified ? user?.id : null } : l));
        await authFetch(`${API_BASE}/api/lead-studio/leads/check-off`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId: lead.campaignId, leadIds: [lead.id], verified }),
        }).catch(() => fetchLeads());
    };

    const verifyAllVisible = async () => {
        const ids = leads.filter(l => !l.verified).map(l => l.id);
        if (!ids.length || !activeId) return;
        setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, verified: true, checkedByUserId: user?.id } : l));
        await authFetch(`${API_BASE}/api/lead-studio/leads/check-off`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId: activeId, leadIds: ids, verified: true }),
        }).catch(() => fetchLeads());
    };

    // On-demand "research more" for one lead — server merges + emits lead_updated,
    // but we also replace from the response so the row refreshes immediately.
    const researchLead = async (leadId, focus = 'all') => {
        setBusyResearchId(leadId);
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/leads/${leadId}/research`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ focus }),
            });
            const d = await res.json().catch(() => ({}));
            if (res.ok && d.lead) setLeads(prev => prev.map(l => l.id === leadId ? d.lead : l));
        } catch (_) { /* surfaced live via SSE if it succeeded */ }
        finally { setBusyResearchId(null); }
    };

    const verifiedCount = useMemo(() => leads.filter(l => l.verified).length, [leads]);

    // Shared filter bar + leads table for both the campaign and the all-leads views.
    const renderLeadsArea = (showCampaign) => (
        <>
            <div className="px-4 py-2 border-b border-[var(--border-default)] flex items-center gap-2 flex-wrap">
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('leads.search', 'Zoek leads…')}
                        className="text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] pl-7 pr-2 py-1 w-44 text-[var(--text-primary)]" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-[var(--text-secondary)]">
                    <option value="">{t('leads.filter.all_status', 'Alle statussen')}</option>
                    {['new', 'contacted', 'qualified', 'disqualified', 'converted'].map(s => <option key={s} value={s}>{t(`leads.status.${s}`, s)}</option>)}
                </select>
                <select value={verifiedFilter} onChange={e => setVerifiedFilter(e.target.value)}
                    className="text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-[var(--text-secondary)]">
                    <option value="">{t('leads.filter.all', 'Alle')}</option>
                    <option value="true">{t('leads.filter.verified', 'Geverifieerd')}</option>
                    <option value="false">{t('leads.filter.unverified', 'Niet geverifieerd')}</option>
                </select>
                <span className="text-[11px] text-[var(--text-tertiary)] ml-auto flex items-center gap-2">
                    <span><CheckCircle2 size={11} className="inline text-emerald-500" /> {verifiedCount}/{leads.length}</span>
                    {!showCampaign && leads.some(l => !l.verified) && (
                        <button onClick={verifyAllVisible} className="px-2 py-0.5 rounded border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                            {t('leads.verify_all', 'Alles afvinken')}
                        </button>
                    )}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {loadingLeads && leads.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-[var(--text-tertiary)]"><Loader2 size={18} className="animate-spin" /></div>
                ) : leads.length === 0 ? (
                    <div className="text-center text-xs text-[var(--text-tertiary)] py-10">
                        {showCampaign
                            ? t('leads.empty.no_all_leads', 'Nog geen leads. Voer een campagne uit om bedrijven te vinden.')
                            : isRunning(activeCampaign?.status)
                                ? t('leads.empty.generating', 'Leads verschijnen hier zodra ze gevonden zijn…')
                                : t('leads.empty.no_leads', 'Geen leads in deze weergave.')}
                    </div>
                ) : (
                    <LeadTable leads={leads} teammates={teammates} onPatch={patchLead} onToggleVerify={toggleVerify}
                        onResearch={researchLead} onDraftEmail={setEmailLead} onOpenLead={setDetailLead} busyResearchId={busyResearchId}
                        showCampaign={showCampaign} t={t} userId={user?.id} />
                )}
            </div>
        </>
    );

    return (
        <>
            <StudioShell
                sidebarTitle={(
                    <span className="flex items-center gap-2">
                        <Target size={15} /> {t('studio.tab.lead_studio', 'Lead Studio')}
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">Beta</span>
                    </span>
                )}
                sidebarActions={(
                    <button onClick={openCreate} className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]" title={t('leads.new_campaign', 'Nieuwe campagne')}>
                        <Plus size={15} />
                    </button>
                )}
                sidebar={(
                    <div className="flex flex-col gap-1 p-3">
                        {/* Org-wide views */}
                        {[
                            { id: 'all', icon: Layers, label: t('leads.all_leads', 'Alle leads') },
                            { id: 'pipeline', icon: LayoutGrid, label: t('crm.pipeline', 'Pijplijn') },
                            { id: 'tasks', icon: ListChecks, label: t('tasks.title', 'Taken') },
                        ].map(v => (
                            <button key={v.id} onClick={() => { setView(v.id); setActiveId(null); }}
                                className={`text-left text-xs px-3 py-2 rounded border flex items-center gap-1.5 ${view === v.id
                                    ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                    : 'border-transparent hover:bg-[var(--bg-secondary)]'}`}>
                                <v.icon size={12} className="text-[var(--text-secondary)]" />
                                <span className="font-medium text-[var(--text-primary)]">{v.label}</span>
                            </button>
                        ))}
                        <div className="flex items-center justify-between mb-1 mt-1 px-1">
                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{t('leads.campaigns', 'Campagnes')}</h4>
                            <button onClick={fetchCampaigns} className="p-0.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]" title={t('common.refresh', 'Vernieuwen')}><RefreshCw size={11} /></button>
                        </div>
                        {campaigns.length === 0 && (
                            <div className="text-xs text-[var(--text-tertiary)] italic px-1 py-2">
                                {t('leads.empty.no_campaigns', 'Nog geen campagnes. Maak er één om leads te zoeken.')}
                            </div>
                        )}
                        {campaigns.map(c => (
                            <button key={c.id} onClick={() => { setView('campaign'); setActiveId(c.id); }}
                                className={`text-left text-xs px-3 py-2 rounded border ${view === 'campaign' && activeId === c.id
                                    ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                    : 'border-transparent hover:bg-[var(--bg-secondary)]'}`}>
                                <div className="flex items-center gap-1.5">
                                    {isRunning(c.status)
                                        ? <Loader2 size={11} className="animate-spin text-amber-500" />
                                        : <span className={`inline-block w-2 h-2 rounded-full ${CAMPAIGN_STATUS_COLORS[c.status] || 'text-[var(--text-tertiary)]'}`} style={{ backgroundColor: 'currentColor' }} />}
                                    <span className="font-medium truncate flex-1 text-[var(--text-primary)]">{c.title || t('leads.untitled', '(naamloos)')}</span>
                                </div>
                                <div className="text-[var(--text-tertiary)] mt-0.5 flex items-center justify-between">
                                    <span className="truncate">{[c.criteria?.branche, c.criteria?.locatie].filter(Boolean).join(' · ') || t(`leads.status.campaign.${c.status}`, c.status)}</span>
                                    {c.leadsFound > 0 && <span className="ml-2">{c.leadsFound}</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            >
                {view === 'pipeline' ? (
                    <PipelineBoard
                        leads={leads} tasks={tasks} pipeline={pipelineSummary}
                        onStageChange={(id, status) => patchLead(id, { status })}
                        onOpenLead={setDetailLead}
                        onDigest={runDigest} onScore={runScore} digest={digest}
                        busyDigest={busyDigest} busyScore={busyScore} t={t} />
                ) : view === 'tasks' ? (
                    <TasksView onOpenLead={openLeadById} version={tasksVersion} t={t} />
                ) : view === 'all' ? (
                    <div className="flex flex-col h-full">
                        <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center gap-2">
                            <Layers size={15} className="text-[var(--text-secondary)]" />
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('leads.all_leads', 'Alle leads')}</h3>
                            <span className="text-[11px] text-[var(--text-tertiary)]">· {leads.length} {t('leads.companies', 'bedrijven')}</span>
                        </div>
                        {renderLeadsArea(true)}
                    </div>
                ) : !activeCampaign ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-[var(--text-tertiary)] px-6">
                        <Target size={32} className="mb-3 opacity-40" />
                        <p className="text-sm">{t('leads.empty.select', 'Selecteer een campagne of maak een nieuwe om te beginnen.')}</p>
                        <button onClick={() => setShowModal(true)} className="mt-4 px-3 py-1.5 text-sm rounded text-white font-semibold" style={{ background: 'var(--accent-primary)' }}>
                            {t('leads.new_campaign', 'Nieuwe campagne')}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        {/* Campaign header */}
                        <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{activeCampaign.title || t('leads.untitled', '(naamloos)')}</h3>
                                <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                                    {[activeCampaign.criteria?.branche, activeCampaign.criteria?.bedrijfstype, activeCampaign.criteria?.omvang, activeCampaign.criteria?.locatie].filter(Boolean).join(' · ')}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {isRunning(activeCampaign.status) ? (
                                    <button onClick={() => cancelCampaign(activeCampaign)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-rose-500/40 text-rose-500 hover:bg-rose-500/10">
                                        <StopCircle size={12} /> {t('leads.cancel', 'Annuleren')}
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={() => openEdit(activeCampaign)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
                                            <Pencil size={12} /> {t('leads.edit', 'Bewerken')}
                                        </button>
                                        <button onClick={() => runCampaign(activeCampaign)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
                                            <Play size={12} /> {activeCampaign.status === 'draft' ? t('leads.run', 'Zoeken') : t('leads.rerun', 'Opnieuw zoeken')}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Run progress banner — live "what the AI is doing now" */}
                        {isRunning(activeCampaign.status) && (
                            <div className="bg-amber-500/10 border-b border-amber-500/30">
                                <div className="px-4 py-2 text-xs text-[var(--text-secondary)] flex items-center gap-2">
                                    <Loader2 size={13} className="animate-spin text-amber-500 flex-shrink-0" />
                                    <span className="truncate">
                                        {activity[0]?.message || t('leads.running', 'De AI zoekt en verrijkt bedrijven…')}
                                    </span>
                                    {activeCampaign.leadsFound > 0 && <span className="ml-auto flex-shrink-0">{activeCampaign.leadsFound} {t('leads.found_count', 'gevonden')}</span>}
                                </div>
                                {activity.length > 1 && (
                                    <ul className="px-4 pb-2 space-y-0.5 max-h-24 overflow-y-auto">
                                        {activity.slice(1, 6).map((a, i) => (
                                            <li key={a.at || i} className="text-[10px] text-[var(--text-tertiary)] truncate pl-5">{a.message}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                        {activeCampaign.status === 'error' && (
                            <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/30 text-xs text-rose-500 flex items-center gap-2">
                                <AlertTriangle size={13} /> {activeCampaign.lastRunError || t('leads.error', 'Er ging iets mis bij het zoeken.')}
                            </div>
                        )}

                        {renderLeadsArea(false)}
                    </div>
                )}
            </StudioShell>

            {showModal && (
                <CampaignModal
                    onClose={() => { setShowModal(false); setEditing(null); }}
                    onSubmit={submitCampaign}
                    initial={editing}
                    modelTiers={modelTiers}
                    providers={providers}
                    t={t}
                />
            )}

            {emailLead && (
                <EmailDraftModal lead={emailLead} onClose={() => setEmailLead(null)} t={t} />
            )}

            {detailLead && (
                <LeadDetailPanel
                    lead={detailLead} teammates={teammates} userId={user?.id} t={t}
                    onClose={() => setDetailLead(null)}
                    onPatchLead={patchLead}
                    onDraftEmail={setEmailLead}
                    onResearch={researchLead}
                    busyResearchId={busyResearchId} />
            )}
        </>
    );
}

// Map a PATCH body's API field names to lead-object camelCase for optimistic UI.
function mapPatch(body) {
    const out = {};
    if ('status' in body) out.status = body.status;
    if ('assigneeUserId' in body) out.assigneeUserId = body.assigneeUserId;
    if ('notes' in body) out.notes = body.notes;
    if ('dealValue' in body) out.dealValue = body.dealValue;
    if ('expectedCloseAt' in body) out.expectedCloseAt = body.expectedCloseAt;
    return out;
}
