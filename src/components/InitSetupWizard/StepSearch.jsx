import React from 'react';
import { BingLogo, SerperLogo } from './ProviderLogos';

const SEARCH_OPTIONS = [
    { id: 'bing', label: 'Azure Bing', Logo: BingLogo },
    { id: 'agent-search', label: 'Agent Search', Logo: SerperLogo },
    { id: '', label: 'None', icon: '⏭️' },
];

const StepSearch = ({
    searchProvider, setSearchProvider,
    bingKey, setBingKey,
    bingMarket, setBingMarket,
    serperKey, setSerperKey,
    clearMessages, inputClass, inputStyle,
}) => (
    <>
        <div className="grid grid-cols-3 gap-2">
            {SEARCH_OPTIONS.map(p => (
                <button key={p.id} onClick={() => { setSearchProvider(p.id); clearMessages(); }}
                    className="p-3 rounded-xl border text-center transition-all hover:scale-[1.02]"
                    style={{
                        background: searchProvider === p.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-primary)',
                        borderColor: searchProvider === p.id ? 'var(--accent-primary)' : 'var(--border-default)',
                        color: 'var(--text-primary)',
                    }}>
                    <div className="flex justify-center mb-1.5">
                        {p.Logo ? <p.Logo size={28} /> : <span className="text-2xl">{p.icon}</span>}
                    </div>
                    <div className="text-xs font-medium">{p.label}</div>
                </button>
            ))}
        </div>

        {searchProvider === 'bing' && (
            <div className="space-y-3 pt-2">
                <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>API Subscription Key</label>
                    <input type="password" value={bingKey} onChange={e => setBingKey(e.target.value)}
                        placeholder="Bing Search API subscription key"
                        className={inputClass} style={inputStyle} />
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Market</label>
                    <input type="text" value={bingMarket} onChange={e => setBingMarket(e.target.value)}
                        placeholder="Optional, e.g. nl-NL, en-US"
                        className={inputClass} style={inputStyle} />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Get your key from{' '}
                    <a href="https://portal.azure.com/#create/microsoft.bingsearch" target="_blank" rel="noopener noreferrer"
                        className="underline" style={{ color: 'var(--accent-primary)' }}>Azure Portal → Bing Search v7</a>
                </p>
            </div>
        )}

        {searchProvider === 'agent-search' && (
            <div className="space-y-3 pt-2">
                <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Serper API Key</label>
                    <input type="password" value={serperKey} onChange={e => setSerperKey(e.target.value)}
                        placeholder="Serper.dev API Key"
                        className={inputClass} style={inputStyle} />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Self-hosted Agent Search +{' '}
                    <a href="https://serper.dev" target="_blank" rel="noopener noreferrer"
                        className="underline" style={{ color: 'var(--accent-primary)' }}>Serper.dev</a> for web results.
                    URL configured via <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--bg-tertiary)' }}>SEARCH_SERVICE_URL</code>.
                </p>
            </div>
        )}
    </>
);

export default StepSearch;
