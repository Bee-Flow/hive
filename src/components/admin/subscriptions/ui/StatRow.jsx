import React from 'react';
import { Infinity as InfIcon } from 'lucide-react';

export function StatRow({ label, value, hint, unit = '' }) {
    const unlimited = value == null;
    const display = unlimited
        ? <InfIcon className="inline w-3.5 h-3.5 -mt-px" />
        : (unit === '€' ? `€${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `${Number(value).toLocaleString()}${unit}`);
    return (
        <div className="flex items-center justify-between gap-2 text-[12px] py-0.5">
            <span className="text-[var(--text-muted)] truncate">{label}</span>
            <span className="text-[var(--text-primary)] font-semibold tabular-nums">{display}</span>
            {hint && <span className="text-[var(--text-muted)] text-[10.5px]">{hint}</span>}
        </div>
    );
}

export function StatGrid({ children, className = '' }) {
    return <div className={`grid grid-cols-2 gap-x-4 gap-y-0.5 ${className}`}>{children}</div>;
}
