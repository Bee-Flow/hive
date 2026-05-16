import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Save, Trash2, Settings, Shield, Sparkles, Euro, CalendarPlus, Eye } from 'lucide-react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Dot } from '../ui/Badge';
import { usePlanForm } from './usePlanForm';
import { BasicsSection }     from './sections/BasicsSection';
import { LimitsSection }     from './sections/LimitsSection';
import { FeaturesSection }   from './sections/FeaturesSection';
import { PricingSection }    from './sections/PricingSection';
import { TrialSection }      from './sections/TrialSection';
import { VisibilitySection } from './sections/VisibilitySection';

const SECTIONS = [
    { id: 'basics',     label: 'Basics',     icon: Settings,     accent: 'sky' },
    { id: 'limits',     label: 'Limits',     icon: Shield,       accent: 'teal' },
    { id: 'features',   label: 'Features',   icon: Sparkles,     accent: 'emerald' },
    { id: 'pricing',    label: 'Pricing',    icon: Euro,         accent: 'blue' },
    { id: 'trial',      label: 'Trial',      icon: CalendarPlus, accent: 'amber' },
    { id: 'visibility', label: 'Visibility', icon: Eye,          accent: 'rose' },
];

const SECTION_COMPONENTS = {
    basics:     BasicsSection,
    limits:     LimitsSection,
    features:   FeaturesSection,
    pricing:    PricingSection,
    trial:      TrialSection,
    visibility: VisibilitySection,
};

const ACCENT_ICON = {
    sky: 'text-sky-400',
    teal: 'text-teal-400',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
};

function isSectionValid(id, form) {
    switch (id) {
        case 'basics':  return form.name.trim().length > 0;
        case 'pricing': return form.billing_model === 'metered' || form.price != null || form.price === 0;
        default:        return true;
    }
}

export function PlanEditor({ plan, onSave, onDelete, onBack, saving, isNew: isNewProp }) {
    const { form, update, valid } = usePlanForm(plan);
    const [activeIdx, setActiveIdx] = useState(0);

    const active     = SECTIONS[activeIdx];
    const isFirst    = activeIdx === 0;
    const isLast     = activeIdx === SECTIONS.length - 1;
    const ActiveSec  = SECTION_COMPONENTS[active.id];

    const validStates = useMemo(
        () => Object.fromEntries(SECTIONS.map(s => [s.id, isSectionValid(s.id, form)])),
        [form]
    );
    const canAdvance = validStates[active.id];

    // Template gallery seeds `plan` with a full payload but still wants the
    // editor to behave as "create new" — explicit prop wins over the truthy
    // plan inference.
    const isNew = isNewProp ?? !plan;
    const title = isNew ? (form.name || 'New Plan') : (form.name || plan?.name || 'Plan');

    const goTo  = idx => setActiveIdx(Math.max(0, Math.min(SECTIONS.length - 1, idx)));
    const next  = () => goTo(activeIdx + 1);
    const prev  = () => goTo(activeIdx - 1);

    return (
        <div className="absolute inset-0 flex flex-col bg-[var(--bg-primary)]">
            {/* Top bar */}
            <header className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <IconButton icon={ArrowLeft} size="sm" onClick={onBack} title="Back to plans" />
                <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                        {isNew ? 'New' : 'Edit'} subscription plan
                        <span className="ml-2 normal-case font-medium text-[var(--text-muted)]">
                            · Step {activeIdx + 1} of {SECTIONS.length} · {active.label}
                        </span>
                    </div>
                    <h1 className="text-[16px] font-bold text-[var(--text-primary)] truncate">{title || 'Untitled plan'}</h1>
                </div>
            </header>

            {/* Body */}
            <div className="flex-1 flex min-h-0">
                {/* Left section nav */}
                <nav className="hidden md:flex w-[210px] shrink-0 flex-col gap-0.5 px-3 py-4 border-r border-[var(--border-default)] bg-[var(--bg-secondary)]/40">
                    {SECTIONS.map((s, idx) => {
                        const isActive = activeIdx === idx;
                        const ok       = validStates[s.id];
                        const Icon     = s.icon;
                        return (
                            <button
                                key={s.id}
                                onClick={() => goTo(idx)}
                                className={`relative flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-lg text-left text-[12.5px] font-semibold transition-colors ${
                                    isActive
                                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/50 hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <span className={`shrink-0 w-5 h-5 inline-flex items-center justify-center rounded-md text-[10px] font-bold ${
                                    isActive ? 'bg-blue-500/20 text-blue-300' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                                }`}>
                                    {idx + 1}
                                </span>
                                <Icon className={`w-4 h-4 ${isActive ? ACCENT_ICON[s.accent] : 'text-[var(--text-muted)]'}`} />
                                <span className="flex-1">{s.label}</span>
                                <Dot tone={ok ? 'success' : 'neutral'} />
                            </button>
                        );
                    })}
                </nav>

                {/* Right content — one section at a time */}
                <div className="flex-1 overflow-y-auto">
                    <div key={active.id} className="max-w-2xl mx-auto px-6 py-8 pb-32">
                        <ActiveSec form={form} update={update} />
                    </div>
                </div>
            </div>

            {/* Sticky save bar */}
            <footer className="shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-secondary)] px-6 py-3 flex items-center justify-between gap-3">
                <div>
                    {!isNew && (
                        <Button variant="danger" icon={Trash2} onClick={onDelete} size="sm">
                            Delete plan
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={onBack}>Cancel</Button>
                    <Button variant="secondary" icon={ArrowLeft} onClick={prev} disabled={isFirst}>
                        Previous
                    </Button>
                    {isLast ? (
                        <Button
                            variant="primary"
                            icon={Save}
                            onClick={() => onSave(form)}
                            disabled={!valid || saving}
                            busy={saving}
                        >
                            {saving ? 'Saving…' : isNew ? 'Create plan' : 'Save changes'}
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            iconRight={<ArrowRight className="w-4 h-4" />}
                            onClick={next}
                            disabled={!canAdvance}
                        >
                            Next
                        </Button>
                    )}
                </div>
            </footer>
        </div>
    );
}
