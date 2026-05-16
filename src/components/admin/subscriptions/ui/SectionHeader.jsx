import React from 'react';

export function SectionHeader({ title, description, action, className = '' }) {
    return (
        <div className={`flex items-end justify-between gap-4 mb-5 ${className}`}>
            <div className="min-w-0">
                <h2 className="text-[19px] font-bold text-[var(--text-primary)] tracking-tight leading-tight">{title}</h2>
                {description && <p className="mt-1 text-[13px] text-[var(--text-muted)] leading-snug">{description}</p>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
