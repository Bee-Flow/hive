import React, { useState, useEffect } from 'react';
import { Plus, AlertTriangle, Loader2, RotateCcw } from 'lucide-react';

const Section = ({ title, description, children }) => (
    <section className="space-y-3">
        <div>
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</h3>
            {description && <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{description}</p>}
        </div>
        {children}
    </section>
);

const Field = ({ label, children, className = '' }) => (
    <div className={className}>
        <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">{label}</label>
        {children}
    </div>
);

const SettingsTab = ({ conn, controller, onEditingChange, knowledgeBases, t }) => {
    const { settings, setSettings, dirty, saving, save, discard } = controller;
    const [senderInput, setSenderInput] = useState('');
    const [folderInput, setFolderInput] = useState('');

    useEffect(() => {
        onEditingChange?.(dirty);
        return () => onEditingChange?.(false);
    }, [dirty, onEditingChange]);

    const pc = settings.pipeline_config;
    const effectiveMode = pc.ingestion_mode || 'category_merge';
    const setMode = (mode) => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, ingestion_mode: mode } }));
    const setPromptOverride = (stage, value) =>
        setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stage]: { ...s.pipeline_config[stage], systemPrompt: value } } }));

    const addBlacklistEntry = () => {
        const entry = senderInput.trim().toLowerCase();
        if (entry && !settings.sender_blacklist.includes(entry)) {
            setSettings(s => ({ ...s, sender_blacklist: [...s.sender_blacklist, entry] }));
            setSenderInput('');
        }
    };
    const removeBlacklistEntry = (email) =>
        setSettings(s => ({ ...s, sender_blacklist: s.sender_blacklist.filter(e => e !== email) }));
    const addFolderEntry = () => {
        const entry = folderInput.trim();
        if (entry && !settings.folder_filter.includes(entry)) {
            setSettings(s => ({ ...s, folder_filter: [...s.folder_filter, entry] }));
            setFolderInput('');
        }
    };
    const removeFolderEntry = (f) =>
        setSettings(s => ({ ...s, folder_filter: s.folder_filter.filter(x => x !== f) }));

    const input = "w-full px-3 py-2 rounded-lg text-[12px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] transition-colors";

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                <Section title={t('email_kb.connection_settings')}>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={t('email_kb.target_kb')}>
                            <select value={settings.knowledge_base_id}
                                onChange={e => setSettings(s => ({ ...s, knowledge_base_id: e.target.value }))}
                                className={input}>
                                {(knowledgeBases || []).map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
                            </select>
                        </Field>
                        <Field label={t('email_kb.language')}>
                            <select value={pc.language}
                                onChange={e => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, language: e.target.value } }))}
                                className={input}>
                                <option value="">{t('email_kb.language_auto')}</option>
                                <option value="Nederlands">Nederlands</option>
                                <option value="English">English</option>
                                <option value="Deutsch">Deutsch</option>
                                <option value="Français">Français</option>
                            </select>
                        </Field>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <Field label={t('email_kb.sync_interval')}>
                            <div className="flex items-center gap-2">
                                <input type="range" min="15" max="120" step="15" value={settings.sync_interval_minutes}
                                    onChange={e => setSettings(s => ({ ...s, sync_interval_minutes: parseInt(e.target.value) }))}
                                    className="flex-1 accent-[var(--accent-primary)]" />
                                <span className="text-[11px] text-[var(--text-primary)] w-12 text-right tabular-nums">{settings.sync_interval_minutes}m</span>
                            </div>
                        </Field>
                        <Field label={t('email_kb.sync_after_date')}>
                            <input type="date" value={settings.sync_after_date || ''}
                                onChange={e => setSettings(s => ({ ...s, sync_after_date: e.target.value || '' }))}
                                className={input} />
                        </Field>
                        <Field label={t('email_kb.max_emails')}>
                            <input type="number" min="1" max="500" value={settings.max_emails_per_sync}
                                onChange={e => setSettings(s => ({ ...s, max_emails_per_sync: Math.max(1, Math.min(500, parseInt(e.target.value) || 50)) }))}
                                className={input} />
                        </Field>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-1">
                        {[
                            ['group_threads', t('email_kb.group_threads')],
                            ['process_attachments', t('email_kb.process_attachments')],
                            ['redact_pii', t('email_kb.redact_pii')],
                        ].map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
                                <input type="checkbox" checked={!!settings[key]}
                                    onChange={e => setSettings(s => ({ ...s, [key]: e.target.checked }))}
                                    className="w-4 h-4 rounded accent-[var(--accent-primary)]" />
                                <span className="text-[12px] text-[var(--text-primary)]">{label}</span>
                            </label>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label={t('email_kb.folder_filter')}>
                            <div className="flex gap-1 mb-1.5">
                                <input value={folderInput} onChange={e => setFolderInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFolderEntry())}
                                    placeholder={conn.provider === 'gmail' ? 'SENT, INBOX' : 'Inbox, SentItems'}
                                    className={input} />
                                <button onClick={addFolderEntry}
                                    className="px-2 py-1 rounded-lg text-[11px] bg-[var(--accent-primary)] text-white">
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {settings.folder_filter.map(f => (
                                    <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-500/10 text-blue-600">
                                        {f}
                                        <button onClick={() => removeFolderEntry(f)} className="hover:text-blue-800">×</button>
                                    </span>
                                ))}
                            </div>
                        </Field>
                        <Field label={t('email_kb.sender_blacklist')}>
                            <div className="flex gap-1 mb-1.5">
                                <input value={senderInput} onChange={e => setSenderInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBlacklistEntry())}
                                    placeholder="noreply@example.com"
                                    className={input} />
                                <button onClick={addBlacklistEntry}
                                    className="px-2 py-1 rounded-lg text-[11px] bg-[var(--accent-primary)] text-white">
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {settings.sender_blacklist.map(e => (
                                    <span key={e} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-red-500/10 text-red-600">
                                        {e}
                                        <button onClick={() => removeBlacklistEntry(e)} className="hover:text-red-800">×</button>
                                    </span>
                                ))}
                            </div>
                        </Field>
                    </div>
                </Section>

                <div className="border-t border-[var(--border-subtle)]" />

                <Section title={t('email_kb.ingestion_mode')} description={t('email_kb.ingestion_mode_desc')}>
                    <div className="space-y-2">
                        <label className={`flex items-start gap-2.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${effectiveMode === 'per_email' ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'}`}>
                            <input type="radio" name="ingestion_mode" className="mt-0.5" checked={effectiveMode === 'per_email'} onChange={() => setMode('per_email')} />
                            <div>
                                <div className="text-[12px] font-semibold text-[var(--text-primary)]">{t('email_kb.ingestion_per_email')}</div>
                                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{t('email_kb.ingestion_per_email_desc')}</div>
                            </div>
                        </label>
                        <label className={`flex items-start gap-2.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${effectiveMode === 'category_merge' ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'}`}>
                            <input type="radio" name="ingestion_mode" className="mt-0.5" checked={effectiveMode === 'category_merge'} onChange={() => setMode('category_merge')} />
                            <div>
                                <div className="text-[12px] font-semibold text-[var(--text-primary)]">{t('email_kb.ingestion_category')}</div>
                                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{t('email_kb.ingestion_category_desc')}</div>
                            </div>
                        </label>
                        {effectiveMode === 'per_email' && (
                            <div className="flex items-start gap-2 text-[11px] text-amber-700 p-2.5 bg-amber-50 rounded-lg">
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                <span>{t('email_kb.ingestion_per_email_warn')}</span>
                            </div>
                        )}
                    </div>
                </Section>

                {/* Custom prompts (carried from advanced pipeline config) */}
                <div className="border-t border-[var(--border-subtle)]" />

                <Section title={t('email_kb.custom_prompt')} description={t('email_kb.custom_prompt_desc')}>
                    {['article', 'category', 'merge'].map(stage => (
                        <details key={stage} className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                            <summary className="cursor-pointer text-[12px] font-medium text-[var(--text-primary)] flex items-center justify-between">
                                <span>{t(`email_kb.stage_${stage}`)}</span>
                                {pc[stage].systemPrompt && <span className="text-[10px] text-[var(--accent-primary)]">(customized)</span>}
                            </summary>
                            <textarea value={pc[stage].systemPrompt}
                                onChange={e => setPromptOverride(stage, e.target.value)}
                                placeholder={t('email_kb.custom_prompt_placeholder')} rows={4}
                                className="w-full mt-2 px-2 py-1.5 rounded text-[11px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] resize-y font-mono" />
                            {pc[stage].systemPrompt && (
                                <button onClick={() => setPromptOverride(stage, '')}
                                    className="flex items-center gap-1 mt-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]">
                                    <RotateCcw className="w-3 h-3" /> {t('email_kb.reset_prompt')}
                                </button>
                            )}
                        </details>
                    ))}
                </Section>
            </div>

            {/* Sticky dirty bar */}
            {dirty && (
                <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
                    <span className="text-[12px] text-[var(--text-secondary)] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {t('email_kb.unsaved_changes')}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={discard} disabled={saving}
                            className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50 transition-colors">
                            {t('email_kb.discard_changes')}
                        </button>
                        <button onClick={save} disabled={saving}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 shadow-sm transition-all">
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {saving ? t('email_kb.saving') : t('email_kb.save_changes')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsTab;
