import React, { useState } from 'react';
import { ChevronRight, ChevronDown, ExternalLink, CheckCircle2, Building2, Mail, Phone, Linkedin, MapPin, Sparkles, Loader2, PanelRightOpen } from 'lucide-react';

const STATUS_IDS = ['new', 'contacted', 'qualified', 'disqualified', 'converted'];
const STATUS_COLORS = {
    new: 'text-sky-500',
    contacted: 'text-amber-500',
    qualified: 'text-emerald-500',
    disqualified: 'text-rose-500',
    converted: 'text-green-600',
};

function StatusDot({ status }) {
    return <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[status] || 'text-[var(--text-tertiary)]'}`} style={{ backgroundColor: 'currentColor' }} />;
}

function confidencePct(c) {
    return c == null ? null : Math.round(Number(c) * 100);
}

function LeadRow({ lead, teammates, onPatch, onToggleVerify, onResearch, onDraftEmail, onOpenLead, busyResearchId, showCampaign, t, userId }) {
    const [open, setOpen] = useState(false);
    const pct = confidencePct(lead.aiConfidence);
    const researching = busyResearchId === lead.id;
    // Columns: checkbox + company + place + owner + email + phone + status +
    // assignee + confidence (=9) + [campaign?] + actions. Drawer spans all-but-checkbox.
    const colSpan = 9 + (showCampaign ? 1 : 0) + 1 - 1;
    const assigneeLabel = (id) => {
        if (!id) return '';
        const tm = teammates.find(m => m.id === id);
        return tm ? (tm.name || tm.email || id) : id;
    };

    return (
        <>
            <tr className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)]">
                <td className="px-2 py-2 align-top">
                    <input type="checkbox" checked={!!lead.verified}
                        onChange={() => onToggleVerify(lead)}
                        aria-label={t('leads.row.verify', 'Afvinken')}
                        className="mt-0.5 accent-emerald-500 cursor-pointer" />
                </td>
                <td className="px-2 py-2 align-top">
                    <button onClick={() => setOpen(o => !o)} className="flex items-start gap-1 text-left">
                        {open ? <ChevronDown size={13} className="mt-0.5 text-[var(--text-tertiary)]" /> : <ChevronRight size={13} className="mt-0.5 text-[var(--text-tertiary)]" />}
                        <span className="flex flex-col">
                            <span className="font-medium text-[var(--text-primary)] flex items-center gap-1">
                                {lead.companyName}
                                {lead.verified && <CheckCircle2 size={12} className="text-emerald-500" title={lead.checkedByUserId ? `${t('leads.row.verified_by', 'Geverifieerd door')} ${assigneeLabel(lead.checkedByUserId)}` : t('leads.row.verified', 'Geverifieerd')} />}
                            </span>
                            {lead.website && (
                                <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer"
                                    className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] inline-flex items-center gap-0.5 max-w-[180px] truncate">
                                    {lead.website.replace(/^https?:\/\//, '')} <ExternalLink size={9} />
                                </a>
                            )}
                        </span>
                    </button>
                </td>
                <td className="px-2 py-2 align-top text-[var(--text-secondary)]">{lead.address ? lead.address.split(',').slice(-1)[0].trim() : '—'}</td>
                <td className="px-2 py-2 align-top text-[var(--text-secondary)]">{lead.ownerName || '—'}</td>
                <td className="px-2 py-2 align-top text-[var(--text-secondary)] max-w-[170px] truncate">{lead.email || '—'}</td>
                <td className="px-2 py-2 align-top text-[var(--text-secondary)]">{lead.phone || '—'}</td>
                <td className="px-2 py-2 align-top">
                    <span className="inline-flex items-center gap-1.5">
                        <StatusDot status={lead.status} />
                        <select value={lead.status} onChange={e => onPatch(lead.id, { status: e.target.value })}
                            className="text-xs bg-transparent border-none text-[var(--text-secondary)] cursor-pointer focus:outline-none">
                            {STATUS_IDS.map(s => <option key={s} value={s}>{t(`leads.status.${s}`, s)}</option>)}
                        </select>
                    </span>
                </td>
                <td className="px-2 py-2 align-top">
                    <select value={lead.assigneeUserId || ''} onChange={e => onPatch(lead.id, { assigneeUserId: e.target.value || null })}
                        className="text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-1 py-0.5 text-[var(--text-secondary)] max-w-[120px]">
                        <option value="">{t('leads.row.unassigned', 'Niet toegewezen')}</option>
                        {userId && !teammates.some(m => m.id === userId) && <option value={userId}>{t('leads.row.assign_me', 'Aan mij')}</option>}
                        {teammates.map(m => <option key={m.id} value={m.id}>{m.name || m.email || m.id}{m.id === userId ? ` (${t('leads.row.you', 'jij')})` : ''}</option>)}
                    </select>
                </td>
                <td className="px-2 py-2 align-top text-right">
                    {pct != null ? <span className={`text-[11px] ${pct >= 70 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-[var(--text-tertiary)]'}`}>{pct}%</span> : <span className="text-[var(--text-tertiary)]">—</span>}
                </td>
                {showCampaign && (
                    <td className="px-2 py-2 align-top text-[var(--text-tertiary)] max-w-[140px] truncate" title={lead.campaignTitle || ''}>{lead.campaignTitle || '—'}</td>
                )}
                <td className="px-2 py-2 align-top whitespace-nowrap text-right">
                    <div className="inline-flex items-center gap-0.5">
                        <button onClick={() => onResearch?.(lead.id)} disabled={researching}
                            title={t('leads.actions.research', 'Meer info zoeken (AI)')}
                            aria-label={t('leads.actions.research', 'Meer info zoeken (AI)')}
                            className="p-1 rounded hover:bg-[var(--bg-tertiary,var(--bg-primary))] text-sky-500 disabled:opacity-50">
                            {researching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        </button>
                        <button onClick={() => onDraftEmail?.(lead)}
                            title={t('leads.actions.draft_email', 'E-mail opstellen (AI)')}
                            aria-label={t('leads.actions.draft_email', 'E-mail opstellen (AI)')}
                            className="relative p-1 rounded hover:bg-[var(--bg-tertiary,var(--bg-primary))] text-amber-500">
                            <Mail size={13} />
                            {lead.emailDraftSubject && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        </button>
                        {onOpenLead && (
                            <button onClick={() => onOpenLead(lead)}
                                title={t('crm.open_record', 'CRM openen')}
                                aria-label={t('crm.open_record', 'CRM openen')}
                                className="p-1 rounded hover:bg-[var(--bg-tertiary,var(--bg-primary))] text-[var(--text-tertiary)]">
                                <PanelRightOpen size={13} />
                            </button>
                        )}
                    </div>
                </td>
            </tr>
            {open && (
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                    <td></td>
                    <td colSpan={colSpan} className="px-2 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                            <Detail icon={<Building2 size={11} />} label={t('leads.detail.kvk', 'KvK-nummer')} value={lead.kvkNumber} />
                            <Detail icon={<MapPin size={11} />} label={t('leads.detail.address', 'Adres')} value={lead.address} />
                            <Detail label={t('leads.detail.branche', 'Branche')} value={lead.branche} />
                            <Detail label={t('leads.detail.size', 'Omvang')} value={lead.companySize} />
                            <Detail label={t('leads.detail.sbi', 'SBI-codes')} value={Array.isArray(lead.sbiCodes) && lead.sbiCodes.length ? lead.sbiCodes.join(', ') : null} />
                            <Detail icon={<Mail size={11} />} label="Email" value={lead.email} />
                            <Detail icon={<Phone size={11} />} label={t('leads.detail.phone', 'Telefoon')} value={lead.phone} />
                            <Detail label={t('leads.detail.contact_title', 'Functie')} value={lead.contactTitle} />
                            {lead.linkedinUrl && (
                                <div className="flex flex-col">
                                    <span className="text-[var(--text-tertiary)] flex items-center gap-1"><Linkedin size={11} /> LinkedIn</span>
                                    <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] truncate inline-flex items-center gap-0.5">{lead.linkedinUrl.replace(/^https?:\/\//, '')} <ExternalLink size={9} /></a>
                                </div>
                            )}
                        </div>
                        <div className="mt-3">
                            <label className="text-[var(--text-tertiary)] text-xs">{t('leads.detail.notes', 'Notities')}</label>
                            <textarea defaultValue={lead.notes || ''} rows={2}
                                onBlur={e => { if ((e.target.value || '') !== (lead.notes || '')) onPatch(lead.id, { notes: e.target.value }); }}
                                placeholder={t('leads.detail.notes_ph', 'Team-notities…')}
                                className="w-full mt-1 px-2 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)]" />
                        </div>
                        {lead.provenance && Object.keys(lead.provenance).length > 0 && (
                            <div className="mt-2 text-[10px] text-[var(--text-tertiary)]">
                                {t('leads.detail.sources', 'Bronnen')}: {Array.from(new Set(Object.values(lead.provenance).map(p => p?.source).filter(Boolean))).join(', ')}
                            </div>
                        )}
                        {/* AI actions + persisted outreach draft */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button onClick={() => onResearch?.(lead.id)} disabled={researching}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-sky-500/40 text-sky-600 hover:bg-sky-500/10 disabled:opacity-50">
                                {researching ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                {t('leads.actions.research', 'Meer info zoeken (AI)')}
                            </button>
                            <button onClick={() => onDraftEmail?.(lead)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-amber-500/40 text-amber-600 hover:bg-amber-500/10">
                                <Mail size={11} /> {t('leads.actions.draft_email', 'E-mail opstellen (AI)')}
                            </button>
                            {lead.lastResearchAt && (
                                <span className="text-[10px] text-[var(--text-tertiary)]">{t('leads.research.last_researched', 'Laatst onderzocht')}: {new Date(lead.lastResearchAt).toLocaleDateString()}</span>
                            )}
                        </div>
                        {lead.emailDraftSubject && (
                            <div className="mt-2 text-[11px] rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[var(--text-tertiary)] flex items-center gap-1"><Mail size={11} /> {t('leads.email.title', 'Concept e-mail')}</span>
                                    <button onClick={() => onDraftEmail?.(lead)} className="text-[var(--accent-primary)]">{t('leads.email.open', 'Bekijk/bewerk')}</button>
                                </div>
                                <div className="text-[var(--text-primary)] font-medium mt-0.5 truncate">{lead.emailDraftSubject}</div>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}

function Detail({ icon, label, value }) {
    if (!value) return null;
    return (
        <div className="flex flex-col">
            <span className="text-[var(--text-tertiary)] flex items-center gap-1">{icon}{label}</span>
            <span className="text-[var(--text-primary)] break-words">{value}</span>
        </div>
    );
}

/**
 * LeadTable — the collaborative lead list. Compact columns + an expandable
 * detail row for full data + provenance. Check-off (afvinken), status, and
 * assignee are inline; changes optimistically apply via the parent's callbacks
 * and reconcile over SSE.
 */
export default function LeadTable({ leads, teammates = [], onPatch, onToggleVerify, onResearch = () => {}, onDraftEmail = () => {}, onOpenLead = null, busyResearchId = '', showCampaign = false, t, userId }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="text-left text-[var(--text-tertiary)] border-b border-[var(--border-default)]">
                        <th className="px-2 py-2 font-medium w-8"></th>
                        <th className="px-2 py-2 font-medium">{t('leads.col.company', 'Bedrijf')}</th>
                        <th className="px-2 py-2 font-medium">{t('leads.col.place', 'Plaats')}</th>
                        <th className="px-2 py-2 font-medium">{t('leads.col.owner', 'Eigenaar')}</th>
                        <th className="px-2 py-2 font-medium">Email</th>
                        <th className="px-2 py-2 font-medium">{t('leads.col.phone', 'Tel')}</th>
                        <th className="px-2 py-2 font-medium">{t('leads.col.status', 'Status')}</th>
                        <th className="px-2 py-2 font-medium">{t('leads.col.assignee', 'Toegewezen')}</th>
                        <th className="px-2 py-2 font-medium text-right">{t('leads.col.confidence', 'Conf.')}</th>
                        {showCampaign && <th className="px-2 py-2 font-medium">{t('leads.col.campaign', 'Campagne')}</th>}
                        <th className="px-2 py-2 font-medium text-right">{t('leads.col.actions', 'AI')}</th>
                    </tr>
                </thead>
                <tbody>
                    {leads.map(lead => (
                        <LeadRow key={lead.id} lead={lead} teammates={teammates} onPatch={onPatch} onToggleVerify={onToggleVerify}
                            onResearch={onResearch} onDraftEmail={onDraftEmail} onOpenLead={onOpenLead} busyResearchId={busyResearchId} showCampaign={showCampaign}
                            t={t} userId={userId} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
