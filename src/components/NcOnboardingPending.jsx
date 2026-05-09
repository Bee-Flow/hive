import React from 'react';
import { RefreshCw, Clock } from 'lucide-react';

/**
 * Shown to NC users (non-admin) who click the Bee Flow icon while their
 * organization's admin is still working through the App Store onboarding
 * wizard. The server-side connectorJwt gate returns 403 with code
 * NC_ONBOARDING_PENDING; the SPA renders this screen until /auth/user
 * reports `ncOnboardingPending: false`, at which point the user is
 * auto-provisioned with the admin's chosen defaults and the chat opens.
 */
const NcOnboardingPending = ({ orgName, onRefresh }) => {
    return (
        <div className="h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>
            <div className="w-full max-w-md">
                <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border text-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                    <div className="w-20 h-20 mx-auto mb-5 rounded-full overflow-hidden shadow-xl ring-4 ring-[var(--border-subtle)]">
                        <img src="bee-flow-logo.svg" alt="Bee Flow" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-amber-500" />
                        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Setup in progress</h2>
                    </div>
                    <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                        Your administrator is finalising the Bee Flow configuration{orgName ? ` for ${orgName}` : ''}. This usually takes a couple of minutes — your account will be ready as soon as they're done.
                    </p>
                    <button
                        onClick={onRefresh}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                        style={{ background: 'var(--accent-primary)', color: 'white' }}
                    >
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NcOnboardingPending;
