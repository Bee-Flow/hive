import { Loader2, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import Modal from '../../../components/shared/Modal';
import useTranslation from '../../../hooks/useTranslation';

/**
 * NewNotebookModal — name a notebook, create it, open it.
 *
 * `onCreate` is useNotebookList's re-entrancy-guarded create(): hammering
 * Enter can fire this handler twice but only the first call reaches the
 * server; the second resolves null and is ignored.
 */
export default function NewNotebookModal({ open, onClose, onCreate, creating }) {
    const { t } = useTranslation();
    const [name, setName] = useState('');

    // Fresh field per open.
    useEffect(() => { if (open) setName(''); }, [open]);

    const submit = async (e) => {
        e?.preventDefault?.();
        if (!name.trim() || creating) return;
        await onCreate(name);
    };

    return (
        <Modal
            open={open}
            onClose={() => { if (!creating) onClose(); }}
            title={t('notebooks.new_notebook', 'New notebook')}
            description={t('notebooks.new_notebook_hint', 'Give it a name to get started')}
            size="sm"
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={creating}
                        className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={creating || !name.trim()}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        {t('notebooks.create_notebook', 'Create notebook')}
                    </button>
                </>
            }
        >
            <form onSubmit={submit}>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('notebooks.name_placeholder', 'Notebook name…')}
                    aria-label={t('notebooks.name_placeholder', 'Notebook name…')}
                    maxLength={120}
                    autoFocus
                    className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
                    style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                    }}
                />
            </form>
        </Modal>
    );
}
