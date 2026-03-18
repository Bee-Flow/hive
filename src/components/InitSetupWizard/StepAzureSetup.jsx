import React, { useState } from 'react';
import { AzureOpenAILogo, BingLogo, MicrosoftLogo } from './ProviderLogos';

const Section = ({ Logo, title, subtitle, children, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-xl border-2 overflow-hidden transition-all" style={{ borderColor: '#e5e7eb', background: '#fff' }}>
            <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50/50 transition-colors">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(0,120,212,0.08)' }}>
                    <Logo size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: '#1f2937' }}>{title}</div>
                    <div className="text-xs" style={{ color: '#6b7280' }}>{subtitle}</div>
                </div>
                <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: '#9ca3af' }} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            {open && <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: '#f3f4f6' }}>{children}</div>}
        </div>
    );
};

const Label = ({ children }) => (
    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>{children}</label>
);

const StepAzureSetup = ({
    azureEndpoint, setAzureEndpoint,
    azureKey, setAzureKey,
    azureVersion, setAzureVersion,
    azureModels, setAzureModels,
    bingKey, setBingKey,
    bingMarket, setBingMarket,
    msClientId, setMsClientId,
    msClientSecret, setMsClientSecret,
    msTenantId, setMsTenantId,
    inputClass, inputStyle,
}) => (
    <div className="space-y-3">
        {/* Microsoft Entra ID SSO — first */}
        <Section Logo={MicrosoftLogo} title="Microsoft Entra ID" subtitle="Enable 'Sign in with Microsoft' for your users">
            <div>
                <Label>Application (Client) ID</Label>
                <input type="text" value={msClientId} onChange={e => setMsClientId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className={inputClass} style={inputStyle} />
            </div>
            <div>
                <Label>Client Secret</Label>
                <input type="password" value={msClientSecret} onChange={e => setMsClientSecret(e.target.value)}
                    placeholder="Client secret value"
                    className={inputClass} style={inputStyle} />
            </div>
            <div>
                <Label>Tenant ID</Label>
                <input type="text" value={msTenantId} onChange={e => setMsTenantId(e.target.value)}
                    placeholder="common or your tenant GUID"
                    className={inputClass} style={inputStyle} />
                <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                    <code className="px-1 py-0.5 rounded text-xs" style={{ background: '#f3f4f6' }}>common</code> = multi-tenant
                </p>
            </div>
            <p className="text-xs" style={{ color: '#9ca3af' }}>
                Register at{' '}
                <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer"
                    className="underline" style={{ color: '#0078D4' }}>Azure Portal → App Registrations</a>
            </p>
        </Section>

        {/* Azure OpenAI — second */}
        <Section Logo={AzureOpenAILogo} title="Azure OpenAI" subtitle="AI model endpoint and deployment configuration" defaultOpen={false}>
            <div>
                <Label>Endpoint URL</Label>
                <input type="text" value={azureEndpoint} onChange={e => setAzureEndpoint(e.target.value)}
                    placeholder="https://your-resource.openai.azure.com"
                    className={inputClass} style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <Label>API Key</Label>
                    <input type="password" value={azureKey} onChange={e => setAzureKey(e.target.value)}
                        placeholder="Your Azure API key"
                        className={inputClass} style={inputStyle} />
                </div>
                <div>
                    <Label>API Version</Label>
                    <input type="text" value={azureVersion} onChange={e => setAzureVersion(e.target.value)}
                        placeholder="2025-04-01-preview"
                        className={inputClass} style={inputStyle} />
                </div>
            </div>
            <div>
                <Label>Deployment Names</Label>
                <input type="text" value={azureModels} onChange={e => setAzureModels(e.target.value)}
                    placeholder="gpt-4o, gpt-4.1, o3-mini"
                    className={inputClass} style={inputStyle} />
                <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>Comma-separated names from your Azure portal</p>
            </div>
        </Section>

        {/* Bing Search — third */}
        <Section Logo={BingLogo} title="Bing Web Search" subtitle="Enable web search powered by Azure Bing" defaultOpen={false}>
            <div>
                <Label>Bing API Subscription Key</Label>
                <input type="password" value={bingKey} onChange={e => setBingKey(e.target.value)}
                    placeholder="Your Bing Search API key"
                    className={inputClass} style={inputStyle} />
            </div>
            <div>
                <Label>Market (optional)</Label>
                <input type="text" value={bingMarket} onChange={e => setBingMarket(e.target.value)}
                    placeholder="e.g. nl-NL, en-US"
                    className={inputClass} style={inputStyle} />
            </div>
            <p className="text-xs" style={{ color: '#9ca3af' }}>
                Get your key from{' '}
                <a href="https://portal.azure.com/#create/microsoft.bingsearch" target="_blank" rel="noopener noreferrer"
                    className="underline" style={{ color: '#0078D4' }}>Azure Portal → Bing Search</a>
            </p>
        </Section>
    </div>
);

export default StepAzureSetup;
