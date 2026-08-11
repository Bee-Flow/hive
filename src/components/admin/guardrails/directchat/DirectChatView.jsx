import React, { useState } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import Toggle from '../../../shared/Toggle';
import { saveDirectChatGuardrails } from '../api/guardrailsApi';
import { showToast } from '../Toast';

/**
 * Regex collections applied to direct chat.
 *
 * Worth being explicit about the scope, because the old UI was not: this is
 * ONE switch and ONE collection list for every organisation on the
 * installation. It is stored under `direct_chat_regex_guardrails`, not per org,
 * so an admin flipping it here changes direct chat for every tenant at once.
 */
const DirectChatView = ({ collections, directChat, setDirectChat, onSaved }) => {
    const { t } = useTranslation();
    const [saving, setSaving] = useState(false);

    const toggleCollection = (id) => {
        const has = directChat.collectionIds.includes(id);
        setDirectChat({
            ...directChat,
            collectionIds: has
                ? directChat.collectionIds.filter(c => c !== id)
                : [...directChat.collectionIds, id],
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveDirectChatGuardrails(directChat);
            showToast('success', t('admin.guard_saved'));
            onSaved?.();
        } catch (e) {
            showToast('error', e.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('admin.guard_tab_direct')}</h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                        {t('admin.gr_directchat_desc', 'Collections applied to direct chat across this whole installation.')}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="shrink-0 px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50
                               bg-[var(--accent-primary)] hover:opacity-90 transition-opacity
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                >
                    {saving ? t('admin.guard_saving') : t('admin.guard_save_all')}
                </button>
            </div>

            {/* Scope warning: this is not per-organisation, and nothing on the old
                screen said so. */}
            <p className="text-xs px-3 py-2 rounded-lg border border-amber-500/25 bg-amber-500/5 text-[var(--text-secondary)]">
                {t('admin.gr_directchat_scope_note', 'This setting is installation-wide. Every organisation shares it — per-organisation rules are configured on the Organisations tab.')}
            </p>

            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 space-y-4">
                <Toggle
                    checked={directChat.enabled}
                    onChange={(v) => setDirectChat({ ...directChat, enabled: v })}
                    label={t('admin.gr_directchat_enable', 'Apply regex collections to direct chat')}
                    description={t('admin.gr_directchat_enable_desc', 'Scan direct-chat messages in both directions and remove anything a selected collection matches.')}
                />

                {directChat.enabled && (
                    <div>
                        <p className="text-xs font-medium text-[var(--text-tertiary)] mb-2">
                            {t('admin.gr_directchat_collections', 'Collections')}
                        </p>
                        {collections.length === 0 ? (
                            <p className="text-sm text-[var(--text-tertiary)] italic">
                                {t('admin.gr_patterns_create_rules_first', 'Create rules first.')}
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {collections.map(col => (
                                    <label
                                        key={col.id}
                                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors
                                                    ${directChat.collectionIds.includes(col.id)
                                                ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30'
                                                : 'bg-white/5 border-transparent hover:border-white/10'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={directChat.collectionIds.includes(col.id)}
                                            onChange={() => toggleCollection(col.id)}
                                            className="w-4 h-4 rounded border-gray-600 bg-transparent text-[var(--accent-primary)]
                                                       focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                                        />
                                        <span className="text-sm text-[var(--text-primary)]">{col.name}</span>
                                        <span className="ml-auto text-xs text-[var(--text-tertiary)]">{col.ruleIds?.length || 0}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DirectChatView;
