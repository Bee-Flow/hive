import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * "This app was updated" — the missing half of publishing.
 *
 * A run session fetches the published definition ONCE. When the owner
 * republishes, every open session keeps rendering the old definition while its
 * data calls hit the new schema, RLS and datasets: a silent split-brain that
 * only ends when the person happens to reload. Every data response now carries
 * the published version, so the moment it disagrees with the one this session
 * loaded we say so — and offer the reload rather than forcing one, because
 * yanking the app out from under someone mid-form is its own bug.
 */
export default function AppVersionBanner({ onReload }) {
    return (
        <div
            className="shrink-0 mx-4 mt-3 flex items-center gap-3 border px-3 py-2 text-sm"
            style={{
                borderColor: 'var(--app-primary)',
                background: 'var(--app-primary-soft)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--app-radius)',
            }}
            role="status"
            data-app-version-banner="true"
        >
            <RefreshCw className="w-4 h-4 shrink-0" style={{ color: 'var(--app-primary)' }} aria-hidden="true" />
            <span className="flex-1 min-w-0">A newer version of this app has been published.</span>
            <button
                type="button"
                onClick={onReload}
                className="px-2.5 py-1 text-xs font-medium border"
                style={{ borderColor: 'var(--app-primary)', color: 'var(--app-primary)', borderRadius: 'var(--app-radius)' }}
            >
                Reload
            </button>
        </div>
    );
}
