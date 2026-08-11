import React, { useMemo, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Eye } from 'lucide-react';
import { FormRow, inputClass, textareaClass, denseInputClass, cardClass, subLabelClass } from './formPrimitives';
import PublicFormRenderer, { FormEndingView } from '../../../../../forms/PublicFormRenderer';
import TemplateField from '../../mapping/TemplateField';
import { walkPath, previewValue } from '../../../../../../utils/bindingHelpers';

/**
 * The shared editor for ONE hosted form page — used by the form trigger (page
 * one) and by every `form_page` step (page two onwards, and the closing page).
 * All three declare the same `form` object, so they get the same surface.
 *
 * Three ideas the whole panel is built around:
 *
 *   1. Dropping a node already gives a WORKING page (title, fields, thank-you
 *      text, the Clean preset). Refining is optional, not a prerequisite —
 *      that is what "super simpel in gebruik" has to mean.
 *   2. Styling is a set of presets plus five knobs. No CSS, ever. The knobs are
 *      the platform's shared THEME_SPEC (server/core/themeSpec.js), so a form
 *      and a Studio App are themed by the same vocabulary.
 *   3. The author edits the LABEL; `name` is slugged once at creation and never
 *      re-derived. Re-deriving on every rename would silently break every
 *      `<base>.<name>` binding downstream, with no error anywhere.
 *
 * Props:
 *   form        — the declaration being edited
 *   onChange(next) — receives the WHOLE next declaration
 *   bindingBase — 'trigger.output' or 'steps.<id>.output'; shown read-only per
 *                 field so an author can see what to bind downstream
 *   variant     — 'input' (a page with questions) or 'ending' (a closing page:
 *                 text only, no questions, no submit button)
 *   allowVariables — offer the {} picker on every text slot, so the page can
 *                 greet the visitor by name or summarise what the routine did.
 *                 OFF for the trigger: page one is rendered before anything has
 *                 run, and the server passes it no interpolator, so a `{{…}}`
 *                 there would reach the visitor verbatim.
 *   onFocusField / previewSample — the usual mapping plumbing, so clicking or
 *                 dragging a value in the Input panel lands in the focused slot
 */

const FIELD_TYPES = [
    { value: 'text', label: 'Short text' },
    { value: 'textarea', label: 'Long text' },
    { value: 'email', label: 'Email' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Dropdown' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'file', label: 'File upload' },
];

// One click sets all five theme keys. This IS the "styling without code" story;
// the individual knobs below are for the people who want to fine-tune.
export const THEME_PRESETS = [
    { id: 'clean', label: 'Clean', theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'light' } },
    { id: 'corporate', label: 'Corporate', theme: { primary: '#1D4ED8', radius: 'sm', density: 'compact', fontScale: 'sm', appearance: 'light' } },
    { id: 'friendly', label: 'Friendly', theme: { primary: '#C2410C', radius: 'xl', density: 'spacious', fontScale: 'lg', appearance: 'light' } },
    { id: 'night', label: 'Night', theme: { primary: '#0891B2', radius: 'lg', density: 'comfortable', fontScale: 'md', appearance: 'dark' } },
    { id: 'system', label: 'Match visitor', theme: { primary: '#047857', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' } },
];

const THEME_KNOBS = [
    { key: 'radius', label: 'Corners', values: ['none', 'sm', 'md', 'lg', 'xl'] },
    { key: 'density', label: 'Spacing', values: ['compact', 'comfortable', 'spacious'] },
    { key: 'fontScale', label: 'Text size', values: ['sm', 'md', 'lg'] },
    { key: 'appearance', label: 'Appearance', values: ['light', 'dark', 'auto'] },
];

const COLOR_PRESETS = [
    '#0F766E', '#0369A1', '#1D4ED8', '#0891B2', '#047857', '#4D7C0F',
    '#B45309', '#C2410C', '#B91C1C', '#BE185D', '#334155', '#57534E',
];

/** The form a freshly-dropped trigger node starts with — already publishable. */
export function defaultFormDeclaration() {
    return {
        title: 'Get in touch',
        description: '',
        submitLabel: 'Submit',
        successMessage: 'Thanks — we got your answer.',
        fields: [
            { name: 'name', type: 'text', label: 'Your name', required: true, placeholder: '' },
            { name: 'email', type: 'email', label: 'Your email', required: true, placeholder: '' },
            { name: 'message', type: 'textarea', label: 'How can we help?', required: false, placeholder: '' },
        ],
        theme: { ...THEME_PRESETS[0].theme },
    };
}

/**
 * A mid-flow page asking for one more thing. `theme: null` means "inherit the
 * trigger's" — the server merges it, so pages match without the author having
 * to restyle each one.
 */
export function defaultFormPageDeclaration() {
    return {
        title: 'One more thing',
        description: '',
        submitLabel: 'Continue',
        successMessage: 'Thanks!',
        fields: [{ name: 'answer', type: 'text', label: 'Your answer', required: true, placeholder: '' }],
        theme: null,
    };
}

/** The closing page. No questions — its job is to tell the visitor what happened. */
export function defaultFormEndingDeclaration() {
    return {
        title: 'All done',
        description: 'Thanks — here is what we did:\n',
        fields: [],
        theme: null,
    };
}

/**
 * Label → field name, once. Must produce a valid identifier for the server's
 * PARAM_NAME_RE (letter first, then letters/digits/underscore).
 */
export function slugifyFieldName(label, taken = new Set()) {
    const base = String(label || '')
        .normalize('NFKD')
        .replace(/[^\w\s]/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[^a-z]+/, '')
        .slice(0, 55) || 'field';
    if (!taken.has(base)) return base;
    for (let i = 2; i < 200; i += 1) {
        const candidate = `${base}_${i}`;
        if (!taken.has(candidate)) return candidate;
    }
    return `${base}_${Date.now().toString(36)}`;
}

/**
 * Resolve `{{path}}` against the builder's sample tree for the preview only.
 * Unresolvable paths are left standing — a typo should stay visible instead of
 * quietly turning into an empty string.
 */
export function fillTemplate(text, sampleRoot) {
    const s = String(text ?? '');
    if (!s || !sampleRoot || !/\{\{[^}]+\}\}/.test(s)) return s;
    return s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, expr) => {
        const v = walkPath(expr.trim(), sampleRoot);
        return v === undefined ? full : previewValue(v, 40);
    });
}

export function normaliseOptions(options) {
    if (!Array.isArray(options)) return [];
    return options
        .map(o => (typeof o === 'string' ? { value: o, label: o } : (o && typeof o === 'object' && o.value ? { value: o.value, label: o.label || o.value } : null)))
        .filter(Boolean);
}

export default function FormBuilderFields({
    form,
    onChange,
    bindingBase = 'trigger.output',
    variant = 'input',
    allowVariables = false,
    onFocusField = null,
    previewSample = null,
}) {
    const [showPreview, setShowPreview] = useState(false);
    const fields = useMemo(() => (Array.isArray(form?.fields) ? form.fields : []), [form]);
    const isEnding = variant === 'ending';
    // `null` is the inherit-from-the-trigger signal; the editor still needs
    // concrete values to render its own controls against.
    const theme = form?.theme || THEME_PRESETS[0].theme;
    const inherits = !form?.theme;

    // The preview is the visitor's view, and the visitor never sees `{{…}}` —
    // the server interpolates at the moment the page is shown. So resolve the
    // same way here, against the sample tree, and leave unresolvable paths
    // standing so a typo stays visible rather than silently vanishing.
    const previewConfig = useMemo(() => {
        const fill = allowVariables ? (s) => fillTemplate(s, previewSample) : (s) => s;
        return {
            title: fill(form?.title) || (isEnding ? 'All done' : 'Form'),
            description: fill(form?.description) || '',
            submitLabel: fill(form?.submitLabel) || 'Submit',
            successMessage: fill(form?.successMessage) || 'Thanks!',
            theme,
            fields: fields.filter(f => f?.name).map(f => ({
                ...f,
                label: fill(f.label),
                placeholder: fill(f.placeholder),
                maxSizeMb: f.maxSizeMb || 10,
                options: normaliseOptions(f.options),
            })),
        };
    }, [form, fields, theme, isEnding, allowVariables, previewSample]);

    const patch = (changes) => onChange({ ...form, ...changes });
    const setFields = (next) => patch({ fields: next });

    const addField = () => {
        const taken = new Set(fields.map(f => f.name));
        const label = 'New question';
        setFields([...fields, { name: slugifyFieldName(label, taken), type: 'text', label, required: false, placeholder: '' }]);
    };
    const updateField = (i, changes) => setFields(fields.map((f, j) => (j === i ? { ...f, ...changes } : f)));
    const removeField = (i) => setFields(fields.filter((_, j) => j !== i));
    const moveField = (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= fields.length) return;
        const next = fields.slice();
        [next[i], next[j]] = [next[j], next[i]];
        setFields(next);
    };

    /**
     * One text slot. With variables allowed it is a TemplateField — the {}
     * button, the Input-panel drag target and the resolved example line all
     * come with it, so a page reads the same way as a Notification body.
     *
     * A plain function, deliberately NOT a component: declaring a component
     * inside the body gives it a new type on every render, so React would
     * remount the field on each keystroke and the caret would jump out.
     */
    const textSlot = ({ slot, rows = 1, ariaLabel = null, placeholder = '' }) => (
        allowVariables ? (
            <TemplateField
                value={form[slot] || ''}
                onChange={(next) => patch({ [slot]: next })}
                rows={rows}
                multiline={rows > 1}
                inline={rows === 1}
                ariaLabel={ariaLabel}
                onFocusField={onFocusField}
                previewSample={previewSample}
                placeholder={placeholder}
            />
        ) : rows > 1 ? (
            <textarea rows={rows} aria-label={ariaLabel || undefined} value={form[slot] || ''} onChange={(e) => patch({ [slot]: e.target.value })} className={textareaClass()} placeholder={placeholder} />
        ) : (
            <input type="text" aria-label={ariaLabel || undefined} value={form[slot] || ''} onChange={(e) => patch({ [slot]: e.target.value })} className={inputClass()} placeholder={placeholder} />
        )
    );

    const varsHint = allowVariables
        ? ' Drag a value from the Input panel (or use the {} button) to drop in something from an earlier step.'
        : '';

    return (
        <div className="space-y-3">
            <FormRow label={isEnding ? 'Heading' : 'Form title'} hint={allowVariables ? varsHint.trim() : null}>
                {textSlot({ slot: 'title', placeholder: isEnding ? 'All done' : 'Get in touch' })}
            </FormRow>
            <FormRow
                label={isEnding ? 'Message' : 'Intro text'}
                hint={isEnding
                    ? `Tell the visitor what happened.${varsHint || ' Use {{steps.…}} to show what the routine did — it is filled in when the page is shown.'}`
                    : `Shown under the title. Optional.${varsHint}`}
            >
                {textSlot({ slot: 'description', rows: isEnding ? 4 : 2 })}
            </FormRow>

            {!isEnding && (
                <>
                    <div className="space-y-1.5">
                        <div className={subLabelClass()}>Questions</div>
                        {fields.length === 0 && (
                            <div className="text-[11px] text-[var(--text-tertiary)] italic">No questions yet — nobody can submit this form.</div>
                        )}
                        {fields.map((field, i) => (
                            <FieldCard
                                key={i}
                                field={field}
                                index={i}
                                count={fields.length}
                                bindingBase={bindingBase}
                                allowVariables={allowVariables}
                                onFocusField={onFocusField}
                                previewSample={previewSample}
                                onChange={(changes) => updateField(i, changes)}
                                onRemove={() => removeField(i)}
                                onMove={(dir) => moveField(i, dir)}
                            />
                        ))}
                        <button
                            type="button"
                            onClick={addField}
                            className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-2 py-1 rounded transition"
                        >
                            <Plus size={12} /> Add a question
                        </button>
                    </div>

                    <FormRow label="Button text">
                        {textSlot({ slot: 'submitLabel', placeholder: 'Submit' })}
                    </FormRow>
                    <FormRow label="Thank-you message" hint={`Replaces the form after a successful submission.${varsHint}`}>
                        {textSlot({ slot: 'successMessage', rows: 2 })}
                    </FormRow>
                </>
            )}

            <ThemeEditor
                theme={theme}
                inherits={inherits}
                canInherit={bindingBase !== 'trigger.output'}
                onChange={(next) => patch({ theme: next })}
            />

            <div>
                <button
                    type="button"
                    onClick={() => setShowPreview(v => !v)}
                    className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] px-1 py-0.5 rounded transition"
                >
                    <Eye size={12} /> {showPreview ? 'Hide preview' : 'Preview the form'}
                </button>
                {showPreview && (
                    <div className="mt-2 p-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)]" data-testid="form-preview">
                        {/* The same component the visitor gets, inert. */}
                        {isEnding
                            ? <FormEndingView form={previewConfig} />
                            : <PublicFormRenderer form={previewConfig} preview />}
                    </div>
                )}
            </div>
        </div>
    );
}

function FieldCard({ field, index, count, bindingBase, onChange, onRemove, onMove, allowVariables = false, onFocusField = null, previewSample = null }) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const optionsText = (field.options || []).map(o => (typeof o === 'string' ? o : o?.value || '')).filter(Boolean).join('\n');

    // Same rule as the page-level slots: a template only makes sense where the
    // server has a run to interpolate against. See `textSlot` above.
    const slot = (key, ariaLabel, placeholder = '') => (
        allowVariables ? (
            <TemplateField
                value={field[key] || ''}
                onChange={(next) => onChange({ [key]: next })}
                rows={1}
                multiline={false}
                inline
                ariaLabel={ariaLabel}
                onFocusField={onFocusField}
                previewSample={previewSample}
                placeholder={placeholder}
            />
        ) : (
            <input
                type="text"
                aria-label={ariaLabel}
                value={field[key] || ''}
                onChange={(e) => onChange({ [key]: e.target.value })}
                className={denseInputClass('w-full')}
                placeholder={placeholder}
            />
        )
    );

    return (
        <div className={cardClass()}>
            <div className="flex items-center gap-1">
                <span className="flex-1 text-xs font-medium text-[var(--text-primary)] truncate">{field.label || field.name}</span>
                <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move question up" title="Move up"
                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30">
                    <ChevronUp size={12} />
                </button>
                <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move question down" title="Move down"
                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30">
                    <ChevronDown size={12} />
                </button>
                <button type="button" onClick={onRemove} aria-label={`Remove ${field.label || field.name}`} title="Remove this question"
                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10">
                    <Trash2 size={12} />
                </button>
            </div>

            <div className="flex items-start gap-2">
                {/* NOTE: `name` is deliberately untouched by this field. It was
                    slugged once when the question was created; re-deriving it
                    here would break every downstream <base>.<name> binding
                    silently. */}
                <div className="flex-1 min-w-0">
                    {slot('label', `Question ${index + 1} label`, 'What do you want to ask?')}
                </div>
                <select
                    aria-label={`Question ${index + 1} type`}
                    value={field.type || 'text'}
                    onChange={(e) => onChange({ type: e.target.value })}
                    className={denseInputClass('!w-auto shrink-0')}
                >
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
            </div>

            <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer select-none">
                <input type="checkbox" checked={!!field.required} onChange={(e) => onChange({ required: e.target.checked })} />
                Required
            </label>

            {field.type === 'select' && (
                <div className="space-y-0.5">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Choices (one per line)</div>
                    <textarea
                        rows={3}
                        aria-label={`Question ${index + 1} choices`}
                        value={optionsText}
                        onChange={(e) => onChange({ options: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                        className={textareaClass()}
                    />
                </div>
            )}

            {field.type === 'file' && (
                <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Accepted types</div>
                        <input type="text" value={field.accept || ''} onChange={(e) => onChange({ accept: e.target.value })} className={denseInputClass('w-full')} placeholder="application/pdf,image/*" />
                    </div>
                    <div className="w-24 shrink-0 space-y-0.5">
                        <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Max MB</div>
                        <input type="number" min={1} max={25} value={field.maxSizeMb ?? 10} onChange={(e) => onChange({ maxSizeMb: Number(e.target.value) || 10 })} className={denseInputClass('w-full')} />
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
                {showAdvanced ? 'Hide advanced' : 'Advanced'}
            </button>
            {showAdvanced && (
                <div className="space-y-1.5">
                    <div className="space-y-0.5">
                        <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Placeholder</div>
                        {slot('placeholder', `Question ${index + 1} placeholder`)}
                    </div>
                    <div className="space-y-0.5">
                        <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Binding name</div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 min-w-0 truncate text-[11px] text-[var(--text-secondary)]">{bindingBase}.{field.name}</code>
                        </div>
                        <p className="text-[10px] text-[var(--text-tertiary)]">
                            Fixed when the question was created. Renaming the question does not change it, so your
                            downstream steps keep working.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

function ThemeEditor({ theme, onChange, inherits = false, canInherit = false }) {
    const activePreset = THEME_PRESETS.find(p => Object.keys(p.theme).every(k => p.theme[k] === theme?.[k]));
    return (
        <div className="space-y-2">
            <div className={subLabelClass()}>Styling</div>

            {canInherit && (
                // A later page defaults to the trigger's look so a form does not
                // change appearance halfway through. Overriding is one click,
                // and going back is the same click.
                <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={inherits}
                        onChange={(e) => onChange(e.target.checked ? null : { ...theme })}
                    />
                    Match the first page
                </label>
            )}

            {!(canInherit && inherits) && (
                <>
                    <div className="flex flex-wrap gap-1.5">
                        {THEME_PRESETS.map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => onChange({ ...p.theme })}
                                aria-pressed={activePreset?.id === p.id}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition ${
                                    activePreset?.id === p.id
                                        ? 'border-[var(--accent)] text-[var(--text-primary)] bg-[var(--accent)]/10'
                                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: p.theme.primary }} />
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-0.5">
                        <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Accent colour</div>
                        <div className="flex flex-wrap items-center gap-1">
                            {COLOR_PRESETS.map(hex => (
                                <button
                                    key={hex}
                                    type="button"
                                    aria-label={`Accent ${hex}`}
                                    onClick={() => onChange({ ...theme, primary: hex })}
                                    className={`h-5 w-5 rounded-full transition hover:scale-110 ${theme?.primary === hex ? 'ring-2 ring-offset-1 ring-[var(--text-primary)]' : ''}`}
                                    style={{ background: hex }}
                                />
                            ))}
                            <input
                                type="color"
                                aria-label="Custom accent colour"
                                value={theme?.primary || '#0F766E'}
                                onChange={(e) => onChange({ ...theme, primary: e.target.value })}
                                className="h-5 w-7 rounded cursor-pointer border-0 bg-transparent p-0"
                            />
                        </div>
                    </div>

                    {THEME_KNOBS.map(knob => (
                        <div key={knob.key} className="flex items-center gap-2">
                            <span className="w-20 shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">{knob.label}</span>
                            <div className="flex gap-1 flex-wrap">
                                {knob.values.map(v => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => onChange({ ...theme, [knob.key]: v })}
                                        aria-pressed={theme?.[knob.key] === v}
                                        className={`px-1.5 py-0.5 rounded text-[10px] border transition ${
                                            theme?.[knob.key] === v
                                                ? 'border-[var(--accent)] text-[var(--text-primary)] bg-[var(--accent)]/10'
                                                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
