/**
 * E2E Testing Page — Main entry point
 *
 * Composes the sidebar navigation with sub-page components,
 * wrapping everything in the API context for proxied requests.
 */

import { useState, useEffect, useCallback } from 'react';
import { createApiClient, ApiContext } from './api';
import { NAV, PAGE_TITLE } from './constants';
import ScenariosPage from './components/ScenariosPage';
import TestRunnerPage from './components/TestRunnerPage';
import ResultsPage from './components/ResultsPage';
import YouTrackPage from './components/YouTrackPage';
import UserManualPage from './components/UserManualPage';
import ConfigPage from './components/ConfigPage';
import './e2e-testing.css';

let _toastId = 0;

export default function E2ETestingPage({ user, onBack }) {
  const [page, setPage] = useState('scenarios');
  const [suites, setSuites] = useState([]);
  const [config, setConfig] = useState({});
  const [rawConfig, setRawConfig] = useState({});
  const [toasts, setToasts] = useState([]);

  const api = useCallback(() => createApiClient(), [])();

  useEffect(() => {
    api.get('/api/suites').then((d) => setSuites(d.suites || [])).catch(() => {});
    api.get('/api/config').then((d) => {
      setConfig(d.config || {});
      setRawConfig(d.raw || {});
    }).catch(() => {});
  }, []);

  const refreshSuites = () => api.get('/api/suites').then((d) => setSuites(d.suites || []));

  const showToast = (message, type = 'success') => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismissToast(id), 5000);
  };

  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ApiContext.Provider value={api}>
      <div className="e2e-testing-page">
        {/* Header */}
        <div className="e2e-header">
          <h2>
            {onBack && (
              <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginRight: 8 }}>←</button>
            )}
            {PAGE_TITLE[page]}
          </h2>
          <div className="e2e-header-actions">
            {config.BASE_URL && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🎯 {config.BASE_URL}</span>
            )}
            <span className="badge" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: 10, padding: '2px 8px' }}>BETA</span>
          </div>
        </div>

        {/* Layout: sidebar + content */}
        <div className="e2e-layout">
          <nav className="e2e-sidebar">
            {NAV.map((item) => (
              <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => setPage(item.id)}>
                <span className="icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="e2e-content">
            {page === 'scenarios' && <ScenariosPage showToast={showToast} />}
            {page === 'youtrack' && <YouTrackPage showToast={showToast} />}
            {page === 'runner' && <TestRunnerPage suites={suites} showToast={showToast} onSuitesChange={refreshSuites} />}
            {page === 'results' && <ResultsPage />}
            {page === 'manual' && <UserManualPage showToast={showToast} />}
            {page === 'config' && <ConfigPage config={rawConfig} setConfig={setRawConfig} showToast={showToast} />}
          </div>
        </div>

        {/* Toasts */}
        {toasts.length > 0 && (
          <div className="toast-container">
            {toasts.map((t) => (
              <div key={t.id} className={`toast ${t.type}`}>
                {t.message}
                <button className="toast-close" onClick={() => dismissToast(t.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ApiContext.Provider>
  );
}
