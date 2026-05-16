// One-shot async runner — replaces the ad-hoc
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
// pattern around save/delete/submit handlers that don't warrant a
// React Query mutation (no caching, no invalidation, just "run this and
// show a spinner").
//
// Usage:
//   const { run, loading, error, data } = useAsyncAction(async (args) => {
//       const r = await authFetch(...);
//       if (!r.ok) throw new Error('Save failed');
//       return r.json();
//   });
//   <button disabled={loading} onClick={() => run(payload)}>Save</button>
//   {error && <p className="text-red-500">{error.message}</p>}
//
// `run` always resolves (never throws to the caller) — failures land in
// `error`. The component decides what to render.

import { useCallback, useRef, useState } from 'react';

export default function useAsyncAction(fn) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    // Keep latest fn in a ref so changing identity doesn't recreate `run`.
    const fnRef = useRef(fn);
    fnRef.current = fn;

    const run = useCallback(async (...args) => {
        setLoading(true);
        setError(null);
        try {
            const result = await fnRef.current(...args);
            setData(result);
            setLoading(false);
            return { ok: true, data: result };
        } catch (e) {
            setError(e);
            setLoading(false);
            return { ok: false, error: e };
        }
    }, []);

    const reset = useCallback(() => {
        setLoading(false);
        setError(null);
        setData(null);
    }, []);

    return { run, loading, error, data, reset };
}
