/**
 * The Apps picker's state for ONE cowork item.
 *
 * A cowork item may carry its own list of apps — "this digest may read my
 * mail, that reminder may not" — because it runs unattended, hours after you
 * decided, against whatever credentials you have. That is a narrower question
 * than the chat composer's picker, which edits the workspace-wide preference.
 *
 * Until the user touches the picker the item has no list of its own (`value`
 * is null) and inherits the workspace default, which is exactly how every
 * cowork behaved before this existed. The first toggle *materialises* that
 * inherited set and edits it from there, so switching one app off doesn't
 * silently switch every other app off with it.
 */
import { useCallback } from 'react';
import useAppsCatalog from '../../hooks/useAppsCatalog';

export default function useCoworkApps({ agentIntegrations = null, value = null, onChange } = {}) {
    const {
        availableApps,
        isAppEnabled: isGloballyEnabled,
        toggleApp: toggleGlobally,
    } = useAppsCatalog({ agentIntegrations });

    const hasOwnList = Array.isArray(value);

    const isAppEnabled = useCallback(
        (appId) => (hasOwnList ? value.includes(appId) : isGloballyEnabled(appId)),
        [hasOwnList, value, isGloballyEnabled],
    );

    const toggleApp = useCallback((appId) => {
        // No onChange means nobody is holding a per-item list — fall back to
        // editing the workspace preference, which is what the chat does.
        if (typeof onChange !== 'function') {
            toggleGlobally(appId);
            return;
        }
        // Steps are always on and are never part of the stored list.
        const base = hasOwnList
            ? value
            : availableApps.filter(a => !a.isStep && isGloballyEnabled(a.id)).map(a => a.id);
        onChange(base.includes(appId) ? base.filter(id => id !== appId) : [...base, appId]);
    }, [onChange, hasOwnList, value, availableApps, isGloballyEnabled, toggleGlobally]);

    return { availableApps, isAppEnabled, toggleApp, hasOwnList };
}
