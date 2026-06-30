import { useCallback, useState } from 'react';

export function initPlanForm(plan) {
    return {
        name: plan?.name || '',
        description: plan?.description || '',
        max_cost_per_month:     plan?.max_cost_per_month     ?? null,
        max_users:              plan?.max_users              ?? null,
        max_agents:             plan?.max_agents             ?? null,
        max_knowledge_sources:  plan?.max_knowledge_sources  ?? null,
        allowed_features:       plan?.allowed_features       || [],
        allowed_models:         plan?.allowed_models         || [],
        // tri-state — undefined → null (unrestricted) so existing legacy plans keep their broad behavior.
        // MCP servers (mcp:<id>) live inside allowed_integrations now (opt-in; only count when explicit).
        allowed_integrations:   plan?.allowed_integrations === undefined ? null : plan.allowed_integrations,
        allowed_beta_features:  plan?.allowed_beta_features === undefined ? null : plan.allowed_beta_features,
        billing_model:          plan?.billing_model          || 'fixed',
        markup_percent:         plan?.markup_percent         ?? 20,
        is_default:             plan?.is_default             || false,
        price:                  plan?.price                  ?? null,
        currency:               plan?.currency               || 'EUR',
        billing_interval:       plan?.billing_interval       || 'monthly',
        trial_days:             plan?.trial_days             ?? 0,
        sort_order:             plan?.sort_order             ?? 0,
        is_public:              plan?.is_public              || false,
        plan_type:              plan?.plan_type              || 'organization',
        nc_recommended:         plan?.nc_recommended         || false,
        tagline:                plan?.tagline                || '',
        per_seat:               plan?.per_seat               || false,
    };
}

export function usePlanForm(plan) {
    const [form, setForm] = useState(() => initPlanForm(plan));

    const update = useCallback((key, val) => {
        setForm(prev => ({ ...prev, [key]: val }));
    }, []);

    const valid = !!form.name.trim();

    return { form, setForm, update, valid };
}
