import { useEffect } from 'react';

/**
 * Shown when a save returns 409 (the agent changed elsewhere — another tab, a
 * version restore, a publish). Mirrors AppStudio's conflict reconcile: the user
 * either takes the server's copy (discarding local edits) or overwrites with
 * their own. There is no undo stack in the agent editor, so "load latest"
 * discards unsaved changes — the copy says so explicitly.
 */
export default function AgentConflictModal({ t, busy, onLoadLatest, onOverwrite, onDismiss }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onDismiss(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onDismiss, busy]);

    return (
        <div
            className="fixed inset-0 z-[1200] bg-black/50 flex items-center justify-center p-4"
            onClick={() => { if (!busy) onDismiss(); }}
            role="alertdialog"
            aria-modal="true"
        >
            <div
                className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md shadow-xl border border-[var(--border-default)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-[var(--border-default)] text-sm font-semibold text-[var(--text-primary)]">
                    {t('agent_wizard.conflict.title', 'This agent changed elsewhere')}
                </div>
                <div className="px-5 py-4 text-sm text-[var(--text-secondary)] space-y-2">
                    <p>{t('agent_wizard.conflict.body', 'Someone (or another tab) saved this agent since you opened it. Choose how to continue:')}</p>
                    <ul className="list-disc pl-5 space-y-1 text-[13px]">
                        <li>{t('agent_wizard.conflict.load_latest_hint', 'Load latest — take the other version. Your unsaved changes in this tab are discarded.')}</li>
                        <li>{t('agent_wizard.conflict.overwrite_hint', 'Keep mine — overwrite with your version.')}</li>
                    </ul>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                    <button
                        onClick={onDismiss}
                        disabled={busy}
                        className="px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                    >
                        {t('agent_studio.cancel', 'Cancel')}
                    </button>
                    <button
                        onClick={onLoadLatest}
                        disabled={busy}
                        className="px-4 py-2 rounded-full text-sm border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                    >
                        {t('agent_wizard.conflict.load_latest', 'Load latest')}
                    </button>
                    <button
                        onClick={onOverwrite}
                        disabled={busy}
                        className="px-4 py-2 rounded-full text-sm bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
                    >
                        {busy
                            ? t('agent_wizard.builder.saving', 'Saving…')
                            : t('agent_wizard.conflict.overwrite', 'Keep mine')}
                    </button>
                </div>
            </div>
        </div>
    );
}
