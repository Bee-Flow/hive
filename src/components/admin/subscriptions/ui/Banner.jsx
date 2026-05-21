import React from 'react';
import { Info, AlertTriangle, CheckCircle } from 'lucide-react';

const TONES = {
    info:    { wrap: 'bg-blue-500/8 border-blue-500/30 text-blue-800 dark:text-blue-200',         icon: Info,           accent: 'text-blue-500 dark:text-blue-400' },
    success: { wrap: 'bg-emerald-500/8 border-emerald-500/30 text-emerald-800 dark:text-emerald-100', icon: CheckCircle, accent: 'text-emerald-500 dark:text-emerald-400' },
    warning: { wrap: 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-100',    icon: AlertTriangle,  accent: 'text-amber-500 dark:text-amber-400' },
    danger:  { wrap: 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-100',        icon: AlertTriangle,  accent: 'text-rose-500 dark:text-rose-400' },
    teal:    { wrap: 'bg-teal-500/8 border-teal-500/30 text-teal-800 dark:text-teal-100',         icon: Info,           accent: 'text-teal-500 dark:text-teal-400' },
};

export function Banner({ tone = 'info', icon: IconOverride, title, children, className = '' }) {
    const t = TONES[tone] || TONES.info;
    const Icon = IconOverride || t.icon;
    return (
        <div className={`flex items-start gap-3 p-3 rounded-lg border ${t.wrap} ${className}`}>
            <Icon className={`shrink-0 mt-0.5 w-4 h-4 ${t.accent}`} />
            <div className="text-[12px] leading-relaxed min-w-0">
                {title && <div className="font-semibold text-[13px] mb-0.5">{title}</div>}
                {children}
            </div>
        </div>
    );
}
