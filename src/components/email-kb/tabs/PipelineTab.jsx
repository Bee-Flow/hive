import React, { useState, useEffect } from 'react';
import {
    Sparkles, Sparkle, Layers, FileText, CheckCircle2, ChevronRight, RotateCcw, Loader2,
    Shield, Filter, Combine
} from 'lucide-react';
import StageTestPanel from '../pipeline/StageTestPanel';

const STAGES = [
    { key: 'cleanup',    icon: Sparkle,      color: 'slate',   configurable: false, titleKey: 'email_kb.stage_cleanup',    descKey: 'email_kb.stage_cleanup_desc' },
    { key: 'pii',        icon: Shield,       color: 'rose',    configurable: false, titleKey: 'email_kb.stage_pii',        descKey: 'email_kb.stage_pii_desc', togglesSetting: 'redact_pii' },
    { key: 'usefulness', icon: Filter,       color: 'cyan',    configurable: false, titleKey: 'email_kb.stage_usefulness', descKey: 'email_kb.stage_usefulness_desc', comingSoon: true },
    { key: 'article',    icon: Sparkles,     color: 'blue',    configurable: true,  titleKey: 'email_kb.stage_article',    descKey: 'email_kb.stage_article_desc', withParallel: true },
    { key: 'category',   icon: Layers,       color: 'amber',   configurable: true,  titleKey: 'email_kb.stage_category',   descKey: 'email_kb.stage_category_desc' },
    { key: 'merge',      icon: FileText,     color: 'purple',  configurable: true,  titleKey: 'email_kb.stage_merge',      descKey: 'email_kb.stage_merge_desc' },
    { key: 'dedupe',     icon: Combine,      color: 'fuchsia', configurable: false, titleKey: 'email_kb.stage_dedupe',     descKey: 'email_kb.stage_dedupe_desc', comingSoon: true },
    { key: 'ingest',     icon: CheckCircle2, color: 'emerald', configurable: false, titleKey: 'email_kb.stage_ingest',     descKey: 'email_kb.stage_ingest_desc' },
];

const COLORS = {
    slate:   { bg: 'bg-slate-500/10',   border: 'border-slate-400/40',   text: 'text-slate-600',   solid: 'bg-slate-500' },
    rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/40',    text: 'text-rose-600',    solid: 'bg-rose-500' },
    cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/40',    text: 'text-cyan-600',    solid: 'bg-cyan-500' },
    blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/40',    text: 'text-blue-600',    solid: 'bg-blue-500' },
    amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/40',   text: 'text-amber-600',   solid: 'bg-amber-500' },
    purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/40',  text: 'text-purple-600',  solid: 'bg-purple-500' },
    fuchsia: { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/40', text: 'text-fuchsia-600', solid: 'bg-fuchsia-500' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-600', solid: 'bg-emerald-500' },
};

const StageNode = ({ stage, idx, selected, inactive, onClick, tier, subLabel, t }) => {
    const c = COLORS[stage.color];
    const Icon = stage.icon;
    return (
        <button
            onClick={() => onClick(stage.key)}
            disabled={!stage.configurable}
            className={`group flex flex-col items-center text-center w-28 flex-shrink-0 transition-all ${
                stage.configurable ? 'cursor-pointer' : 'cursor-default'
            } ${inactive ? 'opacity-40' : ''}`}
        >
            <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all ${
                selected
                    ? `${c.bg} ${c.border} ring-2 ring-offset-2 ring-offset-[var(--bg-primary)] ring-[var(--accent-primary)]`
                    : `${c.bg} ${c.border} ${stage.configurable ? 'group-hover:scale-105' : ''}`
            }`}>
                <Icon className={`w-6 h-6 ${c.text}`} />
                <span className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full ${c.solid} text-white text-[10px] font-bold flex items-center justify-center`}>
                    {idx + 1}
                </span>
                {stage.comingSoon && (
                    <span className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[8px] font-bold text-[var(--text-tertiary)] flex items-center justify-center" title={t('email_kb.stage_coming_soon')}>
                        ⋯
                    </span>
                )}
            </div>
            <div className="mt-2 text-[11px] font-semibold text-[var(--text-primary)] leading-tight">
                {t(stage.titleKey)}
            </div>
            {tier && stage.configurable && (
                <div className={`mt-1 text-[10px] ${c.text} font-medium`}>{t(`email_kb.tier_${tier}`)}</div>
            )}
            {subLabel && (
                <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">{subLabel}</div>
            )}
            {inactive && !subLabel && (
                <div className="mt-1 text-[10px] text-[var(--text-tertiary)] italic">
                    {t('email_kb.pipeline_stage_inactive')}
                </div>
            )}
        </button>
    );
};

const StageConfigDrawer = ({ stage, pc, setSettings, connectionId, t }) => {
    if (!stage?.configurable) return null;
    const stageKey = stage.key;
    const cfg = pc[stageKey];
    const c = COLORS[stage.color];

    const update = (patch) =>
        setSettings(s => ({
            ...s,
            pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], ...patch } },
        }));

    const acceptAiPrompt = (newPrompt) => update({ systemPrompt: newPrompt });

    return (
        <div className={`mt-4 p-4 rounded-xl border ${c.border} bg-[var(--bg-primary)] space-y-3`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[13px] font-semibold text-[var(--text-primary)]">{t(stage.titleKey)}</div>
                    <div className="text-[11px] text-[var(--text-tertiary)]">{t(stage.descKey)}</div>
                </div>
                <div className="flex items-center gap-2">
                    {stage.withParallel && (
                        <>
                            <div className="flex flex-col items-end">
                                <label className="text-[9px] text-[var(--text-tertiary)]" title={t('email_kb.parallel_help')}>{t('email_kb.parallel')}</label>
                                <input type="number" min="1" max="10"
                                    placeholder={cfg.modelTier === 'deep_thinking' ? '3' : cfg.modelTier === 'fast' ? '8' : '5'}
                                    value={cfg.concurrency ?? ''}
                                    onChange={e => {
                                        const raw = e.target.value;
                                        if (raw === '') return update({ concurrency: undefined });
                                        update({ concurrency: Math.max(1, Math.min(10, parseInt(raw) || 1)) });
                                    }}
                                    className="w-14 px-2 py-1 rounded text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-right" />
                            </div>
                            <div className="flex flex-col items-end">
                                <label className="text-[9px] text-[var(--text-tertiary)]" title={t('email_kb.batch_help')}>{t('email_kb.batch')}</label>
                                <input type="number" min="1" max="5"
                                    value={cfg.batch_size ?? 1}
                                    onChange={e => update({ batch_size: Math.max(1, Math.min(5, parseInt(e.target.value) || 1)) })}
                                    className="w-12 px-2 py-1 rounded text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-right" />
                            </div>
                        </>
                    )}
                    <div className="flex flex-col items-end">
                        <label className="text-[9px] text-[var(--text-tertiary)]">{t('email_kb.model_tier')}</label>
                        <select value={cfg.modelTier} onChange={e => update({ modelTier: e.target.value })}
                            className="px-2 py-1 rounded text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                            <option value="fast">{t('email_kb.tier_fast')}</option>
                            <option value="thinking">{t('email_kb.tier_thinking')}</option>
                            <option value="writer">{t('email_kb.tier_writer')}</option>
                            <option value="deep_thinking">{t('email_kb.tier_deep_thinking')}</option>
                        </select>
                    </div>
                </div>
            </div>

            <details className="text-[11px]">
                <summary className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] inline-flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" /> {t('email_kb.custom_prompt')}
                </summary>
                <textarea value={cfg.systemPrompt}
                    onChange={e => update({ systemPrompt: e.target.value })}
                    placeholder={t('email_kb.custom_prompt_placeholder')} rows={4}
                    className="w-full mt-2 px-2 py-1.5 rounded text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] resize-y font-mono" />
                {cfg.systemPrompt && (
                    <button onClick={() => update({ systemPrompt: '' })}
                        className="flex items-center gap-1 mt-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]">
                        <RotateCcw className="w-3 h-3" /> {t('email_kb.reset_prompt')}
                    </button>
                )}
            </details>

            {connectionId && (
                <StageTestPanel
                    connectionId={connectionId}
                    stageKey={stageKey}
                    currentPrompt={cfg.systemPrompt}
                    currentModelTier={cfg.modelTier}
                    onAcceptPrompt={acceptAiPrompt}
                    t={t}
                />
            )}
        </div>
    );
};

const Connector = ({ active }) => (
    <div className="flex-1 flex items-center h-14 relative min-w-[24px]">
        <div className={`h-px flex-1 ${active ? 'bg-[var(--accent-primary)]/40' : 'bg-[var(--border-subtle)]'}`} />
        <ChevronRight className={`w-3 h-3 -ml-1 ${active ? 'text-[var(--accent-primary)]/60' : 'text-[var(--border-default)]'}`} />
    </div>
);

const PipelineTab = ({ controller, onEditingChange, connectionId, t }) => {
    const { settings, setSettings, dirty, saving, save, discard } = controller;
    const pc = settings.pipeline_config;
    const mode = pc.ingestion_mode || 'category_merge';
    const isPerEmail = mode === 'per_email';

    const [selectedStage, setSelectedStage] = useState('article');
    const stage = STAGES.find(s => s.key === selectedStage);

    useEffect(() => {
        onEditingChange?.(dirty);
        return () => onEditingChange?.(false);
    }, [dirty, onEditingChange]);

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                    <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{t('email_kb.pipeline_config')}</h3>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{t('email_kb.pipeline_click_configure')}</p>
                </div>

                {isPerEmail && (
                    <div className="text-[11px] text-[var(--text-tertiary)] p-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg">
                        {t('email_kb.pipeline_per_email_note')}
                    </div>
                )}

                {/* Horizontal flow */}
                <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-x-auto">
                    <div className="flex items-start gap-0 min-w-max">
                        {STAGES.map((s, i) => {
                            const inactive =
                                (isPerEmail && ['article', 'category', 'merge', 'dedupe'].includes(s.key)) ||
                                (s.togglesSetting && !settings[s.togglesSetting]);
                            let subLabel = null;
                            if (s.togglesSetting && !settings[s.togglesSetting]) subLabel = 'off';
                            else if (s.comingSoon) subLabel = t('email_kb.stage_coming_soon');
                            return (
                                <React.Fragment key={s.key}>
                                    <StageNode
                                        stage={s}
                                        idx={i}
                                        selected={s.key === selectedStage && s.configurable}
                                        inactive={inactive}
                                        onClick={setSelectedStage}
                                        tier={s.configurable ? pc[s.key]?.modelTier : null}
                                        subLabel={subLabel}
                                        t={t}
                                    />
                                    {i < STAGES.length - 1 && <Connector active={!inactive} />}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Config drawer for selected stage */}
                {stage?.configurable && (
                    <StageConfigDrawer
                        stage={stage}
                        pc={pc}
                        setSettings={setSettings}
                        connectionId={connectionId}
                        t={t}
                    />
                )}
            </div>

            {dirty && (
                <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
                    <span className="text-[12px] text-[var(--text-secondary)] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {t('email_kb.unsaved_changes')}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={discard} disabled={saving}
                            className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50">
                            {t('email_kb.discard_changes')}
                        </button>
                        <button onClick={save} disabled={saving}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 shadow-sm">
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {saving ? t('email_kb.saving') : t('email_kb.save_changes')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PipelineTab;
