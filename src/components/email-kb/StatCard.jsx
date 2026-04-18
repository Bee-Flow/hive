import React from 'react';

const StatCard = ({ icon: Icon, label, value, accent, children }) => (
    <div className="flex-1 min-w-0 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="flex items-center gap-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
            {Icon && <Icon className={`w-3.5 h-3.5 ${accent || ''}`} />}
            <span className="truncate">{label}</span>
        </div>
        <div className="mt-1.5 text-[20px] font-bold text-[var(--text-primary)] truncate">
            {value}
        </div>
        {children && (
            <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">{children}</div>
        )}
    </div>
);

export default StatCard;
