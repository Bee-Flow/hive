import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../api';
import { formatTime } from '../constants';

const selectStyle = {
  padding: '8px 12px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontSize: 12, minWidth: 120,
};

const inputStyle = {
  ...selectStyle, flex: 1, minWidth: 180,
};

const STATE_COLORS = {
  'Open':        { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  'In Progress': { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
  'To Verify':   { bg: 'rgba(139,92,246,0.1)',  color: '#8b5cf6' },
  'Fixed':       { bg: 'rgba(16,185,129,0.1)',   color: '#10b981' },
  'Verified':    { bg: 'rgba(16,185,129,0.15)',  color: '#059669' },
  'In Wait':     { bg: 'rgba(245,158,11,0.1)',  color: '#d97706' },
  'Denied':      { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444' },
  'New':         { bg: 'rgba(99,102,241,0.1)',  color: '#6366f1' },
  'Closed':      { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
};

function StateBadge({ state }) {
  const s = STATE_COLORS[state] || { bg: 'var(--bg-elevated)', color: 'var(--text-muted)' };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {state || '—'}
    </span>
  );
}

export default function YouTrackPage({ showToast }) {
  const api = useApi();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    api.get('/api/youtrack/projects').then((d) => setProjects(d.projects || [])).catch(() => {});
    api.get('/api/youtrack/plans').then((d) => setPlans(d.plans || [])).catch(() => {});
  }, [api]);

  const loadIssues = async () => {
    if (!selectedProject) return;
    setLoading(true);
    const d = await api.post('/api/youtrack/issues', {
      projectId: selectedProject,
      includeResolved: showResolved,
    });
    setIssues(d.issues || []);
    setLoading(false);
  };

  // Derive unique filter values from loaded issues
  const filterOptions = useMemo(() => {
    const states = new Set(), types = new Set(), priorities = new Set(), assignees = new Set();
    for (const i of issues) {
      if (i.state) states.add(i.state);
      if (i.type) types.add(i.type);
      if (i.priority) priorities.add(i.priority);
      if (i.assignee) assignees.add(i.assignee);
    }
    return {
      states: [...states].sort(),
      types: [...types].sort(),
      priorities: [...priorities].sort(),
      assignees: [...assignees].sort(),
    };
  }, [issues]);

  // Apply client-side filters
  const filtered = useMemo(() => {
    return issues.filter((i) => {
      if (search && !i.summary?.toLowerCase().includes(search.toLowerCase()) && !i.id?.toLowerCase().includes(search.toLowerCase())) return false;
      if (stateFilter && i.state !== stateFilter) return false;
      if (typeFilter && i.type !== typeFilter) return false;
      if (priorityFilter && i.priority !== priorityFilter) return false;
      if (assigneeFilter && i.assignee !== assigneeFilter) return false;
      return true;
    });
  }, [issues, search, stateFilter, typeFilter, priorityFilter, assigneeFilter]);

  const hasActiveFilters = search || stateFilter || typeFilter || priorityFilter || assigneeFilter;

  const clearFilters = () => {
    setSearch(''); setStateFilter(''); setTypeFilter(''); setPriorityFilter(''); setAssigneeFilter('');
  };

  const generateTests = async (issueId) => {
    showToast('Generating tests…', 'success');
    const d = await api.post('/api/youtrack/generate-tests', { issueId });
    if (d.error) { showToast(d.error, 'error'); return; }
    showToast(`Generated ${d.testCount || 0} test(s)`, 'success');
    api.get('/api/youtrack/plans').then((d) => setPlans(d.plans || []));
  };

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header"><h3>📋 YouTrack Issues</h3></div>
        <div className="card-body">
          {/* Project selector + load */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}>
              <option value="">Select a project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }} />
              Include resolved
            </label>
            <button className="btn btn-primary" onClick={loadIssues} disabled={!selectedProject || loading}>
              {loading ? '⏳ Loading…' : '📥 Load Issues'}
            </button>
          </div>

          {/* Filter bar — only show when issues are loaded */}
          {issues.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
              padding: '12px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
            }}>
              <input
                type="text" placeholder="🔍 Search issues…" value={search}
                onChange={(e) => setSearch(e.target.value)} style={inputStyle}
              />
              {filterOptions.states.length > 1 && (
                <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} style={selectStyle}>
                  <option value="">All States</option>
                  {filterOptions.states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {filterOptions.types.length > 1 && (
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
                  <option value="">All Types</option>
                  {filterOptions.types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {filterOptions.priorities.length > 1 && (
                <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={selectStyle}>
                  <option value="">All Priorities</option>
                  {filterOptions.priorities.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              {filterOptions.assignees.length > 1 && (
                <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} style={selectStyle}>
                  <option value="">All Assignees</option>
                  {filterOptions.assignees.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              {hasActiveFilters && (
                <button onClick={clearFilters} style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)',
                  background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  ✕ Clear
                </button>
              )}
            </div>
          )}

          {/* Results count */}
          {issues.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Showing {filtered.length} of {issues.length} issue{issues.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' (filtered)'}
            </div>
          )}

          {/* Issues table */}
          {filtered.length > 0 && (
            <div className="table-wrapper">
              <table className="custom-table">
                <thead><tr>
                  <th>ID</th>
                  <th>Summary</th>
                  {filterOptions.types.length > 0 && <th>Type</th>}
                  {filterOptions.priorities.length > 0 && <th>Priority</th>}
                  <th>State</th>
                  {filterOptions.assignees.length > 0 && <th>Assignee</th>}
                  <th>Action</th>
                </tr></thead>
                <tbody>
                  {filtered.map((issue) => (
                    <tr key={issue.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap' }}>{issue.id}</td>
                      <td>{issue.summary}</td>
                      {filterOptions.types.length > 0 && <td style={{ fontSize: 12 }}>{issue.type || '—'}</td>}
                      {filterOptions.priorities.length > 0 && <td style={{ fontSize: 12 }}>{issue.priority || '—'}</td>}
                      <td><StateBadge state={issue.state} /></td>
                      {filterOptions.assignees.length > 0 && <td style={{ fontSize: 12 }}>{issue.assignee || '—'}</td>}
                      <td><button className="btn btn-secondary btn-sm" onClick={() => generateTests(issue.id)}>🧪 Generate</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty filtered state */}
          {issues.length > 0 && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No issues match the current filters.
              <button onClick={clearFilters} style={{ marginLeft: 8, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {plans.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>📋 Test Plans</h3>
            <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{plans.length} plans</span>
          </div>
          <div className="card-body">
            {plans.map((plan) => (
              <div key={plan.id} style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 10, background: 'var(--bg-elevated)' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{plan.issueId} — {plan.summary}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{plan.testCount || 0} test(s) • {formatTime(plan.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
