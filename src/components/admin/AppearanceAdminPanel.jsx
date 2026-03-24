import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Check, Pencil, Search } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { AppIcon } from '../AppIcon';
import IconPickerModal from '../icons/IconPickerModal';
import { loadSettings } from '../chat/NanoBananaSettings';
import { useTranslation } from '../../hooks/useTranslation';
import { useIconPack } from '../../hooks/useIconPack';

const ICON_CATEGORIES = [
    {
        name: 'Navigation & Core',
        keys: ['Home', 'Settings', 'Bot', 'User', 'MessageSquare', 'Database', 'LayoutDashboard', 'Shield', 'Globe', 'Terminal', 'Monitor', 'CreditCard', 'Activity', 'Box', 'Briefcase', 'Layers', 'Grid', 'Package', 'Cpu']
    },
    {
        name: 'Actions',
        keys: ['Plus', 'Trash2', 'Pencil', 'Check', 'X', 'Search', 'Filter', 'Download', 'Upload', 'Share2', 'Save', 'Copy', 'RefreshCw', 'Play', 'Square', 'ChevronDown', 'ChevronRight', 'MoreVertical', 'MoreHorizontal']
    },
    {
        name: 'Status & Indicators',
        keys: ['AlertCircle', 'AlertTriangle', 'CheckCircle2', 'XCircle', 'Info', 'HelpCircle', 'Lock', 'Unlock', 'Eye', 'EyeOff', 'Clock', 'Star', 'Heart', 'Link', 'Wifi']
    }
];

export default function AppearanceAdminPanel() {
    const { t } = useTranslation();
    const iconPackContext = useIconPack();
    const [packs, setPacks] = useState([]);
    const [activePackId, setActivePackId] = useState(null);
    const [editingPackId, setEditingPackId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // For IconPickerModal
    const [editingIconKey, setEditingIconKey] = useState(null);
    const [nanoSettings, setNanoSettings] = useState({});

    useEffect(() => {
        loadPacks();
        setNanoSettings(loadSettings());
    }, []);

    const loadPacks = async () => {
        setIsLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/icons`);
            if (res.ok) {
                const data = await res.json();
                setPacks(data.packs);
                setActivePackId(data.activeIconPackId);
                // If they don't have an editing pack open, default to the active one to show something
                if (!editingPackId && data.activeIconPackId) {
                    setEditingPackId(data.activeIconPackId);
                }
            }
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    };

    const handleCreatePack = async () => {
        const name = prompt('Name your new Icon Pack:');
        if (!name) return;
        try {
            const res = await authFetch(`${API_BASE}/api/icons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, icons: {} })
            });
            if (res.ok) {
                const newPack = await res.json();
                await loadPacks();
                setEditingPackId(newPack.id);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleActivatePack = async (id) => {
        try {
            const defaultId = id || 'default';
            const res = await authFetch(`${API_BASE}/api/icons/${defaultId}/activate`, {
                method: 'POST'
            });
            if (res.ok) {
                setActivePackId(id);
                // Tell the React Context to re-fetch/update live, no page reload needed
                iconPackContext.setIconPack(id);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeletePack = async (id) => {
        if (!confirm('Are you sure you want to delete this icon pack?')) return;
        try {
            const res = await authFetch(`${API_BASE}/api/icons/${id}`, { method: 'DELETE' });
            if (res.ok) {
                if (activePackId === id) {
                    setActivePackId(null);
                    iconPackContext.setIconPack(null);
                }
                if (editingPackId === id) {
                    setEditingPackId(null);
                }
                loadPacks();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const updateIconInPack = async (packId, iconKey, iconData) => {
        const pack = packs.find(p => p.id === packId);
        if (!pack) return;

        const newIcons = { ...pack.icons };
        if (iconData === null) {
            delete newIcons[iconKey];
        } else {
            newIcons[iconKey] = iconData;
        }

        // Optimistically update local state so editing panel reflects immediately
        setPacks(prev => prev.map(p => p.id === packId ? { ...p, icons: newIcons } : p));

        try {
            const res = await authFetch(`${API_BASE}/api/icons/${packId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ icons: newIcons })
            });

            if (res.ok) {
                // If the pack being edited is currently dictating the whole app's visuals,
                // trigger a context reload so the navbar/sidebar update instantly.
                if (packId === activePackId) {
                    iconPackContext.reload();
                }
            } else {
                // Revert if failed
                loadPacks();
            }
        } catch (e) {
            console.error(e);
            loadPacks();
        }
    };

    const handleResetPack = async (packId) => {
        if (!confirm('Are you sure you want to remove ALL custom icons from this pack?')) return;
        
        try {
            const res = await authFetch(`${API_BASE}/api/icons/${packId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ icons: {} })
            });
            
            if (res.ok) {
                setPacks(prev => prev.map(p => p.id === packId ? { ...p, icons: {} } : p));
                if (packId === activePackId) {
                    iconPackContext.reload();
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    const editingPack = packs.find(p => p.id === editingPackId);

    return (
        <div className="p-6 h-full overflow-auto">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Packs Overview Section */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div>
                            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('admin.tab_appearance', 'Appearance & Icon Packs')}</h3>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                Customize the application's icons by creating a pack and applying it.
                            </p>
                        </div>
                        <button
                            onClick={handleCreatePack}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                            style={{ background: 'var(--accent-primary)', color: '#fff' }}
                        >
                            <Plus className="w-4 h-4" />
                            New Pack
                        </button>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {/* Default Pack Card */}
                            <div 
                                onClick={() => handleActivatePack(null)}
                                className="relative p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm"
                                style={{ 
                                    background: !activePackId ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-primary)',
                                    borderColor: !activePackId ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-subtle)'
                                }}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <h4 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>System Default</h4>
                                    </div>
                                    {!activePackId && (
                                        <div className="text-blue-500">
                                            <Check className="w-5 h-5" />
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Standard Lucide icons</div>
                                {!activePackId ? (
                                    <div className="mt-4 text-xs font-semibold text-blue-500">Currently Active</div>
                                ) : (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleActivatePack(null); }}
                                        className="mt-4 w-full py-1.5 border rounded-lg text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                    >
                                        Set as Active
                                    </button>
                                )}
                            </div>

                            {/* Custom Packs */}
                            {packs.map(pack => (
                                <div 
                                    key={pack.id}
                                    onClick={() => setEditingPackId(pack.id)}
                                    className="relative p-4 rounded-xl border transition-all cursor-pointer group hover:shadow-sm"
                                    style={{ 
                                        background: activePackId === pack.id ? 'rgba(59, 130, 246, 0.1)' : (editingPackId === pack.id ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-primary)'),
                                        borderColor: activePackId === pack.id ? 'rgba(59, 130, 246, 0.4)' : (editingPackId === pack.id ? 'rgba(59, 130, 246, 0.2)' : 'var(--border-subtle)')
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                                                <Package className="w-5 h-5" />
                                            </div>
                                            <h4 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{pack.name}</h4>
                                        </div>
                                        {activePackId === pack.id && (
                                            <div className="text-blue-500">
                                                <Check className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                                        <span>{Object.keys(pack.icons || {}).length} custom icons</span>
                                    </div>
                                    
                                    {activePackId === pack.id ? (
                                        <div className="mt-4 text-xs font-semibold text-blue-500">Currently Active</div>
                                    ) : (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleActivatePack(pack.id); }}
                                            className="mt-4 w-full py-1.5 border rounded-lg text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                        >
                                            Set as Active
                                        </button>
                                    )}

                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeletePack(pack.id); }}
                                        className="absolute top-3 right-3 p-1.5 opacity-0 group-hover:opacity-100 transition-all rounded-md text-red-500 hover:bg-red-500 hover:bg-opacity-20"
                                        title="Delete pack"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Pack Editor Section */}
                {editingPack && (
                    <div className="rounded-2xl border overflow-hidden flex flex-col" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', minHeight: '500px' }}>
                        
                        {/* Editor Header */}
                        <div className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="flex items-center gap-4">
                                <div>
                                    <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Editing "{editingPack.name}"</h3>
                                    <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                        <span>Click any icon below to customize it.</span>
                                        {activePackId === editingPack.id && (
                                            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">Active Preview</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                    <input 
                                        type="text"
                                        placeholder="Search icons..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 pr-4 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1 transition-all"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', outlineColor: 'var(--accent-primary)' }}
                                    />
                                </div>
                                <button
                                    onClick={() => handleResetPack(editingPack.id)}
                                    className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:text-red-500 hover:border-red-300 dark:hover:border-red-800"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                                >
                                    Reset All
                                </button>
                                {activePackId !== editingPack.id && (
                                    <button
                                        onClick={() => handleActivatePack(editingPack.id)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                        style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                    >
                                        Set as Active
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Icon Library Grid */}
                        <div className="p-6 flex-1 overflow-y-auto space-y-8">
                            {ICON_CATEGORIES.map(category => {
                                // Filter by search
                                const filteredKeys = category.keys.filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
                                if (filteredKeys.length === 0) return null;

                                return (
                                    <div key={category.name} className="space-y-4">
                                        <h4 className="text-sm font-medium border-b pb-2" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
                                            {category.name}
                                        </h4>
                                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                                            {filteredKeys.map(iconKey => {
                                                const custom = (editingPack.icons || {})[iconKey];
                                                return (
                                                    <div 
                                                        key={iconKey} 
                                                        onClick={() => setEditingIconKey(iconKey)} 
                                                        className="flex flex-col items-center justify-center p-3 border rounded-xl cursor-pointer transition-colors group relative"
                                                        style={{ 
                                                            background: custom ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-primary)', 
                                                            borderColor: custom ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-subtle)' 
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)' }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = custom ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-subtle)' }}
                                                    >
                                                        <div className="h-8 flex items-center justify-center mb-1">
                                                            {custom ? (
                                                                custom.type === 'image' ? (
                                                                    <img src={custom.value} alt={iconKey} className="w-6 h-6 object-contain" />
                                                                ) : (
                                                                    <span className="text-xl leading-none">{custom.value}</span>
                                                                )
                                                            ) : (
                                                                <AppIcon name={iconKey} className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-center w-full truncate px-1" style={{ color: custom ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                            {iconKey}
                                                        </span>
                                                        
                                                        {custom && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-primary)' }} title="Customized" />}
                                                        
                                                        <div className="absolute inset-0 bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity">
                                                            <div className="bg-white dark:bg-zinc-800 p-1.5 rounded-full shadow-sm">
                                                                <Pencil className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {searchQuery && ICON_CATEGORIES.every(c => c.keys.filter(k => k.toLowerCase().includes(searchQuery.toLowerCase())).length === 0) && (
                                <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                                    No icons found matching "{searchQuery}"
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Editing Modal */}
                {editingIconKey && editingPack && (
                    <IconPickerModal 
                        isOpen={true} 
                        onClose={() => setEditingIconKey(null)}
                        iconKey={editingIconKey}
                        currentCustom={(editingPack.icons || {})[editingIconKey]}
                        nanoBananaSettings={nanoSettings}
                        onApply={(data) => {
                            updateIconInPack(editingPack.id, editingIconKey, data);
                            setEditingIconKey(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
}
