import { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

const SKILLS_API = `${API_BASE}/api/skills`;

let cache = null;
const listeners = new Set();

const notify = () => listeners.forEach(l => l(cache));

async function fetchSkills() {
    const res = await authFetch(SKILLS_API);
    if (!res.ok) {
        if (res.status === 403 || res.status === 404) return []; // feature disabled
        throw new Error('Failed to load skills');
    }
    return res.json();
}

export function useSkills() {
    const [skills, setSkills] = useState(cache || []);
    const [loading, setLoading] = useState(cache === null);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchSkills();
            cache = data;
            notify();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const listener = (next) => setSkills(next || []);
        listeners.add(listener);
        if (cache === null) refresh();
        else setSkills(cache);
        return () => { listeners.delete(listener); };
    }, [refresh]);

    const create = useCallback(async (form) => {
        const res = await authFetch(SKILLS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to create skill');
        }
        const created = await res.json();
        await refresh();
        return created;
    }, [refresh]);

    const update = useCallback(async (id, form) => {
        const res = await authFetch(`${SKILLS_API}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to update skill');
        }
        await refresh();
    }, [refresh]);

    const remove = useCallback(async (id) => {
        const res = await authFetch(`${SKILLS_API}/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to delete skill');
        }
        await refresh();
    }, [refresh]);

    return { skills, loading, error, refresh, create, update, remove };
}
