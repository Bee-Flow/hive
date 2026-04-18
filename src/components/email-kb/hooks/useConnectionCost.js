import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../utils';

/**
 * Fetches the 30-day rolling cost estimate for a connection via
 * GET /api/email-kb/connections/:id/cost. Refetch manually after a sync completes.
 */
export default function useConnectionCost(connectionId) {
    const [cost, setCost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const aliveRef = useRef(true);

    const refetch = useCallback(async () => {
        if (!connectionId) return;
        setLoading(true);
        try {
            const data = await api(`/connections/${connectionId}/cost`);
            if (!aliveRef.current) return;
            setCost(typeof data.cost30dUsd === 'number' ? data.cost30dUsd : null);
            setError(null);
        } catch (err) {
            if (!aliveRef.current) return;
            setError(err.message);
            setCost(null);
        } finally {
            if (aliveRef.current) setLoading(false);
        }
    }, [connectionId]);

    useEffect(() => {
        aliveRef.current = true;
        refetch();
        return () => { aliveRef.current = false; };
    }, [refetch]);

    return { cost, loading, error, refetch };
}
