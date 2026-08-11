// AI-translate state + submit handler — replaces the block that was
// open-coded three times in the admin Languages panel (the GUI-strings,
// system-prompts and email-templates sub-panels each carried their own copy):
//
//   const [aiTranslating, setAiTranslating] = useState(false);
//   const [aiTier, setAiTier] = useState('fast');
//   const [aiResult, setAiResult] = useState(null);
//   const handleAiTranslate = useCallback(async () => {
//       setAiTranslating(true); setAiResult(null);
//       try { const r = await authFetch(...POST { modelTier }...).json();
//             if (r.success) { setAiResult(r); reload(); setTimeout(clear, 8000); }
//             else setAiResult({ error: r.error || 'Translation failed' }); }
//       catch (err) { setAiResult({ error: err.message }); }
//       setAiTranslating(false);
//   }, [...]);
//
// The three copies differed only in which endpoint(s) they hit and which
// loader refreshes the view afterwards, so those bits are injected:
//   request   async (tier) => parsed `{ success, message?, error? }` result
//   onReload  called once after a successful translate (re-fetch the panel)
//
// Usage:
//   const ai = useAiTranslate({
//       request: (tier) => translateRequest(`${API}/${locale}/ai-translate-prompts`, tier),
//       onReload: fetchData,
//   });
//   <AiTranslateControl tier={ai.tier} onTierChange={ai.setTier}
//       translating={ai.translating} missing={stats.missing} onTranslate={ai.run} />
//   <AiTranslateResult result={ai.result} />

import { useCallback, useRef, useState } from 'react';
import { authFetch } from '../utils/helpers';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Standard single-endpoint translate call (system prompts + email templates):
// POST `{ modelTier }` and return the parsed JSON body.
export async function translateRequest(url, tier) {
    const res = await authFetch(url, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ modelTier: tier }),
    });
    return res.json();
}

export default function useAiTranslate({ request, onReload, initialTier = 'fast', clearAfterMs = 8000 } = {}) {
    const [tier, setTier] = useState(initialTier);
    const [translating, setTranslating] = useState(false);
    const [result, setResult] = useState(null);

    // Keep the injected callbacks in refs so callers can pass inline closures
    // without re-creating `run` (and re-rendering) on every parent render.
    const requestRef = useRef(request);
    requestRef.current = request;
    const reloadRef = useRef(onReload);
    reloadRef.current = onReload;

    const run = useCallback(async () => {
        setTranslating(true);
        setResult(null);
        try {
            const res = await requestRef.current(tier);
            if (res?.success) {
                setResult(res);
                reloadRef.current?.();
                if (clearAfterMs) setTimeout(() => setResult(null), clearAfterMs);
            } else {
                setResult({ error: res?.error || 'Translation failed' });
            }
        } catch (err) {
            setResult({ error: err.message });
        }
        setTranslating(false);
    }, [tier, clearAfterMs]);

    return { tier, setTier, translating, result, run };
}
