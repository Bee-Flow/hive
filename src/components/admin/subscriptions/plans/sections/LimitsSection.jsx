import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { LIMIT_FIELDS, AGENT_TYPES } from '../../constants';
import { LimitField } from '../../ui/LimitField';
import { Field, NumberInput } from '../../ui/Input';
import { Banner } from '../../ui/Banner';

export function LimitsSection({ form, update }) {
    const [expanded, setExpanded] = useState(Object.keys(form.max_messages_by_type || {}).length > 0);
    const isPerSeat = !!form.per_seat;

    const updateType = (key, val) => {
        const next = { ...form.max_messages_by_type };
        if (val == null) delete next[key];
        else next[key] = val;
        update('max_messages_by_type', Object.keys(next).length > 0 ? next : {});
    };

    // Field list: when the plan bills per seat, the org-wide max_messages_per_month
    // is computed from the per-seat cap × seat count, so hide that field and
    // show a per-seat input in its place.
    const fieldsToRender = isPerSeat
        ? LIMIT_FIELDS.filter(f => f.key !== 'max_messages_per_month')
        : LIMIT_FIELDS;

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-1">Limits</h3>
                <p className="text-[12px] text-[var(--text-muted)]">Leave any field empty to mean unlimited.</p>
            </div>

            {isPerSeat && (
                <Banner tone="info" icon={Users}>
                    This plan bills per seat. The org-wide message cap is computed automatically as <strong>per-seat cap × active seat count</strong>.
                </Banner>
            )}

            {isPerSeat && (
                <Field
                    label="Messages per seat / month"
                    hint="Each active user gets this many messages; total org cap scales with seat count."
                    className="mb-3"
                >
                    <NumberInput
                        value={form.max_messages_per_seat}
                        onChange={v => update('max_messages_per_seat', v)}
                        placeholder="e.g. 1000"
                        min="0"
                    />
                </Field>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                {fieldsToRender.map(f => (
                    <LimitField key={f.key} field={f} value={form[f.key]} onChange={v => update(f.key, v)} />
                ))}
            </div>

            <div>
                <button
                    type="button"
                    onClick={() => setExpanded(v => !v)}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)] hover:opacity-80"
                >
                    {expanded
                        ? <ChevronDown  className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    Per agent-type caps
                    <span className="font-normal text-[11px] text-[var(--text-muted)]">— optional</span>
                </button>
                {expanded && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)]">
                        {AGENT_TYPES.map(t => (
                            <Field key={t.key} label={
                                <span className="inline-flex items-center gap-2">
                                    <span className={`inline-block w-2 h-2 rounded-full ${t.dot}`} />
                                    {t.label}
                                </span>
                            }>
                                <NumberInput
                                    value={form.max_messages_by_type?.[t.key] ?? null}
                                    onChange={v => updateType(t.key, v)}
                                    placeholder="Unlimited"
                                />
                            </Field>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
