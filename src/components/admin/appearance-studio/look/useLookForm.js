import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '../../../shared/Toast';
import { useTheme } from '../../../ThemeContext';
import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * useLookForm — owns the in-flight form for the admin Look editor.
 *
 * Critical: this hook fetches `/api/branding/admin` (the **raw org default**)
 * to build the form, NOT `useTheme()`. The provider's `useTheme()` returns
 * the *merged* result of org default + the admin's own user override —
 * which would silently revert saves when an admin has previously used the
 * sidebar QuickPicker to set a personal preset for themselves. See the
 * comment block in `loadOrgDefault` below for the full failure mode.
 *
 * Save funnels through `theme.setAdminDefault(form)` and surfaces success /
 * error toasts. Re-syncs the local form whenever the raw org default
 * changes (e.g. after our own save, or after a Reload click).
 */
export function useLookForm() {
    const theme = useTheme();
    const [orgDefault, setOrgDefault] = useState(null);
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const refresh = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/branding/admin`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const raw = await res.json();
            setOrgDefault(raw);
            setForm((prev) => prev ? prev : buildFormFromTheme(raw));
            return raw;
        } catch (e) {
            setError(e?.message || 'Could not load org theme');
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh().catch(() => { /* error captured in state */ });
    }, [refresh]);

    const dirty = useMemo(() => {
        if (!form || !orgDefault) return false;
        return isDirty(form, orgDefault);
    }, [form, orgDefault]);

    const save = useCallback(async () => {
        if (!form) return;
        setSaving(true);
        setError('');
        try {
            // Send the form to /admin via the provider helper so the provider
            // stays in sync for the chrome around the editor. We then re-fetch
            // the raw org default to repopulate the form (NOT the merged
            // /effective payload — see loadOrgDefault comment).
            await theme.setAdminDefault(form);
            const fresh = await refresh();
            setForm(buildFormFromTheme(fresh));
            toast.success('Theme saved as organisation default');
        } catch (e) {
            const msg = e?.message || 'Save failed';
            console.error('[Look] save failed:', e);
            setError(msg);
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    }, [theme, form, refresh]);

    const discard = useCallback(() => {
        if (orgDefault) setForm(buildFormFromTheme(orgDefault));
        setError('');
    }, [orgDefault]);

    const reload = useCallback(async () => {
        setError('');
        try {
            const fresh = await refresh();
            // Reset the form to the just-fetched server truth.
            setForm(buildFormFromTheme(fresh));
            // Also reload the provider so the chrome around the editor flips.
            await theme.reload();
            toast.info('Reloaded from server');
        } catch (e) {
            const msg = e?.message || 'Reload failed';
            setError(msg);
            toast.error(msg);
        }
    }, [theme, refresh]);

    // Draft payload sent to preview iframes — merge form (admin's draft) with
    // wallpaper image url from the org default (uploaded via a separate
    // endpoint, never lives in the form).
    const draftPayload = useMemo(() => {
        if (!form) return null;
        return {
            preset: form.preset,
            accent: form.accent,
            radiusScale: form.radiusScale,
            font: form.font,
            glassIntensity: form.glassIntensity,
            wallpaperPreset: form.wallpaperPreset,
            glassTint: form.glassTint,
            glassLens: form.glassLens,
            glassAnimation: form.glassAnimation,
            glassGrain: form.glassGrain,
            glassBorder: form.glassBorder,
            glassTierSubtle: form.glassTierSubtle,
            glassTierDefault: form.glassTierDefault,
            glassTierOpaque: form.glassTierOpaque,
            allowUserOverride: form.allowUserOverride,
            wallpaperUrl: orgDefault?.wallpaperUrl ?? theme.wallpaperUrl ?? null,
            wallpaperOverlay: form.wallpaperOverlay ?? null,
        };
    }, [form, orgDefault?.wallpaperUrl, theme.wallpaperUrl]);

    return {
        form,
        setForm,
        dirty,
        saving,
        loading,
        error,
        save,
        discard,
        reload,
        theme,
        orgDefault,
        draftPayload,
    };
}

export function buildFormFromTheme(theme) {
    return {
        preset: theme.preset,
        accent: theme.accent,
        radiusScale: theme.radiusScale,
        font: theme.font,
        glassIntensity: theme.glassIntensity ?? 1,
        wallpaperPreset: theme.wallpaperPreset || 'mono',
        glassTint: theme.glassTint || 'neutral',
        glassLens: theme.glassLens || 'on',
        glassAnimation: theme.glassAnimation || 'off',
        glassGrain: theme.glassGrain || 'subtle',
        glassBorder: theme.glassBorder || 'subtle',
        glassTierSubtle: theme.glassTierSubtle || null,
        glassTierDefault: theme.glassTierDefault || null,
        glassTierOpaque: theme.glassTierOpaque || null,
        allowUserOverride: theme.allowUserOverride !== false,
        wallpaperOverlay: theme.wallpaperOverlay ?? 0.1,
    };
}

function isDirty(form, baseline) {
    return (
        form.preset !== baseline.preset ||
        form.accent !== baseline.accent ||
        form.radiusScale !== baseline.radiusScale ||
        form.font !== baseline.font ||
        form.glassIntensity !== (baseline.glassIntensity ?? 1) ||
        form.wallpaperPreset !== (baseline.wallpaperPreset || 'mono') ||
        form.glassTint !== (baseline.glassTint || 'neutral') ||
        form.glassLens !== (baseline.glassLens || 'on') ||
        form.glassAnimation !== (baseline.glassAnimation || 'off') ||
        form.glassGrain !== (baseline.glassGrain || 'subtle') ||
        form.glassBorder !== (baseline.glassBorder || 'subtle') ||
        JSON.stringify(form.glassTierSubtle) !== JSON.stringify(baseline.glassTierSubtle) ||
        JSON.stringify(form.glassTierDefault) !== JSON.stringify(baseline.glassTierDefault) ||
        JSON.stringify(form.glassTierOpaque) !== JSON.stringify(baseline.glassTierOpaque) ||
        form.allowUserOverride !== (baseline.allowUserOverride !== false) ||
        Math.abs((form.wallpaperOverlay ?? 0.1) - (baseline.wallpaperOverlay ?? 0.1)) > 0.001
    );
}

export const SECTION_IDS = {
    preset: 'look-preset',
    accent: 'look-accent',
    wallpaper: 'look-wallpaper',
    glass: 'look-glass',
    typography: 'look-typography',
    radius: 'look-radius',
    access: 'look-access',
    advanced: 'look-advanced',
};
