import React from 'react';
import { KeyRound, ToggleLeft } from 'lucide-react';
import FeatureKillSwitches from '../FeatureKillSwitches';
import ServerLicensePanel from '../ServerLicensePanel';

/**
 * SelfHostedCeilingEditor — the self-hosted ceiling. On self-hosted the ceiling
 * is the server licence tier, raised/lowered by activating a licence; plus the
 * global feature kill-switches that operators flip for the whole install. Both
 * reuse their existing self-contained components.
 *
 * Emerald + blue only.
 */
export default function SelfHostedCeilingEditor() {
    return (
        <div className="space-y-6">
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <KeyRound className="w-5 h-5" style={{ color: '#3b82f6' }} />
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Server licence</h2>
                </div>
                <p className="text-sm mb-3" style={{ color: 'var(--text-muted)', maxWidth: 720 }}>
                    The active licence tier is the capability ceiling for every organisation on this install. Distribute
                    what it unlocks to members and groups under <strong>Grants</strong>.
                </p>
                <ServerLicensePanel />
            </section>

            <section>
                <div className="flex items-center gap-2 mb-3">
                    <ToggleLeft className="w-5 h-5" style={{ color: '#10b981' }} />
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Global feature switches</h2>
                </div>
                <FeatureKillSwitches />
            </section>
        </div>
    );
}
