import React from 'react';
import { UserPlus, Check, Loader, X, Pencil, Mail, Phone, Building2, Briefcase, StickyNote } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';

export default function ContactsDraftCard({ msg, contactsDraftStatuses, setContactsDraftStatuses }) {
    if (!msg.contactsDrafts || msg.contactsDrafts.length === 0) return null;

    const handleConfirm = async (draft, index) => {
        setContactsDraftStatuses(prev => ({ ...prev, [index]: 'executing' }));
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/contacts/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            });
            if (res.ok) {
                setContactsDraftStatuses(prev => ({ ...prev, [index]: 'done' }));
            } else {
                const err = await res.json();
                setContactsDraftStatuses(prev => ({ ...prev, [index]: `failed: ${err.error}` }));
            }
        } catch (err) {
            setContactsDraftStatuses(prev => ({ ...prev, [index]: `failed: ${err.message}` }));
        }
    };

    const handleDiscard = (index) => {
        setContactsDraftStatuses(prev => ({ ...prev, [index]: 'discarded' }));
    };

    const isCreate = (draft) => draft.action === 'create';
    const displayName = (draft) => `${draft.firstName || ''}${draft.lastName ? ' ' + draft.lastName : ''}`.trim() || 'Contact';

    return msg.contactsDrafts.map((draft, i) => {
        const status = contactsDraftStatuses[i] || draft.status || 'pending';
        const isResolved = status === 'done' || status === 'discarded' || status.startsWith('failed');
        const ActionIcon = isCreate(draft) ? UserPlus : Pencil;
        const actionLabel = isCreate(draft) ? 'New Contact' : 'Update Contact';
        const colors = isCreate(draft)
            ? { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-500', btn: 'bg-emerald-600 hover:bg-emerald-500' }
            : { border: 'border-blue-500/30', bg: 'bg-blue-500/5', text: 'text-blue-500', btn: 'bg-blue-600 hover:bg-blue-500' };

        const fields = [
            { icon: Mail, label: 'Email', value: draft.email },
            { icon: Phone, label: 'Phone', value: draft.phone },
            { icon: Building2, label: 'Company', value: draft.company },
            { icon: Briefcase, label: 'Job Title', value: draft.jobTitle },
            { icon: StickyNote, label: 'Notes', value: draft.notes },
        ].filter(f => f.value);

        return (
            <div key={i} className={`my-3 rounded-xl border overflow-hidden transition-all duration-300 ${
                status === 'done' ? 'border-green-500/40 bg-green-500/5'
                : status === 'discarded' ? 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)] opacity-50'
                : status.startsWith('failed') ? 'border-red-500/40 bg-red-500/5'
                : `${colors.border} ${colors.bg}`
            }`}>
                {/* Header */}
                <div className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${
                    status === 'done' ? 'text-green-500'
                    : status === 'discarded' ? 'text-[var(--text-tertiary)]'
                    : status.startsWith('failed') ? 'text-red-500'
                    : colors.text
                }`}>
                    <ActionIcon className="w-3.5 h-3.5" />
                    <span>{
                        status === 'done' ? `${actionLabel} ✓`
                        : status === 'discarded' ? 'Discarded'
                        : status === 'executing' ? 'Saving...'
                        : status.startsWith('failed') ? 'Failed'
                        : `${actionLabel} — Awaiting Approval`
                    }</span>
                </div>

                {/* Contact Details */}
                <div className="px-4 pb-3 space-y-2">
                    {/* Name */}
                    <div className="flex items-center gap-2.5">
                        <UserPlus className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                        <span className="text-[var(--text-primary)] font-semibold text-sm">{displayName(draft)}</span>
                    </div>

                    {/* Dynamic fields */}
                    {fields.map(({ icon: Icon, value }, j) => (
                        <div key={j} className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                            <span className="text-[var(--text-secondary)] text-xs">{value}</span>
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                {!isResolved && (
                    <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                        <button
                            onClick={() => handleConfirm(draft, i)}
                            disabled={status === 'executing'}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold ${colors.btn} text-white transition-colors disabled:opacity-50`}
                        >
                            {status === 'executing' ? (
                                <><Loader className="w-3 h-3 animate-spin" /> Saving...</>
                            ) : (
                                <><Check className="w-3 h-3" /> Confirm</>
                            )}
                        </button>
                        <button
                            onClick={() => handleDiscard(i)}
                            disabled={status === 'executing'}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                            <X className="w-3 h-3" /> Discard
                        </button>
                    </div>
                )}

                {/* Error */}
                {status.startsWith('failed') && (
                    <div className="px-4 py-2 text-xs text-red-400 border-t border-red-500/20">
                        {status.replace('failed: ', 'Error: ')}
                    </div>
                )}
            </div>
        );
    });
}
