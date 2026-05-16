import React from 'react';

export function Card({ children, className = '', accent, padded = true, hover = false, ...rest }) {
    const ring = accent ? `ring-1 ring-${accent}-500/30` : '';
    return (
        <div
            className={`bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl ${padded ? 'p-5' : ''} ${hover ? 'transition-colors hover:border-[var(--border-strong,rgba(255,255,255,0.18))]' : ''} ${ring} ${className}`}
            {...rest}
        >
            {children}
        </div>
    );
}

export function CardHeader({ icon: Icon, iconClass = 'text-blue-400', title, subtitle, action, className = '' }) {
    return (
        <div className={`flex items-start justify-between gap-4 mb-3 ${className}`}>
            <div className="flex items-center gap-2.5 min-w-0">
                {Icon && (
                    <div className={`shrink-0 ${iconClass}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                )}
                <div className="min-w-0">
                    {title && <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{title}</h3>}
                    {subtitle && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
