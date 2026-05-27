import React, { useState, useEffect, useRef, Suspense } from 'react';
import { lazy } from '../../utils/lazyWithReload';
import AIComponentDesigner from '../AIComponentDesigner';
import { API_BASE, authFetch } from '../../utils/helpers';

// Monaco is ~16 KB minified but pulls a large worker dep chain. Defer
// loading until the user actually opens a tab that needs the editor —
// mirrors the pattern in pages/webpages/WebpageEditor.jsx.
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

function EditorFallback() {
    return (
        <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-primary)] animate-spin" />
        </div>
    );
}

// Drop-in replacement so existing <Editor ...> JSX keeps working.
function Editor(props) {
    return (
        <Suspense fallback={<EditorFallback />}>
            <MonacoEditor {...props} />
        </Suspense>
    );
}

const ComponentBuilder = ({ onBack, hasPermission = () => true }) => {
    const [components, setComponents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedComponent, setSelectedComponent] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showDocs, setShowDocs] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('config');
    const [collapsedCategories, setCollapsedCategories] = useState({});
    const [isDirty, setIsDirty] = useState(false);
    const [testInput, setTestInput] = useState('{}');
    const [testOutput, setTestOutput] = useState(null);
    const [isTesting, setIsTesting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        description: '',
        category: 'Custom',
        inputs: {},
        outputs: { result: 'any' },
        dependencies: {},
        code: '',
        agentEnabled: true,
        directChatEnabled: false
    });
    const [inputsList, setInputsList] = useState([]);
    const [outputsList, setOutputsList] = useState([{ key: 'result', type: 'any' }]);
    const [dependenciesList, setDependenciesList] = useState([]);

    const codeRef = useRef(null);

    useEffect(() => {
        fetchComponents();
    }, []);

    // Load component from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const componentId = params.get('component');
        if (componentId && components.length > 0 && !selectedComponent) {
            const comp = components.find(c => c.id === componentId);
            if (comp) handleSelectComponent(comp);
        }
    }, [components]);

    // Update URL when component changes
    const updateUrl = (componentId) => {
        const url = new URL(window.location.href);
        if (componentId) {
            url.searchParams.set('component', componentId);
        } else {
            url.searchParams.delete('component');
        }
        window.history.pushState({}, '', url);
    };

    const fetchComponents = async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/components`);
            const data = await res.json();
            setComponents(data);
        } catch (err) {
            console.error('Failed to fetch components:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectComponent = async (comp) => {
        try {
            const res = await authFetch(`${API_BASE}/components/${comp.id}`);
            const data = await res.json();
            setSelectedComponent(comp.id);
            setFormData({
                id: comp.id,
                name: data.name || '',
                description: data.description || '',
                category: data.category || 'Custom',
                inputs: data.inputs || {},
                outputs: data.outputs || {},
                dependencies: data.dependencies || {},
                code: data.code || '',
                agentEnabled: data.agentEnabled !== false,
                directChatEnabled: data.directChatEnabled === true
            });
            const parsedInputs = Object.entries(data.inputs || {}).map(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                    return { key, type: value.type || 'string', defaultValue: value.default || '', description: value.description || '', secure: value.secure || false, _hasStoredValue: value._hasStoredValue || false };
                }
                return { key, type: value || 'string', defaultValue: '', description: '', secure: false, _hasStoredValue: false };
            });
            setInputsList(parsedInputs);
            setOutputsList(Object.entries(data.outputs || {}).map(([key, type]) => ({ key, type })));
            setDependenciesList(Object.entries(data.dependencies || {}).map(([name, version]) => ({ name, version })));
            setIsCreating(false);
            setActiveTab('config');
            setIsDirty(false);
            updateUrl(comp.id);
            // Generate test input from inputs
            const defaultTestInput = {};
            parsedInputs.forEach(inp => {
                defaultTestInput[inp.key] = inp.defaultValue || '';
            });
            setTestInput(JSON.stringify(defaultTestInput, null, 2));
            setTestOutput(null);
        } catch (err) {
            console.error('Failed to load component:', err);
        }
    };

    const handleNewComponent = () => {
        setSelectedComponent(null);
        setIsCreating(true);
        const defaultCode = `// Read input from stdin
let inputData = '';
process.stdin.on('data', chunk => {
    inputData += chunk;
});

process.stdin.on('end', async () => {
    try {
        const inputs = JSON.parse(inputData);
        
        // Your component logic here
        const result = {
            output: inputs.input || 'Hello World'
        };
        
        // Output must be valid JSON
        console.log(JSON.stringify(result));
    } catch (e) {
        process.stderr.write(e.message);
        process.exit(1);
    }
});`;
        setFormData({
            id: '',
            name: '',
            description: '',
            category: 'Custom',
            inputs: {},
            outputs: { result: 'any' },
            dependencies: {},
            code: defaultCode,
            agentEnabled: true,
            directChatEnabled: false
        });
        setInputsList([{ key: 'input', type: 'string', defaultValue: '', description: '' }]);
        setOutputsList([{ key: 'output', type: 'any' }]);
        setDependenciesList([]);
        setActiveTab('config');
        setTestOutput(null);
        updateUrl(null);
    };

    const handleSave = async () => {
        if (isCreating && !formData.id.match(/^[a-z0-9-]+$/)) {
            alert('Component ID must be lowercase letters, numbers, and hyphens only.');
            return;
        }
        if (!formData.name) {
            alert('Component name is required.');
            return;
        }

        const inputs = {};
        inputsList.forEach(i => {
            if (i.key) {
                const inputDef = { type: i.type || 'string' };
                if (i.defaultValue) inputDef.default = i.defaultValue;
                if (i.description) inputDef.description = i.description.slice(0, 150);
                if (i.secure) inputDef.secure = true;
                // If secure field has stored value and user didn't change it, preserve it
                if (i.secure && i._hasStoredValue && !i.defaultValue) {
                    inputDef._hasStoredValue = true;
                }
                // Only use object format if there's extra properties
                if (inputDef.default || inputDef.description || inputDef.secure || inputDef._hasStoredValue) {
                    inputs[i.key] = inputDef;
                } else {
                    inputs[i.key] = i.type || 'string';
                }
            }
        });
        const outputs = {};
        outputsList.forEach(o => { if (o.key) outputs[o.key] = o.type || 'any'; });
        const dependencies = {};
        dependenciesList.forEach(d => { if (d.name) dependencies[d.name] = d.version || 'latest'; });

        setIsSaving(true);
        try {
            const url = isCreating
                ? `${API_BASE}/components`
                : `${API_BASE}/components/${selectedComponent}`;
            const method = isCreating ? 'POST' : 'PUT';

            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    inputs,
                    outputs,
                    dependencies
                })
            });

            const result = await res.json();
            if (result.error) {
                alert(result.error);
            } else {
                fetchComponents();
                setIsDirty(false);
                if (isCreating) {
                    setSelectedComponent(formData.id);
                    setIsCreating(false);
                    updateUrl(formData.id);
                }
            }
        } catch (err) {
            alert('Failed to save component: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedComponent) return;
        if (!confirm(`Delete "${formData.name}"? This cannot be undone.`)) return;

        try {
            await authFetch(`${API_BASE}/components/${selectedComponent}`, { method: 'DELETE' });
            fetchComponents();
            handleNewComponent();
        } catch (err) {
            alert('Failed to delete component: ' + err.message);
        }
    };

    const handleDeleteCategory = async (category, componentsInCategory) => {
        const count = componentsInCategory.length;
        if (!confirm(`Delete all ${count} components in "${category}"? This cannot be undone.`)) return;

        try {
            for (const comp of componentsInCategory) {
                await authFetch(`${API_BASE}/components/${comp.id}`, { method: 'DELETE' });
            }
            fetchComponents();
            if (selectedComponent && componentsInCategory.some(c => c.id === selectedComponent)) {
                handleNewComponent();
            }
        } catch (err) {
            alert('Failed to delete category: ' + err.message);
        }
    };

    const handleDeleteSingleComponent = async (e, compId, compName) => {
        e.stopPropagation();
        if (!confirm(`Delete "${compName}"? This cannot be undone.`)) return;

        try {
            await authFetch(`${API_BASE}/components/${compId}`, { method: 'DELETE' });
            fetchComponents();
            if (selectedComponent === compId) {
                handleNewComponent();
            }
        } catch (err) {
            alert('Failed to delete component: ' + err.message);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestOutput(null);
        try {
            const testInputObj = JSON.parse(testInput);
            const res = await authFetch(`${API_BASE}/test-component`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    componentId: selectedComponent || formData.id,
                    inputs: testInputObj
                })
            });
            const result = await res.json();
            setTestOutput(result);
        } catch (err) {
            setTestOutput({ error: err.message });
        } finally {
            setIsTesting(false);
        }
    };

    // Generate output schema from a value
    const generateOutputSchema = (value, prefix = '') => {
        if (value === null) return { type: 'any' };
        if (Array.isArray(value)) {
            return { type: 'array', items: value.length > 0 ? generateOutputSchema(value[0]) : { type: 'any' } };
        }
        if (typeof value === 'object') {
            const properties = {};
            for (const [key, val] of Object.entries(value)) {
                properties[key] = generateOutputSchema(val);
            }
            return { type: 'object', properties };
        }
        return { type: typeof value };
    };

    // Flatten schema to simple type strings for outputs
    const flattenSchema = (schema, path = '') => {
        if (schema.type === 'object' && schema.properties) {
            const result = {};
            for (const [key, val] of Object.entries(schema.properties)) {
                const newPath = path ? `${path}.${key}` : key;
                if (val.type === 'object' || val.type === 'array') {
                    Object.assign(result, flattenSchema(val, newPath));
                } else {
                    result[newPath] = val.type;
                }
            }
            return result;
        } else if (schema.type === 'array') {
            return { [path || 'items']: `array<${schema.items?.type || 'any'}>` };
        }
        return { [path]: schema.type };
    };

    // Save test output as sampleOutput AND generate outputs schema
    const handleSaveSampleOutput = async () => {
        if (!testOutput || !selectedComponent) return;

        // Generate simplified outputs schema from test result
        const schema = generateOutputSchema(testOutput);
        const flatOutputs = flattenSchema(schema);

        try {
            const res = await authFetch(`${API_BASE}/components/${selectedComponent}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sampleOutput: testOutput,
                    outputs: flatOutputs
                })
            });

            if (res.ok) {
                // Update local state to reflect new outputs
                setFormData(prev => ({ ...prev, outputs: flatOutputs }));
                alert('Saved! Updated both sampleOutput and outputs schema.');
            } else {
                const err = await res.json();
                alert(`Failed to save: ${err.error}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    // Filter components
    const filteredComponents = components.filter(comp => {
        const name = (comp.definition?.name || comp.id).toLowerCase();
        const category = (comp.definition?.category || '').toLowerCase();
        const term = searchTerm.toLowerCase();
        return name.includes(term) || category.includes(term);
    });

    // Group components by category
    const groupedComponents = filteredComponents.reduce((acc, comp) => {
        const category = comp.definition?.category || 'Uncategorized';
        if (!acc[category]) acc[category] = [];
        acc[category].push(comp);
        return acc;
    }, {});

    const sortedCategories = Object.keys(groupedComponents).sort();

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden p-6" style={{ background: 'var(--bg-primary)' }}>
                <div className="flex-1 flex overflow-hidden border rounded-xl shadow-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                    {/* Component List Sidebar */}
                    <div className="w-80 border-r flex flex-col" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                        <div className="p-3 border-b" style={{ borderColor: 'var(--border-default)' }}>
                            <div className="flex gap-2 mb-3">
                                <button onClick={handleNewComponent} className="btn-primary flex-1 justify-center">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    New
                                </button>
                                <button onClick={() => setShowAI(true)} className="btn-secondary flex-1 justify-center" style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    AI
                                </button>
                            </div>
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search components..."
                                    className="input w-full pl-10"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-2">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <div className="spinner"></div>
                                </div>
                            ) : sortedCategories.length === 0 ? (
                                <div className="text-center py-8 text-muted text-sm">No components found</div>
                            ) : (
                                sortedCategories.map(category => {
                                    const getCategoryIcon = (cat) => {
                                        const lower = cat.toLowerCase();
                                        if (lower.includes('ai')) return { icon: '🤖', color: '#a855f7' };
                                        if (lower.includes('data')) return { icon: '📊', color: '#3b82f6' };
                                        if (lower.includes('api') || lower.includes('http')) return { icon: '🌐', color: '#22c55e' };
                                        if (lower.includes('flow') || lower.includes('logic')) return { icon: '⚡', color: '#f59e0b' };
                                        if (lower.includes('communication') || lower.includes('chat')) return { icon: '💬', color: '#06b6d4' };
                                        if (lower.includes('input')) return { icon: '📝', color: '#ec4899' };
                                        if (lower.includes('json')) return { icon: '{ }', color: '#64748b' };
                                        return { icon: '📦', color: '#6366f1' };
                                    };
                                    const catInfo = getCategoryIcon(category);
                                    const isCollapsed = collapsedCategories[category];
                                    return (
                                        <div key={category} className="mb-3">
                                            <div
                                                className="flex items-center gap-2 px-2 py-1.5 mb-1 group cursor-pointer select-none rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
                                                onClick={() => setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                                            >
                                                <svg
                                                    className="w-3 h-3 transition-transform flex-shrink-0"
                                                    style={{ color: 'var(--text-muted)', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                                <span style={{ fontSize: '12px' }}>{catInfo.icon}</span>
                                                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                                    {category}
                                                </span>
                                                <span className="text-xs px-1.5 py-0.5 rounded-full"
                                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '10px' }}>
                                                    {groupedComponents[category].length}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteCategory(category, groupedComponents[category]);
                                                    }}
                                                    className="ml-auto opacity-0 group-hover:opacity-100 p-1 rounded transition-all hover:bg-red-500/20"
                                                    title={`Delete all ${groupedComponents[category].length} components in ${category}`}
                                                    style={{ color: '#ef4444' }}
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                            {!isCollapsed && groupedComponents[category].map(comp => (
                                                <div
                                                    key={comp.id}
                                                    onClick={() => handleSelectComponent(comp)}
                                                    className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all group/item ${selectedComponent === comp.id
                                                        ? 'bg-[var(--accent-primary)]'
                                                        : 'hover:bg-[var(--bg-tertiary)]'
                                                        }`}
                                                    style={{
                                                        color: selectedComponent === comp.id ? 'white' : 'var(--text-secondary)',
                                                        marginBottom: '2px'
                                                    }}
                                                >
                                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                                        style={{
                                                            background: selectedComponent === comp.id ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                                                            fontSize: '12px'
                                                        }}>
                                                        {catInfo.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="truncate text-sm font-medium block">{comp.definition.name || comp.id}</span>
                                                        {comp.definition.description && (
                                                            <span
                                                                className="text-xs truncate block mt-0.5"
                                                                style={{ color: selectedComponent === comp.id ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', lineHeight: '1.3' }}
                                                            >
                                                                {comp.definition.description.length > 60 ? comp.definition.description.slice(0, 60) + '…' : comp.definition.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleDeleteSingleComponent(e, comp.id, comp.definition.name || comp.id)}
                                                        className={`p-1 rounded transition-all hover:bg-red-500/20 flex-shrink-0 ${selectedComponent === comp.id
                                                            ? 'opacity-70 hover:opacity-100'
                                                            : 'opacity-0 group-hover/item:opacity-100'
                                                            }`}
                                                        title="Delete component"
                                                        style={{ color: selectedComponent === comp.id ? 'white' : '#ef4444' }}
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Editor Panel */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {(selectedComponent || isCreating) ? (
                            <>
                                {/* Tabs */}
                                <div className="flex items-center gap-1 px-4 py-2 border-b" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                                    {[
                                        { id: 'config', label: 'Config', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
                                        { id: 'code', label: 'index.js', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
                                        { id: 'test', label: 'Test', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all"
                                            style={{
                                                background: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
                                                color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
                                                boxShadow: activeTab === tab.id ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none',
                                            }}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                                                {tab.id === 'config' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />}
                                            </svg>
                                            {tab.label}
                                        </button>
                                    ))}

                                    {/* Component ID indicator and Save button */}
                                    <div className="ml-auto flex items-center gap-3 text-xs text-muted px-2">
                                        <span className="badge badge-primary font-mono">{selectedComponent || formData.id || 'new-component'}</span>
                                        {isDirty && (
                                            <span className="flex items-center gap-1.5 text-xs" style={{ color: '#f59e0b' }}>
                                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b' }} />
                                                Unsaved
                                            </span>
                                        )}
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
                                            title="Save component changes"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <div className="spinner" style={{ width: '12px', height: '12px' }}></div>
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Save
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Tab Content */}
                                <div className="flex-1 overflow-auto">
                                    {activeTab === 'config' && (
                                        <div className="p-6 space-y-6 max-w-4xl">
                                            {/* Basic Info */}
                                            <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                                                        <svg className="w-4 h-4" style={{ color: '#6366f1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    </div>
                                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Basic Information</h3>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs font-medium text-muted block mb-1.5">Component ID</label>
                                                        <input
                                                            type="text"
                                                            value={formData.id}
                                                            onChange={(e) => setFormData(prev => { setIsDirty(true); return { ...prev, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }; })}
                                                            disabled={!isCreating}
                                                            placeholder="my-component"
                                                            className="input w-full font-mono"
                                                            style={{ opacity: isCreating ? 1 : 0.6 }}
                                                        />
                                                        <p className="text-xs text-muted mt-1">Lowercase, numbers, hyphens only</p>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-muted block mb-1.5">Display Name</label>
                                                        <input
                                                            type="text"
                                                            value={formData.name}
                                                            onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setIsDirty(true); }}
                                                            placeholder="My Component"
                                                            className="input w-full"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-muted block mb-1.5">Category</label>
                                                        <input
                                                            type="text"
                                                            value={formData.category}
                                                            onChange={(e) => { setFormData({ ...formData, category: e.target.value }); setIsDirty(true); }}
                                                            placeholder="Custom"
                                                            className="input w-full"
                                                        />
                                                        <p className="text-xs text-muted mt-1">Use / for nesting (e.g., API/REST)</p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="text-xs font-medium text-muted block mb-1.5">Description</label>
                                                        <textarea
                                                            value={formData.description}
                                                            onChange={(e) => { setFormData({ ...formData, description: e.target.value.slice(0, 500) }); setIsDirty(true); }}
                                                            placeholder="What does this component do? (max 500 chars)"
                                                            className="input w-full resize-none"
                                                            rows={3}
                                                            maxLength={500}
                                                        />
                                                        <p className="text-xs text-muted mt-1 text-right">{formData.description?.length || 0}/500</p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="flex items-center gap-3 cursor-pointer">
                                                            <div
                                                                onClick={() => setFormData({ ...formData, agentEnabled: !formData.agentEnabled })}
                                                                className="relative w-11 h-6 rounded-full transition-colors cursor-pointer"
                                                                style={{ background: formData.agentEnabled ? 'var(--accent-primary)' : 'var(--bg-tertiary)' }}
                                                            >
                                                                <div
                                                                    className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
                                                                    style={{ left: formData.agentEnabled ? '24px' : '4px' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <span className="text-sm font-medium text-primary">Enable as Agent Tool</span>
                                                                <p className="text-xs text-muted">Allow AI agents to use this tool</p>
                                                            </div>
                                                        </label>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="flex items-center gap-3 cursor-pointer">
                                                            <div
                                                                onClick={() => { setFormData({ ...formData, directChatEnabled: !formData.directChatEnabled }); setIsDirty(true); }}
                                                                className="relative w-11 h-6 rounded-full transition-colors cursor-pointer"
                                                                style={{ background: formData.directChatEnabled ? '#8b5cf6' : 'var(--bg-tertiary)' }}
                                                            >
                                                                <div
                                                                    className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
                                                                    style={{ left: formData.directChatEnabled ? '24px' : '4px' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <span className="text-sm font-medium text-primary">Enable for Direct Chat</span>
                                                                <p className="text-xs text-muted">Make this tool available in direct chat mode</p>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Inputs */}
                                            <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
                                                            <svg className="w-4 h-4" style={{ color: '#22c55e' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                                                            </svg>
                                                        </div>
                                                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Inputs</h3>
                                                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                                            {inputsList.length}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => setInputsList([...inputsList, { key: '', type: 'string', defaultValue: '', description: '', secure: false, _hasStoredValue: false }])}
                                                        className="btn-secondary text-xs"
                                                    >
                                                        + Add Input
                                                    </button>
                                                </div>
                                                {inputsList.length === 0 ? (
                                                    <p className="text-sm text-muted">No inputs defined. Click "Add Input" to create one.</p>
                                                ) : (
                                                    <div className="space-y-2.5">
                                                        {inputsList.map((inp, i) => {
                                                            const typeColors = {
                                                                string: { bg: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' },
                                                                number: { bg: 'rgba(34, 197, 94, 0.12)', color: '#4ade80' },
                                                                boolean: { bg: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' },
                                                                object: { bg: 'rgba(249, 115, 22, 0.12)', color: '#fb923c' },
                                                                array: { bg: 'rgba(236, 72, 153, 0.12)', color: '#f472b6' },
                                                                any: { bg: 'rgba(100, 116, 139, 0.12)', color: '#94a3b8' },
                                                            };
                                                            const tc = typeColors[inp.type] || typeColors.any;
                                                            return (
                                                                <div key={i} className="rounded-xl overflow-hidden transition-all group/card" style={{
                                                                    background: 'var(--bg-primary)',
                                                                    border: '1px solid var(--border-subtle)',
                                                                    borderLeft: `3px solid ${tc.color}`,
                                                                }}>
                                                                    {/* Top row: name, type badge, actions */}
                                                                    <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-1">
                                                                        <input
                                                                            type="text"
                                                                            value={inp.key}
                                                                            onChange={(e) => { const l = [...inputsList]; l[i].key = e.target.value; setInputsList(l); setIsDirty(true); }}
                                                                            placeholder="inputName"
                                                                            className="font-mono text-sm font-semibold bg-transparent border-none outline-none"
                                                                            style={{ color: 'var(--text-primary)', width: '150px' }}
                                                                        />
                                                                        <select
                                                                            value={inp.type}
                                                                            onChange={(e) => { const l = [...inputsList]; l[i].type = e.target.value; setInputsList(l); setIsDirty(true); }}
                                                                            className="text-xs font-medium rounded-full px-2.5 py-0.5 border-none outline-none cursor-pointer"
                                                                            style={{ background: tc.bg, color: tc.color }}
                                                                        >
                                                                            <option value="string">string</option>
                                                                            <option value="number">number</option>
                                                                            <option value="boolean">boolean</option>
                                                                            <option value="object">object</option>
                                                                            <option value="array">array</option>
                                                                            <option value="any">any</option>
                                                                        </select>
                                                                        {inp.secure && (
                                                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>secret</span>
                                                                        )}
                                                                        <div className="ml-auto flex items-center gap-1">
                                                                            <button
                                                                                onClick={() => { const l = [...inputsList]; l[i].secure = !l[i].secure; setInputsList(l); setIsDirty(true); }}
                                                                                className="p-1.5 rounded-lg transition-all"
                                                                                style={{
                                                                                    background: inp.secure ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                                                                                    color: inp.secure ? '#ef4444' : 'var(--text-muted)',
                                                                                }}
                                                                                title={inp.secure ? 'Marked as secret — click to toggle' : 'Click to mark as secret'}
                                                                            >
                                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    {inp.secure ? (
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                                                    ) : (
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                                                                    )}
                                                                                </svg>
                                                                            </button>
                                                                            <button
                                                                                onClick={() => { setInputsList(inputsList.filter((_, j) => j !== i)); setIsDirty(true); }}
                                                                                className="p-1.5 rounded-lg transition-all opacity-0 group-hover/card:opacity-100 hover:bg-red-500/20"
                                                                                style={{ color: 'var(--text-muted)' }}
                                                                                title="Remove input"
                                                                            >
                                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                                </svg>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    {/* Bottom row: default value + description */}
                                                                    <div className="flex gap-2.5 px-3.5 pb-3 pt-1">
                                                                        <div className="flex-shrink-0" style={{ width: '150px' }}>
                                                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Default</label>
                                                                            <input
                                                                                type={inp.secure ? 'password' : 'text'}
                                                                                value={inp.defaultValue || ''}
                                                                                onChange={(e) => { const l = [...inputsList]; l[i].defaultValue = e.target.value; l[i]._hasStoredValue = false; setInputsList(l); setIsDirty(true); }}
                                                                                placeholder={inp.secure ? (inp._hasStoredValue ? '••• stored' : '—') : '—'}
                                                                                className="input w-full text-xs font-mono"
                                                                            />
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
                                                                            <div className="relative">
                                                                                <input
                                                                                    type="text"
                                                                                    value={inp.description || ''}
                                                                                    onChange={(e) => { const l = [...inputsList]; l[i].description = e.target.value.slice(0, 150); setInputsList(l); setIsDirty(true); }}
                                                                                    placeholder="Describe this input for AI agents..."
                                                                                    className="input w-full text-xs pr-12"
                                                                                    maxLength={150}
                                                                                />
                                                                                {(inp.description || '').length > 0 && (
                                                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted" style={{ fontSize: '9px' }}>
                                                                                        {(inp.description || '').length}/150
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Outputs */}
                                            <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
                                                            <svg className="w-4 h-4" style={{ color: '#a855f7' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                            </svg>
                                                        </div>
                                                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Outputs</h3>
                                                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                                            {outputsList.length}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => setOutputsList([...outputsList, { key: '', type: 'any' }])}
                                                        className="btn-secondary text-xs"
                                                    >
                                                        + Add Output
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {outputsList.map((out, i) => (
                                                        <div key={i} className="flex gap-2 items-center">
                                                            <input
                                                                type="text"
                                                                value={out.key}
                                                                onChange={(e) => { const l = [...outputsList]; l[i].key = e.target.value; setOutputsList(l); }}
                                                                placeholder="outputName"
                                                                className="input flex-1 font-mono"
                                                            />
                                                            <select
                                                                value={out.type}
                                                                onChange={(e) => { const l = [...outputsList]; l[i].type = e.target.value; setOutputsList(l); }}
                                                                className="select"
                                                            >
                                                                <option value="string">string</option>
                                                                <option value="number">number</option>
                                                                <option value="boolean">boolean</option>
                                                                <option value="object">object</option>
                                                                <option value="array">array</option>
                                                                <option value="any">any</option>
                                                            </select>
                                                            <button
                                                                onClick={() => setOutputsList(outputsList.filter((_, j) => j !== i))}
                                                                className="btn-icon text-error"
                                                                style={{ border: 'none', background: 'transparent' }}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Dependencies */}
                                            <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(249, 115, 22, 0.15)' }}>
                                                            <svg className="w-4 h-4" style={{ color: '#f97316' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                            </svg>
                                                        </div>
                                                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>NPM Dependencies</h3>
                                                        {dependenciesList.length > 0 && (
                                                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                                                {dependenciesList.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => setDependenciesList([...dependenciesList, { name: '', version: 'latest' }])}
                                                        className="btn-secondary text-xs"
                                                    >
                                                        + Add Package
                                                    </button>
                                                </div>
                                                {dependenciesList.length === 0 ? (
                                                    <p className="text-sm text-muted">No dependencies. Built-in Node.js modules are always available.</p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {dependenciesList.map((dep, i) => (
                                                            <div key={i} className="flex gap-2 items-center">
                                                                <input
                                                                    type="text"
                                                                    value={dep.name}
                                                                    onChange={(e) => { const l = [...dependenciesList]; l[i].name = e.target.value; setDependenciesList(l); }}
                                                                    placeholder="package-name"
                                                                    className="input flex-1 font-mono"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={dep.version}
                                                                    onChange={(e) => { const l = [...dependenciesList]; l[i].version = e.target.value; setDependenciesList(l); }}
                                                                    placeholder="^1.0.0"
                                                                    className="input w-32 font-mono"
                                                                />
                                                                <button
                                                                    onClick={() => setDependenciesList(dependenciesList.filter((_, j) => j !== i))}
                                                                    className="btn-icon text-error"
                                                                    style={{ border: 'none', background: 'transparent' }}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Delete Component */}
                                            {selectedComponent && !isCreating && (
                                                <div className="rounded-xl p-5 mt-2" style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h3 className="text-sm font-semibold" style={{ color: '#ef4444' }}>Danger Zone</h3>
                                                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Permanently delete this component and all its files</p>
                                                        </div>
                                                        <button
                                                            onClick={handleDelete}
                                                            className="px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                                                            style={{
                                                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                color: '#ef4444',
                                                            }}
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            Delete Component
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'code' && (
                                        <div className="h-full flex flex-col p-4">
                                            <div className="flex items-center justify-between mb-3 px-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
                                                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>index.js</span>
                                                </div>
                                                <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                                    {formData.code.split('\n').length} lines
                                                </span>
                                            </div>
                                            <div className="flex-1 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-default)' }}>
                                                <Editor
                                                    height="100%"
                                                    defaultLanguage="javascript"
                                                    theme="vs-dark"
                                                    value={formData.code}
                                                    onChange={(value) => { setFormData({ ...formData, code: value || '' }); setIsDirty(true); }}
                                                    options={{
                                                        fontSize: 13,
                                                        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                                                        minimap: { enabled: false },
                                                        scrollBeyondLastLine: false,
                                                        padding: { top: 16, bottom: 16 },
                                                        lineNumbers: 'on',
                                                        renderLineHighlight: 'line',
                                                        cursorBlinking: 'smooth',
                                                        automaticLayout: true,
                                                        tabSize: 2,
                                                        wordWrap: 'on'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'test' && (
                                        <div className="h-full flex flex-col p-4 gap-4">
                                            <div className="flex-1 flex gap-4 min-h-0">
                                                {/* Test Input */}
                                                <div className="flex-1 flex flex-col min-h-0">
                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
                                                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Input (JSON)</span>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const defaultInput = {};
                                                                inputsList.forEach(inp => {
                                                                    defaultInput[inp.key] = inp.defaultValue || '';
                                                                });
                                                                setTestInput(JSON.stringify(defaultInput, null, 2));
                                                            }}
                                                            className="text-xs px-2 py-1 rounded transition-colors"
                                                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                                                        >
                                                            Reset to defaults
                                                        </button>
                                                    </div>
                                                    <div className="flex-1 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-default)' }}>
                                                        <Editor
                                                            height="100%"
                                                            defaultLanguage="json"
                                                            theme="vs-dark"
                                                            value={testInput}
                                                            onChange={(value) => setTestInput(value || '')}
                                                            options={{
                                                                fontSize: 13,
                                                                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                                                                minimap: { enabled: false },
                                                                scrollBeyondLastLine: false,
                                                                padding: { top: 12, bottom: 12 },
                                                                lineNumbers: 'off',
                                                                renderLineHighlight: 'none',
                                                                automaticLayout: true,
                                                                tabSize: 2,
                                                                wordWrap: 'on',
                                                                folding: false
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Test Output */}
                                                <div className="flex-1 flex flex-col min-h-0">
                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-full" style={{ background: testOutput?.error ? '#ef4444' : '#a855f7' }} />
                                                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Output</span>
                                                            {testOutput && !testOutput.error && (
                                                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>Success</span>
                                                            )}
                                                            {testOutput?.error && (
                                                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>Error</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {testOutput && !testOutput.error && (
                                                                <>
                                                                    <button
                                                                        onClick={() => navigator.clipboard.writeText(JSON.stringify(testOutput, null, 2))}
                                                                        className="text-xs px-2 py-1 rounded transition-colors"
                                                                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                                                                        title="Copy to clipboard"
                                                                    >
                                                                        📋 Copy
                                                                    </button>
                                                                    <button
                                                                        onClick={handleSaveSampleOutput}
                                                                        className="text-xs px-2 py-1 rounded transition-colors"
                                                                        style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#6366f1' }}
                                                                        title="Save as sample output"
                                                                    >
                                                                        💾 Save Sample
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-default)' }}>
                                                        {isTesting ? (
                                                            <div className="h-full flex items-center justify-center" style={{ background: '#1e1e1e' }}>
                                                                <div className="flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                                                                    <div className="spinner" style={{ width: '1.25rem', height: '1.25rem' }}></div>
                                                                    <span>Running component...</span>
                                                                </div>
                                                            </div>
                                                        ) : testOutput ? (
                                                            <Editor
                                                                height="100%"
                                                                defaultLanguage="json"
                                                                theme="vs-dark"
                                                                value={JSON.stringify(testOutput, null, 2)}
                                                                options={{
                                                                    fontSize: 13,
                                                                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                                                                    minimap: { enabled: false },
                                                                    scrollBeyondLastLine: false,
                                                                    padding: { top: 12, bottom: 12 },
                                                                    lineNumbers: 'off',
                                                                    renderLineHighlight: 'none',
                                                                    automaticLayout: true,
                                                                    readOnly: true,
                                                                    wordWrap: 'on',
                                                                    folding: true
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="h-full flex items-center justify-center" style={{ background: '#1e1e1e' }}>
                                                                <span style={{ color: 'var(--text-muted)' }}>Click "Run Test" to execute the component</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-center pt-2">
                                                <button
                                                    onClick={handleTest}
                                                    disabled={isTesting || isCreating}
                                                    className="px-8 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2"
                                                    style={{
                                                        background: isTesting || isCreating ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                                                        color: isTesting || isCreating ? 'var(--text-muted)' : 'white',
                                                        cursor: isTesting || isCreating ? 'not-allowed' : 'pointer'
                                                    }}
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                    {isTesting ? 'Running...' : 'Run Test'}
                                                </button>
                                                {isCreating && (
                                                    <p className="text-xs ml-4 self-center" style={{ color: 'var(--text-muted)' }}>Save the component first to test it</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                                    <div style={{
                                        width: '80px', height: '80px', borderRadius: '20px', margin: '0 auto 24px',
                                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.15)',
                                    }}>
                                        <svg style={{ width: '36px', height: '36px', color: '#818cf8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Select or Create a Component</h3>
                                    <p className="text-sm mb-6" style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>Components are reusable tools that your AI agents can call. Pick one from the sidebar or create a new one.</p>
                                    <div className="flex gap-3 justify-center">
                                        <button onClick={handleNewComponent} className="btn-primary flex items-center gap-2 px-5 py-2.5">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            New Component
                                        </button>
                                        <button onClick={() => setShowAI(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all" style={{ border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', background: 'rgba(99, 102, 241, 0.08)' }}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                            </svg>
                                            AI Designer
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Documentation Modal */}
            {
                showDocs && (
                    <div className="modal-overlay" onClick={() => setShowDocs(false)}>
                        <div
                            className="modal-content max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                            style={{ width: '900px' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
                                <h2 className="modal-title">Component Development Guide</h2>
                                <button onClick={() => setShowDocs(false)} className="btn-icon">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto pt-4 space-y-6">
                                <section>
                                    <h3 className="text-base font-semibold text-primary mb-2">📦 Component Structure</h3>
                                    <p className="text-sm text-secondary mb-2">Each component is stored in <code className="badge badge-primary font-mono">/components/component-id/</code> and contains:</p>
                                    <ul className="text-sm text-secondary list-disc pl-5 space-y-1">
                                        <li><strong>component.json</strong> — Name, inputs, outputs, category</li>
                                        <li><strong>package.json</strong> — NPM dependencies (isolated per component)</li>
                                        <li><strong>index.js</strong> — Execution logic</li>
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="text-base font-semibold text-primary mb-2">⚡ Execution Flow</h3>
                                    <div className="text-sm text-secondary space-y-1">
                                        <p>1. Component receives <strong>JSON via stdin</strong> (configured inputs)</p>
                                        <p>2. Performs logic (API calls, data processing, etc.)</p>
                                        <p>3. Outputs <strong>JSON via stdout</strong> (available to downstream nodes)</p>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-base font-semibold text-primary mb-2">📝 Code Template</h3>
                                    <pre className="text-xs p-4 rounded-lg overflow-auto font-mono" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>
                                        {`let inputData = '';
process.stdin.on('data', chunk => inputData += chunk);

process.stdin.on('end', async () => {
    try {
        const inputs = JSON.parse(inputData);
        
        // Your logic here
        const result = { output: inputs.input };
        
        console.log(JSON.stringify(result));
    } catch (e) {
        process.stderr.write(e.message);
        process.exit(1);
    }
});`}
                                    </pre>
                                </section>

                                <section>
                                    <h3 className="text-base font-semibold text-primary mb-2">💡 Tips</h3>
                                    <ul className="text-sm text-secondary list-disc pl-5 space-y-1">
                                        <li><strong>Output must be valid JSON</strong> — use <code className="font-mono text-xs">JSON.stringify()</code></li>
                                        <li><strong>Handle errors</strong> — write to stderr, exit with code 1</li>
                                        <li><strong>Async is supported</strong> — just output before process ends</li>
                                        <li><strong>Use categories</strong> — group with / (e.g., "Nextcloud/Files")</li>
                                    </ul>
                                </section>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* AI Component Designer Modal */}
            {
                showAI && (
                    <div className="fixed inset-0 z-[100]" style={{ background: 'var(--bg-primary)' }}>
                        <AIComponentDesigner
                            onComponentCreated={(id) => {
                                fetchComponents();
                                // Don't close immediately - let the designer handle post-create actions
                            }}
                            onClose={() => setShowAI(false)}
                        />
                    </div>
                )
            }
        </div >
    );
};

export default ComponentBuilder;
