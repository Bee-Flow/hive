import React from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

const STYLES = {
    idle:    { bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500', icon: CheckCircle2, key: 'email_kb.sync_status_idle' },
    syncing: { bg: 'bg-blue-500/10',    text: 'text-blue-600',    dot: 'bg-blue-500',    icon: Loader2,       key: 'email_kb.sync_status_syncing' },
    error:   { bg: 'bg-red-500/10',     text: 'text-red-600',     dot: 'bg-red-500',     icon: XCircle,       key: 'email_kb.sync_status_error' },
};

const SyncStatusBadge = ({ status, t, compact = false }) => {
    const s = STYLES[status] || STYLES.idle;
    const Icon = s.icon;
    if (compact) {
        return (
            <span className={`inline-block w-2 h-2 rounded-full ${s.dot} ${status === 'syncing' ? 'animate-pulse' : ''}`} />
        );
    }
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>
            <Icon className={`w-3 h-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
            {t(s.key)}
        </span>
    );
};

export default SyncStatusBadge;
