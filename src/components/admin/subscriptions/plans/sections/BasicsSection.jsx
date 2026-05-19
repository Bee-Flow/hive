import React from 'react';
import { Building2, Users } from 'lucide-react';
import { Field, Input, Textarea, Select } from '../../ui/Input';
import { ChoiceCards } from '../../ui/Choice';

export function BasicsSection({ form, update }) {
    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-1">Basics</h3>
                <p className="text-[12px] text-[var(--text-muted)]">Who this plan is for and how it appears to customers.</p>
            </div>

            <Field label="Plan type" hint="who this plan is sold to">
                <ChoiceCards
                    value={form.plan_type}
                    onChange={v => update('plan_type', v)}
                    options={[
                        { value: 'organization', label: 'Organization', description: 'For teams & companies', icon: Building2, accent: 'sky' },
                        { value: 'consumer',     label: 'Consumer',     description: 'For individuals',      icon: Users,     accent: 'emerald' },
                    ]}
                />
            </Field>

            <Field label="Plan name *">
                <Input
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="e.g. Pro, Enterprise"
                    autoFocus
                />
            </Field>

            <Field label="Tagline" hint="short marketing line shown in onboarding cards">
                <Input
                    value={form.tagline}
                    onChange={e => update('tagline', e.target.value)}
                    placeholder="e.g. Best for Nextcloud teams"
                />
            </Field>

            <Field label="Description">
                <Textarea
                    value={form.description}
                    onChange={e => update('description', e.target.value)}
                    placeholder="Brief description of this plan"
                    rows={2}
                />
            </Field>

            <Field
                label="Tier"
                hint="Cloud subscription tier. 'community' / 'full' are reserved for self-hosted license keys."
            >
                <Select value={form.tier} onChange={e => update('tier', e.target.value)}>
                    <option value="">— Unset (Free; community floor applies) —</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                </Select>
            </Field>
        </div>
    );
}
