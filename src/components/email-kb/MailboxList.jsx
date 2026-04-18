import React from 'react';
import { Plus } from 'lucide-react';
import ProviderIcon from './ProviderIcon';
import SyncStatusBadge from './SyncStatusBadge';
import { timeAgo } from './utils';

const MailboxListItem = ({ conn, selected, onSelect, t }) => (
    <button
        onClick={() => onSelect(conn.id)}
        className={`w-full text-left p-3 rounded-lg border transition-all ${
            selected
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-sm'
                : 'border-transparent hover:bg-[var(--bg-secondary)]'
        }`}
    >
        <div className="flex items-center gap-2.5 min-w-0">
            <ProviderIcon provider={conn.provider} size={22} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {conn.email_address}
                    </span>
                    <SyncStatusBadge status={conn.sync_status} compact />
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                    {timeAgo(conn.last_sync_at)} · {conn.total_articles_created || 0} {t('email_kb.articles_created').toLowerCase()}
                </div>
            </div>
            {!conn.enabled && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium flex-shrink-0">
                    {t('email_kb.disabled')}
                </span>
            )}
        </div>
    </button>
);

const MailboxList = ({ connections, selectedId, onSelect, onAdd, t }) => (
    <div className="w-64 flex-shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 flex flex-col">
        <div className="px-3 py-3 flex items-center justify-between border-b border-[var(--border-subtle)]">
            <span className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                {t('email_kb.mailbox_list_title')}
            </span>
            <button onClick={onAdd}
                className="p-1 rounded-md text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10"
                title={t('email_kb.connect_mailbox')}>
                <Plus className="w-4 h-4" />
            </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {connections.map(conn => (
                <MailboxListItem
                    key={conn.id}
                    conn={conn}
                    selected={conn.id === selectedId}
                    onSelect={onSelect}
                    t={t}
                />
            ))}
        </div>
    </div>
);

export default MailboxList;
