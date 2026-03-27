import React, { useState, useRef } from 'react';
import { Eye, EyeOff, Check, AlertTriangle, Loader2, Search } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { getModelMeta, getDisplayName } from './constants';

/* ── Input field ─────────────────────────────────────────────────────── */
export const Input = ({ label, value, onChange, placeholder, helpText, type = 'text', disabled, trailing }) => {
    const [visible, setVisible] = useState(false);
    const isSecret = type === 'password';
    return (
        <div className="space-y-1.5">
            {label && (
                <label className="block text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
            )}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <input
                        type={isSecret && !visible ? 'password' : 'text'}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                        className="w-full px-3 py-2 rounded-lg border outline-none text-[13px] transition-colors focus:ring-2 focus:ring-blue-500/20"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', opacity: disabled ? 0.5 : 1 }}
                    />
                    {isSecret && (
                        <button
                            type="button"
                            onClick={() => setVisible(v => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded"
                            style={{ color: 'var(--text-muted)' }}
                            tabIndex={-1}
                        >
                            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    )}
                </div>
                {trailing}
            </div>
            {helpText && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{helpText}</p>}
        </div>
    );
};

/* ── Toggle switch ───────────────────────────────────────────────────── */
export const Toggle = ({ checked, onChange, label, description }) => (
    <div className="flex items-start gap-3">
        <button
            onClick={() => onChange(!checked)}
            className="mt-0.5 relative flex-shrink-0 rounded-full transition-colors"
            style={{ width: '36px', height: '20px', background: checked ? '#0078D4' : 'var(--bg-tertiary)' }}
        >
            <span
                className="absolute top-[2px] rounded-full bg-white transition-transform shadow-sm"
                style={{ width: '16px', height: '16px', left: '2px', transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
            />
        </button>
        <div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
            {description && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
        </div>
    </div>
);

/* ── Status badge ────────────────────────────────────────────────────── */
export const StatusBadge = ({ configured, label }) => {
    const { t } = useTranslation();
    return (
        <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1"
            style={{
                background: configured ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.1)',
                color: configured ? '#059669' : '#ef4444',
            }}
        >
            {configured ? <Check size={10} /> : <AlertTriangle size={10} />}
            {label || (configured ? t('azure.configured') : t('azure.not_configured'))}
        </span>
    );
};

/* ── Section card with save button ───────────────────────────────────── */
export const SectionCard = ({ title, description, children, onSave, saving, saved }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                {description && <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>{description}</p>}
            </div>
            <div className="space-y-4">
                {children}
            </div>
            {onSave && (
                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all disabled:opacity-40 flex items-center gap-2"
                        style={{ background: '#0078D4' }}
                    >
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        {saving ? t('azure.saving') : t('azure.save')}
                    </button>
                    {saved && (
                        <span className="text-[12px] font-medium flex items-center gap-1" style={{ color: '#059669' }}>
                            <Check size={14} /> {t('azure.saved')}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

/* ── Searchable Model Selector (modal overlay) ───────────────────────── */
export const SearchableModelSelect = ({ value, label, models, onChange }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const inputRef = useRef(null);

    const grouped = {};
    models.forEach(m => {
        const id = m.id || m;
        const meta = getModelMeta(id);
        const providerName = m.provider || (meta?.cat) || 'Other';
        if (!grouped[providerName]) grouped[providerName] = [];
        grouped[providerName].push(m);
    });

    const filteredGroups = {};
    const lowerSearch = search.toLowerCase();
    for (const [provName, provModels] of Object.entries(grouped)) {
        const filtered = provModels.filter(m => {
            const id = m.id || m;
            const display = getDisplayName(m);
            return id.toLowerCase().includes(lowerSearch) || display.toLowerCase().includes(lowerSearch);
        });
        if (filtered.length > 0) filteredGroups[provName] = filtered;
    }
    const totalResults = Object.values(filteredGroups).reduce((sum, arr) => sum + arr.length, 0);

    return (
        <>
            <button
                onClick={() => { setOpen(true); setSearch(''); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-[13px] transition-colors hover:border-blue-400"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
                <span className="truncate">{label}</span>
                <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
                    onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
                >
                    <div
                        className="rounded-2xl shadow-2xl flex flex-col"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', width: '480px', maxHeight: '70vh' }}
                    >
                        <div className="flex items-center justify-between px-5 pt-5 pb-3">
                            <div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('azure.select_model')}</h3>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {totalResults} model{totalResults !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ' available'}
                                </p>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >×</button>
                        </div>

                        <div className="px-5 pb-3">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                <input
                                    ref={inputRef}
                                    autoFocus
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={t('azure.search_models')}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none text-sm"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-2 pb-4" style={{ maxHeight: '50vh' }}>
                            <button
                                onClick={() => { onChange(''); setOpen(false); }}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                — {t('azure.not_configured_option')} —
                            </button>

                            {Object.entries(filteredGroups).map(([provName, provModels]) => (
                                <div key={provName} className="mt-2">
                                    <p className="text-[10px] uppercase font-semibold px-3 py-1 tracking-wider" style={{ color: 'var(--text-muted)' }}>{provName}</p>
                                    {provModels.map(m => {
                                        const id = m.id || m;
                                        const display = getDisplayName(m);
                                        const isSelected = id === value;
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => { onChange(id); setOpen(false); }}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                                                style={{
                                                    background: isSelected ? 'rgba(0,120,212,0.08)' : 'transparent',
                                                    borderLeft: isSelected ? '3px solid #0078D4' : '3px solid transparent',
                                                }}
                                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate" style={{ color: isSelected ? '#0078D4' : 'var(--text-primary)' }}>{display}</p>
                                                    {display !== id && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{id}</p>}
                                                </div>
                                                {isSelected && <Check size={16} style={{ color: '#0078D4', flexShrink: 0 }} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}

                            {totalResults === 0 && (
                                <div className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                                    <p className="text-lg mb-1">{t('azure.no_models_found')}</p>
                                    <p className="text-sm">{t('azure.try_different_search')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
