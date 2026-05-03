import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import VersionHistory from '../../../VersionHistory';

export default function VersionPicker({ t, agentId, onClose, onRestore }) {
    const popoverRef = useRef(null);
    useEffect(() => {
        const onDoc = (e) => {
            if (popoverRef.current?.contains(e.target)) return;
            if (e.target.closest?.('[data-popover-trigger="versions"]')) return;
            onClose();
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [onClose]);
    return (
        <div
            ref={popoverRef}
            className="absolute z-30 top-full left-0 mt-2 w-[420px] max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl"
        >
            <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">{t('agent_wizard.section.versions') || 'Version History'}</span>
                <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={14} /></button>
            </div>
            <div className="p-4">
                <VersionHistory agentId={agentId} onRestore={onRestore} />
            </div>
        </div>
    );
}
