import React, { useEffect, useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import EmptyState from '../../../shared/EmptyState';
import InboxesTab from './InboxesTab';
import RepliesTab from './RepliesTab';
import AutomationsTab from './AutomationsTab';
import TemplatesTab from './TemplatesTab';
import AccessTab from './AccessTab';
import AuditTab from './AuditTab';

// Tab set — mirrors Organisation Settings' top pill bar. Per-inbox tabs act on
// the inbox chosen in the in-panel selector; org-wide tabs ignore it.
const TABS = [
    { id: 'inboxes', label: 'Inboxes', scope: 'inbox' },
    { id: 'access', label: 'Access', scope: 'inbox' },
    { id: 'replies', label: 'AI & Replies', scope: 'inbox' },
    { id: 'automations', label: 'Automations', scope: 'inbox' },
    { id: 'templates', label: 'Templates', scope: 'org' },
    { id: 'audit', label: 'Audit', scope: 'org' },
];

/**
 * SupportSettings — tabbed configuration for the tenant Support studio,
 * mirroring the Organisation Settings pill-tab pattern. Per-inbox tabs operate
 * on the inbox selected in the panel; Templates + Audit are organisation-wide.
 */
export default function SupportSettings({ inboxes = [], onChanged, user, onOpenThread }) {
    const { t } = useTranslation();
    const [tab, setTab] = useState('inboxes');
    const [selectedInboxId, setSelectedInboxId] = useState(inboxes[0]?.id || null);

    // Reference data shared across per-inbox tabs (loaded once).
    const [agents, setAgents] = useState([]);
    const [kbs, setKbs] = useState([]);
    const [teammates, setTeammates] = useState([]);

    useEffect(() => {
        authFetch(`${API_BASE}/agents/all`).then(r => r.ok ? r.json() : []).then(d => setAgents(Array.isArray(d) ? d : [])).catch(() => {});
        authFetch(`${API_BASE}/api/kb`).then(r => r.ok ? r.json() : []).then(d => setKbs(Array.isArray(d) ? d : (d.kbs || []))).catch(() => {});
        authFetch(`${API_BASE}/api/support-inbox/teammates`).then(r => r.ok ? r.json() : {}).then(d => setTeammates(Array.isArray(d.teammates) ? d.teammates : [])).catch(() => {});
    }, []);

    // Keep the selected inbox valid as the list changes.
    useEffect(() => {
        if (!inboxes.length) { setSelectedInboxId(null); return; }
        if (!inboxes.some(i => i.id === selectedInboxId)) setSelectedInboxId(inboxes[0].id);
    }, [inboxes, selectedInboxId]);

    const selectedInbox = useMemo(() => inboxes.find(i => i.id === selectedInboxId) || null, [inboxes, selectedInboxId]);
    const activeTab = TABS.find(t2 => t2.id === tab) || TABS[0];
    const needsInbox = activeTab.scope === 'inbox' && activeTab.id !== 'inboxes';

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* Pill-tab bar — identical treatment to Organisation Settings. */}
            <div className="h-14 flex items-center justify-between px-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">{t('support.settings.heading', 'Support settings')}</h2>
                <div className="flex gap-1 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-tertiary)' }}>
                    {TABS.map((tb) => (
                        <button
                            key={tb.id}
                            onClick={() => setTab(tb.id)}
                            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${tab === tb.id
                                ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'}`}
                        >
                            {t(`support.settings.tab.${tb.id}`, tb.label)}
                        </button>
                    ))}
                </div>
                <div className="w-20" />
            </div>

            {/* Per-inbox selector (shown on per-inbox tabs when >1 inbox). */}
            {needsInbox && inboxes.length > 0 && (
                <div className="px-6 pt-4 flex items-center gap-2 shrink-0">
                    <Mail size={14} className="text-[var(--text-tertiary)]" />
                    <span className="text-xs text-[var(--text-tertiary)]">{t('support.settings.editing_inbox', 'Inbox')}:</span>
                    <select value={selectedInboxId || ''} onChange={e => setSelectedInboxId(e.target.value)}
                        className="text-sm rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5">
                        {inboxes.map(i => <option key={i.id} value={i.id}>{i.email_address || i.display_name || i.provider}</option>)}
                    </select>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 overflow-auto">
                    {tab === 'inboxes' && (
                        <InboxesTab inboxes={inboxes} agents={agents} kbs={kbs}
                            selectedInboxId={selectedInboxId} onSelectInbox={setSelectedInboxId} onChanged={onChanged} />
                    )}
                    {tab === 'replies' && (needsInbox && !selectedInbox
                        ? <NoInbox onGo={() => setTab('inboxes')} />
                        : <RepliesTab inbox={selectedInbox} teammates={teammates} onChanged={onChanged} />)}
                    {tab === 'automations' && (needsInbox && !selectedInbox
                        ? <NoInbox onGo={() => setTab('inboxes')} />
                        : <AutomationsTab inbox={selectedInbox} kbs={kbs} onChanged={onChanged} />)}
                    {tab === 'access' && (needsInbox && !selectedInbox
                        ? <NoInbox onGo={() => setTab('inboxes')} />
                        : <AccessTab inbox={selectedInbox} user={user} onChanged={onChanged} />)}
                    {tab === 'templates' && <TemplatesTab />}
                    {tab === 'audit' && <AuditTab inboxes={inboxes} onOpenThread={onOpenThread} />}
                </div>
            </div>
        </div>
    );

    function NoInbox({ onGo }) {
        return (
            <div className="py-10">
                <EmptyState
                    icon={<Mail size={36} />}
                    title={t('support.settings.no_mailbox', 'No mailbox connected yet.')}
                    action={{ label: t('support.settings.go_inboxes', 'Go to Inboxes'), onClick: onGo }}
                />
            </div>
        );
    }
}
