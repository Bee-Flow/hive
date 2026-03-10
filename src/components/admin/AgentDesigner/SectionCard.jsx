import React from 'react';

const SectionCard = ({ title, icon, children, className = '' }) => (
    <div className={`rounded-xl border shadow-sm ${className}`} style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
            {icon && <div className="text-lg opacity-70">{icon}</div>}
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        <div className="p-5">
            {children}
        </div>
    </div>
);

export default SectionCard;
