import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import useAutomationApi from '../../../../../hooks/useAutomationApi';
import { fieldLabelClass, inputClass } from './settings/formStyles';
import {
    WEEKDAYS,
    TIMEZONE_OPTIONS,
    presetFromCron,
    cronFromPreset,
    describeCron,
} from './scheduleBuilderUtils';

/**
 * Visual schedule builder. Replaces the two raw cron/timezone text
 * inputs with a frequency-driven UI: pick a mode (Every N minutes /
 * Hourly / Daily / Weekly / Monthly / Custom), fill in the params,
 * and see the generated cron expression + a server-validated preview
 * of the next firing times.
 *
 * Power users keep their escape hatch: Custom mode is just the raw
 * 5-field expression. Loading an automation whose cron doesn't match a
 * preset auto-opens in Custom so we never lose user-typed precision.
 *
 * Contract with the parent inspector:
 *   onChange({ cron, tz }) fires on every meaningful edit so the
 *   existing autosave plumbing in StepInspector picks it up unchanged.
 */
export default function ScheduleBuilder({ cron, tz, onChange }) {
    const [preset, setPreset] = useState(() => presetFromCron(cron));
    const [customDraft, setCustomDraft] = useState(() => cron || '0 9 * * *');
    const [tzValue, setTzValue] = useState(tz || 'Europe/Amsterdam');

    // Re-seed when the upstream cron/tz changes (e.g. user picked another
    // step then came back, or the JSON tab edited the field).
    const lastSeenCron = useRef(cron);
    const lastSeenTz = useRef(tz);
    useEffect(() => {
        if (cron !== lastSeenCron.current) {
            lastSeenCron.current = cron;
            setPreset(presetFromCron(cron));
            if (cron) setCustomDraft(cron);
        }
        if (tz !== lastSeenTz.current) {
            lastSeenTz.current = tz;
            setTzValue(tz || 'Europe/Amsterdam');
        }
    }, [cron, tz]);

    // Derive the cron string for the current preset on every render so
    // the preview chip stays in sync with the form controls.
    const generatedCron = useMemo(
        () => preset.mode === 'custom' ? customDraft : cronFromPreset(preset),
        [preset, customDraft],
    );
    const description = useMemo(() => describeCron(generatedCron), [generatedCron]);

    // Bubble changes up. We compare against the upstream value to avoid
    // a setState loop when the parent echoes the same cron back.
    useEffect(() => {
        if (generatedCron !== cron || tzValue !== tz) {
            onChange?.({ cron: generatedCron, tz: tzValue });
        }
    }, [generatedCron, tzValue]); // eslint-disable-line react-hooks/exhaustive-deps

    // Backend next-runs preview. Debounced because the user can rattle
    // through several edits per second (typing in the minute field).
    const api = useAutomationApi();
    const [preview, setPreview] = useState({ valid: true, error: null, next: [] });
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (!generatedCron) return;
        const handle = setTimeout(async () => {
            setLoading(true);
            try {
                const r = await api.previewSchedule(generatedCron, tzValue, 3);
                setPreview({
                    valid: !!r?.valid,
                    error: r?.error || null,
                    next: Array.isArray(r?.next) ? r.next : [],
                });
            } catch (e) {
                setPreview({ valid: false, error: e.message || 'Preview failed', next: [] });
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(handle);
    }, [generatedCron, tzValue, api]);

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <Field label="Frequency">
                    <select
                        value={preset.mode}
                        onChange={(e) => setPreset(presetForMode(e.target.value, preset))}
                        className={inputClass()}
                    >
                        <option value="minute">Every N minutes</option>
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Advanced — custom pattern</option>
                    </select>
                </Field>
                <Field label="Timezone">
                    <select
                        value={tzValue}
                        onChange={(e) => setTzValue(e.target.value)}
                        className={inputClass()}
                    >
                        {TIMEZONE_OPTIONS.includes(tzValue) ? null : <option value={tzValue}>{tzValue}</option>}
                        {TIMEZONE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </Field>
            </div>

            {preset.mode === 'minute' && (
                <Field label="Every">
                    <div className="flex items-center gap-2">
                        <input
                            type="number" min={1} max={59}
                            value={preset.everyN ?? 1}
                            onChange={(e) => setPreset({ ...preset, everyN: parseInt(e.target.value, 10) || 1 })}
                            className={inputClass() + ' w-24'}
                        />
                        <span className="text-xs text-[var(--text-secondary)]">minute(s)</span>
                    </div>
                </Field>
            )}

            {preset.mode === 'hourly' && (
                <Field label="Minute of the hour">
                    <input
                        type="number" min={0} max={59}
                        value={preset.minute ?? 0}
                        onChange={(e) => setPreset({ ...preset, minute: parseInt(e.target.value, 10) || 0 })}
                        className={inputClass() + ' w-24'}
                    />
                </Field>
            )}

            {(preset.mode === 'daily' || preset.mode === 'weekly' || preset.mode === 'monthly') && (
                <Field label="At time">
                    <TimePicker
                        hour={preset.hour ?? 9}
                        minute={preset.minute ?? 0}
                        onChange={(h, m) => setPreset({ ...preset, hour: h, minute: m })}
                    />
                </Field>
            )}

            {preset.mode === 'weekly' && (
                <Field label="On days">
                    <div className="flex flex-wrap gap-1">
                        {WEEKDAYS.map(d => {
                            const selected = (preset.days || []).includes(d.id);
                            return (
                                <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => {
                                        const days = new Set(preset.days || []);
                                        if (days.has(d.id)) days.delete(d.id);
                                        else days.add(d.id);
                                        const nextDays = Array.from(days).sort((a, b) => a - b);
                                        setPreset({ ...preset, days: nextDays.length ? nextDays : [1] });
                                    }}
                                    className={`text-xs px-2.5 py-1 rounded-md border transition ${
                                        selected
                                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    {d.label}
                                </button>
                            );
                        })}
                    </div>
                </Field>
            )}

            {preset.mode === 'monthly' && (
                <Field label="On day of month">
                    <select
                        value={preset.day ?? 1}
                        onChange={(e) => setPreset({ ...preset, day: parseInt(e.target.value, 10) || 1 })}
                        className={inputClass() + ' w-24'}
                    >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </Field>
            )}

            {/* The word "cron" appears nowhere in this editor: nearly every
                author has never met it, and the five presets above cover what
                they actually want. This escape hatch stays for the rare
                schedule the presets can't express — described by its shape
                ("minute hour …") rather than by its name. */}
            {preset.mode === 'custom' && (
                <Field
                    label="Timing pattern"
                    hint="Five values: minute · hour · day of month · month · day of week. Use * for “every”, N for a value, N-M for a range, N,M for a list, */N for every Nth."
                >
                    <input
                        type="text"
                        value={customDraft}
                        onChange={(e) => setCustomDraft(e.target.value)}
                        placeholder="0 9 * * 1"
                        className={inputClass() + ' font-mono'}
                    />
                </Field>
            )}

            {/* Preview chip — always visible. A plain-English description plus
                the next 3 actual firing times from the server. Errors render
                inline below. The raw pattern is shown only in Advanced mode,
                where the author typed it themselves; everywhere else it was
                machine noise next to a sentence that already said it. */}
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-[var(--text-tertiary)] flex-shrink-0" />
                    <span className="text-[var(--text-secondary)]">{description}</span>
                    {preset.mode === 'custom' && (
                        <code className="ml-auto font-mono text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-1.5 py-0.5">
                            {generatedCron || '—'}
                        </code>
                    )}
                </div>
                {!preview.valid && preview.error && (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <AlertCircle size={12} className="flex-shrink-0" />
                        <span>{preview.error}</span>
                    </div>
                )}
                {preview.valid && (
                    <div className="flex items-start gap-2">
                        <Clock size={12} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <div className="text-[var(--text-tertiary)] mb-0.5">
                                Next runs in {tzValue}:
                            </div>
                            {loading && preview.next.length === 0 && (
                                <div className="text-[var(--text-tertiary)]">Computing…</div>
                            )}
                            {preview.next.length > 0 ? (
                                <ul className="space-y-0.5">
                                    {preview.next.map((iso, i) => (
                                        <li key={iso + i} className="font-mono text-[11px] text-[var(--text-primary)] tabular-nums">
                                            {formatInTz(iso, tzValue)}
                                        </li>
                                    ))}
                                </ul>
                            ) : (!loading && (
                                <div className="text-[var(--text-tertiary)]">No upcoming runs in the next year.</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * When the user switches mode, carry over hour/minute when possible
 * (daily ↔ weekly ↔ monthly all share them) and seed sensible defaults
 * for the others. Keeps the form from feeling like it forgot the
 * user's choices the moment they tab between modes.
 */
function presetForMode(nextMode, prev) {
    const carry = {
        hour:   typeof prev.hour   === 'number' ? prev.hour   : 9,
        minute: typeof prev.minute === 'number' ? prev.minute : 0,
    };
    switch (nextMode) {
        case 'minute':  return { mode: 'minute', everyN: prev.everyN || 5 };
        case 'hourly':  return { mode: 'hourly', minute: carry.minute };
        case 'daily':   return { mode: 'daily', ...carry };
        case 'weekly':  return { mode: 'weekly', ...carry, days: prev.days?.length ? prev.days : [1] };
        case 'monthly': return { mode: 'monthly', ...carry, day: prev.day || 1 };
        case 'custom':  return { mode: 'custom', cron: prev.cron || cronFromPreset(prev) };
        default:        return prev;
    }
}

function TimePicker({ hour, minute, onChange }) {
    return (
        <div className="flex items-center gap-1">
            <select
                value={hour}
                onChange={(e) => onChange(parseInt(e.target.value, 10), minute)}
                className={inputClass() + ' w-20 font-mono'}
            >
                {Array.from({ length: 24 }, (_, i) => i).map(h => (
                    <option key={h} value={h}>{pad2(h)}</option>
                ))}
            </select>
            <span className="text-[var(--text-tertiary)]">:</span>
            <select
                value={minute}
                onChange={(e) => onChange(hour, parseInt(e.target.value, 10))}
                className={inputClass() + ' w-20 font-mono'}
            >
                {Array.from({ length: 60 }, (_, i) => i).map(m => (
                    <option key={m} value={m}>{pad2(m)}</option>
                ))}
            </select>
        </div>
    );
}

function Field({ label, hint, children }) {
    return (
        <div>
            <div className={`${fieldLabelClass()} mb-1`}>{label}</div>
            {children}
            {hint && <div className="text-[11px] text-[var(--text-tertiary)] mt-1 leading-snug">{hint}</div>}
        </div>
    );
}

function pad2(n) {
    const s = String(n);
    return s.length < 2 ? `0${s}` : s;
}

function formatInTz(iso, tz) {
    try {
        const d = new Date(iso);
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
            hour12: false,
        }).format(d).replace(',', '');
    } catch (_) {
        return iso;
    }
}
