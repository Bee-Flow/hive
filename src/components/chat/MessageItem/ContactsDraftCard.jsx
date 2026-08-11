import { UserPlus, Pencil, Mail, Phone, Building2, Briefcase, StickyNote } from 'lucide-react';
import React from 'react';
import DraftCardShell from './DraftCardShell';
import useDraftAction from '../../../hooks/useDraftAction';

export default function ContactsDraftCard({ msg, contactsDraftStatuses, setContactsDraftStatuses }) {
    const { confirm, discard, getStatus } = useDraftAction({
        endpoint: '/api/integrations/contacts/execute',
        statuses: contactsDraftStatuses,
        setStatuses: setContactsDraftStatuses,
    });

    if (!msg.contactsDrafts || msg.contactsDrafts.length === 0) return null;

    const isCreate = (draft) => draft.action === 'create';
    const displayName = (draft) => `${draft.firstName || ''}${draft.lastName ? ' ' + draft.lastName : ''}`.trim() || 'Contact';

    return msg.contactsDrafts.map((draft, i) => {
        const status = getStatus(draft, i);
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
            <DraftCardShell
                key={i}
                status={status}
                colors={colors}
                icon={ActionIcon}
                actionLabel={actionLabel}
                executingLabel="Saving..."
                titleIcon={UserPlus}
                title={displayName(draft)}
                onConfirm={() => confirm(draft, i)}
                onDiscard={() => discard(i)}
            >
                {/* Dynamic fields */}
                {fields.map(({ icon: Icon, value }, j) => (
                    <div key={j} className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                        <span className="text-[var(--text-secondary)] text-xs">{value}</span>
                    </div>
                ))}
            </DraftCardShell>
        );
    });
}
