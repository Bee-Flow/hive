/**
 * Tiny preview card that shows the admin what the end user experiences when
 * a given guardrail layer fires. Every layer card in the redesigned Privacy
 * Shield renders one of these so the mental model is immediately clear.
 */

import React from 'react';
import { Eye } from 'lucide-react';

export default function WhatTheUserSees({ title = 'What the end user sees', children }) {
    return (
        <div
            className="rounded-lg border p-3 mt-3"
            style={{
                background: 'rgba(59, 130, 246, 0.04)',
                borderColor: 'rgba(59, 130, 246, 0.18)',
            }}
        >
            <div className="flex items-center gap-1.5 mb-2">
                <Eye className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#3b82f6' }}>
                    {title}
                </span>
            </div>
            <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {children}
            </div>
        </div>
    );
}
