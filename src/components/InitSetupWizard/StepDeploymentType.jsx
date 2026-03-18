import React from 'react';
import { AzureOpenAILogo } from './ProviderLogos';

const StepDeploymentType = ({ deploymentType, setDeploymentType }) => (
    <div className="space-y-4">
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
            Choose how you want to set up your AI infrastructure
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Azure Card */}
            <button
                onClick={() => setDeploymentType('azure')}
                className="group relative p-5 rounded-2xl border-2 text-left transition-all hover:scale-[1.02]"
                style={{
                    background: deploymentType === 'azure'
                        ? 'linear-gradient(135deg, rgba(0,120,212,0.08), rgba(80,230,255,0.05))'
                        : '#fff',
                    borderColor: deploymentType === 'azure' ? '#0078D4' : '#d1d5db',
                    boxShadow: deploymentType === 'azure'
                        ? '0 4px 20px rgba(0,120,212,0.15)'
                        : '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                {deploymentType === 'azure' && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-xs text-white" style={{ background: '#0078D4' }}>✓</div>
                )}
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,120,212,0.1)' }}>
                        <AzureOpenAILogo size={24} />
                    </div>
                    <div>
                        <div className="font-semibold text-sm" style={{ color: '#1f2937' }}>Microsoft Azure</div>
                        <div className="text-xs" style={{ color: '#6b7280' }}>Enterprise-ready setup</div>
                    </div>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                    Azure OpenAI, Bing Search, and Microsoft SSO — fully integrated Azure ecosystem.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                    {['Azure OpenAI', 'Bing Search', 'Microsoft SSO'].map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(0,120,212,0.08)', color: '#0078D4' }}>{tag}</span>
                    ))}
                </div>
            </button>

            {/* Standard Card */}
            <button
                onClick={() => setDeploymentType('standard')}
                className="group relative p-5 rounded-2xl border-2 text-left transition-all hover:scale-[1.02]"
                style={{
                    background: deploymentType === 'standard'
                        ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.05))'
                        : '#fff',
                    borderColor: deploymentType === 'standard' ? 'var(--accent-primary)' : '#d1d5db',
                    boxShadow: deploymentType === 'standard'
                        ? '0 4px 20px rgba(99,102,241,0.15)'
                        : '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                {deploymentType === 'standard' && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-xs text-white" style={{ background: 'var(--accent-primary)' }}>✓</div>
                )}
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
                        <span className="text-xl">🔧</span>
                    </div>
                    <div>
                        <div className="font-semibold text-sm" style={{ color: '#1f2937' }}>Custom Setup</div>
                        <div className="text-xs" style={{ color: '#6b7280' }}>Mix & match providers</div>
                    </div>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                    Choose from OpenAI, Google, Mistral, Claude — configure each service independently.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                    {['OpenAI', 'Google', 'Mistral', 'Claude'].map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--accent-primary)' }}>{tag}</span>
                    ))}
                </div>
            </button>
        </div>
    </div>
);

export default StepDeploymentType;
