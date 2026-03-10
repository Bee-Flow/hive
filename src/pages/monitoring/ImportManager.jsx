import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import ModelTierSelector from '../../components/ModelTierSelector';
import {
    ArrowLeft, Plus, Trash2, Play, Loader2, Download,
    AlertCircle, CheckCircle, Sparkles, FileText, Clock, ChevronRight
} from 'lucide-react';

const APP_ICONS = { gmail: '📧', calendar: '📅', drive: '📁', sheets: '📊', youtrack: '🎯' };

// ── Import List ──────────────────────────────────────────

const ImportList = ({ imports, loading, onSelect, onCreate, onBack }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32 }}>
        <div style={{ width: '100%', maxWidth: 800 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {onBack && <button onClick={onBack} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex' }}><ArrowLeft style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} /></button>}
                    <Download style={{ width: 22, height: 22, color: 'var(--accent-primary)' }} />
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Data Imports</h1>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)' }}>AI</span>
                </div>
                <button onClick={onCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--accent-primary)', cursor: 'pointer' }}><Plus style={{ width: 15, height: 15 }} />New Import</button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} /></div>
            ) : imports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    <Download style={{ width: 40, height: 40, opacity: 0.2, margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 14, margin: 0 }}>No imports yet. Create one to pull data from your apps.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {imports.map(imp => (
                        <button key={imp.id} onClick={() => onSelect(imp)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--bg-primary)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                            <span style={{ fontSize: 24 }}>{APP_ICONS[imp.app_source] || '📦'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{imp.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, marginTop: 2 }}>
                                    <span>{imp.app_source}</span>
                                    {imp.last_run_at && <span><Clock style={{ width: 10, height: 10, display: 'inline', verticalAlign: -1 }} /> {new Date(imp.last_run_at).toLocaleString()}</span>}
                                </div>
                            </div>
                            <StatusBadge status={imp.last_run_status} />
                            <ChevronRight style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    </div>
);

const StatusBadge = ({ status }) => {
    const styles = {
        never: { bg: 'rgba(100,116,139,0.1)', color: '#64748b', label: 'Not run' },
        success: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', label: 'Success' },
        error: { bg: 'rgba(244,63,94,0.1)', color: '#f43f5e', label: 'Error' },
        running: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1', label: 'Running' },
    };
    const s = styles[status] || styles.never;
    return <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
};

// ── Create Import wizard ─────────────────────────────────

const CreateImport = ({ onBack, onCreated }) => {
    const [step, setStep] = useState(1);
    const [sources, setSources] = useState([]);
    const [appSource, setAppSource] = useState('');
    const [description, setDescription] = useState('');
    const [generating, setGenerating] = useState(false);
    const [generated, setGenerated] = useState(null);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const [modelTiers, setModelTiers] = useState({});
    const [selectedTier, setSelectedTier] = useState('auto');

    useEffect(() => {
        authFetch(`${API_BASE}/api/monitoring/imports/sources`).then(r => r.json()).then(setSources).catch(() => { });
        authFetch(`${API_BASE}/ai/config/chat-models`).then(r => r.ok ? r.json() : {}).then(setModelTiers).catch(() => { });
    }, []);

    const generateScript = async () => {
        setGenerating(true); setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/monitoring/imports/generate-script`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appSource, description, tier: selectedTier || 'auto' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Generation failed');
            setGenerated(data);
            setName(data.suggestedName || `${appSource} Import`);
            setStep(3);
        } catch (err) { setError(err.message); }
        finally { setGenerating(false); }
    };

    const saveImport = async () => {
        setSaving(true); setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/monitoring/imports`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name, description, appSource,
                    importScript: generated.script,
                    columns: generated.columns,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Save failed');
            onCreated(data);
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32 }}>
            <div style={{ width: '100%', maxWidth: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                    <button onClick={onBack} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex' }}><ArrowLeft style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} /></button>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Create Data Import</h2>
                </div>

                {/* Progress steps */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                    {['Select App', 'Describe Data', 'Review & Save'].map((label, i) => (
                        <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ height: 3, borderRadius: 2, background: i + 1 <= step ? 'var(--accent-primary)' : 'var(--border-default)', marginBottom: 6, transition: 'all 0.3s' }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: i + 1 <= step ? 'var(--accent-primary)' : 'var(--text-muted)' }}>{label}</span>
                        </div>
                    ))}
                </div>

                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(244,63,94,0.1)', color: '#f43f5e', fontSize: 13, marginBottom: 16 }}>
                        <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />{error}
                    </div>
                )}

                {/* Step 1: Select App */}
                {step === 1 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                        {sources.map(src => (
                            <button key={src.id} onClick={() => { setAppSource(src.id); setStep(2); }}
                                style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border-default)', background: 'var(--bg-primary)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}
                                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                            >
                                <div style={{ fontSize: 28, marginBottom: 8 }}>{src.icon}</div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{src.label}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{src.description}</div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Step 2: Describe what to import */}
                {step === 2 && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <span style={{ fontSize: 24 }}>{APP_ICONS[appSource]}</span>
                            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{appSource.charAt(0).toUpperCase() + appSource.slice(1)}</span>
                        </div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 6 }}>Describe what data you want to import</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} placeholder={`Example: "Import email headers from the last 30 days. I want sender, recipient, subject, date, and calculate response time."`}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />

                        {/* Model tier selector */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)' }}>AI Model</label>
                            <ModelTierSelector tiers={modelTiers} value={selectedTier} onChange={setSelectedTier} dropDirection="down" />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                            <button onClick={() => setStep(1)} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer' }}>Back</button>
                            <button onClick={generateScript} disabled={!description.trim() || generating}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', background: description.trim() ? 'var(--accent-primary)' : '#999', cursor: description.trim() ? 'pointer' : 'default', opacity: generating ? 0.6 : 1 }}>
                                {generating ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Sparkles style={{ width: 14, height: 14 }} />}
                                {generating ? 'Generating...' : 'Generate with AI'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Review & Save */}
                {step === 3 && generated && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 4 }}>Import Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 4 }}>Columns ({generated.columns.length})</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {generated.columns.map((col, i) => (
                                    <span key={i} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{col.label || col.name}</span>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 4 }}>Generated Script</label>
                            <pre style={{ padding: 12, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', fontSize: 11, color: 'var(--text-secondary)', maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>{generated.script}</pre>
                        </div>

                        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', fontSize: 12, color: 'var(--text-secondary)' }}>
                            🔒 All imported values will be encrypted with your personal key. Only you can view this data.
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <button onClick={() => { setStep(2); setGenerated(null); }} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer' }}>Regenerate</button>
                            <button onClick={saveImport} disabled={saving || !name.trim()}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--accent-primary)', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                                {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <CheckCircle style={{ width: 14, height: 14 }} />}
                                {saving ? 'Saving...' : 'Create Import'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Import Detail View ───────────────────────────────────

const ImportDetail = ({ importConfig, onBack, onDelete, onRun }) => {
    const [running, setRunning] = useState(false);
    const [runResult, setRunResult] = useState(null);
    const [error, setError] = useState(null);

    const handleRun = async () => {
        setRunning(true); setError(null); setRunResult(null);
        try {
            const res = await authFetch(`${API_BASE}/api/monitoring/imports/${importConfig.id}/run`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Run failed');
            setRunResult(data);
            onRun?.();
        } catch (err) { setError(err.message); }
        finally { setRunning(false); }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this import and all its data?')) return;
        try {
            await authFetch(`${API_BASE}/api/monitoring/imports/${importConfig.id}`, { method: 'DELETE' });
            onDelete();
        } catch (err) { setError(err.message); }
    };

    const imp = importConfig;
    const columns = imp.column_mapping || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32 }}>
            <div style={{ width: '100%', maxWidth: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                    <button onClick={onBack} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex' }}><ArrowLeft style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} /></button>
                    <span style={{ fontSize: 24 }}>{APP_ICONS[imp.app_source] || '📦'}</span>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0, flex: 1 }}>{imp.name}</h2>
                    <StatusBadge status={imp.last_run_status} />
                </div>

                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(244,63,94,0.1)', color: '#f43f5e', fontSize: 13, marginBottom: 16 }}>
                        <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />{error}
                    </div>
                )}

                {runResult && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 13, marginBottom: 16 }}>
                        <CheckCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
                        Imported {runResult.imported} of {runResult.total} rows
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                    <button onClick={handleRun} disabled={running}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', background: '#22c55e', cursor: running ? 'default' : 'pointer', opacity: running ? 0.6 : 1 }}>
                        {running ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Play style={{ width: 14, height: 14 }} />}
                        {running ? 'Running...' : 'Run Import'}
                    </button>
                    <button onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(244,63,94,0.3)', fontSize: 13, fontWeight: 600, color: '#f43f5e', background: 'transparent', cursor: 'pointer' }}>
                        <Trash2 style={{ width: 14, height: 14 }} />Delete
                    </button>
                </div>

                {/* Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {imp.description && (
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 4 }}>Description</label>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{imp.description}</p>
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 4 }}>Columns ({columns.length})</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {columns.map((col, i) => (
                                <span key={i} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{col.label || col.name}</span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 4 }}>Import Script</label>
                        <pre style={{ padding: 12, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', fontSize: 11, color: 'var(--text-secondary)', maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>{imp.import_script}</pre>
                    </div>

                    {imp.last_run_result && (
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 4 }}>Last Run Result</label>
                            <pre style={{ padding: 12, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', fontSize: 11, color: 'var(--text-secondary)', maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(imp.last_run_result, null, 2)}</pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Main Import Manager ──────────────────────────────────

export default function ImportManager({ onBack }) {
    const [view, setView] = useState('list');
    const [imports, setImports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedImport, setSelectedImport] = useState(null);

    const loadImports = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/monitoring/imports`);
            const data = await res.json();
            setImports(Array.isArray(data) ? data : []);
        } catch (err) { console.error('Load imports:', err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadImports(); }, [loadImports]);

    if (view === 'create') {
        return <CreateImport onBack={() => setView('list')} onCreated={() => { setView('list'); loadImports(); }} />;
    }

    if (view === 'detail' && selectedImport) {
        return <ImportDetail importConfig={selectedImport} onBack={() => { setView('list'); loadImports(); }} onDelete={() => { setView('list'); loadImports(); }} onRun={loadImports} />;
    }

    return (
        <ImportList
            imports={imports} loading={loading} onBack={onBack}
            onSelect={imp => { setSelectedImport(imp); setView('detail'); }}
            onCreate={() => setView('create')}
        />
    );
}
