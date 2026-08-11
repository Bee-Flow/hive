import { ListPlus, Trash2 } from 'lucide-react';
import React from 'react';

import SegmentedControl from '../../../../shared/SegmentedControl';
import Toggle from '../../../../shared/Toggle';
import AddRow from './AddRow';

/**
 * The org's own sensitive terms — project codenames, contract-number shapes,
 * customer-list entries. Redacted IN ADDITION to what the detector finds.
 *
 * A table, not chips: every row carries four editable properties (label,
 * pattern, literal-or-regex, case sensitivity) plus a validation state, and a
 * chip cannot express any of that.
 *
 * ── Validation mirrors the server exactly ─────────────────────────────────
 * `server/routes/orgPrivacyShield.js` compiles each regex with
 * `new RegExp(pattern, caseSensitive ? '' : 'i')` and reports every failure at
 * once, saving the valid terms regardless. We run the SAME compile here and
 * show the engine's own message — the regex engine is the specification, and
 * re-implementing its rules would only produce a second, subtly different one.
 */

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `term-${Date.now()}-${Math.round(Math.random() * 1e6)}`);

/** @returns {string|null} the engine's message, or null when the pattern is fine. */
export function validateTerm({ pattern, type, caseSensitive }) {
    if (!pattern || !pattern.trim()) return 'Fill in what to look for.';
    if (pattern.length > 500) return 'Too long — keep it under 500 characters.';
    if (type !== 'regex') return null;
    try {
        // eslint-disable-next-line no-new
        new RegExp(pattern, caseSensitive ? '' : 'i');
        return null;
    } catch (e) {
        return e.message;
    }
}

export function CustomTermsTable({ terms, onChange, termErrors = [], readOnly, t }) {
    const errorFor = (term) => termErrors.find(e => e.id === term.id)?.error;

    const patch = (id, changes) => onChange(terms.map(x => (x.id === id ? { ...x, ...changes } : x)));

    const add = (label) => {
        if (terms.some(x => (x.label || '').toLowerCase() === label.toLowerCase())) {
            return t('admin.shield_terms_err_duplicate', 'A term with that name already exists.');
        }
        onChange([...terms, {
            id: newId(),
            label,
            pattern: '',
            type: 'literal',
            caseSensitive: false,
        }]);
        return null;
    };

    return (
        <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)' }}
        >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <ListPlus className="w-4 h-4 shrink-0" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                    {t('admin.shield_terms_title', 'Always hide these')}
                </span>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {t('admin.shield_terms_desc',
                        'Anything of your own that the list above will not catch — project code names, contract number formats, internal system names. These are hidden on top of everything else.')}
                </p>
            </div>

            <div className="p-4 space-y-3">
                {terms.length === 0 && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('admin.shield_terms_empty', 'Nothing added yet.')}
                    </p>
                )}

                {terms.map((term) => {
                    const localError = validateTerm(term);
                    const serverError = errorFor(term);
                    const error = serverError || localError;
                    return (
                        <div
                            key={term.id}
                            className="rounded-lg border p-3 space-y-2"
                            style={{
                                borderColor: error ? 'rgba(239,68,68,0.4)' : 'var(--border-subtle)',
                                background: 'var(--bg-primary)',
                            }}
                        >
                            <div className="flex gap-2 items-start">
                                <input
                                    type="text"
                                    value={term.label || ''}
                                    disabled={readOnly}
                                    aria-label={t('admin.shield_terms_label', 'Name')}
                                    onChange={e => patch(term.id, { label: e.target.value })}
                                    placeholder={t('admin.shield_terms_label', 'Name')}
                                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded border text-xs"
                                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                                />
                                {!readOnly && (
                                    <button
                                        type="button"
                                        onClick={() => onChange(terms.filter(x => x.id !== term.id))}
                                        aria-label={t('admin.shield_terms_remove', 'Remove {label}', { label: term.label || '' })}
                                        className="p-1.5 rounded hover:bg-white/10 shrink-0"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    </button>
                                )}
                            </div>

                            <input
                                type="text"
                                value={term.pattern || ''}
                                disabled={readOnly}
                                aria-label={t('admin.shield_terms_pattern', 'What to look for')}
                                aria-invalid={error ? 'true' : undefined}
                                onChange={e => patch(term.id, { pattern: e.target.value })}
                                placeholder={term.type === 'regex' ? 'KC-\\d{4}' : 'AURORA'}
                                className="w-full px-2.5 py-1.5 rounded border text-xs font-mono"
                                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                            />

                            <div className="flex items-center gap-3 flex-wrap">
                                <SegmentedControl
                                    size="sm"
                                    value={term.type === 'regex' ? 'regex' : 'literal'}
                                    onChange={v => patch(term.id, { type: v })}
                                    disabled={readOnly}
                                    ariaLabel={t('admin.shield_terms_type', 'How to match')}
                                    options={[
                                        { value: 'literal', label: t('admin.shield_terms_type_literal', 'Exact text') },
                                        { value: 'regex', label: t('admin.shield_terms_type_regex', 'Pattern (advanced)') },
                                    ]}
                                />
                                <Toggle
                                    size="sm"
                                    checked={!!term.caseSensitive}
                                    onChange={v => patch(term.id, { caseSensitive: v })}
                                    disabled={readOnly}
                                    ariaLabel={t('admin.shield_terms_case', 'Case sensitive')}
                                />
                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                    {t('admin.shield_terms_case', 'Case sensitive')}
                                </span>
                            </div>

                            {error && (
                                <p role="alert" className="text-[11px]" style={{ color: '#ef4444' }}>
                                    {serverError
                                        ? t('admin.shield_terms_err_server', 'Not saved — {error}', { error: serverError })
                                        : error}
                                </p>
                            )}
                        </div>
                    );
                })}

                {!readOnly && (
                    <AddRow
                        onAdd={add}
                        placeholder={t('admin.shield_terms_placeholder', 'Give it a name')}
                        addLabel={t('admin.shield_terms_add', 'Add')}
                    />
                )}
            </div>
        </div>
    );
}

export default CustomTermsTable;
