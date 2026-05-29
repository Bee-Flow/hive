import React from 'react';
import { Star, Eye, EyeOff } from 'lucide-react';
import { Toggle } from '../../ui/Toggle';

export function VisibilitySection({ form, update }) {
    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-1">Visibility</h3>
                <p className="text-[12px] text-[var(--text-muted)]">Where this plan appears and which audience auto-receives it.</p>
            </div>

            <div className="flex flex-col gap-3">
                <Toggle
                    checked={form.is_default}
                    onChange={v => update('is_default', v)}
                    icon={Star}
                    iconClass="text-amber-400"
                    label="Default plan for new organizations"
                    description="When set, this plan is offered automatically on new org signups."
                />
                <Toggle
                    checked={form.is_public}
                    onChange={v => update('is_public', v)}
                    icon={form.is_public ? Eye : EyeOff}
                    iconClass="text-blue-400"
                    label="Visible on public pricing page"
                    description="Public-facing pricing pages and onboarding cards pull from plans flagged Public."
                />
                <Toggle
                    checked={form.nc_recommended}
                    onChange={v => update('nc_recommended', v)}
                    iconClass="text-sky-400"
                    label="Default plan for Nextcloud"
                    description="Auto-assigned as the active subscription for every organisation that connects through the Nextcloud app — set this on a free plan to give NC users a free default. Also featured in the App Store onboarding wizard. Only one plan should carry this flag."
                />
            </div>
        </div>
    );
}
