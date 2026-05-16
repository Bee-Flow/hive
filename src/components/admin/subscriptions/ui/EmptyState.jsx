import React from 'react';

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
    return (
        <div className={`flex flex-col items-center justify-center text-center py-14 px-6 rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-secondary)]/40 ${className}`}>
            {Icon && (
                <div className="mb-3 w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)]">
                    <Icon className="w-6 h-6" />
                </div>
            )}
            {title && <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{title}</h4>}
            {description && <p className="text-[12px] text-[var(--text-muted)] max-w-sm leading-relaxed">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
