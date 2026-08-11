import { presetFor } from '../../../privacy/PiiSensitivityPicker';

/**
 * Derive the Overview tab's posture rows from the shield state.
 *
 * Deliberately a PURE module: no JSX, no `t()`, no React. Two reasons.
 *
 * 1. The interesting logic here is "which of these settings is a problem",
 *    and that deserves a unit test that asserts on `tone` and structured
 *    `value` rather than on English copy that will churn.
 * 2. It keeps the Overview tab a dumb renderer, so adding a row is a data
 *    change rather than a layout change.
 *
 * Each row carries `tab`, so "Change →" can jump straight to the control
 * instead of the summary duplicating it.
 */
export function derivePosture(f, { categories = [], env = {}, licence = {}, guard = null } = {}) {
    if (!f.enabled) return { off: true, rows: [] };

    const total = categories.length;
    const preset = presetFor(f.piiConfidenceThreshold);
    const rows = [];

    rows.push({
        id: 'categories',
        tab: 'detection',
        icon: 'ScanSearch',
        // The misconfiguration this page never surfaced: the shield is ON, so
        // everything looks fine, but with zero categories selected nothing is
        // ever detected and every other control below is decoration.
        tone: f.piiCategories.length === 0 ? 'warn' : 'ok',
        value: { n: f.piiCategories.length, total },
    });

    rows.push({
        id: 'sensitivity',
        tab: 'detection',
        icon: 'SlidersHorizontal',
        tone: 'ok',
        value: preset
            ? { presetId: preset.id }
            : { customPct: Math.round((f.piiConfidenceThreshold ?? 0.7) * 100) },
    });

    const unlicensedTokenize = f.piiAction === 'tokenize' && licence.canTokenizePii === false;
    rows.push({
        id: 'action',
        tab: 'processing',
        icon: f.piiAction === 'tokenize' ? 'Repeat' : 'Ban',
        // Stored 'tokenize' on a lapsed licence used to render as "no card
        // selected, no explanation". The server deliberately does not clamp
        // this field, so the stored value really is tokenize — and the runtime
        // blocks instead. Saying so is the whole point of a posture summary.
        tone: unlicensedTokenize ? 'warn' : 'ok',
        value: { action: f.piiAction, unlicensed: unlicensedTokenize },
    });

    rows.push({
        id: 'transparency',
        tab: 'processing',
        icon: 'Eye',
        tone: 'ok',
        value: { on: f.piiAction === 'tokenize' && !!f.showRawPayload },
    });

    rows.push({
        id: 'routines',
        tab: 'processing',
        icon: 'Workflow',
        tone: 'ok',
        value: { on: !!f.applyToAutomations },
    });

    rows.push({
        id: 'dlp',
        tab: 'outbound',
        icon: 'ShieldAlert',
        tone: 'ok',
        value: { on: !!f.dlpEnabled, mode: f.dlpEnabled ? f.dlpMode : null },
    });

    rows.push({
        id: 'toolcalls',
        tab: 'outbound',
        icon: 'Wrench',
        tone: 'ok',
        value: {
            external: f.toolPiiPolicy?.external?.blockCategories?.length || 0,
            internal: f.toolPiiPolicy?.internal?.blockCategories?.length || 0,
            total,
        },
    });

    if (env.hasWebSearchEnabled) {
        rows.push({
            id: 'websearch',
            tab: 'outbound',
            icon: 'Search',
            tone: 'ok',
            value: { on: !!f.webSearchGuard, licensed: licence.canUseWebSearchGuard !== false },
        });
    }

    if (env.hasEuModelsConfigured) {
        rows.push({
            id: 'eu',
            tab: 'outbound',
            icon: 'Globe',
            tone: 'ok',
            value: { on: !!f.euModeEnabled },
        });
    }

    rows.push({
        id: 'customterms',
        tab: 'detection',
        icon: 'ListPlus',
        tone: 'ok',
        value: { n: (f.customSensitiveTerms || []).length },
    });

    rows.push({
        id: 'allowlist',
        tab: 'detection',
        icon: 'ShieldOff',
        // The one control on this page that makes the shield leak BY DESIGN,
        // so an active list is worth pointing at even though it is not wrong.
        tone: (f.piiAllowTerms || []).length > 0 ? 'note' : 'ok',
        value: {
            terms: (f.piiAllowTerms || []).length,
            publicOrgs: f.piiAllowPublicOrgs !== false,
        },
    });

    // Prepended, not appended: without a reachable guard every control on this
    // page is decoration, and the org settings screen has never said so.
    if (guard && (guard.configured === false || guard.reachable === false)) {
        rows.unshift({
            id: 'guard',
            tab: null,
            icon: 'AlertTriangle',
            tone: 'error',
            value: { configured: guard.configured !== false, reachable: guard.reachable !== false },
        });
    }

    return { off: false, rows };
}

export default derivePosture;
