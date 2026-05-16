import React from 'react';
import { Infinity as InfIcon } from 'lucide-react';

export function UsageBar({ label, current = 0, limit, unit = '' }) {
    const isUnlimited = limit == null;
    const pct = !isUnlimited && limit > 0 ? Math.min(100, Math.round((current || 0) / limit * 100)) : 0;
    const barColor = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
    const txtColor = pct >= 90 ? 'text-rose-400' : 'text-[var(--text-muted)]';

    const fmtNum = n => (typeof n === 'number' ? n.toLocaleString() : '0');

    return (
        <div className="mb-2.5">
            <div className="flex items-center justify-between text-[11.5px] mb-1">
                <span className="text-[var(--text-secondary)]">{label}</span>
                <span className={txtColor}>
                    {fmtNum(current || 0)}{unit}{' / '}
                    {isUnlimited ? <InfIcon className="inline w-3 h-3 -mt-px" /> : <>{fmtNum(limit)}{unit} ({pct}%)</>}
                </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div className={`h-full ${barColor}`} style={{ width: isUnlimited ? '0%' : `${pct}%` }} />
            </div>
        </div>
    );
}
