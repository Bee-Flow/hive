import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { LANGUAGES } from '../../../config/meetingNotesConfig';
import { useRecorder } from '../hooks/RecorderContext';

// The engine selector was removed — uploads always use the server-configured
// transcription provider. The component still accepts `serverDefault` /
// `localEnabled` for API compatibility but ignores them.
export default function CaptureControls({ compact = false }: { compact?: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const { settings, setSettings } = useRecorder();

    // If a previously-saved per-user provider override is hanging around in
    // state (from before the engine picker was removed), clear it so the
    // upload route picks the server default.
    //
    // Honest deps rather than a suppressed lint rule: the effect is idempotent
    // — clearing `provider` makes the condition false — so it cannot re-trigger
    // itself, and it now also catches an override that appears after mount.
    useEffect(() => {
        if (settings.provider) {
            setSettings((s) => ({ ...s, provider: '' }));
        }
    }, [settings.provider, setSettings]);

    const activeLanguageLabel = LANGUAGES.find((l) => l.code === settings.language)?.label
        ?? settings.language;

    return (
        <div className="w-full">
            {/* Attendees sits ABOVE the disclosure on purpose. It is the single
                strongest input to speaker naming — knowing who was in the room
                turns "which of these 29 voice IDs are the same person?", which
                nothing can answer from text, into assigning each ID to one of a
                known handful. Buried behind a collapsed panel nobody opens, it
                would never get filled in, and the naming would stay guesswork. */}
            <Field label="Who's in the meeting? (improves speaker names)">
                <input
                    value={settings.attendees}
                    onChange={(e) => setSettings((s) => ({ ...s, attendees: e.target.value }))}
                    placeholder="Tom, Gerard, René…"
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
            </Field>

            {/* Optional exact speaker count. Left blank = Auto (auto-detect).
                Used by providers that accept a speaker hint (pyannoteAI, Azure
                Whisper) to sharpen diarization; harmlessly ignored by others. */}
            <div className="mt-2">
                <Field label="Number of speakers (optional — Auto detects)">
                    <input
                        type="number"
                        min="1"
                        max="50"
                        inputMode="numeric"
                        value={settings.numSpeakers}
                        onChange={(e) => setSettings((s) => ({ ...s, numSpeakers: e.target.value.replace(/[^0-9]/g, '') }))}
                        placeholder="Auto"
                        className="w-28 px-3 py-2 rounded-lg text-sm border outline-none"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                </Field>
            </div>

            <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex items-center justify-between w-full mt-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ color: 'var(--text-secondary)', background: expanded ? 'var(--bg-tertiary)' : 'transparent' }}
            >
                <span className="flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5" />
                    {/* Show the ACTIVE language on the collapsed row. It drives
                        the transcription engine (and, for pyannoteAI, which
                        speech model is used), so silently defaulting to Dutch
                        behind a panel nobody opens is how an English meeting
                        gets transcribed as Dutch without anyone noticing. */}
                    Advanced — {activeLanguageLabel}
                    {settings.contextTerms ? ', glossary set' : ''}
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
                            {/* `label` already carries the flag: '🇳🇱 Dutch'. This
                                read `{l.flag} {l.name}`, neither of which exists on
                                MeetingLanguage, so every option rendered as a bare
                                space — an unusable picker that looked like a CSS
                                problem. This file is .tsx precisely so that
                                mismatch is a compile error rather than 14 blank
                                rows. */}
                            {LANGUAGES.map((l) => (
                                <option key={l.code} value={l.code}>{l.label}</option>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</span>
            {children}
        </label>
    );
}
