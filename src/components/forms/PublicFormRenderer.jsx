import React, { useMemo, useState } from 'react';
import { Loader2, Paperclip, Check, X } from 'lucide-react';
import themeVars from '../admin/Studio/AppStudio/runtime/themeVars';
import { Field, INPUT_CLASS, inputStyle } from '../admin/Studio/AppStudio/runtime/uiBits';

/**
 * Renders one form-trigger form. Used by the PUBLIC hosted page and by the
 * builder's live preview, so what the author sees while editing is literally
 * the same component the visitor gets.
 *
 * Deliberately NOT App Studio's AppForm: that hangs off useRuntime() (mode,
 * runAction, scope), a node tree and componentRegistry — none of which exist
 * for an anonymous visitor, and componentRegistry pulls in authenticated
 * components. What IS reused directly is themeVars.js and uiBits.jsx (both
 * import nothing but React), so the look stays identical without the coupling.
 *
 * Props:
 *   form      — the server's renderConfig(): { title, description, submitLabel,
 *               successMessage, theme, fields }
 *   onSubmit(values) → Promise; resolves = success, rejects = show the message.
 *               Omitted in preview mode, which makes the form inert.
 *   onUpload(file, field) → Promise<{ fileId, filename, size }>
 *   preview   — no submission, no network; the author is just looking
 *   showSuccess — whether a resolved submit swaps the form for its
 *               successMessage. TRUE for a single-page form, where this
 *               component owns the ending. FALSE for a multi-page one, where
 *               the routine may still pause for another page and only the page
 *               that is polling knows what comes next.
 */
export default function PublicFormRenderer({ form, onSubmit = null, onUpload = null, preview = false, showSuccess = true }) {
    const fields = form?.fields || [];
    const theme = form?.theme || {};

    const [values, setValues] = useState(() => initialValues(fields));
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    // The honeypot. Never labelled, never in the tab order, never on screen —
    // only a bot that fills every input it finds will touch it.
    const [honeypot, setHoneypot] = useState('');

    const style = useMemo(() => themeVars(theme), [theme]);
    const set = (name, v) => {
        setValues(prev => ({ ...prev, [name]: v }));
        setErrors(prev => (prev[name] ? { ...prev, [name]: null } : prev));
    };

    const submit = async (e) => {
        e.preventDefault();
        if (preview || !onSubmit || busy) return;
        // Client-side required checks are a courtesy, not a gate — the server
        // re-checks every field against the declaration.
        const missing = {};
        for (const f of fields) {
            if (!f.required) continue;
            if (isBlank(f, values[f.name])) missing[f.name] = `${f.label} is required.`;
        }
        if (Object.keys(missing).length) { setErrors(missing); return; }

        setBusy(true);
        setFormError(null);
        try {
            await onSubmit({ ...values, website_url: honeypot });
            if (showSuccess) setDone(true);
        } catch (err) {
            const perField = err?.fields;
            if (Array.isArray(perField) && perField.length) {
                setErrors(Object.fromEntries(perField.map(f => [f.field, f.message])));
            } else {
                setFormError(err?.message || 'Something went wrong. Please try again.');
            }
        } finally {
            setBusy(false);
        }
    };

    if (done) return <FormEndingView form={{ ...form, title: form.successMessage, description: '' }} />;

    return (
        <form
            style={style}
            onSubmit={submit}
            noValidate
            className="w-full flex flex-col"
        >
            <div
                className="border px-6 py-6 flex flex-col gap-5"
                style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)', background: 'var(--bg-card, var(--bg-secondary))' }}
            >
                <header className="flex flex-col gap-1.5">
                    <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{form.title}</h1>
                    {form.description ? (
                        <p className="text-sm whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>{form.description}</p>
                    ) : null}
                </header>

                {fields.map(field => (
                    <FormField
                        key={field.name}
                        field={field}
                        value={values[field.name]}
                        error={errors[field.name] || null}
                        disabled={preview || busy}
                        onChange={(v) => set(field.name, v)}
                        onUpload={onUpload}
                        onError={(msg) => setErrors(prev => ({ ...prev, [field.name]: msg }))}
                    />
                ))}

                {/* Honeypot — hidden from people AND from assistive tech, so
                    only an indiscriminate bot fills it in. */}
                <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                    <label htmlFor="website_url">Leave this field empty</label>
                    <input id="website_url" name="website_url" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </div>

                {formError ? (
                    <p className="text-sm" role="alert" style={{ color: '#ef4444' }}>{formError}</p>
                ) : null}

                <button
                    type="submit"
                    disabled={preview || busy}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-60"
                    style={{ background: 'var(--app-primary)', color: 'var(--app-primary-contrast)', borderRadius: 'var(--app-radius)' }}
                >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                    {form.submitLabel}
                </button>
            </div>
        </form>
    );
}

/**
 * The visitor's last screen: a single-page form's success message, or a
 * `form_page` step with mode 'ending' — which the server renders against the
 * finished run, so its text can be a summary of what actually happened.
 *
 * Same theme plumbing as the form, so the journey does not change appearance
 * on its final step.
 */
export function FormEndingView({ form }) {
    const style = useMemo(() => themeVars(form?.theme || {}), [form]);
    return (
        <div style={style} className="w-full" data-testid="form-ending">
            <div
                className="flex flex-col items-center text-center gap-3 px-6 py-10 border"
                style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)', background: 'var(--bg-card, var(--bg-secondary))' }}
            >
                <span
                    className="h-11 w-11 flex items-center justify-center"
                    style={{ background: 'var(--app-primary)', color: 'var(--app-primary-contrast)', borderRadius: '999px' }}
                >
                    <Check size={22} />
                </span>
                <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                    {form?.title || 'Thanks — we got your answer.'}
                </p>
                {form?.description ? (
                    <p className="text-sm whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>{form.description}</p>
                ) : null}
            </div>
        </div>
    );
}

function initialValues(fields) {
    const out = {};
    for (const f of fields) out[f.name] = f.type === 'checkbox' ? false : (f.type === 'file' ? null : '');
    return out;
}

function isBlank(field, value) {
    if (field.type === 'checkbox') return value !== true;
    if (field.type === 'file') return !value;
    return value === undefined || value === null || String(value).trim() === '';
}

function FormField({ field, value, error, disabled, onChange, onUpload, onError }) {
    const id = `ff_${field.name}`;
    const common = { id, name: field.name, disabled, className: INPUT_CLASS, style: inputStyle(!!error) };

    if (field.type === 'checkbox') {
        return (
            <div className="flex flex-col gap-1 text-left">
                <label htmlFor={id} className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                    <input
                        id={id}
                        name={field.name}
                        type="checkbox"
                        disabled={disabled}
                        checked={value === true}
                        onChange={(e) => onChange(e.target.checked)}
                        className="mt-0.5"
                        style={{ accentColor: 'var(--app-primary)' }}
                    />
                    <span>
                        {field.label}
                        {field.required ? <span aria-hidden="true" style={{ color: '#ef4444' }}> *</span> : null}
                    </span>
                </label>
                {field.help ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{field.help}</p> : null}
                {error ? <p className="text-xs" role="alert" style={{ color: '#ef4444' }}>{error}</p> : null}
            </div>
        );
    }

    return (
        <Field id={id} label={field.label} required={field.required} error={error}>
            {field.type === 'textarea' ? (
                <textarea {...common} rows={5} value={value || ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
            ) : field.type === 'select' ? (
                <select {...common} value={value || ''} onChange={(e) => onChange(e.target.value)}>
                    <option value="">{field.placeholder || 'Choose…'}</option>
                    {(field.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            ) : field.type === 'file' ? (
                <FileField field={field} value={value} disabled={disabled} onChange={onChange} onUpload={onUpload} onError={onError} />
            ) : (
                <input
                    {...common}
                    type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    value={value ?? ''}
                    placeholder={field.placeholder}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}
            {field.help ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{field.help}</p> : null}
        </Field>
    );
}

/**
 * A file field uploads immediately and keeps only the DESCRIPTOR. Bytes never
 * travel with the submission, so a large attachment can't blow the body limit
 * and a failed submit doesn't mean re-picking the file.
 */
function FileField({ field, value, disabled, onChange, onUpload, onError }) {
    const [uploading, setUploading] = useState(false);

    const pick = async (e) => {
        const file = e.target.files?.[0];
        // Let the same file be picked again after a failure.
        e.target.value = '';
        if (!file || !onUpload) return;
        if (file.size > field.maxSizeMb * 1024 * 1024) {
            onError(`That file is larger than ${field.maxSizeMb} MB.`);
            return;
        }
        setUploading(true);
        try {
            const uploaded = await onUpload(file, field.name);
            onChange({ kind: 'form_upload', fileId: uploaded.fileId, filename: uploaded.filename, size: uploaded.size });
        } catch (err) {
            onError(err?.message || 'That file could not be uploaded.');
        } finally {
            setUploading(false);
        }
    };

    if (value) {
        return (
            <div
                className="flex items-center gap-2 px-2.5 py-1.5 text-sm border"
                style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)', color: 'var(--text-primary)' }}
            >
                <Paperclip size={14} style={{ color: 'var(--app-primary)' }} />
                <span className="truncate flex-1 min-w-0">{value.filename}</span>
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    disabled={disabled}
                    aria-label={`Remove ${value.filename}`}
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <label
            className="flex items-center gap-2 px-2.5 py-1.5 text-sm border cursor-pointer"
            style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)', color: 'var(--text-secondary)' }}
        >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
            <span>{uploading ? 'Uploading…' : `Choose a file (max ${field.maxSizeMb} MB)`}</span>
            <input
                type="file"
                className="sr-only"
                accept={field.accept || undefined}
                disabled={disabled || uploading}
                onChange={pick}
            />
        </label>
    );
}
