import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { LANGUAGES } from '../../../config/meetingNotesConfig';
import { useRecorder } from '../hooks/RecorderContext';

// The engine selector was removed — uploads always use the server-configured
// transcription provider. The component still accepts `serverDefault` /
// `localEnabled` for API compatibility but ignores them.
export default function CaptureControls({ compact = false }) {
    const [expanded, setExpanded] = useState(false);
    const { settings, setSettings } = useRecorder();

    // If a previously-saved per-user provider override is hanging around in
    // state (from before the engine picker was removed), clear it so the
    // upload route picks the server default.
    useEffect(() => {
        if (settings.provider) {
            setSettings((s) => ({ ...s, provider: '' }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                    Advanced (language, glossary)
                </span>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {expanded && (
                <div className={`mt-2 grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    <Field label="Language">
                        <select
                            value={settings.language}
                            onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        >
                            {LANGUAGES.map((l) => (
                                // Explicit colours on each <option> — without them, native
                                // dropdowns inherit the page background and render
                                // white-on-white in light themes.
                                <option key={l.code} value={l.code} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>{l.flag} {l.name}</option>
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
