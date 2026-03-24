import { useState } from 'react';
import { useApi } from '../api';
import { SUITE_ICONS, SUITE_DESCRIPTIONS, PROJECT_LABELS } from '../constants';
import { Terminal } from './SharedComponents';

export default function TestRunnerPage({ suites, showToast, onSuitesChange }) {
  const api = useApi();
  const [selected, setSelected] = useState([]);
  const [project, setProject] = useState('chromium');
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState([]);
  const [runStatus, setRunStatus] = useState(null);

  const toggle = (name) => setSelected((s) => s.includes(name) ? s.filter((x) => x !== name) : [...s, name]);

  const handleRun = async () => {
    if (selected.length === 0) return;
    setRunning(true); setOutput([]); setRunStatus(null);
    try {
      const data = await api.post('/api/run', { suites: selected, project });
      if (data.error) { showToast(data.error, 'error'); setRunning(false); return; }

      const es = api.stream(`/run/${data.id}/stream`, {
        onMessage: (msg) => {
          if (msg.type === 'output') setOutput((p) => [...p, msg.line]);
          else if (msg.type === 'done') {
            setRunStatus(msg.status); setRunning(false); es.close();
            showToast(msg.status === 'passed' ? '✅ All tests passed!' : '❌ Some tests failed', msg.status === 'passed' ? 'success' : 'error');
          }
        },
        onError: () => { setRunning(false); },
      });
    } catch (err) {
      setOutput([`❌ Error: ${err.message}`]); setRunning(false);
    }
  };

  const handleDelete = async (name) => {
    if (!window.confirm(`Delete suite "${name}"?`)) return;
    await api.delete(`/api/suites/${name}`);
    onSuitesChange();
    showToast(`Suite "${name}" deleted`, 'success');
  };

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <h3>📦 Test Suites</h3>
          <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{suites.length} suites</span>
        </div>
        <div className="card-body">
          {suites.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="icon">📦</div>
              <h3>No test suites</h3>
              <p>Generate tests from UAT Scenarios or Issue Tests to create suites.</p>
            </div>
          ) : (
            <>
              <div className="suite-grid">
                {suites.map((suite) => (
                  <div key={suite.name} className={`suite-card ${selected.includes(suite.name) ? 'selected' : ''}`} onClick={() => toggle(suite.name)}>
                    <div className="suite-checkbox">{selected.includes(suite.name) ? '✓' : ''}</div>
                    <div className="suite-info">
                      <h4>{SUITE_ICONS[suite.name] || '📁'} {suite.name}</h4>
                      <p>{SUITE_DESCRIPTIONS[suite.name] || `${suite.tests || 0} test files`}</p>
                      {suite.files && (
                        <div className="suite-files">
                          {suite.files.slice(0, 3).map((f) => <span key={f} className="suite-file-tag">{f}</span>)}
                          {suite.files.length > 3 && <span className="suite-file-tag">+{suite.files.length - 3}</span>}
                        </div>
                      )}
                    </div>
                    <button className="suite-delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(suite.name); }}>✕</button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18, alignItems: 'center' }}>
                <select value={project} onChange={(e) => setProject(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}>
                  {Object.entries(PROJECT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button className="btn btn-primary" disabled={selected.length === 0 || running} onClick={handleRun}>
                  {running ? '⏳ Running…' : `▶️ Run ${selected.length} Suite${selected.length > 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {output.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>🖥 Test Output</h3></div>
          <Terminal lines={output} running={running} title="Playwright Runner" />
        </div>
      )}
    </div>
  );
}
