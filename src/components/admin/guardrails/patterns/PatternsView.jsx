import { Trash2, Package, Plus } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { STARTER_SETS, applyStarterSet } from './starterSets';
import { useTranslation } from '../../../../hooks/useTranslation';
import { TIER_META, configuredTierKeys } from '../../../tierMeta';
import { apiJson, saveRegexGuardrails, generateRegexWithAi } from '../api/guardrailsApi';
import { showToast } from '../Toast';

/**
 * Regular expressions and the collections that group them — the server-wide
 * pattern library every organisation draws from.
 *
 * Fase 1 keeps the existing markup and fixes what was outright broken. The
 * rules table, live tester and risk badges land in Fase 2.
 */
const PatternsView = ({ rules, setRules, collections, setCollections, onSaved }) => {
    const { t } = useTranslation();
    const [newRuleName, setNewRuleName] = useState('');
    const [newRulePattern, setNewRulePattern] = useState('');
    const [newCollectionName, setNewCollectionName] = useState('');
    const [editingCollection, setEditingCollection] = useState(null);
    const [saving, setSaving] = useState(false);

    const [aiPrompt, setAiPrompt] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiMessage, setAiMessage] = useState(null);
    const [tiers, setTiers] = useState({});
    const [aiModelTier, setAiModelTier] = useState('');

    // The tier picker used to hard-code `fast|think|write|deep_thinking`, but the
    // real keys are `fast|standard|swarm|thinking|writer|pro`. Three of the four
    // matched nothing, so `tiers[key] || {}` silently fell back to the global
    // default model — including for `think`, which was the DEFAULT selection.
    // Sourcing the list from the server's own configured tiers makes that class
    // of drift impossible rather than fixing it once.
    useEffect(() => {
        let cancelled = false;
        apiJson('/ai/config/chat-models')
            .then((data) => {
                if (cancelled) return;
                const configured = data?.tiers || data || {};
                setTiers(configured);
                const keys = configuredTierKeys(configured).filter(k => k !== 'auto');
                setAiModelTier(prev => (prev && keys.includes(prev) ? prev : (keys[0] || '')));
            })
            .catch(() => { /* the picker just stays empty; generation still works on the server default */ });
        return () => { cancelled = true; };
    }, []);

    const tierKeys = configuredTierKeys(tiers).filter(k => k !== 'auto');

    const addRule = () => {
        if (!newRuleName.trim() || !newRulePattern.trim()) return;
        // Was `'r' + Date.now()`, which collides for two rules added inside the
        // same millisecond — and, more importantly, is not stable across an AI
        // regeneration that rewrites the whole library.
        setRules([...rules, { id: `r_${crypto.randomUUID()}`, name: newRuleName.trim(), pattern: newRulePattern.trim() }]);
        setNewRuleName('');
        setNewRulePattern('');
    };

    const removeRule = (id) => {
        setRules(rules.filter(r => r.id !== id));
        setCollections(collections.map(c => ({ ...c, ruleIds: c.ruleIds.filter(rId => rId !== id) })));
    };

    const addCollection = () => {
        if (!newCollectionName.trim()) return;
        setCollections([...collections, { id: `c_${crypto.randomUUID()}`, name: newCollectionName.trim(), ruleIds: [] }]);
        setNewCollectionName('');
    };

    const removeCollection = (id) => setCollections(collections.filter(c => c.id !== id));

    const toggleRuleInCollection = (colId, ruleId) => {
        setCollections(collections.map(c => {
            if (c.id !== colId) return c;
            const has = c.ruleIds.includes(ruleId);
            return { ...c, ruleIds: has ? c.ruleIds.filter(r => r !== ruleId) : [...c.ruleIds, ruleId] };
        }));
    };

    // Applying a template only stages the change — the admin still has to Save.
    // These rules feed the REDACTION path for every organisation bound to the
    // collection, so writing them on a single click would change what tenants see
    // before anyone had read them.
    const applyTemplate = (set) => {
        const next = applyStarterSet(set, rules, collections);
        setRules(next.rules);
        setCollections(next.collections);
        showToast(
            'success',
            next.addedRules === 0 && !next.addedCollection
                ? t('admin.gr_starter_already', 'That set is already in your library.')
                : t('admin.gr_starter_added', 'Added {n} rule(s) — review and save.')
                    .replace('{n}', next.addedRules),
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveRegexGuardrails({ rules, collections });
            showToast('success', t('admin.guard_saved'));
            onSaved?.();
        } catch (e) {
            showToast('error', e.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateWithAI = async () => {
        if (!aiPrompt.trim() || aiGenerating) return;
        setAiGenerating(true);
        setAiMessage(null);
        try {
            const data = await generateRegexWithAi({ prompt: aiPrompt.trim(), modelTier: aiModelTier });
            if (data?.success) {
                setRules(data.regexGuardrails?.rules || []);
                setCollections(data.regexGuardrails?.collections || []);
                setAiMessage({ type: 'success', text: data.message || 'Rules generated successfully!' });
                setAiPrompt('');
                onSaved?.();
            } else {
                setAiMessage({ type: 'error', text: data?.error || 'Failed to generate rules' });
            }
        } catch (e) {
            setAiMessage({ type: 'error', text: 'Error communicating with AI: ' + e.message });
        } finally {
            setAiGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('admin.guard_regex_title')}</h2>
                    <p className="text-sm text-[var(--text-secondary)]">{t('admin.guard_regex_desc')}</p>
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

            {/* Starter sets. The two empty columns below were the whole reason
                this page read as unfinished: an authoring surface with nothing to
                author from. Shown while the library is small, then out of the way. */}
            {rules.length < 6 && (
                <section
                    className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5"
                    aria-labelledby="gr-starter-heading"
                >
                    <h3
                        id="gr-starter-heading"
                        className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1"
                    >
                        {t('admin.gr_starter_title', 'Start from a template')}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">
                        {t('admin.gr_starter_desc', 'Ready-made collections per country and theme. They are added to your library for review — nothing is applied to an organisation until you bind the collection.')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {STARTER_SETS.map(set => (
                            <button
                                key={set.id}
                                type="button"
                                onClick={() => applyTemplate(set)}
                                title={set.description}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                           border border-[var(--border-default)] bg-[var(--bg-tertiary)]
                                           text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                                           hover:border-[var(--accent-primary)]/40 transition-colors
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                            >
                                <Plus size={13} aria-hidden="true" />
                                {set.name}
                            </button>
                        ))}
                    </div>
                    {/* Worth saying plainly: this layer is not the PII detector.
                        It is flat redaction that keeps working when the guard
                        service is down — the state that produces "Privacy
                        protection is temporarily unavailable". */}
                    <p className="mt-3 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                        {t('admin.gr_starter_note', 'These patterns are matched in the app itself, so they keep working when the PII Guard service is unavailable. They have no checksums — the guard handles that.')}
                    </p>
                </section>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Rules */}
                <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
                        {t('admin.gr_patterns_rules', 'Rules')}
                    </h3>
                    <div className="flex gap-2 mb-4">
                        <input
                            value={newRuleName}
                            onChange={e => setNewRuleName(e.target.value)}
                            placeholder={t('admin.gr_patterns_rule_name', 'Name')}
                            aria-label={t('admin.gr_patterns_rule_name', 'Name')}
                            className="w-1/3 px-3 py-2 rounded-lg border border-[var(--border-default)]
                                       bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm"
                        />
                        <input
                            value={newRulePattern}
                            onChange={e => setNewRulePattern(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addRule()}
                            placeholder={t('admin.gr_patterns_rule_pattern', 'Pattern…')}
                            aria-label={t('admin.gr_patterns_rule_pattern', 'Pattern…')}
                            className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-default)]
                                       bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-mono"
                        />
                        <button
                            onClick={addRule}
                            className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border-default)]
                                       text-[var(--accent-primary)] hover:bg-white/5 transition-colors
                                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                        >
                            {t('admin.gr_add', 'Add')}
                        </button>
                    </div>

                    <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                        {rules.length === 0 && (
                            <p className="text-center py-8 text-sm text-[var(--text-tertiary)] border-2 border-dashed border-white/5 rounded-lg">
                                {t('admin.gr_patterns_no_rules', 'No rules yet.')}
                            </p>
                        )}
                        {rules.map(rule => (
                            <div key={rule.id} className="flex items-center justify-between gap-3 p-3 rounded-lg group bg-[var(--bg-tertiary)] hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="font-medium text-sm text-[var(--text-primary)] whitespace-nowrap">{rule.name}</span>
                                    <code className="text-xs px-2 py-1 rounded font-mono truncate bg-[var(--bg-primary)] text-[var(--text-tertiary)]">{rule.pattern}</code>
                                </div>
                                {/* Was opacity-0 group-hover only — invisible to keyboard and touch. */}
                                <button
                                    onClick={() => removeRule(rule.id)}
                                    aria-label={t('admin.gr_delete_rule', 'Delete rule')}
                                    title={t('admin.gr_delete_rule', 'Delete rule')}
                                    className="shrink-0 p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-red-400 hover:bg-white/10
                                               transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100
                                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Collections */}
                <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
                        {t('admin.gr_patterns_collections', 'Collections')}
                    </h3>
                    <div className="flex gap-2 mb-4">
                        <input
                            value={newCollectionName}
                            onChange={e => setNewCollectionName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addCollection()}
                            placeholder={t('admin.gr_patterns_new_collection', 'New collection name…')}
                            aria-label={t('admin.gr_patterns_new_collection', 'New collection name…')}
                            className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-default)]
                                       bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm"
                        />
                        <button
                            onClick={addCollection}
                            className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border-default)]
                                       text-[var(--accent-primary)] hover:bg-white/5 transition-colors
                                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                        >
                            {t('admin.gr_create', 'Create')}
                        </button>
                    </div>

                    <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                        {collections.length === 0 && (
                            <p className="text-center py-8 text-sm text-[var(--text-tertiary)] border-2 border-dashed border-white/5 rounded-lg">
                                {t('admin.gr_patterns_no_collections', 'No collections yet.')}
                            </p>
                        )}
                        {collections.map(col => (
                            <div
                                key={col.id}
                                className="rounded-xl border bg-[var(--bg-tertiary)] transition-colors"
                                style={{ borderColor: editingCollection === col.id ? 'var(--accent-primary)' : 'var(--border-default)' }}
                            >
                                <div className="p-3 flex items-center justify-between border-b border-white/5">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Package size={16} className="shrink-0 text-[var(--text-tertiary)]" />
                                        <div className="min-w-0">
                                            <h4 className="font-medium text-sm text-[var(--text-primary)] truncate">{col.name}</h4>
                                            <span className="text-xs text-[var(--text-tertiary)]">
                                                {t('admin.gr_patterns_rule_count', '{n} rule(s)').replace('{n}', col.ruleIds.length)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={() => setEditingCollection(editingCollection === col.id ? null : col.id)}
                                            aria-expanded={editingCollection === col.id}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                                                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
                                                        ${editingCollection === col.id
                                                    ? 'bg-[var(--accent-primary)] text-white'
                                                    : 'bg-white/5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                                        >
                                            {editingCollection === col.id ? t('admin.gr_done', 'Done') : t('admin.gr_edit', 'Edit')}
                                        </button>
                                        <button
                                            onClick={() => removeCollection(col.id)}
                                            aria-label={t('admin.gr_delete_collection', 'Delete collection')}
                                            title={t('admin.gr_delete_collection', 'Delete collection')}
                                            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-red-400 hover:bg-white/5
                                                       transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {editingCollection === col.id ? (
                                    <div className="p-3 bg-black/10 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {rules.map(rule => (
                                            <label
                                                key={rule.id}
                                                className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors
                                                            ${col.ruleIds.includes(rule.id)
                                                        ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30'
                                                        : 'bg-white/5 border-transparent hover:border-white/10'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={col.ruleIds.includes(rule.id)}
                                                    onChange={() => toggleRuleInCollection(col.id, rule.id)}
                                                    className="w-4 h-4 rounded border-gray-600 bg-transparent text-[var(--accent-primary)]
                                                               focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                                                />
                                                <span className={`text-sm ${col.ruleIds.includes(rule.id) ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                                                    {rule.name}
                                                </span>
                                            </label>
                                        ))}
                                        {rules.length === 0 && (
                                            <p className="text-xs text-[var(--text-tertiary)] italic sm:col-span-2">
                                                {t('admin.gr_patterns_create_rules_first', 'Create rules first.')}
                                            </p>
                                        )}
                                    </div>
                                ) : col.ruleIds.length > 0 && (
                                    <div className="px-3 py-2.5 flex flex-wrap gap-2">
                                        {col.ruleIds.slice(0, 5).map(id => {
                                            const rule = rules.find(r => r.id === id);
                                            if (!rule) return null;
                                            return (
                                                <span key={id} className="text-xs px-2 py-1 rounded bg-white/5 text-[var(--text-tertiary)] border border-white/5">
                                                    {rule.name}
                                                </span>
                                            );
                                        })}
                                        {col.ruleIds.length > 5 && (
                                            <span className="text-xs text-[var(--text-tertiary)] py-1">+ {col.ruleIds.length - 5}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* AI generation */}
            <section className="p-5 rounded-xl border border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                    ✨ {t('admin.gr_ai_title', 'Generate with AI')}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mb-3">
                    {t('admin.gr_ai_desc', 'Describe what you want to detect and the AI will create rules and collections for you.')}
                </p>
                <div className="flex flex-wrap gap-2">
                    <input
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleGenerateWithAI()}
                        placeholder={t('admin.gr_ai_placeholder', 'e.g. Dutch IBAN and passport numbers, EU credit cards…')}
                        aria-label={t('admin.gr_ai_placeholder', 'e.g. Dutch IBAN and passport numbers, EU credit cards…')}
                        disabled={aiGenerating}
                        className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-[var(--border-default)]
                                   bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm disabled:opacity-50"
                    />
                    <label className="sr-only" htmlFor="gr-ai-tier">{t('admin.gr_ai_tier', 'Model tier')}</label>
                    <select
                        id="gr-ai-tier"
                        value={aiModelTier}
                        onChange={e => setAiModelTier(e.target.value)}
                        disabled={aiGenerating || tierKeys.length === 0}
                        className="px-3 py-2 rounded-lg border border-[var(--border-default)]
                                   bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm disabled:opacity-50"
                    >
                        {tierKeys.map(key => (
                            <option key={key} value={key}>{TIER_META[key]?.label || key}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleGenerateWithAI}
                        disabled={aiGenerating || !aiPrompt.trim()}
                        className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50
                                   bg-[var(--accent-primary)] hover:opacity-90 transition-opacity whitespace-nowrap
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    >
                        {aiGenerating ? t('admin.gr_ai_generating', 'Generating…') : t('admin.gr_ai_generate', 'Generate')}
                    </button>
                </div>
                {aiMessage && (
                    <p className={`mt-2 text-xs ${aiMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`} role="status">
                        {aiMessage.text}
                    </p>
                )}
                {/* The endpoint persists inside its tool loop and returns the WHOLE
                    library, which replaces anything unsaved here. Say so until the
                    review-then-adopt flow lands in Fase 2. */}
                <p className="mt-2 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                    {t('admin.gr_ai_replaces_warning', 'Generating saves immediately and replaces the full rule library — any unsaved edits above are lost.')}
                </p>
            </section>
        </div>
    );
};

export default PatternsView;
