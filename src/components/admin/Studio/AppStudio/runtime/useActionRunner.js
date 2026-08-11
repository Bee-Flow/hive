import { tryEvaluate } from '@shared/expr/engine.mjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { reconcileVariableDefaults, seedVariableDefaults } from './appVariables';
import { closeAppModal, openAppModal } from './components/AppModal';
import { resolveBinding } from './resolveBinding';
import { buildScope } from './RuntimeContext';
import { API_BASE, authFetch } from '../../../../../utils/helpers';
import toast from '../../../../shared/Toast';

/**
 * App Studio runtime — the live action engine (SEQUENCE COORDINATOR).
 *
 * useActionRunner(appId, definition, { draft, onNavigate, confirm, onRefresh,
 *                                      currentUser, dataState })
 *   → { actionState, runAction, vars, setVar }
 *
 * `vars` is HOOK STATE shared across the whole run surface: sequences start
 * from it, and set_variable / resultVar writes merge back into it, so a value
 * set by one action is visible to formulas (vars.*) and later actions.
 * setVar(name, value) writes it directly (e.g. filter_bar). Loop-local
 * itemVar/indexVar stay sequence-local. Existing callers that destructure only
 * { actionState, runAction } are unaffected.
 *
 * An action is either a bare v1 action (kind run_automation/navigate/toast/
 * open_url/open_modal — an implicit 1-step sequence) or a v2
 * { kind:'sequence', steps:[Step] }. runAction resolves the action and:
 *
 *   • BARE v1 actions keep their exact legacy behaviour (below) — including the
 *     run_automation /run bridge with 202-poll and onSuccess/onError effects.
 *   • v2 SEQUENCES are walked step-by-step. CLIENT kinds run in the browser:
 *       navigate → onNavigate(screenId, resolvedParams) — the optional params
 *                  map ({kind:'static'|'formula'}) resolves against live scope
 *       toast    → shared toast
 *       open_url → window.open (https only)  open_modal/close_modal → the
 *       AppModal open bus (openAppModal/closeAppModal by modalId)
 *       confirm  → await a confirm promise (decline ABORTS the sequence)
 *       set_variable → writes the shared `vars` map threaded into later steps
 *       refresh  → onRefresh(actionId) (refetch the app's data)
 *       condition/switch/loop → evaluate the expr/source via @shared/expr
 *                               against the live scope and recurse/iterate
 *     SERVER kinds (create_record/update_record/delete_record/run_automation)
 *     POST to /api/studio-apps/:id/actions/:actionId/step {stepIndex, formValues,
 *     vars, item} (+?draft=1 in editor preview); the result threads into
 *     `vars`/actionState for later steps. A step failing with
 *     code 'quota_exceeded' surfaces the distinct storage-limit toast.
 *
 * A step failure aborts the remaining sequence (its optional onError branch runs
 * first) and surfaces an error toast. Only a sequence that touches the server
 * shows the triggering control's spinner (status:'running'); pure client
 * sequences resolve synchronously, exactly like a v1 navigate/toast.
 *
 * actionState: { [actionId]: { status: 'idle'|'running'|'success'|'error',
 *                              result, error } }
 * The hook is mode-agnostic: the editor never calls runAction (it stubs one).
 */

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90000;

// Ceiling on loop iterations client-side (matches LIMITS.MAX_ACTION_LOOP_ITERATIONS).
const MAX_LOOP_ITERATIONS = 200;

// Sentinel thrown when polling is abandoned because the hook is no longer alive
// (unmount / leaving run mode). It lets a catch tell a cancellation apart from a
// real failure so it can skip BOTH the error state and the onError effects.
const CANCELLED = Symbol('useActionRunner.cancelled');
// Sentinel that unwinds a sequence cleanly (a declined confirm, or an onError
// branch that already handled the failure) — no error state, no toast.
const SEQ_ABORT = Symbol('useActionRunner.abort');

// Server-authoritative step kinds — dispatched to the /step endpoint. This MUST
// equal DATA_MUTATING_STEP_KINDS (componentSpecs.js); a kind the server knows
// but this set omits falls through execStep's `default: return` and becomes a
// SILENT no-op — the surrounding sequence keeps running and still reports
// success. `send_email` was missing here and did exactly that: the support desk
// toasted "Reply sent" while nothing was ever sent. useActionRunner.stepKinds
// .test.js now pins the two lists together.
export const SERVER_STEP_KINDS = new Set(['run_automation', 'create_record', 'update_record', 'delete_record', 'ai_extract', 'ai_generate', 'kb_query', 'send_email']);

// A hard deadline on one server step. Deliberately longer than the server's own
// AI ceiling (STUDIO_APP_AI_TIMEOUT_MS, 120s) so a real server error still wins
// the race and the user gets the specific message rather than this generic one.
const STEP_DEADLINE_MS = 135_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function showToast(tone, message) {
    if (!message) return;
    if (tone === 'success') toast.success(message);
    else if (tone === 'danger') toast.error(message);
    else toast.info(message); // 'info' and 'warning' share the info style
}

// A bare v1 action is an implicit 1-step sequence; a v2 action carries its steps.
function normalizeSequence(action) {
    if (!action || typeof action !== 'object') return [];
    if (action.kind === 'sequence') return Array.isArray(action.steps) ? action.steps : [];
    return [action];
}

// Pre-order flatten — BYTE-IDENTICAL to the server's flattenSteps
// (routes/studioAppsRun.js) so a step's ordinal here is the same one the server
// resolves from the definition. Returns a Map(step → index).
function buildStepIndexMap(steps) {
    const map = new Map();
    let i = 0;
    const walk = (list) => {
        for (const step of (Array.isArray(list) ? list : [])) {
            if (!step || typeof step !== 'object') continue;
            map.set(step, i++);
            if (step.kind === 'condition') { walk(step.then); walk(step.else); }
            else if (step.kind === 'loop') { walk(step.steps); }
            else if (step.kind === 'switch') {
                for (const c of (Array.isArray(step.cases) ? step.cases : [])) {
                    if (c && typeof c === 'object') walk(c.steps);
                }
                walk(step.default);
            }
        }
    };
    walk(steps);
    return map;
}

function sequenceHasServerStep(steps) {
    for (const [step] of buildStepIndexMap(steps)) {
        if (step && SERVER_STEP_KINDS.has(step.kind)) return true;
    }
    return false;
}

// Loose switch-case match: tolerate a number-vs-string authoring mismatch.
function caseMatches(caseValue, exprValue) {
    if (caseValue === exprValue) return true;
    if (caseValue == null || exprValue == null) return false;
    return String(caseValue) === String(exprValue);
}

// Distinct copy for a server step rejected by the storage quota (the server
// marks it with code:'quota_exceeded' — 409 body or step-result body alike).
const QUOTA_TOAST = 'Storage limit reached — delete rows or attachments to continue';

// Resolve a navigate action/step's optional params map against the live scope:
// { key: {kind:'static',value} | {kind:'formula',expr} } → { key: value }.
function resolveNavParams(params, scope) {
    if (!params || typeof params !== 'object') return {};
    const out = {};
    for (const [key, entry] of Object.entries(params)) {
        if (!entry || typeof entry !== 'object') continue;
        if (entry.kind === 'static') out[key] = entry.value;
        else if (entry.kind === 'formula') out[key] = tryEvaluate(entry.expr, scope).value;
    }
    return out;
}

function defaultConfirm(step) {
    const message = (step && step.message) || 'Are you sure?';
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        try { return Promise.resolve(window.confirm(message)); } catch { return Promise.resolve(true); }
    }
    return Promise.resolve(true);
}

export default function useActionRunner(appId, definition, {
    draft = false, onNavigate, confirm, onRefresh, currentUser = null, dataState = null,
} = {}) {
    const [actionState, setActionState] = useState({});
    // Shared variable state for the whole run surface — sequences seed their
    // local vars from it and merge set_variable/resultVar writes back in.
    //
    // SEEDED from definition.variables, so a records binding filtered on
    // `vars.status` filters on the FIRST paint instead of being dropped for
    // having no value yet (resolveBindingFilters omits an unresolved entry).
    const [vars, setVars] = useState(() => seedVariableDefaults(definition?.variables));

    // Refs so runAction stays identity-stable but never reads stale data.
    const stateRef = useRef(actionState);
    stateRef.current = actionState;
    const varsRef = useRef(vars);
    varsRef.current = vars;
    const definitionRef = useRef(definition);
    definitionRef.current = definition;
    const onNavigateRef = useRef(onNavigate);
    onNavigateRef.current = onNavigate;
    const confirmRef = useRef(confirm);
    confirmRef.current = confirm;
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;
    const currentUserRef = useRef(currentUser);
    currentUserRef.current = currentUser;
    const dataStateRef = useRef(dataState);
    dataStateRef.current = dataState;
    /*
     * Fold a change in the DECLARATIONS into the live bag.
     *
     * The trap here is specific: Canvas.jsx passes the live editor definition,
     * which is a NEW object on every inspector keystroke. An effect keyed on
     * `definition` would re-seed — wiping vars.filters mid-typing and resetting
     * preview state on every character. So the effect is keyed on a signature of
     * the DECLARATIONS only; definitionOps preserves structural sharing, so
     * `definition.variables` keeps its reference across every edit that is not a
     * variables edit and the memo never even recomputes.
     */
    const declSignature = useMemo(
        () => JSON.stringify((definition?.variables || []).map((v) => [v.name, v.type, v.default])),
        [definition?.variables],
    );
    // Initialised to the same list the lazy useState seeded from, so the first
    // pass is a no-op rather than a reconcile against nothing.
    const prevDeclsRef = useRef(definition?.variables || []);
    useEffect(() => {
        const next = definition?.variables || [];
        setVars((prev) => reconcileVariableDefaults(prev, prevDeclsRef.current, next));
        prevDeclsRef.current = next;
        // Keyed on the signature, NOT on `definition` — see above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [declSignature]);

    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);

    const setEntry = useCallback((actionId, entry) => {
        if (!aliveRef.current) return;
        setActionState((prev) => ({ ...prev, [actionId]: entry }));
    }, []);

    // Public writer (filter_bar etc.) AND the merge target for sequence writes.
    const setVar = useCallback((name, value) => {
        if (!aliveRef.current || typeof name !== 'string' || !name) return;
        setVars((prev) => ({ ...prev, [name]: value }));
    }, []);

    const applyEffects = useCallback((effects) => {
        if (!effects || typeof effects !== 'object') return;
        if (effects.toast && effects.toast.message) showToast(effects.toast.tone, effects.toast.message);
        if (effects.navigateTo && onNavigateRef.current) onNavigateRef.current(effects.navigateTo);
    }, []);

    const pollRun = useCallback(async (runId) => {
        const deadline = Date.now() + POLL_TIMEOUT_MS;
        while (Date.now() < deadline) {
            await sleep(POLL_INTERVAL_MS);
            if (!aliveRef.current) throw CANCELLED;
            const res = await authFetch(
                `${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/actions/runs/${encodeURIComponent(runId)}`,
            );
            let body = null;
            try { body = await res.json(); } catch { body = null; }
            if (!res.ok) throw new Error(body?.error || `Could not check the run (${res.status})`);
            const status = body?.status;
            if (status && !['pending', 'running', 'queued'].includes(status)) return body;
        }
        throw new Error('The routine is taking too long — check its run history.');
    }, [appId]);

    // ── v1 run_automation bridge (unchanged) ───────────────────────────────
    const runAutomationAction = useCallback(async (actionId, action, opts) => {
        if (stateRef.current[actionId]?.status === 'running') return;
        setEntry(actionId, { status: 'running', result: undefined, error: null });
        try {
            const qs = draft ? '?draft=1' : '';
            const res = await authFetch(
                `${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/actions/${encodeURIComponent(actionId)}/run${qs}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ formValues: opts.formValues || {}, wait: true }),
                },
            );
            let body = null;
            try { body = await res.json(); } catch { body = null; }

            if (res.status === 202) {
                const runId = body?.runId ?? body?.id;
                if (runId != null) {
                    body = await pollRun(runId);
                } else if (body?.status === 'pending') {
                    // Accepted, but with no run id there is nothing to poll (a
                    // GET on `undefined` would 404 and report a failure the user
                    // never had). The routine keeps running server-side, so
                    // settle neutrally: no error state, no success/error effects.
                    setEntry(actionId, { status: 'idle', result: undefined, error: null });
                    showToast('info', 'The routine is still running — check its run history.');
                    return;
                } else {
                    throw new Error(body?.error || body?.message || 'The action was accepted but never returned a result.');
                }
            } else if (!res.ok) {
                throw new Error(body?.error || body?.message || `The action failed (${res.status})`);
            }
            if (body?.status === 'error') {
                throw new Error(body?.error || 'The action failed.');
            }
            setEntry(actionId, {
                status: 'success',
                result: body && body.result !== undefined ? body.result : body,
                error: null,
            });
            applyEffects(action.onSuccess);
        } catch (err) {
            if (err === CANCELLED || !aliveRef.current) return;
            const message = err?.message || 'The action failed.';
            setEntry(actionId, { status: 'error', result: undefined, error: message });
            // A bare v1 run_automation set actionState.error and stopped there —
            // and no runtime component renders that, so a failed action was
            // completely invisible. The sequence path has always toasted; this
            // is the same promise for the older shape.
            showToast('danger', message);
            applyEffects(action.onError);
        }
    }, [appId, draft, setEntry, applyEffects, pollRun]);

    // ── v2 sequence coordinator ────────────────────────────────────────────
    const runSequence = useCallback(async (actionId, action, opts) => {
        const steps = normalizeSequence(action);
        const indexMap = buildStepIndexMap(steps);
        const hasServer = sequenceHasServerStep(steps);

        // Only a server-touching sequence shows the triggering control's spinner
        // (and guards re-entry). Pure client sequences run synchronously.
        if (hasServer && stateRef.current[actionId]?.status === 'running') return;
        if (hasServer) setEntry(actionId, { status: 'running', result: undefined, error: null });

        const state = {
            actionId,
            formValues: opts.formValues || {},
            vars: { ...varsRef.current },
            item: undefined,
            index: undefined,
            lastResult: undefined,
            error: null,
        };

        // The FULL bag resolveBinding takes ({ actionState, dataState, scope }) —
        // identical to the one the renderer builds. A scope-only bag makes every
        // record/records/dataset/connector/actionResult source resolve to
        // undefined (a loop over a table would run zero iterations).
        const liveBag = (st) => {
            const merged = { ...stateRef.current };
            if (st.lastResult !== undefined) {
                merged[actionId] = { status: 'running', result: st.lastResult, error: null };
            }
            const data = dataStateRef.current || {};
            return {
                actionState: merged,
                dataState: data,
                scope: buildScope({
                    actionState: merged,
                    dataState: data,
                    form: st.formValues || {},
                    vars: st.vars || {},
                    item: st.item,
                    index: st.index,
                    currentUser: currentUserRef.current || null,
                }),
            };
        };

        const liveScope = (st) => liveBag(st).scope;

        const dispatchServerStep = async (step, st) => {
            const stepIndex = indexMap.get(step);
            const body = { stepIndex, formValues: st.formValues || {}, vars: st.vars || {} };
            if (st.item !== undefined) body.item = st.item;
            // `index` is a declared server scope root and the loop tracks it,
            // but it was never put in the body: a create_record inside a loop
            // whose column read `index + 1` wrote NaN into every row, while the
            // loop itself iterated perfectly.
            if (st.index !== undefined) body.index = st.index;
            const qs = draft ? '?draft=1' : '';
            let res;
            try {
                res = await authFetch(
                    `${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/actions/${encodeURIComponent(actionId)}/step${qs}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                        // Longer than the server's own AI ceiling, so its message
                        // wins when it has one. This is the backstop for the case
                        // where it does not: a provider adapter that ignores
                        // timeoutMs would otherwise leave the spinner up forever.
                        signal: AbortSignal.timeout(STEP_DEADLINE_MS),
                    },
                );
            } catch (err) {
                if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
                    throw new Error('That took too long and was stopped. Try again, or with fewer documents.');
                }
                throw err;
            }
            let payload = null;
            try { payload = await res.json(); } catch { payload = null; }
            // A quota rejection (409 body or ok:false step result) gets its
            // own actionable copy instead of the raw server error.
            if (payload?.code === 'quota_exceeded') throw new Error(QUOTA_TOAST);
            if (!res.ok) throw new Error(payload?.error || `The step failed (${res.status})`);
            if (payload && payload.ok === false) throw new Error(payload.error || 'The step failed.');
            return payload && payload.result !== undefined ? payload.result : payload;
        };

        const execStep = async (step, st) => {
            if (!step || typeof step.kind !== 'string') return;
            // Server kinds are dispatched from the SET, not from a hand-written
            // case list. The list-and-set used to be maintained separately and
            // drifted (send_email), which turns a step into a silent no-op
            // instead of an error. Driving both off one value makes that class
            // of bug unrepresentable.
            if (SERVER_STEP_KINDS.has(step.kind)) {
                const result = await dispatchServerStep(step, st);
                st.lastResult = result;
                if (typeof step.resultVar === 'string' && step.resultVar) {
                    st.vars = { ...st.vars, [step.resultVar]: result };
                    setVar(step.resultVar, result); // persist beyond this sequence
                }
                if (hasServer) setEntry(actionId, { status: 'running', result, error: null });
                return;
            }
            switch (step.kind) {
                case 'navigate':
                    if (onNavigateRef.current) {
                        onNavigateRef.current(step.screenId, resolveNavParams(step.params, liveScope(st)));
                    }
                    return;
                case 'toast':
                    showToast(step.tone, step.message);
                    return;
                case 'open_url': {
                    const url = String(step.url || '').trim();
                    if (url.toLowerCase().startsWith('https://')) {
                        window.open(url, step.newTab === false ? '_self' : '_blank', 'noopener,noreferrer');
                    }
                    return;
                }
                case 'open_modal':
                    if (step.modalId) openAppModal(step.modalId);
                    return;
                case 'close_modal':
                    if (step.modalId) closeAppModal(step.modalId);
                    return;
                case 'confirm': {
                    const ask = confirmRef.current || defaultConfirm;
                    const ok = await ask(step);
                    if (!ok) throw SEQ_ABORT;
                    return;
                }
                case 'set_variable': {
                    if (typeof step.name === 'string' && step.name) {
                        const { value } = resolveBinding(step.value, liveBag(st));
                        st.vars = { ...st.vars, [step.name]: value };
                        setVar(step.name, value); // persist beyond this sequence
                    }
                    return;
                }
                case 'refresh':
                    // Narrow to the source that changed when the author said
                    // which one. Passing nothing keeps the original "reload
                    // everything" behaviour, which is what a v2.0 definition
                    // (whose only field was the ignored actionId) still gets.
                    if (onRefreshRef.current) {
                        onRefreshRef.current(
                            (step.tableId || step.datasetId)
                                ? { tableId: step.tableId || null, datasetId: step.datasetId || null }
                                : undefined,
                        );
                    }
                    return;
                case 'condition': {
                    const { value } = tryEvaluate(step.expr, liveScope(st));
                    await execSteps(value ? step.then : step.else, st);
                    return;
                }
                case 'switch': {
                    const { value } = tryEvaluate(step.expr, liveScope(st));
                    const cases = Array.isArray(step.cases) ? step.cases : [];
                    const hit = cases.find((c) => c && caseMatches(c.value, value));
                    await execSteps(hit ? hit.steps : step.default, st);
                    return;
                }
                case 'loop': {
                    const { value: src } = resolveBinding(step.source, liveBag(st));
                    const arr = Array.isArray(src) ? src : [];
                    const cap = Number.isInteger(step.maxIterations)
                        ? Math.min(step.maxIterations, MAX_LOOP_ITERATIONS) : MAX_LOOP_ITERATIONS;
                    for (let i = 0; i < arr.length && i < cap; i++) {
                        const outerVars = st.vars || {};
                        const iter = {
                            ...st,
                            item: arr[i],
                            index: i,
                            vars: {
                                ...outerVars,
                                ...(step.itemVar ? { [step.itemVar]: arr[i] } : {}),
                                ...(step.indexVar ? { [step.indexVar]: i } : {}),
                            },
                        };
                        await execSteps(step.steps, iter);
                        // itemVar/indexVar are ITERATION-scoped: whatever the name
                        // held outside the loop is restored, so later steps never
                        // see it pinned to the last row. Other writes carry on.
                        const carried = { ...iter.vars };
                        for (const name of [step.itemVar, step.indexVar]) {
                            if (typeof name !== 'string' || !name) continue;
                            if (Object.prototype.hasOwnProperty.call(outerVars, name)) carried[name] = outerVars[name];
                            else delete carried[name];
                        }
                        st.vars = carried;
                        st.lastResult = iter.lastResult;
                    }
                    return;
                }
                default:
                    return;
            }
        };

        const execSteps = async (list, st) => {
            for (const step of (Array.isArray(list) ? list : [])) {
                if (!aliveRef.current) throw CANCELLED;
                try {
                    await execStep(step, st);
                } catch (e) {
                    if (e === SEQ_ABORT || e === CANCELLED) throw e;
                    // A failure: run the step's optional onError branch (which
                    // handles it, then unwinds), else propagate up to abort.
                    if (step && Array.isArray(step.onError) && step.onError.length) {
                        await execSteps(step.onError, st);
                        throw SEQ_ABORT;
                    }
                    st.error = e?.message || 'The action failed.';
                    throw e;
                }
            }
        };

        try {
            await execSteps(steps, state);
            if (hasServer) setEntry(actionId, { status: 'success', result: state.lastResult, error: null });
            applyEffects(action.onSuccess);
        } catch (e) {
            if (e === SEQ_ABORT) {
                // Declined confirm / handled onError — settle without an error.
                if (hasServer) {
                    setEntry(actionId, state.lastResult !== undefined
                        ? { status: 'success', result: state.lastResult, error: null }
                        : { status: 'idle', result: undefined, error: null });
                }
                return;
            }
            if (e === CANCELLED || !aliveRef.current) return;
            const message = state.error || e?.message || 'The action failed.';
            // A server-touching sequence surfaces the error on the triggering
            // control (status:'error'); every failed sequence also toasts so the
            // abort is never silent. onError effects (if any) apply afterwards.
            if (hasServer) setEntry(actionId, { status: 'error', result: undefined, error: message });
            showToast('danger', message);
            applyEffects(action.onError);
        }
    }, [appId, draft, setEntry, setVar, applyEffects]);

    const runAction = useCallback(async (actionId, opts = {}) => {
        const action = definitionRef.current?.actions?.[actionId];
        if (!action) return;

        // v2 sequences use the coordinator; bare v1 actions keep their exact
        // legacy behaviour so existing call sites and semantics are unchanged.
        if (action.kind === 'sequence') {
            return runSequence(actionId, action, opts);
        }

        switch (action.kind) {
            case 'navigate':
                if (onNavigateRef.current) {
                    const scope = buildScope({
                        actionState: stateRef.current,
                        dataState: dataStateRef.current || {},
                        form: opts.formValues || {},
                        vars: varsRef.current || {},
                        currentUser: currentUserRef.current || null,
                    });
                    onNavigateRef.current(action.screenId, resolveNavParams(action.params, scope));
                }
                return;
            case 'toast':
                showToast(action.tone, action.message);
                return;
            case 'open_url': {
                const url = String(action.url || '').trim();
                if (!url.toLowerCase().startsWith('https://')) return;
                window.open(url, action.newTab === false ? '_self' : '_blank', 'noopener,noreferrer');
                return;
            }
            case 'open_modal':
                if (action.modalId) openAppModal(action.modalId);
                return;
            case 'close_modal':
                if (action.modalId) closeAppModal(action.modalId);
                return;
            case 'run_automation':
                return runAutomationAction(actionId, action, opts);
            // Native AI and email actions are server steps — run them through the
            // sequence coordinator (a bare action normalizes to a 1-step
            // sequence, which dispatches to /step and threads the result into
            // resultVar).
            case 'ai_extract':
            case 'ai_generate':
            case 'kb_query':
            case 'send_email':
                return runSequence(actionId, action, opts);
            default:
                return;
        }
    }, [runSequence, runAutomationAction]);

    return { actionState, runAction, vars, setVar };
}
