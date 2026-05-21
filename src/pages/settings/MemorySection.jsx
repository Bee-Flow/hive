import React, { useState } from 'react';
import { Lightbulb, Download, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import ImportMemoryModal from '../../components/ImportMemoryModal';

const TYPE_LABELS = {
    instruction: 'Instructions',
    person: 'People',
    project: 'Projects',
    preference: 'Preferences',
    workflow: 'Workflows',
    fact: 'Facts',
    context: 'Context',
};

// ── Memory Section ───────────────────────────────────────────────────────────
const MemorySection = ({ memoryStats, onOpenMemory, onImported }) => {
    const { t } = useTranslation();
    const [showImport, setShowImport] = useState(false);
    const count = memoryStats?.total || 0;

    return (
        <div className="space-y-6">
            {/* Memory card */}
            <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>{t('settings.memory_title')}</p>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    {/* Stat row */}
                    <div className="flex items-center gap-4 px-5 py-4" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                            <Lightbulb className="w-4 h-4" style={{ color: '#d97706' }} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[13px] font-medium text-black">{t('settings.memory_stored')}</p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {t('settings.memory_desc')}
                            </p>
                        </div>
                        <span className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{count}</span>
                    </div>

                    {/* Type distribution */}
                    {count > 0 && memoryStats?.typeDistribution?.labels?.length > 0 && (
                        <div className="px-5 py-3 flex flex-wrap gap-2" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                            {memoryStats.typeDistribution.labels.map((label, i) => (
                                <span key={label} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                                    {TYPE_LABELS[label] || label}: {memoryStats.typeDistribution.data[i]}
                                </span>
                            ))}
                        </div>
                    )}

                    {count === 0 && (
                        <div className="px-5 py-3" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                                {t('settings.memory_empty')}
                            </p>
                        </div>
                    )}

                    {/* Manage row */}
                    <button
                        onClick={onOpenMemory}
                        className="w-full flex items-center px-5 py-3.5 text-left transition-colors gap-3"
                        style={{ background: 'var(--bg-secondary)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    >
                        <span className="text-[13px] flex-1 text-black">{t('settings.memory_manage')}</span>
                        <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                    </button>
                </div>
            </div>

            {/* Import card */}
            <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>{t('settings.memory_import_title', 'Import memory from other AI providers')}</p>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-4 px-5 py-4" style={{ background: 'var(--bg-secondary)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                            <Download className="w-4 h-4" style={{ color: '#d97706' }} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[13px] font-medium text-black">{t('settings.memory_import_title', 'Import memory from other AI providers')}</p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {t('settings.memory_import_desc', "Bring relevant context and data from another AI provider. We'll provide a prompt you can use from your other account.")}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowImport(true)}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white"
                            style={{ background: 'var(--accent-primary)' }}
                        >
                            {t('settings.memory_import_button', 'Import')}
                        </button>
                    </div>
                </div>
            </div>

            {/* About card */}
            <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>{t('settings.memory_about_title')}</p>
                <div className="rounded-xl px-5 py-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {t('settings.memory_about_desc')}
                    </p>
                </div>
            </div>

            {showImport && (
                <ImportMemoryModal
                    onClose={() => setShowImport(false)}
                    onImported={() => onImported?.()}
                />
            )}
        </div>
    );
};

export default MemorySection;
