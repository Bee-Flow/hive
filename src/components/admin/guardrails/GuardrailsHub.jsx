import React, { useEffect, useMemo } from 'react';
import useGuardrailsData from './api/useGuardrailsData';
import DirectChatView from './directchat/DirectChatView';
import { availableSections, resolveSection, isKnownButUnavailable, pathFor } from './guardrailsRoutes';
import OrgShieldEditor from './orgShield/OrgShieldEditor';
import HealthBanner from './overview/HealthBanner';
import StatStrip from './overview/StatStrip';
import PatternsView from './patterns/PatternsView';
import { ToastHost } from './Toast';
import { useTranslation } from '../../../hooks/useTranslation';
import Spinner from '../../shared/Spinner';
import Tabs from '../../shared/Tabs';

/**
 * Guardrail Configs — the server-operator console.
 *
 * The page this replaces mixed two scopes in one tab strip: regex rules and
 * direct chat are INSTALLATION-wide, while the Privacy Shield tab edited one
 * organisation. Nothing on screen distinguished them, which is how an admin
 * could believe they were configuring a tenant while editing a global default,
 * and vice versa. Here the authoring tabs come first and anything per-org lives
 * behind "Organisations".
 *
 * Sections are capability-gated (see guardrailsRoutes): the artefact types this
 * console is being built for do not all have endpoints yet, so a tab appears
 * when its route exists rather than 404-ing in place.
 */
const GuardrailsHub = ({ section, onNavigate }) => {
    const { t } = useTranslation();
    const data = useGuardrailsData();
    const { capabilities, loading, error } = data;

    const sections = useMemo(() => availableSections(capabilities), [capabilities]);
    const active = resolveSection(section, sections);

    // Normalise the URL when it names nothing renderable, so a refresh or a
    // shared link lands on the same place the user is actually looking at.
    useEffect(() => {
        if (!active || loading) return;
        if (section !== active) {
            window.history.replaceState({}, '', `/app/${pathFor(active)}`);
        }
    }, [active, section, loading]);

    const showUnavailableNotice = isKnownButUnavailable(section, sections);

    const tabItems = sections.map(s => ({
        id: s.id,
        label: t(s.labelKey, s.fallback),
        icon: <s.icon size={14} aria-hidden="true" />,
    }));

    const activeMeta = sections.find(s => s.id === active);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Spinner size="md" label={t('admin.gr_loading', 'Loading guardrail configuration…')} />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <ToastHost />

            <header>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">
                    {t('admin.gr_title', 'Guardrail configs')}
                </h1>
                <p className="text-sm text-[var(--text-secondary)]">
                    {t('admin.gr_subtitle', 'Reusable security configuration for organisations on this server.')}
                </p>
            </header>

            <StatStrip
                rules={data.rules.length}
                collections={data.collections.length}
                orgsBound={data.orgsWithShieldOn}
                orgsTotal={data.orgs.length}
                staleRefs={data.staleRefs}
                onShowStale={() => onNavigate?.(pathFor('organisations'))}
            />

            <HealthBanner status={data.guardStatus} />

            {error && (
                <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                    <p className="text-sm text-[var(--text-primary)]">
                        {t('admin.gr_load_failed', 'Could not load the guardrail configuration.')}
                    </p>
                    <button
                        onClick={data.reload}
                        className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400
                                   hover:bg-red-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                        {t('admin.gr_retry', 'Retry')}
                    </button>
                </div>
            )}

            <Tabs
                value={active}
                onChange={(id) => onNavigate?.(pathFor(id))}
                items={tabItems}
                ariaLabel={t('admin.gr_title', 'Guardrail configs')}
            />

            {showUnavailableNotice && (
                <p role="status" className="text-xs px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                    {t('admin.gr_section_unavailable', 'That section is not available on this server yet — showing the closest one instead.')}
                </p>
            )}

            {activeMeta?.descKey && (
                <p className="text-xs text-[var(--text-tertiary)]">
                    {t(activeMeta.descKey, activeMeta.descFallback)}
                </p>
            )}

            <div>
                {active === 'patterns' && (
                    <PatternsView
                        rules={data.rules}
                        setRules={data.setRules}
                        collections={data.collections}
                        setCollections={data.setCollections}
                        onSaved={data.reload}
                    />
                )}

                {active === 'directchat' && (
                    <DirectChatView
                        collections={data.collections}
                        directChat={data.directChat}
                        setDirectChat={data.setDirectChat}
                        onSaved={data.reload}
                    />
                )}

                {active === 'organisations' && (
                    /* Still the full editor in Fase 1. It becomes a read-only
                       overview with an explicit super-admin unlock in Fase 4;
                       allowOrgPicker is what keeps today's behaviour until then. */
                    <OrgShieldEditor allowOrgPicker />
                )}
            </div>
        </div>
    );
};

export default GuardrailsHub;
