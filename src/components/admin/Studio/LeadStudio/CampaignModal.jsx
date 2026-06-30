import React, { useState, useMemo, useEffect } from 'react';
import { X, Target, Bot, ShieldCheck, Database, Mail } from 'lucide-react';
import ModelTierSelector from '../../../ModelTierSelector';
import FormField from '../../../shared/FormField';
import Toggle from '../../../shared/Toggle';
import useTranslation from '../../../../hooks/useTranslation';

/**
 * New-campaign wizard for Lead Studio: criteria (branche / type / omvang /
 * locatie), how many leads to find, the model tier that drives the agent, which
 * enrichment providers to use (greyed when not configured for the org), and the
 * AVG legitimate-interest notice + retention window. Submit creates the campaign
 * and immediately starts the run.
 */
export default function CampaignModal({ onClose, onSubmit, initial = null, modelTiers = {}, providers = [], t: tProp }) {
    const { t: tHook } = useTranslation();
    const t = tProp || tHook;
    const isEdit = !!initial;
    const ic = initial?.criteria || {};
    const [title, setTitle] = useState(initial?.title || '');
    const [branche, setBranche] = useState(ic.branche || '');
    const [type, setType] = useState(ic.bedrijfstype || ic.type || '');
    const [omvang, setOmvang] = useState(ic.omvang || ic.size || '');
    const [locatie, setLocatie] = useState(ic.locatie || ic.location || '');
    const [outreachPitch, setOutreachPitch] = useState(initial?.outreachPitch || '');
    const [targetCount, setTargetCount] = useState(initial?.targetCount ?? 25);
    const [retentionDays, setRetentionDays] = useState(initial?.retentionDays ?? 90);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);

    // Offer every configured tier that resolves to a concrete model (drop 'auto').
    const selectableTiers = useMemo(() => {
        const out = {};
        for (const [k, v] of Object.entries(modelTiers || {})) {
            if (k === 'auto') continue;
            if (v && typeof v.modelId === 'string' && v.modelId.trim()) out[k] = v;
        }
        return out;
    }, [modelTiers]);
    const defaultTier = useMemo(
        () => (selectableTiers.standard ? 'standard' : selectableTiers.thinking ? 'thinking' : Object.keys(selectableTiers)[0] || 'standard'),
        [selectableTiers],
    );
    const [modelTier, setModelTier] = useState(initial?.modelTier || defaultTier);
    const [tierTouched, setTierTouched] = useState(false);
    useEffect(() => { if (!isEdit && !tierTouched) setModelTier(defaultTier); }, [defaultTier, isEdit, tierTouched]);
    const onTierChange = (v) => { setTierTouched(true); setModelTier(v); };

    // Provider toggles. web_search is always on; others default-on when configured.
    // In edit mode, seed from the campaign's saved provider list.
    const [enabledProviders, setEnabledProviders] = useState({});
    useEffect(() => {
        const saved = Array.isArray(initial?.enrichmentProviders) ? new Set(initial.enrichmentProviders) : null;
        const next = {};
        for (const p of providers) {
            if (saved) next[p.id] = p.alwaysOn || (saved.has(p.id) && p.configured);
            else next[p.id] = p.alwaysOn ? true : !!p.configured;
        }
        setEnabledProviders(next);
    }, [providers, initial]);

    const toggleProvider = (id, alwaysOn, configured) => {
        if (alwaysOn || !configured) return;
        setEnabledProviders(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const submit = async () => {
        setErr(null);
        if (!branche.trim() && !type.trim() && !locatie.trim()) {
            setErr(t('leads.modal.err_criteria', 'Vul minstens een branche, type of locatie in.'));
            return;
        }
        setBusy(true);
        try {
            const chosen = providers.filter(p => enabledProviders[p.id]).map(p => p.id);
            await onSubmit({
                title: title.trim() || `${branche || type || 'Leads'} · ${locatie || ''}`.trim(),
                criteria: {
                    branche: branche.trim() || undefined,
                    bedrijfstype: type.trim() || undefined,
                    omvang: omvang.trim() || undefined,
                    locatie: locatie.trim() || undefined,
                },
                outreachPitch: outreachPitch.trim() || undefined,
                modelTier: Object.keys(selectableTiers).length ? (modelTier || defaultTier) : undefined,
                targetCount,
                enrichmentProviders: chosen,
                retentionDays,
            });
        } catch (e) {
            setErr(e.message || t('leads.modal.err_generic', 'Aanmaken mislukt.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="relative w-[600px] max-h-[90vh] overflow-y-auto rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-xl" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                        <Target size={15} style={{ color: 'var(--accent-primary)' }} />
                        {isEdit ? t('leads.modal.title_edit', 'Campagne bewerken') : t('leads.modal.title', 'Nieuwe lead-campagne')}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"><X size={16} /></button>
                </header>

                <div className="px-5 py-4 flex flex-col gap-4">
                    <div className="text-xs text-[var(--text-secondary)] rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 leading-relaxed">
                        {t('leads.modal.pitch', 'De AI zoekt bedrijven die aan je criteria voldoen en verrijkt elk met eigenaar + contactgegevens. Resultaten verschijnen live in een lijst die je team samen kan afvinken.')}
                    </div>

                    <FormField label={t('leads.modal.field.title', 'Campagnenaam (optioneel)')}>
                        <input value={title} onChange={e => setTitle(e.target.value)}
                            placeholder={t('leads.modal.field.title_ph', 'bv. Aannemers Utrecht Q3')}
                            className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                    </FormField>

                    <div className="grid grid-cols-2 gap-3">
                        <FormField label={t('leads.modal.field.branche', 'Branche')}>
                            <input value={branche} onChange={e => setBranche(e.target.value)}
                                placeholder={t('leads.modal.field.branche_ph', 'bv. Bouw')}
                                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                        </FormField>
                        <FormField label={t('leads.modal.field.type', 'Type bedrijf')}>
                            <input value={type} onChange={e => setType(e.target.value)}
                                placeholder={t('leads.modal.field.type_ph', 'bv. Aannemer')}
                                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                        </FormField>
                        <FormField label={t('leads.modal.field.omvang', 'Omvang')}>
                            <input value={omvang} onChange={e => setOmvang(e.target.value)}
                                placeholder={t('leads.modal.field.omvang_ph', 'bv. 10-50 medewerkers')}
                                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                        </FormField>
                        <FormField label={t('leads.modal.field.locatie', 'Locatie')}>
                            <input value={locatie} onChange={e => setLocatie(e.target.value)}
                                placeholder={t('leads.modal.field.locatie_ph', 'bv. Utrecht')}
                                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                        </FormField>
                    </div>

                    <FormField
                        label={(<span className="flex items-center gap-1.5"><Mail size={13} /> {t('leads.modal.pitch_label', 'Reden van benadering / je aanbod')}</span>)}
                        hint={t('leads.modal.pitch_hint', 'Optioneel. De AI gebruikt dit om persoonlijke outreach-e-mails per lead op te stellen.')}>
                        <textarea value={outreachPitch} onChange={e => setOutreachPitch(e.target.value)} rows={3}
                            placeholder={t('leads.modal.pitch_ph', 'bv. Wij helpen aannemers met digitale werkbonnen die de administratie halveren.')}
                            className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]" />
                    </FormField>

                    <FormField label={t('leads.modal.field.target', 'Aantal leads')} hint={t('leads.modal.field.target_hint', 'Hoeveel bedrijven de AI probeert te vinden (1-200).')}>
                        <div className="flex items-center gap-3">
                            <input type="range" min={5} max={100} step={5} value={targetCount}
                                onChange={e => setTargetCount(parseInt(e.target.value, 10))}
                                className="flex-1 accent-[var(--accent-primary)]" />
                            <span className="text-sm text-[var(--text-primary)] w-10 text-right">{targetCount}</span>
                        </div>
                    </FormField>

                    {/* Model tier */}
                    <div className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]"><Bot size={13} /> {t('leads.modal.field.model', 'Model')}</span>
                        {Object.keys(selectableTiers).length > 0 ? (
                            <div className="flex items-center gap-2">
                                <ModelTierSelector tiers={selectableTiers} value={modelTier || defaultTier} onChange={onTierChange} dropDirection="down" variant="input" />
                                <span className="text-[10px] text-[var(--text-tertiary)]">{t('leads.modal.field.model_hint', 'Bepaalt hoe grondig de AI zoekt en verrijkt.')}</span>
                            </div>
                        ) : (
                            <span className="text-[10px] text-[var(--text-tertiary)] rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-1.5">
                                {t('leads.modal.field.model_none', 'Geen model-tier geconfigureerd; het standaardmodel wordt gebruikt.')}
                            </span>
                        )}
                    </div>

                    {/* Enrichment providers */}
                    <div className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]"><Database size={13} /> {t('leads.modal.field.providers', 'Databronnen')}</span>
                        <div className="flex flex-col gap-1.5">
                            {providers.map(p => (
                                <label key={p.id} className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded border text-xs ${p.configured || p.alwaysOn ? 'border-[var(--border-default)]' : 'border-[var(--border-subtle)] opacity-60'}`}>
                                    <span className="flex flex-col">
                                        <span className="text-[var(--text-primary)]">{p.label}</span>
                                        {!p.configured && !p.alwaysOn && <span className="text-[10px] text-[var(--text-tertiary)]">{t('leads.modal.provider_unconfigured', 'Niet geconfigureerd — voeg een API-sleutel toe in Admin → AI Config.')}</span>}
                                    </span>
                                    <Toggle
                                        checked={!!enabledProviders[p.id]}
                                        onChange={() => toggleProvider(p.id, p.alwaysOn, p.configured)}
                                        disabled={p.alwaysOn || !p.configured}
                                        color="emerald" size="sm"
                                        ariaLabel={p.label}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* AVG / legitimate interest notice + retention */}
                    <div className="flex flex-col gap-2 p-3 rounded border border-amber-500/40 bg-amber-500/10 text-xs">
                        <span className="flex items-center gap-1.5 text-[var(--text-primary)] font-medium"><ShieldCheck size={13} className="text-amber-600" /> {t('leads.modal.avg_title', 'AVG — gerechtvaardigd belang (B2B)')}</span>
                        <span className="text-[var(--text-secondary)] leading-relaxed">
                            {t('leads.modal.avg_body', 'Er wordt uitsluitend publiek beschikbare B2B-bedrijfsdata verzameld op grondslag van gerechtvaardigd belang. Gegevens worden automatisch verwijderd na de bewaartermijn.')}
                        </span>
                        <label className="flex items-center gap-2 text-[var(--text-secondary)]">
                            {t('leads.modal.retention', 'Bewaartermijn (dagen):')}
                            <input type="number" min={1} max={365} value={retentionDays}
                                onChange={e => setRetentionDays(Math.min(365, Math.max(1, parseInt(e.target.value, 10) || 90)))}
                                className="w-20 px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)]" />
                        </label>
                    </div>

                    {err && <div className="text-xs" style={{ color: 'var(--danger, #ef4444)' }}>{err}</div>}
                </div>

                <footer className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]">{t('common.cancel', 'Annuleren')}</button>
                    <button onClick={submit} disabled={busy}
                        className="px-3 py-1.5 text-sm rounded text-white font-semibold disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}>
                        {busy ? t('leads.modal.starting', 'Bezig…') : isEdit ? t('leads.modal.save_run', 'Opslaan & opnieuw zoeken') : t('leads.modal.start', 'Zoeken starten')}
                    </button>
                </footer>
            </div>
        </div>
    );
}
