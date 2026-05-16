import React from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ label = 'Loading…', className = '' }) {
    return (
        <div className={`flex items-center justify-center gap-2 py-12 text-[13px] text-[var(--text-muted)] ${className}`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            {label}
        </div>
    );
}
