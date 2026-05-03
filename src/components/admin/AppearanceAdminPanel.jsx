import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Package, Plus, Trash2, Check, Pencil, Search, Star, Download, Upload,
    Sparkles, AlertCircle, X, Loader2,
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { AppIcon } from '../AppIcon';
import IconPickerModal from '../icons/IconPickerModal';
import { loadSettings } from '../chat/NanoBananaSettings';
import { useTranslation } from '../../hooks/useTranslation';
import { useIconPack } from '../../hooks/useIconPack';

const API = `${API_BASE}/api/icons`;

// ─── Main Panel ──────────────────────────────────────────────────
export default function AppearanceAdminPanel() {
    const { t } = useTranslation();
    const iconPackContext = useIconPack();

    const [packs, setPacks] = useState([]);
    const [activePackId, setActivePackId] = useState(null);
    const [selectedPackId, setSelectedPackId] = useState(null);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    const fetchPacks = useCallback(async () => {
        try {
            const res = await authFetch(API);
            const data = await res.json();
            setPacks(data.packs || []);
            setActivePackId(data.activeIconPackId || null);
            setCategories(data.categories || []);
            setSelectedPackId(prev => {
                if (prev && data.packs?.some(p => p.id === prev)) return prev;
                return data.activeIconPackId || data.packs?.[0]?.id || null;
            });
        } catch {
            setError('Failed to load icon packs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPacks(); }, [fetchPacks]);

    const handleCreatePack = async (name) => {
        if (!name?.trim()) return;
        try {
            const res = await authFetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), icons: {} }),
            });
            if (res.ok) {
                const newPack = await res.json();
                await fetchPacks();
                setSelectedPackId(newPack.id);
                setShowAddModal(false);
            } else {
                setError('Failed to create pack');
            }
        } catch {
            setError('Failed to create pack');
        }
    };

    const handleActivatePack = async (id) => {
        try {
            const res = await authFetch(`${API}/${id || 'default'}/activate`, { method: 'POST' });
            if (res.ok) {
                setActivePackId(id);
                iconPackContext.setIconPack(id);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeletePack = async (id) => {
        if (!confirm('Delete this icon pack? This cannot be undone.')) return;
        try {
            const res = await authFetch(`${API}/${id}`, { method: 'DELETE' });
            if (res.ok) {
                if (activePackId === id) {
                    setActivePackId(null);
                    iconPackContext.setIconPack(null);
                }
                if (selectedPackId === id) setSelectedPackId(null);
                fetchPacks();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleExport = async (id) => {
        try {
            const res = await authFetch(`${API}/${id}/export`);
            if (!res.ok) throw new Error('export failed');
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `beeflow-iconpack-${(data.name || 'pack').replace(/[^a-z0-9]/gi, '_')}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setError('Export failed');
        }
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const res = await authFetch(`${API}/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                if (!res.ok) throw new Error('import failed');
                const newPack = await res.json();
                await fetchPacks();
                setSelectedPackId(newPack.id);
            } catch {
                setError('Import failed — invalid JSON file');
            }
        };
        input.click();
    };

    const updatePackLocally = (id, partial) => {
        setPacks(prev => prev.map(p => p.id === id ? { ...p, ...partial } : p));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
                Loading icon packs...
            </div>
        );
    }

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
                {/* ─── Left: Pack list ─────────────────────────────────── */}
                <div className="w-64 border-r shrink-0 flex flex-col" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                    <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
                        <span className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Package className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                            {t('admin.tab_appearance', 'Icon Packs')}
                        </span>
                        <div className="flex items-center gap-0.5">
                            <button onClick={handleImport} className="p-1 rounded-md transition-colors hover:bg-[var(--bg-tertiary)]" title="Import pack">
                                <Upload className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                            </button>
                            <button onClick={() => setShowAddModal(true)} className="p-1 rounded-md transition-colors hover:bg-[var(--bg-tertiary)]" title="New pack">
                                <Plus className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {/* System Default */}
                        <PackListItem
                            label="System Default"
                            sub="Standard Lucide icons"
                            isActive={!activePackId}
                            isSelected={false}
                            onSelect={() => handleActivatePack(null)}
                        />

                        {packs.map(pack => (
                            <PackListItem
                                key={pack.id}
                                label={pack.name}
                                sub={`${Object.keys(pack.icons || {}).length} custom`}
                                isActive={activePackId === pack.id}
                                isSelected={selectedPackId === pack.id}
                                onSelect={() => setSelectedPackId(pack.id)}
                                onActivate={() => handleActivatePack(pack.id)}
                                onExport={() => handleExport(pack.id)}
                                onDelete={() => handleDeletePack(pack.id)}
                            />
                        ))}

                        {packs.length === 0 && (
                            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                                No custom packs yet — click + to create one.
                            </p>
                        )}
                    </div>
                </div>

                {/* ─── Right: Editor ───────────────────────────────────── */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {selectedPackId ? (
                        <PackEditor
                            key={selectedPackId}
                            packId={selectedPackId}
                            categories={categories}
                            isActive={activePackId === selectedPackId}
                            onActivate={() => handleActivatePack(selectedPackId)}
                            onExport={() => handleExport(selectedPackId)}
                            onPackChanged={(partial) => {
                                updatePackLocally(selectedPackId, partial);
                                if (selectedPackId === activePackId) iconPackContext.reload();
                            }}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                            <div className="text-center">
                                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Select a pack to edit, or create a new one.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showAddModal && (
                <AddPackModal onAdd={handleCreatePack} onClose={() => setShowAddModal(false)} />
            )}
        </div>
    );
}

// ─── Sidebar item ────────────────────────────────────────────────
const PackListItem = ({ label, sub, isActive, isSelected, onSelect, onActivate, onExport, onDelete }) => {
    const isHighlight = isSelected;
    return (
        <div
            onClick={onSelect}
            className={`group px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-all ${isHighlight ? 'bg-[var(--accent-primary)] text-white' : 'hover:bg-[var(--bg-tertiary)]'}`}
        >
            <div className="flex items-center gap-2 min-w-0">
                <Package className={`w-3.5 h-3.5 shrink-0 ${isHighlight ? '' : 'opacity-60'}`} />
                <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{label}</div>
                    <div className={`text-[10px] truncate ${isHighlight ? 'opacity-80' : 'opacity-60'}`}>{sub}</div>
                </div>
                {isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-1 shrink-0" style={{ background: isHighlight ? 'rgba(255,255,255,0.2)' : 'var(--accent-primary)', color: '#fff' }}>
                        Active
                    </span>
                )}
            </div>
            {(onActivate || onExport || onDelete) && (
                <div className={`flex items-center gap-0.5 shrink-0 ${isHighlight ? 'opacity-80' : 'opacity-0 group-hover:opacity-60'} transition-opacity`}>
                    {onActivate && !isActive && (
                        <button onClick={(e) => { e.stopPropagation(); onActivate(); }} className="p-1 rounded hover:bg-black/10" title="Set as active">
                            <Star className="w-3 h-3" />
                        </button>
                    )}
                    {onExport && (
                        <button onClick={(e) => { e.stopPropagation(); onExport(); }} className="p-1 rounded hover:bg-black/10" title="Export">
                            <Download className="w-3 h-3" />
                        </button>
                    )}
                    {onDelete && (
                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded hover:bg-red-500/20" title="Delete">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Add Pack Modal ──────────────────────────────────────────────
const AddPackModal = ({ onAdd, onClose }) => {
    const [name, setName] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
            <div className="w-full max-w-sm rounded-2xl border shadow-2xl p-5" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>New Icon Pack</h3>
                <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onAdd(name); }}
                    placeholder="Pack name"
                    className="w-full px-3 py-2 rounded-lg text-sm border bg-[var(--bg-primary)] mb-4"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
                />
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border hover:bg-[var(--bg-tertiary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                        Cancel
                    </button>
                    <button onClick={() => onAdd(name)} disabled={!name.trim()} className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ background: 'var(--accent-primary)' }}>
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Pack Editor ────────────────────────────────────────────────
const PackEditor = ({ packId, categories, isActive, onActivate, onExport, onPackChanged }) => {
    const [pack, setPack] = useState(null);
    const [search, setSearch] = useState('');
    const [showOnly, setShowOnly] = useState('all'); // 'all' | 'missing' | 'customized'
    const [editingIconKey, setEditingIconKey] = useState(null);
    const [nanoSettings] = useState(() => loadSettings());
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkRunning, setBulkRunning] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);

    const fetchPack = useCallback(async () => {
        try {
            const res = await authFetch(API);
            const data = await res.json();
            setPack(data.packs?.find(p => p.id === packId) || null);
        } catch { /* swallowed */ }
    }, [packId]);

    useEffect(() => { fetchPack(); }, [fetchPack]);

    const allKeys = useMemo(() => categories.flatMap(c => c.keys), [categories]);
    const stats = useMemo(() => {
        const total = allKeys.length;
        const customized = allKeys.filter(k => (pack?.icons || {})[k]).length;
        return { total, customized, progress: total ? Math.round((customized / total) * 100) : 0 };
    }, [allKeys, pack]);

    const setIcon = useCallback(async (iconKey, iconData) => {
        if (!pack) return;
        const optimistic = { ...(pack.icons || {}) };
        if (iconData === null) delete optimistic[iconKey];
        else optimistic[iconKey] = iconData;
        setPack(prev => prev ? { ...prev, icons: optimistic } : prev);
        onPackChanged({ icons: optimistic });

        try {
            const res = await authFetch(`${API}/${pack.id}/icons/${encodeURIComponent(iconKey)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(iconData || {}),
            });
            if (!res.ok) await fetchPack();
        } catch {
            await fetchPack();
        }
    }, [pack, onPackChanged, fetchPack]);

    const handleResetAll = async () => {
        if (!confirm('Remove ALL custom icons from this pack?')) return;
        try {
            const res = await authFetch(`${API}/${pack.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ icons: {} }),
            });
            if (res.ok) {
                setPack(prev => prev ? { ...prev, icons: {} } : prev);
                onPackChanged({ icons: {} });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const runBulkGenerate = async ({ style, model, overwrite }) => {
        setBulkRunning(true);
        setBulkResult(null);
        try {
            const res = await authFetch(`${API}/${pack.id}/bulk-generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ style, model, overwrite }),
            });
            const data = await res.json();
            if (res.ok) {
                setBulkResult({ ok: true, message: data.message });
                await fetchPack();
                onPackChanged({});
                setTimeout(() => setBulkResult(null), 8000);
            } else {
                setBulkResult({ ok: false, message: data.error || 'Failed' });
            }
        } catch (e) {
            setBulkResult({ ok: false, message: e.message });
        }
        setBulkRunning(false);
    };

    if (!pack) {
        return <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading pack...</div>;
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-3 shrink-0" style={{ borderColor: 'var(--border-default)' }}>
                <div className="min-w-0">
                    <h3 className="font-semibold text-base truncate" style={{ color: 'var(--text-primary)' }}>
                        Editing "{pack.name}"
                    </h3>
                    <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                        <span>Click any icon to customise it.</span>
                        {isActive && (
                            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
                                Active Preview
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setBulkOpen(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 transition-opacity"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
                    >
                        <Sparkles className="w-3.5 h-3.5" /> AI Generate All
                    </button>
                    <button onClick={onExport} className="px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 hover:bg-[var(--bg-tertiary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                        <Download className="w-3.5 h-3.5" /> Export
                    </button>
                    <button onClick={handleResetAll} className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:text-red-500 hover:border-red-300 dark:hover:border-red-800" style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                        Reset All
                    </button>
                    {!isActive && (
                        <button onClick={onActivate} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: 'var(--accent-primary)' }}>
                            Set as Active
                        </button>
                    )}
                </div>
            </div>

            {/* Stats + filters */}
            <div className="px-4 py-3 flex items-center gap-3 shrink-0 flex-wrap">
                <div className="flex-1 min-w-48 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${stats.progress}%`, background: stats.progress >= 100 ? '#22c55e' : 'var(--accent-primary)' }} />
                </div>
                <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-secondary)' }}>
                    {stats.customized} / {stats.total} ({stats.progress}%)
                </span>
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search icons..."
                        className="pl-7 pr-3 py-1.5 rounded-lg text-xs border bg-[var(--bg-secondary)]"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none', width: 180 }}
                    />
                </div>
                <select
                    value={showOnly}
                    onChange={e => setShowOnly(e.target.value)}
                    className="px-2 py-1.5 rounded-lg text-xs border bg-[var(--bg-secondary)]"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
                >
                    <option value="all">All ({stats.total})</option>
                    <option value="customized">Customized ({stats.customized})</option>
                    <option value="missing">Default ({stats.total - stats.customized})</option>
                </select>
            </div>

            {bulkResult && (
                <div className="mx-4 mb-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{
                    background: bulkResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: bulkResult.ok ? '#22c55e' : '#ef4444',
                }}>
                    {bulkResult.ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    {bulkResult.message}
                </div>
            )}

            {/* Icon grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
                {categories.map(category => {
                    const filtered = category.keys.filter(k => {
                        if (search && !k.toLowerCase().includes(search.toLowerCase())) return false;
                        const isCustom = !!(pack.icons || {})[k];
                        if (showOnly === 'customized' && !isCustom) return false;
                        if (showOnly === 'missing' && isCustom) return false;
                        return true;
                    });
                    if (filtered.length === 0) return null;
                    return (
                        <div key={category.name}>
                            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                                {category.name}
                            </h4>
                            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                                {filtered.map(iconKey => (
                                    <IconCell
                                        key={iconKey}
                                        iconKey={iconKey}
                                        custom={(pack.icons || {})[iconKey]}
                                        onClick={() => setEditingIconKey(iconKey)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {editingIconKey && (
                <IconPickerModal
                    isOpen
                    onClose={() => setEditingIconKey(null)}
                    iconKey={editingIconKey}
                    currentCustom={(pack.icons || {})[editingIconKey]}
                    nanoBananaSettings={nanoSettings}
                    onApply={(data) => {
                        setIcon(editingIconKey, data);
                        setEditingIconKey(null);
                    }}
                />
            )}

            {bulkOpen && (
                <BulkGenerateModal
                    pack={pack}
                    nanoSettings={nanoSettings}
                    running={bulkRunning}
                    onRun={async (opts) => { await runBulkGenerate(opts); setBulkOpen(false); }}
                    onClose={() => setBulkOpen(false)}
                />
            )}
        </div>
    );
};

// ─── Single icon cell ────────────────────────────────────────────
const IconCell = React.memo(({ iconKey, custom, onClick }) => (
    <button
        onClick={onClick}
        className="relative flex flex-col items-center justify-center p-2 border rounded-lg cursor-pointer transition-colors group"
        style={{
            background: custom ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-secondary)',
            borderColor: custom ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-subtle)',
        }}
    >
        <div className="h-8 flex items-center justify-center mb-1">
            {custom ? (
                custom.type === 'image'
                    ? <img src={custom.value} alt={iconKey} className="w-6 h-6 object-contain" />
                    : <span className="text-xl leading-none">{custom.value}</span>
            ) : (
                <AppIcon name={iconKey} className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
            )}
        </div>
        <span className="text-[10px] text-center w-full truncate px-1" style={{ color: custom ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {iconKey}
        </span>
        {custom && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-primary)' }} title="Customized" />}
        <div className="absolute inset-0 bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
            <div className="bg-white dark:bg-zinc-800 p-1 rounded-full shadow-sm">
                <Pencil className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
            </div>
        </div>
    </button>
));

// ─── Bulk generate modal ────────────────────────────────────────
const BulkGenerateModal = ({ pack, nanoSettings, running, onRun, onClose }) => {
    const [style, setStyle] = useState('flat 2D vector icon, single subject centred, solid background, no text, app-icon style');
    const [model, setModel] = useState(nanoSettings?.image?.model || 'gemini-3.1-flash-image-preview');
    const [overwrite, setOverwrite] = useState(false);
    const customCount = Object.keys(pack.icons || {}).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl border shadow-2xl p-5" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5" style={{ color: '#f59e0b' }} />
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>AI Generate All Icons</h3>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                    Generates an icon for every key in the catalog using Nano Banana. Existing custom icons are kept unless you tick overwrite.
                </p>

                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Style prompt</label>
                <textarea
                    value={style}
                    onChange={e => setStyle(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border text-xs mb-3"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
                />

                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Model</label>
                <select
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-xs mb-3"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
                >
                    <option value="gemini-3.1-flash-image-preview">Nano Banana 2 — Flash (fast)</option>
                    <option value="gemini-3-pro-image-preview">Nano Banana Pro — Quality</option>
                    <option value="gemini-2.5-flash-image">Nano Banana — 2.5 Flash</option>
                </select>

                <label className="flex items-center gap-2 text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
                    Overwrite existing customised icons ({customCount} currently set)
                </label>

                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border hover:bg-[var(--bg-tertiary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                        Cancel
                    </button>
                    <button
                        onClick={() => onRun({ style, model, overwrite })}
                        disabled={running}
                        className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
                    >
                        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {running ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
    );
};
