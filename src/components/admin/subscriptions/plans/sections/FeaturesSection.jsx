import React, { useEffect, useMemo, useState } from 'react';
import { Puzzle, FlaskConical, Sparkles, Clock, BookOpen, Globe, Workflow, Brain, Zap } from 'lucide-react';
import { INTEGRATION_CATALOG } from '../../../../../config/integrationCatalog';
import { getIntegrationIcon } from '../../../../../config/integrationIcons';
import { FeatureChipGrid } from '../../ui/FeatureChipGrid';
import { FeatureCardGrid } from '../../ui/FeatureCardGrid';
import { Banner } from '../../ui/Banner';
import { apiJson } from '../../hooks/useApi';

// Integration IDs that exist in the catalog but are NOT gated by the org
// integration system — they're gated by their beta/license feature instead,
// so toggling them as an integration here is a no-op. We hide them from the
// plan editor's integration list to avoid the "I toggled it but nothing
// happened" confusion. (The catalog ID itself is left intact — it's a runtime
// gate key referenced elsewhere — we only drop it from this option list.)
const PLAN_HIDDEN_INTEGRATION_IDS = new Set(['webpages']);

// Mirrors OrgFeatureTogglesPanel.pickBetaIcon — keyword sniff over the
// beta's id/name. Kept locally so we don't reach into the admin panel.
function pickBetaIcon(idOrName) {
    const s = (idOrName || '').toLowerCase();
    if (s.includes('skill'))                       return <Sparkles className="w-4 h-4" />;
    if (s.includes('routine'))                     return <Clock className="w-4 h-4" />;
    if (s.includes('knowledge') || s.includes('kb')) return <BookOpen className="w-4 h-4" />;
    if (s.includes('webpage') || s.includes('web')) return <Globe className="w-4 h-4" />;
    if (s.includes('automation'))                  return <Workflow className="w-4 h-4" />;
    if (s.includes('memory'))                      return <Brain className="w-4 h-4" />;
    if (s.includes('zap') || s.includes('quick'))  return <Zap className="w-4 h-4" />;
    return <Sparkles className="w-4 h-4" />;
}

export function FeaturesSection({ form, update }) {
    const [betaRegistry, setBetaRegistry] = useState([]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await apiJson('/api/subscriptions/registries');
                if (alive) setBetaRegistry(Array.isArray(data.beta_features) ? data.beta_features : []);
            } catch (e) {
                console.warn('Failed to load registries:', e);
            }
        })();
        return () => { alive = false; };
    }, []);

    const integrationOptions = useMemo(
        () => INTEGRATION_CATALOG
            .filter(i => !PLAN_HIDDEN_INTEGRATION_IDS.has(i.id))
            .map(i => ({ id: i.id, label: i.label, description: i.description, category: i.category })),
        []
    );
    const betaOptions = useMemo(
        () => betaRegistry.map(b => ({
            id: b.id,
            label: b.name,
            // Compound betas carry a license_feature — enabling the beta here
            // also grants its paid capability, so the gate unlocks end-to-end.
            description: b.license_feature
                ? `${b.description} — includes its license grant (enabling this beta unlocks the paid capability too).`
                : b.description,
            category: 'Feature flags',
        })),
        [betaRegistry]
    );

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-1">Features &amp; integrations</h3>
                <p className="text-[12px] text-[var(--text-muted)]">Controls what's enabled for organizations on this plan.</p>
            </div>

            <div>
                <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-2.5">
                    Core features
                    <span className="ml-2 font-normal text-[11px] text-[var(--text-muted)]">— base licensed capabilities; beta features below carry their own license grant. All selected = unrestricted</span>
                </h4>
                <FeatureChipGrid
                    selected={form.allowed_features}
                    onChange={v => update('allowed_features', v)}
                />
            </div>

            <div>
                <h4 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)] mb-2.5">
                    <Puzzle className="w-4 h-4 text-blue-400" />
                    Included integrations
                </h4>
                <Banner tone="info" className="mb-3">
                    These integrations are auto-enabled when the plan is assigned and capped at the org level — an
                    org-admin cannot turn on anything outside this list.
                </Banner>
                <FeatureCardGrid
                    options={integrationOptions}
                    value={form.allowed_integrations}
                    onChange={v => update('allowed_integrations', v)}
                    renderIcon={id => getIntegrationIcon(id)}
                    grouped
                    restrictLabel="Restrict integrations to selection"
                    restrictDescription="Off: every integration in the catalog is included with this plan."
                />
            </div>

            <div>
                <h4 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)] mb-2.5">
                    <FlaskConical className="w-4 h-4 text-emerald-400" />
                    Included beta features
                </h4>
                <Banner tone="info" className="mb-3">
                    On cloud, this list is the source of truth for beta access — it's what organizations on this plan
                    actually get, no separate admin opt-in. Features that note "includes its license grant" also unlock
                    their paid capability automatically.
                </Banner>
                <FeatureCardGrid
                    options={betaOptions}
                    value={form.allowed_beta_features}
                    onChange={v => update('allowed_beta_features', v)}
                    renderIcon={(_, item) => pickBetaIcon(item?.id || item?.label)}
                    grouped={false}
                    emptyHint="Loading beta features…"
                    restrictLabel="Restrict beta features to selection"
                    restrictDescription="Off: every beta feature in the registry is included with this plan."
                />
            </div>
        </div>
    );
}
