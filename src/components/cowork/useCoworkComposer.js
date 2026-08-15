/**
 * Shared state for "turn this brief into work": when it runs, how often, and
 * which agent does it. Used by both entry points so they behave identically —
 * the Cowork switch in the chat composer and the Cowork page's own composer.
 *
 * The user types one sentence. On send, the server reads that sentence and
 * works out the title, the runnable instruction and the schedule
 * ("elke ochtend" → daily at 08:00), so nobody has to translate their own
 * request into three chips before anything happens.
 *
 * Whatever the user set by hand wins. Each chip records that it was touched,
 * and a touched chip is never overwritten by the composer — the AI fills in
 * the blanks, it does not overrule a decision the user already made.
 */
import { useCallback, useEffect, useState } from 'react';
import { useEntitlements } from '../EntitlementsContext';
import { composeCowork, createCowork, listCoworkAgents } from './coworkApi';
import {
    buildCoworkPayload, titleFromBrief, describeSchedule, resolveWhen,
    nextOccurrence, toDateInput, toTimeInput,
} from './coworkSchedule';

const DEFAULT_WHEN = { presetId: 'now', date: '', time: '' };

export default function useCoworkComposer({ enabled = true, onCreated } = {}) {
    const [when, setWhenState] = useState(DEFAULT_WHEN);
    const [repeatInterval, setRepeatState] = useState('');
    const [agentId, setAgentState] = useState('');
    // Which apps this one item may touch. null until the user opens the Apps
    // picker — that keeps "I didn't choose" (inherit the workspace-wide list)
    // distinct from "I chose nothing" (an empty array, a real answer).
    const [enabledApps, setEnabledApps] = useState(null);
    const [agents, setAgents] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    // Which chips the user (or the surrounding chat) decided for themselves.
    const [touched, setTouched] = useState({ when: false, repeat: false, agent: false });

    const ent = useEntitlements();
    // Handing work to an agent is the same beta the server gates POST on — no
    // point offering the picker if the create call would 403.
    const canPickAgent = !!ent && !ent.loading && typeof ent.can === 'function' && ent.can('agent_routines');

    useEffect(() => {
        if (!enabled || !canPickAgent) { setAgents([]); return undefined; }
        let cancelled = false;
        listCoworkAgents()
            .then(list => { if (!cancelled) setAgents(list); })
            .catch(() => { if (!cancelled) setAgents([]); });
        return () => { cancelled = true; };
    }, [enabled, canPickAgent]);

    // Every setter the UI calls marks its chip as the user's choice. Seeding
    // the agent from an agent chat goes through setAgentId too, and that is
    // deliberate: if you are talking to an agent and delegate something, you
    // mean that agent — the composer must not reassign it.
    const setWhen = useCallback((value) => {
        setWhenState(value);
        setTouched(t => (t.when ? t : { ...t, when: true }));
    }, []);
    const setRepeatInterval = useCallback((value) => {
        setRepeatState(value);
        setTouched(t => (t.repeat ? t : { ...t, repeat: true }));
    }, []);
    const setAgentId = useCallback((value) => {
        setAgentState(value);
        setTouched(t => (t.agent ? t : { ...t, agent: true }));
    }, []);

    const reset = useCallback(() => {
        setWhenState(DEFAULT_WHEN);
        setRepeatState('');
        setAgentState('');
        setEnabledApps(null);
        setTouched({ when: false, repeat: false, agent: false });
        setError(null);
    }, []);

    // 'custom' with empty inputs is the one unschedulable state — block send
    // rather than silently falling back to "now".
    const scheduleReady = !!resolveWhen(when.presetId, when);

    const submit = useCallback(async (brief, { modelTier } = {}) => {
        const text = String(brief || '').trim();
        if (!text || submitting) return null;

        setSubmitting(true);
        setError(null);
        try {
            // A composer failure must never cost the user their work — fall
            // back to their own words, which is what they got before this
            // existed. The server already degrades this way; this catch covers
            // the network too.
            let spec = null;
            try {
                spec = await composeCowork(text);
            } catch (_) { spec = null; }

            const useRepeat = touched.repeat ? repeatInterval : (spec?.repeatInterval || '');
            const useAgent = touched.agent ? agentId : (spec?.agentId || '');
            const useDays = touched.when ? null : (spec?.daysOfWeek || null);

            // A composed time becomes a concrete first run: the next one that
            // has not happened yet, so a daily 08:00 job created at 09:00
            // starts tomorrow rather than firing immediately.
            let useWhen = when;
            if (!touched.when && spec?.timeOfDay) {
                const first = nextOccurrence(spec.timeOfDay, spec.daysOfWeek);
                if (first) {
                    useWhen = { presetId: 'custom', date: toDateInput(first), time: toTimeInput(first) };
                }
            }

            const payload = buildCoworkPayload({
                title: spec?.title || titleFromBrief(text),
                prompt: spec?.prompt || text,
                presetId: useWhen.presetId,
                date: useWhen.date,
                time: useWhen.time,
                repeatInterval: useRepeat,
                daysOfWeek: useDays,
                timeOfDay: !touched.when ? (spec?.timeOfDay || null) : null,
                // An agent brings its own model, so the tier is only meaningful
                // for agent-less work (the server ignores it otherwise).
                modelTier: useAgent ? 'auto' : modelTier,
                agentId: useAgent,
                enabledApps,
            });
            if (!payload) { setError('Pick a date and time first.'); return null; }

            const created = await createCowork(payload);
            reset();
            if (onCreated) onCreated(created, payload, spec);
            return created;
        } catch (err) {
            setError(err.message || 'Could not create this work');
            return null;
        } finally {
            setSubmitting(false);
        }
    }, [when, repeatInterval, agentId, enabledApps, touched, submitting, reset, onCreated]);

    return {
        when, setWhen,
        repeatInterval, setRepeatInterval,
        agentId, setAgentId,
        enabledApps, setEnabledApps,
        agents,
        touched,
        submitting, error, setError,
        scheduleReady,
        summary: describeSchedule({ presetId: when.presetId, runAt: resolveWhen(when.presetId, when), repeatInterval }),
        submit, reset,
    };
}
