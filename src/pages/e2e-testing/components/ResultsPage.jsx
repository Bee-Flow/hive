import { useState, useEffect } from 'react';
import { useApi } from '../api';
import { formatTime, formatDuration } from '../constants';

export default function ResultsPage() {
  const api = useApi();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/runs').then((d) => { setRuns(d.runs || []); setLoading(false); }).catch(() => setLoading(false));
  }, [api]);

  if (loading) return <div className="empty-state"><p>Loading results…</p></div>;

  return (
    <div className="fade-in">
      {runs.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📊</div>
          <h3>No test results yet</h3>
          <p>Run some tests from the Test Runner or UAT Scenarios to see results here.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3>📊 Test Runs</h3>
            <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{runs.length} runs</span>
          </div>
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr><th>Status</th><th>Suites</th><th>Project</th><th>Started</th><th>Duration</th></tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <span className={`status-badge ${run.status === 'passed' ? 'status-passed' : run.status === 'failed' ? 'status-failed' : run.status === 'running' ? 'status-running' : 'status-pending'}`}>
                        {run.status === 'passed' ? '✅' : run.status === 'failed' ? '❌' : run.status === 'running' ? '⚡' : '⏹'} {run.status}
                      </span>
                    </td>
                    <td>{(run.suites || []).join(', ')}</td>
                    <td>{run.project || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatTime(run.startedAt)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatDuration(run.startedAt, run.finishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
