import { useState, useEffect } from 'react';
import { useApi } from '../api';

export default function ConfigPage({ config, setConfig, showToast }) {
  const api = useApi();
  const [localConfig, setLocalConfig] = useState({});

  useEffect(() => { setLocalConfig(config || {}); }, [config]);

  const handleSave = async () => {
    const d = await api.post('/api/config', localConfig);
    if (d.error) { showToast(d.error, 'error'); return; }
    setConfig(localConfig);
    showToast('Configuration saved', 'success');
  };

  const appFields = [
    { key: 'BASE_URL', label: 'Base URL', placeholder: 'https://your-app.com' },
    { key: 'ADMIN_USERNAME', label: 'Admin Username', placeholder: 'admin' },
    { key: 'ADMIN_PASSWORD', label: 'Admin Password', placeholder: '••••••••', type: 'password' },
  ];

  const youtrackFields = [
    { key: 'YOUTRACK_URL', label: 'YouTrack URL', placeholder: 'https://youtrack.example.com' },
    { key: 'YOUTRACK_TOKEN', label: 'YouTrack Token', placeholder: 'perm:xxxx…', type: 'password' },
  ];

  const renderFields = (fields) =>
    fields.map((f) => (
      <div className="form-group" key={f.key}>
        <label>{f.label}</label>
        <input
          type={f.type || 'text'}
          value={localConfig[f.key] || ''}
          onChange={(e) => setLocalConfig({ ...localConfig, [f.key]: e.target.value })}
          placeholder={f.placeholder}
        />
      </div>
    ));

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-header">
          <h3>⚙️ Configuration</h3>
          <button className="btn btn-primary" onClick={handleSave}>💾 Save</button>
        </div>
        <div className="card-body">
          {renderFields(appFields)}

          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '24px 0 20px', paddingTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 YouTrack Integration
            </div>
            {renderFields(youtrackFields)}
          </div>
        </div>
      </div>
    </div>
  );
}
