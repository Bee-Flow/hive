import { useState, useEffect } from 'react';
import { useApi } from '../api';

export default function UserManualPage({ showToast }) {
  const api = useApi();
  const [manual, setManual] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.get('/api/user-manual').then((d) => setManual(d)).catch(() => {});
  }, [api]);

  const handleGenerate = async () => {
    setGenerating(true);
    showToast('Generating user manual…', 'success');
    const d = await api.post('/api/user-manual/generate');
    if (d.error) { showToast(d.error, 'error'); setGenerating(false); return; }
    showToast('User manual generated!', 'success');
    setManual(d);
    setGenerating(false);
  };

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <h3>📖 User Manual</h3>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? '⏳ Generating…' : '🤖 Generate Manual'}
          </button>
        </div>
        <div className="card-body">
          {manual?.content ? (
            <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)' }}
              dangerouslySetInnerHTML={{ __html: manual.content }} />
          ) : (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="icon">📖</div>
              <h3>No manual generated yet</h3>
              <p>Click "Generate Manual" to create an AI-powered user manual based on your application.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
