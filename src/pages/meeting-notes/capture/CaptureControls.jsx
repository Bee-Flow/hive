import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { LANGUAGES } from '../../../config/meetingNotesConfig';
import { useRecorder } from '../hooks/RecorderContext';

const PROVIDER_LABELS = {
    '': 'Server default',
    voxtral: 'Voxtral (cloud, multilingual)',
    whisperx: 'WhisperX (self-hosted)',
    whisper_azure: 'Whisper via Azure',
    azure: 'Azure Speech',
    local: 'Local Whisper (private, slower)',
};

export default function CaptureControls({ serverDefault = 'voxtral', localEnabled = true, compact = false }) {
    const [expanded, setExpanded] = useState(false);
    const { settings, setSettings } = useRecorder();

    const providerOptions = [
        ['', `Server default (${serverDefault})`],
        ['voxtral', PROVIDER_LABELS.voxtral],
        ['whisperx', PROVIDER_LABELS.whisperx],
        ['whisper_azure', PROVIDER_LABELS.whisper_azure],
        ['azure', PROVIDER_LABELS.azure],
        ...(localEnabled ? [['local', PROVIDER_LABELS.local]] : []),
    ];

    return (
        <div className="w-full">
            <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ color: 'var(--text-secondary)', background: expanded ? 'var(--bg-tertiary)' : 'transparent' }}
            >
                <span className="flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5" />
                    Advanced (language, engine, glossary)
                </span>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {expanded && (
                <div className={`mt-2 grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
                    <Field label="Language">
                        <select
                            value={settings.language}
                            onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        >
                            {LANGUAGES.map((l) => (
                                <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Engine">
                        <select
                            value={settings.provider}
                            onChange={(e) => setSettings((s) => ({ ...s, provider: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        >
                            {providerOptions.map(([v, label]) => (
                                <option key={v} value={v}>{label}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Glossary (optional)">
                        <input
                            value={settings.contextTerms}
                            onChange={(e) => setSettings((s) => ({ ...s, contextTerms: e.target.value }))}
                            placeholder="AFAS, Bflow, N8N…"
                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        />
                    </Field>
                </div>
            )}
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</span>
            {children}
        </label>
    );
}
