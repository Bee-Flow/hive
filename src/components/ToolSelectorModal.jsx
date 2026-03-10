import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const ToolSelectorModal = ({
    isOpen,
    onClose,
    components,
    selectedTools,
    onToggle,
    onSelectAll,
    onClear,
    toolParams = {},
    onUpdateParams
}) => {
    const [search, setSearch] = useState('');
    const [expandedTool, setExpandedTool] = useState(null);
    const [localParams, setLocalParams] = useState({});

    // Initialize local params from props when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalParams(toolParams || {});
        }
    }, [isOpen, toolParams]);

    if (!isOpen) return null;

    // Filter components by search
    const filtered = search.trim()
        ? components.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.description.toLowerCase().includes(search.toLowerCase())
        )
        : components;

    // Group by category
    const byCategory = filtered.reduce((acc, comp) => {
        const cat = comp.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(comp);
        return acc;
    }, {});

    const categories = Object.keys(byCategory).sort();

    const handleParamChange = (toolId, paramName, value, isFixed) => {
        setLocalParams(prev => ({
            ...prev,
            [toolId]: {
                ...prev[toolId],
                [paramName]: isFixed ? { value, fixed: true } : { fixed: false }
            }
        }));
    };

    const getParamConfig = (toolId, paramName) => {
        return localParams[toolId]?.[paramName] || { fixed: false };
    };

    const handleClose = () => {
        // Save params when closing
        if (onUpdateParams) {
            onUpdateParams(localParams);
        }
        onClose();
    };

    // Parse input type from component definition
    const parseInputType = (inputDef) => {
        if (typeof inputDef === 'string') return inputDef;
        if (typeof inputDef === 'object') return inputDef.type || 'string';
        return 'string';
    };

    const parseInputDefault = (inputDef) => {
        if (typeof inputDef === 'object' && inputDef.default !== undefined) {
            return inputDef.default;
        }
        return '';
    };

    const parseInputOptions = (inputDef) => {
        if (typeof inputDef === 'object' && inputDef.options) {
            return inputDef.options;
        }
        return null;
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={handleClose}
        >
            <div
                className="w-full max-w-5xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
                style={{ background: 'var(--bg-secondary)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div>
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Select Agent Tools</h2>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{selectedTools.length} of {components.length} tools selected</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onSelectAll} className="text-sm hover:opacity-80" style={{ color: 'var(--text-muted)' }}>Select All</button>
                        <button onClick={onClear} className="text-sm hover:opacity-80" style={{ color: 'var(--text-muted)' }}>Clear All</button>
                        <button onClick={handleClose} className="p-2 rounded-lg hover:bg-white/10">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border"
                        style={{
                            background: 'var(--bg-primary)',
                            borderColor: 'var(--border-default)',
                            color: 'var(--text-primary)'
                        }}
                        placeholder="Search tools..."
                    />
                </div>

                {/* Tools Grid */}
                <div className="flex-1 overflow-auto p-4">
                    {categories.map(cat => (
                        <div key={cat} className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{cat}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({byCategory[cat].length})</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-2">
                                {byCategory[cat].map(comp => {
                                    const isSelected = selectedTools.includes(comp.id);
                                    const isExpanded = expandedTool === comp.id;
                                    const inputCount = Object.keys(comp.inputs || {}).length;

                                    return (
                                        <div
                                            key={comp.id}
                                            className={`rounded-lg border transition-all ${isSelected
                                                ? 'border-[var(--accent-primary)]'
                                                : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                                                }`}
                                            style={{ background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-tertiary)' }}
                                        >
                                            {/* Tool Header */}
                                            <div className="p-3 flex items-start gap-2">
                                                <div
                                                    onClick={() => onToggle(comp.id)}
                                                    className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center cursor-pointer ${isSelected ? 'bg-[var(--accent-primary)]' : 'border border-[var(--border-default)]'
                                                        }`}
                                                >
                                                    {isSelected && (
                                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{comp.name}</div>
                                                    <div className="text-xs line-clamp-1" style={{ color: 'var(--text-muted)' }}>{comp.description || 'No description'}</div>
                                                </div>
                                                {inputCount > 0 && isSelected && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setExpandedTool(isExpanded ? null : comp.id);
                                                        }}
                                                        className="text-xs px-2 py-1 rounded hover:bg-white/10 flex items-center gap-1"
                                                        style={{ color: 'var(--text-muted)' }}
                                                    >
                                                        <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                        {inputCount} param{inputCount !== 1 ? 's' : ''}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Expanded Parameters */}
                                            {isExpanded && isSelected && (
                                                <div className="px-3 pb-3 pt-0 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                                    <div className="text-xs my-2" style={{ color: 'var(--text-muted)' }}>Configure fixed values or let AI decide:</div>
                                                    {Object.entries(comp.inputs || {}).map(([paramName, paramDef]) => {
                                                        const type = parseInputType(paramDef);
                                                        const defaultVal = parseInputDefault(paramDef);
                                                        const options = parseInputOptions(paramDef);
                                                        const paramConfig = getParamConfig(comp.id, paramName);

                                                        return (
                                                            <div key={paramName} className="flex items-center gap-2 py-1.5 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                <div className="flex-1">
                                                                    <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{paramName}</div>
                                                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{type}{defaultVal ? ` • default: ${defaultVal}` : ''}</div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                                        <input
                                                                            type="radio"
                                                                            name={`${comp.id}-${paramName}`}
                                                                            checked={!paramConfig.fixed}
                                                                            onChange={() => handleParamChange(comp.id, paramName, '', false)}
                                                                            className="text-xs"
                                                                        />
                                                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>AI decides</span>
                                                                    </label>
                                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                                        <input
                                                                            type="radio"
                                                                            name={`${comp.id}-${paramName}`}
                                                                            checked={paramConfig.fixed}
                                                                            onChange={() => handleParamChange(comp.id, paramName, defaultVal || '', true)}
                                                                            className="text-xs"
                                                                        />
                                                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Fixed:</span>
                                                                    </label>
                                                                    {paramConfig.fixed && (
                                                                        options ? (
                                                                            <select
                                                                                value={paramConfig.value || ''}
                                                                                onChange={e => handleParamChange(comp.id, paramName, e.target.value, true)}
                                                                                className="text-xs px-2 py-1 rounded border"
                                                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                                            >
                                                                                {options.map(opt => (
                                                                                    <option key={opt} value={opt}>{opt || '(empty)'}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : (
                                                                            <input
                                                                                type={type === 'number' ? 'number' : 'text'}
                                                                                value={paramConfig.value || ''}
                                                                                onChange={e => handleParamChange(comp.id, paramName, e.target.value, true)}
                                                                                className="text-xs px-2 py-1 rounded border w-32"
                                                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                                                placeholder={defaultVal || 'Enter value...'}
                                                                            />
                                                                        )
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {filtered.length === 0 && (
                        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                            No tools match your search
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t flex justify-end" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button
                        onClick={handleClose}
                        className="px-6 py-2 rounded-xl font-medium text-white"
                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                    >
                        Done ({selectedTools.length} selected)
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ToolSelectorModal;
