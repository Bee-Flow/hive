import React from 'react';
import { AlertTriangle, Bug, Check, Download, Globe, Inbox, Loader2, Mic, Package, Shield, Target, Trash2 } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

// module.icon arrives as a free-form string: an emoji, a lucide name from the
// server catalog (e.g. 'shield' for Security Scan), or something we may not
// know. Render short pictographic strings as-is, map known lucide names, and
// fall back to Package so an unrecognised icon never breaks the card.
const NAMED_ICONS = { shield: Shield, globe: Globe, inbox: Inbox, target: Target, mic: Mic, bug: Bug, package: Package };

function ModuleIcon({ icon }) {
    if (icon && icon.length <= 4 && /\p{Extended_Pictographic}/u.test(icon)) {
        return <span className="text-2xl leading-none">{icon}</span>;
    }
    const Glyph = NAMED_ICONS[String(icon || '').toLowerCase()] || Package;
    return <Glyph className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />;
}

export default function ModuleCard({ module, onImport, onRemoveRequest, busy }) {
    const { t } = useTranslation();
    const imported = module.status === 'imported';
    const requirements = module.requirements || [];
    const capabilities = module.capabilities || [];

    return (
        <div
            className="rounded-xl border p-4 transition-all hover:shadow-lg relative flex flex-col"
            style={{
                background: 'var(--bg-secondary)',
                borderColor: imported ? 'var(--accent-primary)' : 'var(--border-default)',
            }}
        >
            {/* Status badge */}
            {imported ? (
                <div className="absolute top-3 right-3">
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-medium">
                        <Check className="w-3 h-3" /> {t('modules.badge_imported')}
                    </span>
                </div>
            ) : !module.requirementsMet ? (
                <div className="absolute top-3 right-3">
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                        <AlertTriangle className="w-3 h-3" /> {t('modules.badge_requirements_unmet')}
                    </span>
                </div>
            ) : null}

            {/* Icon + name + category */}
            <div className="flex items-start gap-3 mb-2 pr-24">
                <ModuleIcon icon={module.icon} />
                <div className="min-w-0">
                    <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {module.name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {module.category && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                {module.category}
                            </span>
                        )}
                        {module.version && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>v{module.version}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Description */}
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                {module.description}
            </p>

            {/* Requirements */}
            {requirements.length > 0 && (
                <div className="mb-3">
                    <div className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                        {t('modules.requirements')}
                    </div>
                    <div className="space-y-1">
                        {requirements.map(req => (
                            <div key={req.id} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                                <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${req.met ? 'bg-green-500' : 'bg-amber-500'}`} />
                                <span className="min-w-0">
                                    {req.label}
                                    {!req.met && req.detail && (
                                        <span className="block" style={{ color: 'var(--text-muted)' }}>{req.detail}</span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Capabilities */}
            {capabilities.length > 0 && (
                <div className="mb-3">
                    <div className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                        {t('modules.capabilities')}
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {capabilities.map(cap => (
                            <span key={cap.id} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                {cap.label}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="mt-auto pt-1">
                {imported ? (
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-green-500">
                            <span className="w-2 h-2 rounded-full bg-green-500" /> {t('modules.active', 'Active')}
                        </span>
                        <div className="flex-1" />
                        <button
                            onClick={() => onRemoveRequest(module)}
                            disabled={busy}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            title={t('modules.remove')}
                        >
                            {busy
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#ef4444' }} />
                                : <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />}
                        </button>
                    </div>
                ) : module.requirementsMet ? (
                    <button
                        onClick={() => onImport(module)}
                        disabled={busy}
                        className="w-full py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{ background: 'var(--accent-primary)', color: '#fff' }}
                    >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {busy ? t('modules.importing') : t('modules.import')}
                    </button>
                ) : (
                    <>
                        <button
                            disabled
                            className="w-full py-2 rounded-lg text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1.5 border"
                            style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', borderColor: 'var(--border-default)' }}
                        >
                            <Download className="w-3.5 h-3.5" /> {t('modules.import')}
                        </button>
                        <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#f59e0b' }}>
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {t('modules.requirements_blocked')}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
