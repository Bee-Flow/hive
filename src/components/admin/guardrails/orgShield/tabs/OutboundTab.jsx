import { Globe, Paperclip, Search, Server, ShieldAlert, Wrench } from 'lucide-react';
import React, { useId } from 'react';

import ChoiceCards from '../../../../shared/ChoiceCards';
import LicenceLock from '../parts/LicenceLock';
import ToggleCard from '../parts/ToggleCard';

/** One tool class's category grid, as a labelled group rather than loose checkboxes. */
function ToolClassGrid({ cls, legend, Icon, categories, selected, onToggle, onSetAll, readOnly, t }) {
    const legendId = useId();
    return (
        <fieldset className="border-0 p-0 m-0 mt-4 min-w-0">
            <div className="flex items-center justify-between mb-2">
                <legend id={legendId} className="text-xs font-medium text-muted flex items-center gap-1.5 float-left">
                    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    {legend}
                </legend>
                <div className="flex gap-2 ml-auto">
                    <button type="button" disabled={readOnly} onClick={() => onSetAll(cls, categories.map(c => c.id))}
                        className="text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[var(--text-secondary)] transition-colors disabled:opacity-50">
                        {t('common.all')}
                    </button>
                    <button type="button" disabled={readOnly} onClick={() => onSetAll(cls, [])}
                        className="text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[var(--text-secondary)] transition-colors disabled:opacity-50">
                        {t('common.none')}
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
                {categories.map(cat => (
                    <label key={cat.id} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors py-1 px-2 rounded hover:bg-white/5">
                        <input
                            type="checkbox"
                            disabled={readOnly}
                            checked={selected.includes(cat.id)}
                            onChange={e => onToggle(cls, cat.id, e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                        />
                        <cat.Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                        <span>{cat.label}</span>
                    </label>
                ))}
            </div>
            {selected.length > 0 && (
                <p className="text-xs mt-2" style={{ color: '#10b981' }}>
                    {t('admin.categories_selected_count', '{n} of {total} selected', { n: selected.length, total: categories.length })}
                </p>
            )}
        </fieldset>
    );
}

/**
 * "What may leave the building?"
 *
 * Everything that governs data crossing a boundary: the outbound pre-flight
 * scan, per-tool-class blocking, web search, uploads, integrations, and the
 * EU-only model restriction.
 */
export function OutboundTab({ f, categories, readOnly, licence, env, t, toggleToolPiiCat, setToolPiiCats }) {
    const { canUseWebSearchGuard, upgradeUrl } = licence;

    return (
        <div className="space-y-5">
            <ToggleCard
                Icon={ShieldAlert}
                title={t('admin.shield_dlp_preflight', 'One last check before an outside AI')}
                description={t('admin.shield_dlp_preflight_desc', 'Some AI models run outside your organisation. Just before a message goes to one of those, check it once more for personal data and handle it as chosen below.')}
                checked={f.dlpEnabled}
                onChange={f.setDlpEnabled}
                disabled={readOnly}
            >
                {f.dlpEnabled && (
                    <ChoiceCards
                        value={f.dlpMode}
                        onChange={f.setDlpMode}
                        disabled={readOnly}
                        columns={3}
                        ariaLabel={t('admin.shield_dlp_mode', 'What to do when it finds something')}
                        options={[
                            { value: 'ask', label: t('admin.shield_dlp_mode_ask_short', 'Ask'), description: t('admin.shield_dlp_mode_ask_desc', 'Show what was found and let the person choose: hide it, send anyway, or cancel.') },
                            { value: 'auto_redact', label: t('admin.shield_dlp_mode_redact_short', 'Hide it'), description: t('admin.shield_dlp_mode_redact_desc', 'Hide what was found and send the message. Nobody is interrupted.') },
                            { value: 'block', label: t('admin.shield_dlp_mode_block_short', 'Do not send'), description: t('admin.shield_dlp_mode_block_desc', 'Stop the message and ask the person to take the personal data out first.') },
                        ]}
                    />
                )}
            </ToggleCard>

            <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-start gap-2">
                    <Wrench className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                    <div>
                        <span className="text-sm font-medium text-[var(--text-primary)] block">
                            {t('admin.shield_tool_block_title', 'Hold personal data back from tools')}
                        </span>
                        <span className="text-xs text-muted">
                            {t('admin.shield_tool_block_desc', 'Tools are things the AI can use for you — search the web, open a file, send an email. If one of these kinds of data is involved, refuse the tool and strip that data out of whatever comes back.')}
                        </span>
                    </div>
                </div>

                {canUseWebSearchGuard ? (
                    <ToolClassGrid
                        cls="external"
                        Icon={Globe}
                        legend={t('admin.shield_tool_block_external', 'Tools that send data outside your organisation')}
                        categories={categories}
                        selected={f.toolPiiPolicy.external?.blockCategories || []}
                        onToggle={toggleToolPiiCat}
                        onSetAll={setToolPiiCats}
                        readOnly={readOnly}
                        t={t}
                    />
                ) : (
                    <div className="mt-4">
                        <p className="text-xs font-medium text-muted flex items-center gap-1.5 mb-2">
                            <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            {t('admin.shield_tool_block_external', 'Tools that send data outside your organisation')}
                        </p>
                        <LicenceLock upgradeUrl={upgradeUrl} t={t}>
                            {t('admin.shield_tool_block_locked', 'Holding data back from outside tools is an Enterprise feature.')}
                        </LicenceLock>
                    </div>
                )}

                <ToolClassGrid
                    cls="internal"
                    Icon={Server}
                    legend={t('admin.shield_tool_block_internal', 'Tools that stay on your own server')}
                    categories={categories}
                    selected={f.toolPiiPolicy.internal?.blockCategories || []}
                    onToggle={toggleToolPiiCat}
                    onSetAll={setToolPiiCats}
                    readOnly={readOnly}
                    t={t}
                />
            </div>

            {env.hasWebSearchEnabled && (
                canUseWebSearchGuard ? (
                    <ToggleCard
                        Icon={Search}
                        title={t('admin.shield_web_guard', 'Protect web searches')}
                        description={t('admin.shield_web_guard_desc', 'Stop search terms that contain personal data from being sent to an outside search engine.')}
                        checked={f.webSearchGuard}
                        onChange={f.setWebSearchGuard}
                        disabled={readOnly}
                    />
                ) : (
                    <div className="p-4 rounded-xl border" style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.25)' }}>
                        <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                            {t('admin.shield_web_guard', 'Protect web searches')}
                        </span>
                        <span className="text-xs text-muted block mt-0.5 mb-2">{t('admin.shield_web_guard_desc', 'Stop search terms that contain personal data from being sent to an outside search engine.')}</span>
                        <LicenceLock upgradeUrl={upgradeUrl} t={t}>
                            {t('admin.shield_web_guard_locked', 'Protecting web searches is an Enterprise feature.')}
                        </LicenceLock>
                    </div>
                )
            )}

            {env.hasWebSearchEnabled && (
                <ToggleCard
                    Icon={Paperclip}
                    title={t('admin.shield_search_upload', 'No web search while a file is attached')}
                    description={t('admin.shield_search_upload_desc', 'When someone attaches a document, do not let the AI search the web — so nothing from that document can end up in a search box.')}
                    checked={f.disableSearchOnUpload}
                    onChange={f.setDisableSearchOnUpload}
                    disabled={readOnly}
                />
            )}

            <ToggleCard
                Icon={Globe}
                title={t('admin.shield_integ_monitor', 'Check connected-app traffic for personal data')}
                description={t('admin.shield_integ_monitor_desc', 'Every connected-app call is always recorded: which server, which country, when, and whether it worked. Turn this on to also check the content for personal data, so the reports can show what kind of data left your organisation.')}
                checked={f.monitorIntegrations}
                onChange={f.setMonitorIntegrations}
                disabled={readOnly}
            />

            {env.hasEuModelsConfigured && (
                <ToggleCard
                    Icon={Globe}
                    title={t('admin.shield_eu_models', 'Use only AI hosted in the EU')}
                    description={t('admin.shield_eu_desc', 'Send chats only to the AI models hosted in the EU. Set those up under AI Config → Chat Models.')}
                    checked={f.euModeEnabled}
                    onChange={f.setEuModeEnabled}
                    disabled={readOnly}
                />
            )}
        </div>
    );
}

export default OutboundTab;
