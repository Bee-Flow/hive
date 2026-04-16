/**
 * URL ⟷ component-state helpers for the settings surfaces.
 *
 * The app uses a custom history.pushState approach (react-router is not mounted).
 * These hooks give a small, consistent API for any settings panel that wants its
 * active tab / sub-tab to be bookmarkable and back-button-aware.
 */

import { useCallback, useEffect, useState } from 'react';

function splitPath(pathname) {
    return pathname.replace(/^\/+|\/+$/g, '').split('/');
}

/**
 * Syncs a tab-id value with a URL path segment.
 *
 * @param {object}   opts
 * @param {string}   opts.basePath      Path prefix, e.g. '/app/settings' or '/app/org-settings/users'.
 * @param {string[]} opts.validValues   Accepted tab ids (anything else falls back to defaultValue).
 * @param {string}   opts.defaultValue  Value used when the URL has no matching segment.
 * @param {object}   [opts.aliases]     Optional map of internal id → URL segment (and the reverse is computed).
 *                                      E.g. { org_users: 'users', org_license: 'license' }.
 * @returns {[string, (value: string, opts?: { replace?: boolean }) => void]}
 */
export function useUrlTab({ basePath, validValues, defaultValue, aliases = {} }) {
    const urlToId = {};
    for (const [id, urlName] of Object.entries(aliases)) urlToId[urlName] = id;

    const idToUrl = (id) => aliases[id] || id;
    const urlToIdFn = (url) => urlToId[url] || url;

    const readFromUrl = useCallback(() => {
        const baseParts = splitPath(basePath);
        const pathParts = splitPath(window.location.pathname);
        // Find the segment that sits directly after basePath.
        for (let i = 0; i < baseParts.length; i++) {
            if (pathParts[i] !== baseParts[i]) return defaultValue;
        }
        const candidateUrl = pathParts[baseParts.length];
        if (!candidateUrl) return defaultValue;
        const candidate = urlToIdFn(candidateUrl);
        return validValues.includes(candidate) ? candidate : defaultValue;
    }, [basePath, defaultValue, validValues]); // eslint-disable-line react-hooks/exhaustive-deps

    const [value, setValueState] = useState(readFromUrl);

    const setValue = useCallback((v, { replace = false } = {}) => {
        setValueState(v);
        const url = `${basePath}/${idToUrl(v)}`;
        const method = replace ? 'replaceState' : 'pushState';
        window.history[method]({}, '', url);
    }, [basePath]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const onPop = () => setValueState(readFromUrl());
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [readFromUrl]);

    return [value, setValue];
}

/**
 * Reads and writes a single query-string parameter on the current URL.
 * Used by overlay-style UI (the Agent editor modal) that sits on top of another route.
 *
 * @param {string} name  Query param name, e.g. 'edit' or 'editTab'.
 * @returns {[string|null, (value: string|null, opts?: { replace?: boolean }) => void]}
 */
export function useUrlQueryParam(name) {
    const read = useCallback(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }, [name]);

    const [value, setValueState] = useState(read);

    const setValue = useCallback((v, { replace = false } = {}) => {
        setValueState(v);
        const params = new URLSearchParams(window.location.search);
        if (v === null || v === undefined || v === '') {
            params.delete(name);
        } else {
            params.set(name, v);
        }
        const qs = params.toString();
        const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
        const method = replace ? 'replaceState' : 'pushState';
        window.history[method]({}, '', url);
    }, [name]);

    useEffect(() => {
        const onPop = () => setValueState(read());
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [read]);

    return [value, setValue];
}
