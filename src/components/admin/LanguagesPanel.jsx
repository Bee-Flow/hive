import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Globe, Plus, Trash2, Download, Upload, Search, ChevronRight, Check, X, Copy, FileText, Languages, AlertCircle, Star } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

const API = `${API_BASE}/api/languages`;

// ─── Main Panel ──────────────────────────────────────────────────
const LanguagesPanel = () => {
    const [locales, setLocales] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [selectedLocale, setSelectedLocale] = useState(null);
    const [activeSection, setActiveSection] = useState('gui'); // 'gui' | 'prompts'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    const fetchLocales = useCallback(async () => {
        try {
            const res = await authFetch(API);
            const data = await res.json();
            setLocales(data.locales || []);
            setCatalog(data.catalog || []);
            if (!selectedLocale && data.locales?.length > 0) {
                // Auto-select first non-English locale, or English
                const nonEn = data.locales.find(l => l.code !== 'en');
                setSelectedLocale(nonEn?.code || data.locales[0].code);
            }
        } catch (err) {
            setError('Failed to load languages');
        } finally {
            setLoading(false);
        }
    }, [selectedLocale]);

    useEffect(() => { fetchLocales(); }, []);

    const handleAddLocale = async (code, name) => {
        try {
            const res = await authFetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, name }),
            });
            const data = await res.json();
            if (data.success) {
                setLocales(data.locales);
                setSelectedLocale(code);
                setShowAddModal(false);
            } else {
                setError(data.error || 'Failed to add language');
            }
        } catch { setError('Failed to add language'); }
    };

    const handleDeleteLocale = async (code) => {
        if (!confirm(`Delete "${code}" and all its translations?`)) return;
        try {
            const res = await authFetch(`${API}/${code}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setLocales(data.locales);
                if (selectedLocale === code) {
                    setSelectedLocale(data.locales[0]?.code || null);
                }
            }
        } catch { setError('Failed to delete language'); }
    };

    const handleExport = async (code) => {
        try {
            const res = await authFetch(`${API}/${code}/export`);
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `beeflow-i18n-${code}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch { setError('Export failed'); }
    };

    const handleImport = async (code) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const res = await authFetch(`${API}/${code}/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (res.ok) fetchLocales();
            } catch { setError('Import failed — invalid JSON file'); }
        };
        input.click();
    };

    const handleSetDefault = async (code) => {
        try {
            const res = await authFetch(`${API}/${code}/default`, { method: 'PUT' });
            const data = await res.json();
            if (data.success) setLocales(data.locales);
        } catch { setError('Failed to set default'); }
    };

    if (loading) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>Loading languages...</div>;

    const availableToAdd = catalog.filter(c => !locales.find(l => l.code === c.code));

    return (
        <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            {error && (
                <div className="mx-4 mt-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                {/* Left: Locale List */}
                <div className="w-64 border-r shrink-0 flex flex-col" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                    <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
                        <span className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Globe className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> Languages
                        </span>
                        <button onClick={() => setShowAddModal(true)} className="p-1 rounded-md transition-colors hover:bg-[var(--bg-tertiary)]" title="Add language">
                            <Plus className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {locales.map(locale => (
                            <div
                                key={locale.code}
                                onClick={() => setSelectedLocale(locale.code)}
                                className={`group px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-all ${selectedLocale === locale.code ? 'bg-[var(--accent-primary)] text-white' : 'hover:bg-[var(--bg-tertiary)]'}`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm font-medium truncate">{locale.name}</span>
                                    <span className="text-xs opacity-60">{locale.code}</span>
                                    {locale.isDefault && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: selectedLocale === locale.code ? 'rgba(255,255,255,0.2)' : 'var(--accent-primary)', color: selectedLocale === locale.code ? '#fff' : '#fff' }}>
                                            Default
                                        </span>
                                    )}
                                </div>
                                {locale.code !== 'en' && (
                                    <div className={`flex items-center gap-0.5 ${selectedLocale === locale.code ? 'opacity-80' : 'opacity-0 group-hover:opacity-60'} transition-opacity`}>
                                        {!locale.isDefault && (
                                            <button onClick={(e) => { e.stopPropagation(); handleSetDefault(locale.code); }} className="p-1 rounded hover:bg-black/10" title="Set as default">
                                                <Star className="w-3 h-3" />
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); handleExport(locale.code); }} className="p-1 rounded hover:bg-black/10" title="Export"><Download className="w-3 h-3" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleImport(locale.code); }} className="p-1 rounded hover:bg-black/10" title="Import"><Upload className="w-3 h-3" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteLocale(locale.code); }} className="p-1 rounded hover:bg-red-500/20" title="Delete"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Editor */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {selectedLocale ? (
                        <>
                            {/* Section Tabs */}
                            <div className="px-4 pt-3 pb-0 flex items-center gap-2 shrink-0">
                                {[
                                    { id: 'gui', label: 'GUI Translations', icon: Languages },
                                    { id: 'prompts', label: 'System Prompts', icon: FileText },
                                ].map(({ id, label, icon: Icon }) => (
                                    <button
                                        key={id}
                                        onClick={() => setActiveSection(id)}
                                        className={`px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeSection === id ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                                    >
                                        <Icon className="w-4 h-4" /> {label}
                                    </button>
                                ))}
                                <div className="ml-auto flex items-center gap-2">
                                    <button onClick={() => handleExport(selectedLocale)} className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors hover:bg-[var(--bg-tertiary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                                        <Download className="w-3.5 h-3.5" /> Export
                                    </button>
                                    <button onClick={() => handleImport(selectedLocale)} className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors hover:bg-[var(--bg-tertiary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                                        <Upload className="w-3.5 h-3.5" /> Import
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden">
                                {activeSection === 'gui' ? (
                                    <GUIStringEditor locale={selectedLocale} key={`gui-${selectedLocale}`} />
                                ) : (
                                    <PromptEditor locale={selectedLocale} key={`prompts-${selectedLocale}`} />
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                            <div className="text-center">
                                <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Add a language to get started</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Language Modal */}
            {showAddModal && (
                <AddLanguageModal
                    available={availableToAdd}
                    onAdd={handleAddLocale}
                    onClose={() => setShowAddModal(false)}
                />
            )}
        </div>
    );
};

// ─── Add Language Modal ──────────────────────────────────────────
const AddLanguageModal = ({ available, onAdd, onClose }) => {
    const [search, setSearch] = useState('');
    const [customCode, setCustomCode] = useState('');
    const [customName, setCustomName] = useState('');

    const filtered = available.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl border shadow-2xl p-5" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Add Language</h3>

                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search languages..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border bg-[var(--bg-primary)]"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
                        autoFocus
                    />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 mb-4" style={{ scrollbarWidth: 'thin' }}>
                    {filtered.map(l => (
                        <button key={l.code} onClick={() => onAdd(l.code, l.name)} className="w-full px-3 py-2 rounded-lg text-left text-sm flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors" style={{ color: 'var(--text-primary)' }}>
                            <span>{l.name}</span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.code}</span>
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No matching languages. Use custom below.</p>
                    )}
                </div>

                <div className="border-t pt-3 mt-2" style={{ borderColor: 'var(--border-default)' }}>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Or add custom:</p>
                    <div className="flex gap-2">
                        <input value={customCode} onChange={e => setCustomCode(e.target.value.toLowerCase())} placeholder="Code (e.g. pt-br)" className="w-24 px-2 py-1.5 rounded-lg text-sm border bg-[var(--bg-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }} />
                        <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Language name" className="flex-1 px-2 py-1.5 rounded-lg text-sm border bg-[var(--bg-primary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }} />
                        <button onClick={() => customCode && customName && onAdd(customCode, customName)} disabled={!customCode || !customName} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ background: 'var(--accent-primary)' }}>Add</button>
                    </div>
                </div>

                <button onClick={onClose} className="mt-3 w-full py-2 rounded-lg text-sm font-medium border hover:bg-[var(--bg-tertiary)] transition-colors" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
            </div>
        </div>
    );
};

// ─── GUI String Editor ───────────────────────────────────────────
const GUIStringEditor = ({ locale }) => {
    const [data, setData] = useState(null);
    const [translations, setTranslations] = useState({});
    const [search, setSearch] = useState('');
    const [namespace, setNamespace] = useState('all');
    const [showOnly, setShowOnly] = useState('all'); // 'all' | 'missing' | 'translated'
    const [saving, setSaving] = useState(false);
    const [savedKey, setSavedKey] = useState(null);
    const [aiTranslating, setAiTranslating] = useState(false);
    const [aiTier, setAiTier] = useState('fast');
    const [aiResult, setAiResult] = useState(null);

    useEffect(() => {
        authFetch(`${API}/${locale}/gui`)
            .then(r => r.json())
            .then(d => {
                setData(d);
                setTranslations(d.translations || {});
            });
    }, [locale]);

    const reloadData = useCallback(() => {
        authFetch(`${API}/${locale}/gui`)
            .then(r => r.json())
            .then(d => {
                setData(d);
                setTranslations(d.translations || {});
            });
    }, [locale]);

    const handleAiTranslate = useCallback(async () => {
        setAiTranslating(true);
        setAiResult(null);
        try {
            // Translate GUI strings + system prompts in parallel
            const [guiRes, promptsRes] = await Promise.all([
                authFetch(`${API}/${locale}/ai-translate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ modelTier: aiTier }),
                }),
                authFetch(`${API}/${locale}/ai-translate-prompts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ modelTier: aiTier }),
                }).catch(() => null), // Don't fail GUI translation if prompts fail
            ]);
            const result = await guiRes.json();
            const promptResult = promptsRes ? await promptsRes.json().catch(() => null) : null;
            if (result.success) {
                // Build combined message
                let message = result.message;
                if (promptResult?.success && promptResult.translated > 0) {
                    message += ` + ${promptResult.translated} system prompts`;
                }
                setAiResult({ ...result, message });
                reloadData();
                setTimeout(() => setAiResult(null), 8000);
            } else {
                setAiResult({ error: result.error || 'Translation failed' });
            }
        } catch (err) {
            setAiResult({ error: err.message });
        }
        setAiTranslating(false);
    }, [locale, aiTier, reloadData]);

    const saveTranslation = useCallback(async (key, value) => {
        setSaving(true);
        try {
            const res = await authFetch(`${API}/${locale}/gui`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: { [key]: value } }),
            });
            if (res.ok) {
                const result = await res.json();
                setTranslations(result.translations);
                setSavedKey(key);
                setTimeout(() => setSavedKey(null), 1500);
            }
        } catch { }
        setSaving(false);
    }, [locale]);

    if (!data) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>Loading...</div>;

    const defaults = data.defaults || {};
    const namespaces = data.namespaces || [];
    const allKeys = Object.keys(defaults);

    const filteredKeys = allKeys.filter(key => {
        if (namespace !== 'all' && !key.startsWith(namespace + '.')) return false;
        if (showOnly === 'missing' && translations[key]) return false;
        if (showOnly === 'translated' && !translations[key]) return false;
        if (search && !key.toLowerCase().includes(search.toLowerCase()) && !defaults[key].toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const stats = data.stats || {};

    return (
        <div className="h-full flex flex-col p-4 overflow-hidden">
            {/* Stats bar */}
            <div className="flex items-center gap-4 mb-3 shrink-0">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${stats.progress || 0}%`, background: stats.progress >= 100 ? '#22c55e' : 'var(--accent-primary)' }} />
                </div>
                <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-secondary)' }}>
                    {stats.translated || 0} / {stats.total || 0} ({stats.progress || 0}%)
                </span>
                {locale !== 'en' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <select
                            value={aiTier}
                            onChange={e => setAiTier(e.target.value)}
                            disabled={aiTranslating}
                            className="px-2 py-1 rounded-lg text-xs border bg-[var(--bg-secondary)]"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
                        >
                            <option value="fast">⚡ Fast</option>
                            <option value="thinking">🧠 Thinking</option>
                            <option value="writer">✍️ Writer</option>
                            <option value="pro">🔬 Pro</option>
                        </select>
                        <button
                            onClick={handleAiTranslate}
                            disabled={aiTranslating || stats.missing === 0}
                            className="px-3 py-1 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 disabled:opacity-40 transition-opacity"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                        >
                            {aiTranslating ? (
                                <><span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Translating...</>
                            ) : (
                                <>🤖 AI Translate ({stats.missing || 0})</>
                            )}
                        </button>
                    </div>
                )}
            </div>
            {aiResult && (
                <div className="mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{
                    background: aiResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                    color: aiResult.error ? '#ef4444' : '#22c55e',
                }}>
                    {aiResult.error ? (
                        <><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {aiResult.error}</>
                    ) : (
                        <><Check className="w-3.5 h-3.5 shrink-0" /> {aiResult.message}</>
                    )}
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search keys or values..." className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border bg-[var(--bg-secondary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }} />
                </div>
                <select value={namespace} onChange={e => setNamespace(e.target.value)} className="px-2 py-1.5 rounded-lg text-xs border bg-[var(--bg-secondary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}>
                    <option value="all">All Sections</option>
                    {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                </select>
                <select value={showOnly} onChange={e => setShowOnly(e.target.value)} className="px-2 py-1.5 rounded-lg text-xs border bg-[var(--bg-secondary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}>
                    <option value="all">All ({allKeys.length})</option>
                    <option value="missing">Missing ({stats.missing || 0})</option>
                    <option value="translated">Translated ({stats.translated || 0})</option>
                </select>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto rounded-xl border" style={{ borderColor: 'var(--border-default)', scrollbarWidth: 'thin' }}>
                <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-tertiary)' }}>
                        <tr>
                            <th className="text-left px-3 py-2 font-semibold w-1/4" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-default)' }}>Key</th>
                            <th className="text-left px-3 py-2 font-semibold w-[37.5%]" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-default)' }}>English Default</th>
                            <th className="text-left px-3 py-2 font-semibold w-[37.5%]" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-default)' }}>Translation</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredKeys.map(key => (
                            <GUIStringRow
                                key={key}
                                stringKey={key}
                                defaultValue={defaults[key]}
                                translation={translations[key] || ''}
                                onSave={saveTranslation}
                                isSaved={savedKey === key}
                                isEnglish={locale === 'en'}
                            />
                        ))}
                        {filteredKeys.length === 0 && (
                            <tr><td colSpan={3} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No matching keys</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── Single GUI String Row ───────────────────────────────────────
const GUIStringRow = React.memo(({ stringKey, defaultValue, translation, onSave, isSaved, isEnglish }) => {
    const [value, setValue] = useState(translation);
    const [editing, setEditing] = useState(false);

    useEffect(() => setValue(translation), [translation]);

    const handleBlur = () => {
        setEditing(false);
        if (value !== translation) onSave(stringKey, value);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') e.target.blur();
        if (e.key === 'Escape') { setValue(translation); setEditing(false); }
    };

    return (
        <tr className="group hover:bg-[var(--bg-secondary)] transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <td className="px-3 py-1.5 font-mono text-[11px] break-all" style={{ color: 'var(--text-muted)' }}>{stringKey}</td>
            <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{defaultValue}</td>
            <td className="px-3 py-1">
                {isEnglish ? (
                    <span style={{ color: 'var(--text-muted)' }}>{defaultValue}</span>
                ) : (
                    <div className="flex items-center gap-1">
                        <input
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            onFocus={() => setEditing(true)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            placeholder={defaultValue}
                            className="w-full px-2 py-1 rounded border bg-transparent text-xs transition-colors focus:border-[var(--accent-primary)] focus:bg-[var(--bg-primary)]"
                            style={{ borderColor: editing ? 'var(--accent-primary)' : 'transparent', color: 'var(--text-primary)', outline: 'none' }}
                        />
                        {isSaved && <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                        {!value && (
                            <button onClick={() => { setValue(defaultValue); onSave(stringKey, defaultValue); }} className="p-1 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity" title="Copy default">
                                <Copy className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                )}
            </td>
        </tr>
    );
});

// ─── Prompt Editor ───────────────────────────────────────────────
const PromptEditor = ({ locale }) => {
    const [data, setData] = useState(null);
    const [translations, setTranslations] = useState({});
    const [selectedPrompt, setSelectedPrompt] = useState(null);
    const [editText, setEditText] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [aiTranslating, setAiTranslating] = useState(false);
    const [aiTier, setAiTier] = useState('fast');
    const [aiResult, setAiResult] = useState(null);

    const fetchData = useCallback(() => {
        authFetch(`${API}/${locale}/prompts`)
            .then(r => r.json())
            .then(d => {
                setData(d);
                setTranslations(d.translations || {});
                if (d.promptIds?.length && !selectedPrompt) setSelectedPrompt(d.promptIds[0]);
            });
    }, [locale]);

    useEffect(() => { fetchData(); }, [locale]);

    useEffect(() => {
        if (selectedPrompt) {
            setEditText(translations[selectedPrompt] || '');
            setSaved(false);
        }
    }, [selectedPrompt, translations]);

    const handleSave = async () => {
        if (!selectedPrompt) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API}/${locale}/prompts/${selectedPrompt}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: editText }),
            });
            if (res.ok) {
                setTranslations(prev => ({ ...prev, [selectedPrompt]: editText }));
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch { }
        setSaving(false);
    };

    const handleAiTranslate = useCallback(async () => {
        setAiTranslating(true);
        setAiResult(null);
        try {
            const res = await authFetch(`${API}/${locale}/ai-translate-prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelTier: aiTier }),
            });
            const result = await res.json();
            if (result.success) {
                setAiResult(result);
                fetchData();
                setTimeout(() => setAiResult(null), 8000);
            } else {
                setAiResult({ error: result.error || 'Translation failed' });
            }
        } catch (err) {
            setAiResult({ error: err.message });
        }
        setAiTranslating(false);
    }, [locale, aiTier, fetchData]);

    if (!data) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>Loading...</div>;

    const categories = data.categories || {};
    const labels = data.labels || {};
    const defaults = data.defaults || {};
    const stats = data.stats || {};

    return (
        <div className="h-full flex flex-col overflow-hidden p-4">
            {/* Stats bar with AI Translate */}
            {locale !== 'en' && (
                <div className="flex items-center gap-3 mb-3 shrink-0">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${stats.total > 0 ? Math.round((stats.translated / stats.total) * 100) : 0}%`, background: stats.translated >= stats.total ? '#22c55e' : 'var(--accent-primary)' }} />
                    </div>
                    <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-secondary)' }}>
                        {stats.translated || 0} / {stats.total || 0} ({stats.total > 0 ? Math.round(((stats.translated || 0) / stats.total) * 100) : 0}%)
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <select
                            value={aiTier}
                            onChange={e => setAiTier(e.target.value)}
                            disabled={aiTranslating}
                            className="px-2 py-1 rounded-lg text-xs border bg-[var(--bg-secondary)]"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
                        >
                            <option value="fast">⚡ Fast</option>
                            <option value="thinking">🧠 Thinking</option>
                            <option value="writer">✍️ Writer</option>
                            <option value="pro">🔬 Pro</option>
                        </select>
                        <button
                            onClick={handleAiTranslate}
                            disabled={aiTranslating || stats.missing === 0}
                            className="px-3 py-1 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 disabled:opacity-40 transition-opacity"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                        >
                            {aiTranslating ? (
                                <><span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Translating...</>
                            ) : (
                                <>🤖 AI Translate ({stats.missing || 0})</>
                            )}
                        </button>
                    </div>
                </div>
            )}
            {aiResult && (
                <div className="mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{
                    background: aiResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                    color: aiResult.error ? '#ef4444' : '#22c55e',
                }}>
                    {aiResult.error ? (
                        <><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {aiResult.error}</>
                    ) : (
                        <><Check className="w-3.5 h-3.5 shrink-0" /> {aiResult.message}</>
                    )}
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden gap-3 min-h-0">
                {/* Left: Prompt list */}
                <div className="w-56 shrink-0 border rounded-xl overflow-y-auto" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)', scrollbarWidth: 'thin' }}>
                    <div className="p-2 border-b" style={{ borderColor: 'var(--border-default)' }}>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                            {stats.translated || 0} / {stats.total || 0} translated
                        </span>
                    </div>
                    {Object.entries(categories).map(([cat, ids]) => (
                        <div key={cat}>
                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{cat}</div>
                            {ids.map(id => (
                                <button
                                    key={id}
                                    onClick={() => setSelectedPrompt(id)}
                                    className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 transition-colors ${selectedPrompt === id ? 'bg-[var(--accent-primary)] text-white' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                    style={{ color: selectedPrompt === id ? '#fff' : 'var(--text-primary)' }}
                                >
                                    <span className="truncate flex-1">{labels[id] || id}</span>
                                    {translations[id] ? (
                                        <Check className="w-3 h-3 shrink-0" style={{ color: selectedPrompt === id ? '#fff' : '#22c55e' }} />
                                    ) : (
                                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: selectedPrompt === id ? 'rgba(255,255,255,0.4)' : 'var(--text-muted)', opacity: 0.4 }} />
                                    )}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Right: Side-by-side editor */}
                {selectedPrompt ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between mb-2 shrink-0">
                            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{labels[selectedPrompt] || selectedPrompt}</h4>
                            <div className="flex items-center gap-2">
                                {saved && <span className="text-xs text-green-500 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
                                <button
                                    onClick={() => setEditText(defaults[selectedPrompt] || '')}
                                    className="px-2 py-1 rounded text-xs border hover:bg-[var(--bg-tertiary)] transition-colors"
                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                    title="Copy English default into editor"
                                >
                                    <Copy className="w-3 h-3 inline mr-1" /> Copy Default
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-3 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-opacity"
                                    style={{ background: 'var(--accent-primary)' }}
                                >
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex gap-3 overflow-hidden min-h-0">
                            {/* Default (read-only) */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="text-[10px] font-semibold uppercase tracking-wider mb-1 px-1" style={{ color: 'var(--text-muted)' }}>English Default</div>
                                <textarea
                                    value={defaults[selectedPrompt] || ''}
                                    readOnly
                                    className="flex-1 w-full px-3 py-2 rounded-lg border text-xs font-mono resize-none"
                                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', outline: 'none', scrollbarWidth: 'thin' }}
                                />
                                <div className="text-[10px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>{(defaults[selectedPrompt] || '').length} chars</div>
                            </div>

                            {/* Translation (editable) */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="text-[10px] font-semibold uppercase tracking-wider mb-1 px-1" style={{ color: 'var(--text-muted)' }}>Translation ({locale.toUpperCase()})</div>
                                <textarea
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    placeholder="Enter translation..."
                                    className="flex-1 w-full px-3 py-2 rounded-lg border text-xs font-mono resize-none focus:border-[var(--accent-primary)]"
                                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', scrollbarWidth: 'thin' }}
                                />
                                <div className="text-[10px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>{editText.length} chars</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                        <p className="text-sm">Select a prompt to translate</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LanguagesPanel;
