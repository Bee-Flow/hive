import { useState, useEffect } from 'react';
import { useApi } from '../api';
import { AI_PROVIDERS, PRESET_SCENARIOS } from '../constants';
import { Toggle, Terminal, Lightbox, StepCodeBlock } from './SharedComponents';
import ModelTierSelector from '../../../components/ModelTierSelector';
import { API_BASE, authFetch } from '../../../utils/helpers';

export default function ScenariosPage({ showToast }) {
  const api = useApi();
  const [description, setDescription] = useState('');
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState([]);
  const [status, setStatus] = useState(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [runId, setRunId] = useState(null);
  const [headed, setHeaded] = useState(false);
  const [steps, setSteps] = useState([]);
  const [activeStep, setActiveStep] = useState(null);
  const [suiteMode, setSuiteMode] = useState(false);
  const [suitePlan, setSuitePlan] = useState(null);
  const [selectedTier, setSelectedTier] = useState('fast');
  const [modelTiers, setModelTiers] = useState({});
  const [lightbox, setLightbox] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);

  // Fetch model tiers from the main app
  useEffect(() => {
    authFetch(`${API_BASE}/ai/config/chat-models`)
      .then((r) => r.ok ? r.json() : {})
      .then(setModelTiers)
      .catch(() => {});
  }, []);

  const handleRun = async (scenarioText) => {
    const desc = scenarioText || description;
    if (!desc.trim()) return;

    setOutput([]); setStatus(null); setGeneratedCode(''); setShowCode(false);
    setSteps([]); setActiveStep(null); setSuitePlan(null);
    setGenerating(true); setRunning(true); setShowTerminal(false);

    const endpoint = suiteMode ? '/api/suite/generate' : '/api/scenario';

    try {
      const res = await authFetch(api.url(endpoint.replace('/api', '')), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, headed, modelTier: selectedTier }),
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch {
        const msg = res.status === 502
          ? 'E2E dashboard server is not running. Make sure the e2e-tests dependencies are installed.'
          : `Server error (${res.status})`;
        setOutput([`❌ ${msg}`]);
        setRunning(false); setGenerating(false);
        showToast(msg, 'error');
        return;
      }
      if (data.error) {
        setOutput([`❌ ${data.error}`]);
        setRunning(false); setGenerating(false);
        showToast(data.error, 'error');
        return;
      }

      setRunId(data.id); setGenerating(false);

      const es = api.stream(`/run/${data.id}/stream`, {
        onMessage: (msg) => {
          if (msg.type === 'output') {
            setOutput((prev) => [...prev, msg.line]);
          } else if (msg.type === 'step') {
            setSteps((prev) => {
              const next = [...prev, {
                stepNumber: msg.stepNumber,
                screenshotUrl: msg.screenshotUrl ? api.url(`/scenario/${data.id}/screenshots/${msg.stepNumber}`) : msg.screenshotUrl,
                code: msg.code, error: msg.error, durationMs: msg.durationMs,
                prompt: msg.prompt, model: msg.model, provider: msg.provider,
              }];
              setActiveStep(next.length - 1);
              return next;
            });
          } else if (msg.type === 'suite_plan') {
            setSuitePlan(msg.plan); setGenerating(false);
          } else if (msg.type === 'done') {
            setStatus(msg.status); setRunning(false); es.close();
            if (data.id) {
              api.get(`/api/scenario/${data.id}/code`)
                .then((d) => d.code && setGeneratedCode(d.code))
                .catch(() => {});
            }
            showToast(msg.status === 'passed' ? '✅ Scenario passed!' : '❌ Scenario failed', msg.status === 'passed' ? 'success' : 'error');
          }
        },
        onError: () => { setRunning(false); },
      });
    } catch (err) {
      setOutput([`❌ Error: ${err.message}`]);
      setRunning(false); setGenerating(false);
    }
  };

  const handleCancel = async () => {
    if (runId) {
      await api.post(`/api/run/${runId}/cancel`);
      setRunning(false); setStatus('cancelled');
    }
  };

  const activeStepData = steps[activeStep] ?? null;

  return (
    <div className="fade-in">
      {/* Describe your test */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <h3>✍️ Describe Your Test</h3>
          <span className="badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>AI-powered</span>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
            Describe what you want to test in plain language. The AI generates and runs Playwright code step-by-step.
          </p>

          {/* Model Tier Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Model</span>
            <ModelTierSelector
              tiers={modelTiers}
              value={selectedTier}
              onChange={setSelectedTier}
              dropDirection="down"
            />
          </div>

          <div className="form-group">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={suiteMode
                ? 'e.g. Test the complete authentication flow including login, logout, session persistence'
                : 'e.g. Log in with the demo account, navigate to the chat, and send a message.'}
              rows={3}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !running) handleRun(); }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {!running ? (
              <button className="btn btn-primary" onClick={() => handleRun()} disabled={!description.trim()}>
                {suiteMode ? '📋 Generate Suite' : '🧪 Generate & Run Test'}
              </button>
            ) : (
              <button className="btn btn-danger" onClick={handleCancel}>⏹ Cancel</button>
            )}
            <Toggle checked={suiteMode} onChange={setSuiteMode} label="🧪 Single Test" activeLabel="📋 Suite Mode" />
            <Toggle checked={headed} onChange={setHeaded} label="🔇 Headless" activeLabel="👁️ Headed" />
            {generating && <span className="badge status-running pulse" style={{ padding: '5px 12px', borderRadius: 16 }}>{suiteMode ? '🧠 Planning…' : '🚀 Launching…'}</span>}
            {running && !generating && <span className="badge status-running pulse" style={{ padding: '5px 12px', borderRadius: 16 }}>⚡ Executing ({steps.length} steps)…</span>}
            {status && !running && (
              <span className={`badge ${status === 'passed' ? 'status-passed' : status === 'failed' ? 'status-failed' : 'status-pending'}`}
                style={{ padding: '5px 12px', borderRadius: 16 }}>
                {status === 'passed' ? '✅ Passed' : status === 'failed' ? '❌ Failed' : '⏹ Cancelled'}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Tip: Press ⌘↵ / Ctrl↵ to run</p>
        </div>
      </div>

      {/* Presets */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <h3>📋 Preset Scenarios</h3>
          <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{PRESET_SCENARIOS.length} presets</span>
        </div>
        <div className="card-body">
          <div className="suite-grid">
            {PRESET_SCENARIOS.map((preset, i) => (
              <div key={i} className="suite-card"
                onClick={() => { setDescription(preset.description); if (!running) handleRun(preset.description); }}
                style={{ cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.5 : 1 }}>
                <div style={{ fontSize: 26, lineHeight: 1 }}>{preset.icon}</div>
                <div className="suite-info">
                  <h4>{preset.title}</h4>
                  <p>{preset.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step viewer */}
      {steps.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <h3>📸 Step-by-Step Progress</h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {running && <span className="badge status-running pulse" style={{ padding: '3px 8px' }}>Live</span>}
              <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{steps.length} steps</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 400 }}>
            <div style={{ borderRight: '1px solid var(--border-default)', overflowY: 'auto', maxHeight: 550 }}>
              {steps.map((step, i) => (
                <button key={i} onClick={() => setActiveStep(i)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                    background: activeStep === i ? 'var(--accent-glow)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border-default)',
                    borderLeft: activeStep === i ? '3px solid var(--accent)' : '3px solid transparent',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease',
                  }}>
                  <div style={{ width: 50, height: 36, borderRadius: 5, overflow: 'hidden', flexShrink: 0,
                    border: `2px solid ${step.error ? 'var(--error)' : activeStep === i ? 'var(--accent)' : 'var(--border-default)'}`,
                    background: 'var(--bg-elevated)' }}>
                    <img src={step.screenshotUrl} alt={`Step ${step.stepNumber}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: step.error ? 'var(--error)' : activeStep === i ? 'var(--accent)' : 'var(--text-primary)' }}>Step {step.stepNumber}</span>
                      <span style={{ fontSize: 10 }}>{step.error ? '❌' : '✅'}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                      {step.code?.split('\n')[0] || '…'}
                    </div>
                  </div>
                </button>
              ))}
              {running && (
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 12 }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                  <span>Generating…</span>
                </div>
              )}
            </div>

            {activeStepData ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: activeStepData.error ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                        color: activeStepData.error ? 'var(--error)' : 'var(--success)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800,
                      }}>
                        {activeStepData.error ? '✕' : activeStepData.stepNumber}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Step {activeStepData.stepNumber}</div>
                        <div style={{ fontSize: 11, color: activeStepData.error ? 'var(--error)' : 'var(--success)' }}>
                          {activeStepData.error ? 'Failed' : 'Completed'}
                        </div>
                      </div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => setLightbox({ src: activeStepData.screenshotUrl, alt: `Step ${activeStepData.stepNumber}` })}>
                      🔍 Full Screen
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {activeStepData.durationMs > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 16, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                        ⏱ {activeStepData.durationMs > 1000 ? `${(activeStepData.durationMs / 1000).toFixed(1)}s` : `${activeStepData.durationMs}ms`}
                      </span>
                    )}
                    {activeStepData.model && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 16, background: 'var(--accent-glow)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                        🤖 {activeStepData.model}
                      </span>
                    )}
                  </div>

                  <div style={{ borderRadius: 8, overflow: 'hidden', border: `2px solid ${activeStepData.error ? 'var(--error)' : 'var(--border-default)'}`, cursor: 'zoom-in', background: '#f1f5f9', flex: 1, maxHeight: 300 }}
                    onClick={() => setLightbox({ src: activeStepData.screenshotUrl, alt: `Step ${activeStepData.stepNumber}` })}>
                    <img src={activeStepData.screenshotUrl} alt={`Step ${activeStepData.stepNumber}`} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  </div>

                  {activeStepData.error && (
                    <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>
                      {activeStepData.error}
                    </div>
                  )}

                  <StepCodeBlock code={activeStepData.code} error={activeStepData.error} />
                </div>

                <div style={{ borderTop: '1px solid var(--border-default)', padding: '8px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button className="btn btn-secondary btn-sm" disabled={activeStep === 0} onClick={() => setActiveStep((p) => Math.max(0, p - 1))}>← Prev</button>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activeStep + 1} / {steps.length}</span>
                  <button className="btn btn-secondary btn-sm" disabled={activeStep === steps.length - 1} onClick={() => setActiveStep((p) => Math.min(steps.length - 1, p + 1))}>Next →</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 36 }}>📸</span>
                <span style={{ fontSize: 13 }}>Select a step to view its screenshot</span>
              </div>
            )}
          </div>
        </div>
      )}

      {generatedCode && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <h3>🤖 Generated Test Code</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCode(!showCode)}>{showCode ? '▲ Hide' : '▼ Show'}</button>
          </div>
          {showCode && (
            <pre style={{ padding: 20, background: '#1e293b', color: '#e2e8f0', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, overflow: 'auto', maxHeight: 400, margin: 0 }}>
              {generatedCode}
            </pre>
          )}
        </div>
      )}

      {output.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <h3>🖥 Console Output</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowTerminal(!showTerminal)}>{showTerminal ? '▲ Hide' : '▼ Show'}</button>
          </div>
          {showTerminal && <Terminal lines={output} running={running} title="UAT Scenario Execution" />}
        </div>
      )}

      {output.length === 0 && !running && (
        <div className="empty-state">
          <div className="icon">🧪</div>
          <h3>Describe what to test</h3>
          <p>Write a scenario in plain language or click a preset. The AI generates Playwright code step-by-step.</p>
        </div>
      )}

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </div>
  );
}
