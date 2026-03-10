import React, { useState, useEffect } from 'react';
import { filterVisibleModels, fetchAllowedModelsByAgentType } from '../utils/modelMeta.js';
import ModelSelector from '../components/ModelSelector';
import { API_BASE, authFetch } from '../utils/helpers';

const WORKERS = [
    { key: 'clarify', icon: '❓', color: '#3b82f6' },
    { key: 'requirements', icon: '📋', color: '#8b5cf6' },
    { key: 'auth', icon: '🔑', color: '#ef4444' },
    { key: 'schema', icon: '📐', color: '#06b6d4' },
    { key: 'api', icon: '🌐', color: '#f59e0b' },
    { key: 'credentials', icon: '🔑', color: '#f59e0b' },
    { key: 'builder', icon: '🔨', color: '#10b981' },
    { key: 'qa', icon: '🧪', color: '#ec4899' }
];

const PHASES = [
    { num: 0, name: 'Analyze', color: '#3b82f6', agents: ['orchestrator', 'clarify'] },
    { num: 1, name: 'Research', color: '#8b5cf6', agents: ['requirements', 'auth', 'schema', 'api'] },
    { num: 2, name: 'Credentials', color: '#f59e0b', agents: ['credentials'] },
    { num: 3, name: 'Build & Test', color: '#10b981', agents: ['builder', 'qa'] },
    { num: 4, name: 'Deploy', color: '#06b6d4', agents: [] }
];

export default function MultiAgentConfig({ onBack, embedded = false }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [availableModels, setAvailableModels] = useState([]);
    const [testOutput, setTestOutput] = useState('');
    const [testRunning, setTestRunning] = useState(false);
    const [testPrompt, setTestPrompt] = useState('Create a random quote generator component');
    const [activeWorkers, setActiveWorkers] = useState({});
    const [expandedWorker, setExpandedWorker] = useState(null);

    useEffect(() => {
        Promise.all([
            authFetch(`${API_BASE}/ai/multi-agent/config`).then(r => r.json()),
            authFetch(`${API_BASE}/agents/meta/models`).then(r => r.json()),
            fetchAllowedModelsByAgentType()
        ]).then(([cfg, modelData, allowedConfig]) => {
            setConfig(cfg);
            if (modelData.models) {
                setAvailableModels(filterVisibleModels(modelData.models, 'swarm', allowedConfig));
            }
            setLoading(false);
        }).catch(e => { console.error(e); setLoading(false); });
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/multi-agent/config`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' } , body: JSON.stringify(config)
            });
            const updated = await res.json();
            setConfig(updated);
        } catch (e) { console.error('Save failed:', e); }
        finally { setSaving(false); }
    };

    const updateWorker = (key, field, value) => {
        setConfig(prev => ({
            ...prev,
            workers: { ...prev.workers, [key]: { ...prev.workers[key], [field]: value } }
        }));
    };

    const updateOrchestrator = (field, value) => {
        setConfig(prev => ({
            ...prev,
            orchestrator: { ...prev.orchestrator, [field]: value }
        }));
    };

    const updatePipeline = (field, value) => {
        setConfig(prev => ({
            ...prev,
            pipeline: { ...prev.pipeline, [field]: value }
        }));
    };

    const runTest = async () => {
        setTestRunning(true);
        setTestOutput('');
        setActiveWorkers({});
        try {
            const res = await authFetch(`${API_BASE}/ai/multi-agent/start`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' } , body: JSON.stringify({ message: testPrompt })
            });
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop();
                let ev = null;
                for (const line of lines) {
                    if (line.startsWith('event: ')) ev = line.slice(7).trim();
                    else if (line.startsWith('data: ') && ev) {
                        try {
                            const d = JSON.parse(line.slice(6));
                            const ts = new Date().toLocaleTimeString();

                            // Update active worker status for visualization
                            if (d.type === 'worker_start') {
                                setActiveWorkers(prev => ({ ...prev, [d.worker]: 'running' }));
                            } else if (d.type === 'worker_done') {
                                setActiveWorkers(prev => ({ ...prev, [d.worker]: 'done' }));
                            } else if (d.type === 'worker_error') {
                                setActiveWorkers(prev => ({ ...prev, [d.worker]: 'error' }));
                            }

                            // Format output
                            const phaseIcons = { 1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣' };
                            const icon = d.type === 'phase_start' ? (phaseIcons[d.phase] || '▶️') :
                                d.type === 'phase_done' ? '✅' :
                                    d.type === 'orchestrator_start' ? '🎯' :
                                        d.type === 'orchestrator_plan' ? '📋' :
                                            d.type === 'orchestrator_synthesize' ? '🧬' :
                                                d.type === 'worker_start' ? '🚀' :
                                                    d.type === 'worker_done' ? '✅' :
                                                        d.type === 'worker_error' ? '❌' :
                                                            d.type === 'worker_tool' ? '🔧' :
                                                                d.type === 'needs_input' ? '🔑' :
                                                                    d.type === 'build_retry' ? '🔄' :
                                                                        d.type === 'test_start' ? '🧪' :
                                                                            d.type === 'test_result' ? (d.success ? '✅' : '❌') :
                                                                                d.type === 'done' ? '🎉' : '📌';

                            const label = d.type || ev;
                            let detail;
                            if (d.type === 'phase_start') {
                                detail = `── Phase ${d.phase}: ${d.name} ── ${d.message || ''}`;
                            } else if (d.type === 'phase_done') {
                                detail = `Phase ${d.phase} (${d.name}) complete${d.elapsed ? ` (${(d.elapsed / 1000).toFixed(1)}s)` : ''}`;
                            } else if (d.type === 'worker_done') {
                                detail = `${d.name} (${d.elapsed}ms)`;
                                if (d.output && typeof d.output === 'object' && !d.output.rawResponse) {
                                    detail += '\n' + JSON.stringify(d.output, null, 2).split('\n').map(l => '    ' + l).join('\n');
                                }
                            } else if (d.type === 'worker_start') {
                                detail = d.name;
                            } else if (d.type === 'orchestrator_plan') {
                                detail = `${(d.workers || []).length} workers: ${(d.workers || []).join(', ')}`;
                            } else if (d.type === 'orchestrator_synthesize') {
                                detail = `${d.researchResults} research results → builder brief`;
                            } else if (d.type === 'needs_input') {
                                detail = `Waiting for credentials (${d.authMethod})...`;
                            } else if (d.type === 'build_retry') {
                                detail = `Retry ${d.attempt}/${d.maxRetries}: ${d.error}`;
                            } else if (d.type === 'test_start') {
                                detail = `Testing ${d.componentId}...`;
                            } else if (d.type === 'test_result') {
                                detail = d.success ? `PASSED: ${d.componentId}` : `FAILED: ${d.error || JSON.stringify(d.result).slice(0, 100)}`;
                            } else if (d.type === 'worker_tool') {
                                detail = `${d.worker} → ${d.tool}(${JSON.stringify(d.args).slice(0, 80)})`;
                            } else if (d.type === 'done') {
                                detail = `${d.success ? '✓' : '✗'} Component: ${d.componentId} (${(d.totalElapsed / 1000).toFixed(1)}s total)`;
                            } else {
                                detail = JSON.stringify(d).slice(0, 150);
                            }

                            setTestOutput(p => p + `${icon} [${ts}] ${label}: ${detail}\n`);
                        } catch { }
                        ev = null;
                    }
                }
            }
            setTestOutput(p => p + '\n🏁 Pipeline complete.');
        } catch (e) {
            setTestOutput(p => p + `\n❌ Error: ${e.message}`);
        } finally { setTestRunning(false); }
    };

    if (loading) return <div style={styles.center}>Loading configuration...</div>;
    if (!config) return <div style={styles.center}>Failed to load config</div>;

    const workers = config.workers || {};
    const orchestrator = config.orchestrator || {};

    return (
        <div style={{ ...styles.page, ...(embedded ? { padding: 0 } : {}) }}>
            {/* Header */}
            <div style={styles.header}>
                {!embedded && onBack && (
                    <button onClick={onBack} style={styles.backBtn}>← Back</button>
                )}
                <h1 style={styles.title}>🐝 Swarm Pipeline</h1>
                <button onClick={save} disabled={saving} style={styles.saveBtn}>
                    {saving ? 'Saving...' : '💾 Save Changes'}
                </button>
            </div>

            {/* Pipeline Visualization — Phase-based */}
            <div style={styles.pipelineViz}>
                <div style={styles.pipelineLabel}>SWARM PIPELINE FLOW</div>
                <div style={styles.pipelineFlow}>
                    {/* User Request */}
                    <div style={{ ...styles.pipelineNode, background: 'var(--bg-primary)' }}>
                        <span style={styles.pipelineIcon}>💬</span>
                        <span>Request</span>
                    </div>

                    {PHASES.map((phase, pi) => (
                        <React.Fragment key={phase.num}>
                            <span style={styles.arrow}>→</span>
                            <div style={{
                                ...styles.phaseGroup,
                                borderColor: phase.color + '60'
                            }}>
                                <div style={{ ...styles.phaseLabel, color: phase.color }}>
                                    Phase {phase.num}: {phase.name}
                                </div>
                                <div style={styles.phaseAgents}>
                                    {phase.agents.length > 0 ? phase.agents.map(agentKey => {
                                        const isOrch = agentKey === 'orchestrator';
                                        const w = isOrch ? orchestrator : workers[agentKey];
                                        const workerDef = WORKERS.find(wd => wd.key === agentKey);
                                        const icon = isOrch ? '🎯' : (workerDef?.icon || '⚙️');
                                        const color = isOrch ? '#6366f1' : (workerDef?.color || '#888');
                                        const name = isOrch ? 'Orchestrator' : (w?.name?.replace(/^[^\s]+\s/, '') || agentKey);
                                        const enabled = isOrch ? true : w?.enabled !== false;
                                        const status = activeWorkers[agentKey];
                                        return (
                                            <div key={agentKey} style={{
                                                ...styles.miniWorker,
                                                borderLeft: `3px solid ${color}`,
                                                opacity: enabled ? 1 : 0.35,
                                                background: status === 'running' ? `${color}15` :
                                                    status === 'done' ? '#10b98115' :
                                                        status === 'error' ? '#ef444415' : 'var(--bg-primary)'
                                            }}>
                                                <span>{icon}</span>
                                                <span style={styles.miniWorkerLabel}>{name}</span>
                                                {status === 'running' && <span style={styles.spinner}>⟳</span>}
                                                {status === 'done' && <span style={{ color: '#10b981' }}>✓</span>}
                                                {status === 'error' && <span style={{ color: '#ef4444' }}>✗</span>}
                                            </div>
                                        );
                                    }) : (
                                        <div style={{ ...styles.miniWorker, borderLeft: `3px solid ${phase.color}` }}>
                                            <span>📦</span>
                                            <span style={styles.miniWorkerLabel}>Component</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Orchestrator Card */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>🎯 Orchestrator</h2>
                <p style={styles.sectionDesc}>Decomposes user requests into subtasks and decides which workers to activate.</p>
                <div style={styles.row}>
                    <div style={styles.field}>
                        <label style={styles.label}>MODEL</label>
                        <ModelSelector
                            models={availableModels}
                            value={orchestrator.model || ''}
                            onChange={(val) => updateOrchestrator('model', val || null)}
                            defaultLabel="Default (Recommended)"
                            compact
                        />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Temperature</label>
                        <input style={styles.input} type="number" min="0" max="2" step="0.1"
                            value={orchestrator.temperature ?? 0.3}
                            onChange={e => updateOrchestrator('temperature', parseFloat(e.target.value))} />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Max Tokens</label>
                        <input style={styles.input} type="number" min="500" max="8000" step="500"
                            value={orchestrator.maxTokens ?? 2000}
                            onChange={e => updateOrchestrator('maxTokens', parseInt(e.target.value))} />
                    </div>
                </div>
                <details style={{ marginTop: '12px' }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', userSelect: 'none' }}>
                        ▶ Edit System Prompt
                    </summary>
                    <textarea
                        style={{ ...styles.input, width: '100%', minHeight: '200px', marginTop: '8px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5', resize: 'vertical', whiteSpace: 'pre-wrap' }}
                        value={orchestrator.systemPrompt || ''}
                        onChange={e => updateOrchestrator('systemPrompt', e.target.value)}
                    />
                </details>
            </div>

            {/* Worker Cards */}
            <div style={styles.cardsGrid}>
                {WORKERS.map(({ key, icon, color }) => {
                    const worker = workers[key];
                    if (!worker) return null;
                    const isExpanded = expandedWorker === key;
                    return (
                        <div key={key} style={{ ...styles.card, borderTop: `3px solid ${color}`, opacity: worker.enabled !== false ? 1 : 0.6 }}>
                            <div style={styles.cardHeader}>
                                <span style={styles.cardIcon}>{icon}</span>
                                <span style={styles.cardTitle}>{worker.name}</span>
                                <label style={styles.toggleWrapper}>
                                    <input type="checkbox" checked={worker.enabled !== false}
                                        onChange={e => updateWorker(key, 'enabled', e.target.checked)}
                                        style={styles.toggleInput} />
                                    <span style={{
                                        ...styles.toggleTrack,
                                        background: worker.enabled !== false ? color : 'var(--bg-tertiary)'
                                    }}>
                                        <span style={{
                                            ...styles.toggleKnob,
                                            transform: worker.enabled !== false ? 'translateX(18px)' : 'translateX(0)'
                                        }} />
                                    </span>
                                </label>
                            </div>
                            <p style={styles.cardDesc}>{worker.description}</p>

                            {/* Model Dropdown */}
                            <div style={styles.field}>
                                <label style={styles.label}>AI MODEL</label>
                                <ModelSelector
                                    models={availableModels}
                                    value={worker.model || ''}
                                    onChange={(val) => updateWorker(key, 'model', val || null)}
                                    defaultLabel="Default (Recommended)"
                                    compact
                                />
                            </div>

                            <div style={styles.row}>
                                <div style={styles.field}>
                                    <label style={styles.label}>Temperature</label>
                                    <input style={styles.input} type="number" min="0" max="2" step="0.1"
                                        value={worker.temperature}
                                        onChange={e => updateWorker(key, 'temperature', parseFloat(e.target.value))} />
                                </div>
                                <div style={styles.field}>
                                    <label style={styles.label}>Max Tokens</label>
                                    <input style={styles.input} type="number" min="500" max="32000" step="500"
                                        value={worker.maxTokens}
                                        onChange={e => updateWorker(key, 'maxTokens', parseInt(e.target.value))} />
                                </div>
                            </div>

                            {/* Expandable System Prompt */}
                            <button style={styles.expandBtn} onClick={() => setExpandedWorker(isExpanded ? null : key)}>
                                {isExpanded ? '▼ Hide System Prompt' : '▶ Edit System Prompt'}
                            </button>
                            {isExpanded && (
                                <div style={styles.field}>
                                    <textarea style={styles.textarea} rows={8}
                                        value={worker.systemPrompt || ''}
                                        placeholder={key === 'builder' ? 'Uses main designer prompt (dynamically built)' : ''}
                                        onChange={e => updateWorker(key, 'systemPrompt', e.target.value || null)} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Pipeline Settings */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>⚙️ Pipeline Settings</h2>
                <div style={styles.settingsGrid}>
                    <div style={styles.row}>
                        <label style={styles.checkLabel}>
                            <input type="checkbox" checked={config.pipeline?.skipFormForSimpleComponents !== false}
                                onChange={e => updatePipeline('skipFormForSimpleComponents', e.target.checked)} />
                            Skip credential form for simple components
                        </label>
                        <label style={styles.checkLabel}>
                            <input type="checkbox" checked={config.pipeline?.autoTest !== false}
                                onChange={e => updatePipeline('autoTest', e.target.checked)} />
                            Auto-test after assembly
                        </label>
                    </div>
                    <div style={styles.row}>
                        <div style={styles.field}>
                            <label style={styles.label}>Worker Timeout (ms)</label>
                            <input style={styles.input} type="number" value={config.pipeline?.workerTimeout ?? 30000}
                                onChange={e => updatePipeline('workerTimeout', parseInt(e.target.value))} />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Max Retries</label>
                            <input style={styles.input} type="number" min="0" max="5" value={config.pipeline?.maxRetries ?? 3}
                                onChange={e => updatePipeline('maxRetries', parseInt(e.target.value))} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Phase Goals */}
            {config.phases?.length > 0 && (
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>🎯 Phase Goals</h2>
                    <p style={styles.sectionDesc}>Define the success criteria for each pipeline phase. The orchestrator uses these to evaluate phase completion.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {config.phases.map((phase, i) => (
                            <div key={phase.key} style={{
                                display: 'flex', gap: '10px', alignItems: 'flex-start',
                                padding: '10px 12px', borderRadius: '8px',
                                background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)'
                            }}>
                                <div style={{
                                    fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
                                    minWidth: '70px', paddingTop: '6px', textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    Phase {phase.number}<br />
                                    <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: '0' }}>{phase.name}</span>
                                </div>
                                <textarea
                                    style={{
                                        ...styles.input, flex: 1, minHeight: '50px', resize: 'vertical',
                                        fontSize: '12px', lineHeight: '1.5', fontFamily: 'inherit'
                                    }}
                                    value={phase.goal}
                                    onChange={e => {
                                        const updated = [...config.phases];
                                        updated[i] = { ...updated[i], goal: e.target.value };
                                        setConfig(prev => ({ ...prev, phases: updated }));
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Test Panel */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>🧪 Test Panel</h2>
                <div style={styles.testArea}>
                    <div style={styles.row}>
                        <input style={{ ...styles.input, flex: 1 }} value={testPrompt}
                            onChange={e => setTestPrompt(e.target.value)}
                            placeholder="Enter a test component request..."
                            onKeyDown={e => e.key === 'Enter' && !testRunning && runTest()} />
                        <button onClick={runTest} disabled={testRunning} style={styles.testBtn}>
                            {testRunning ? '⏳ Running...' : '▶ Run Swarm'}
                        </button>
                    </div>
                    {testOutput && (
                        <pre style={styles.testOutput}>{testOutput}</pre>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles = {
    page: { maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' },
    center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh', color: 'var(--text-secondary)', fontSize: '14px' },
    header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' },
    title: { flex: 1, fontSize: '20px', fontWeight: 700, margin: 0 },
    backBtn: { background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
    saveBtn: { background: 'var(--accent-primary)', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' },

    pipelineViz: { background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '20px', marginBottom: '24px' },
    pipelineLabel: { fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' },
    pipelineFlow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' },
    pipelineNode: { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-default)', fontSize: '13px', fontWeight: 500, transition: 'all 0.2s' },
    pipelineIcon: { fontSize: '16px' },
    phaseGroup: { padding: '10px', border: '2px dashed', borderRadius: '12px', background: 'var(--bg-primary)', minWidth: '90px' },
    phaseLabel: { fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', textAlign: 'center' },
    phaseAgents: { display: 'flex', flexDirection: 'column', gap: '5px' },
    miniWorker: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', transition: 'all 0.3s', border: '1px solid var(--border-default)' },
    miniWorkerLabel: { fontSize: '11px', fontWeight: 500 },
    spinner: { animation: 'spin 1s linear infinite', fontSize: '14px' },
    arrow: { fontSize: '18px', color: 'var(--text-secondary)', fontWeight: 300 },

    cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' },
    card: { background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '18px', transition: 'opacity 0.2s' },
    cardHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
    cardIcon: { fontSize: '18px' },
    cardTitle: { flex: 1, fontSize: '15px', fontWeight: 600 },
    cardDesc: { fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: 1.4 },

    toggleWrapper: { position: 'relative', display: 'inline-flex', cursor: 'pointer' },
    toggleInput: { position: 'absolute', opacity: 0, width: 0, height: 0 },
    toggleTrack: { width: '40px', height: '22px', borderRadius: '22px', transition: 'background 0.2s', display: 'flex', alignItems: 'center', padding: '2px' },
    toggleKnob: { width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },

    field: { marginBottom: '10px', flex: 1 },
    label: { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' },
    input: { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' },
    select: { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' },
    textarea: { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' },
    row: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
    checkLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' },

    expandBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', padding: '4px 0', marginBottom: '4px' },

    section: { background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '20px', marginBottom: '24px' },
    sectionTitle: { fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0' },
    sectionDesc: { fontSize: '13px', color: 'var(--text-secondary)', margin: '-8px 0 16px 0', lineHeight: 1.4 },
    settingsGrid: { display: 'flex', flexDirection: 'column', gap: '16px' },

    testArea: { display: 'flex', flexDirection: 'column', gap: '12px' },
    testBtn: { background: '#10b981', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' },
    testOutput: { background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '12px', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '400px', overflow: 'auto', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6 }
};
