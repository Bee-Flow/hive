import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

const IconPackContext = createContext(null);
const CACHE_PREFIX = 'beeflow_iconpack_';

export function IconPackProvider({ children }) {
    const [icons, setIcons] = useState({});
    const [activePackId, setActivePackId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const loadedPackRef = useRef(null);

    const loadIconPack = useCallback(async (packId) => {
        if (!packId) {
            setIcons({});
            loadedPackRef.current = null;
            return;
        }

        // Check cache first
        const cached = localStorage.getItem(`${CACHE_PREFIX}${packId}`);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.data) {
                    setIcons(parsed.data);
                    loadedPackRef.current = packId;
                }
            } catch { }
        }

        setIsLoading(true);
        try {
            // First fetch user's active configurations
            const res = await authFetch(`${API_BASE}/api/icons`);
            if (res.ok) {
                const data = await res.json();
                const targetPack = data.packs.find(p => p.id === packId);
                if (targetPack) {
                    setIcons(targetPack.icons || {});
                    loadedPackRef.current = packId;
                    localStorage.setItem(`${CACHE_PREFIX}${packId}`, JSON.stringify({
                        data: targetPack.icons,
                        timestamp: Date.now(),
                    }));
                }
            }
        } catch (err) {
            console.warn('[IconPack] Failed to load icon pack:', err.message);
        }
        setIsLoading(false);
    }, []);

    // Initial load to check which pack is active
    useEffect(() => {
        let mounted = true;
        const fetchInitial = async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/icons`);
                if (res.ok && mounted) {
                    const data = await res.json();
                    if (data.activeIconPackId) {
                        setActivePackId(data.activeIconPackId);
                    }
                }
            } catch (err) { }
        };
        fetchInitial();
        return () => { mounted = false; };
    }, []);

    // Reload pack when activeId changes
    useEffect(() => {
        if (activePackId && activePackId !== loadedPackRef.current) {
            loadIconPack(activePackId);
        } else if (!activePackId) {
            setIcons({});
            loadedPackRef.current = null;
        }
    }, [activePackId, loadIconPack]);

    const setIconPack = useCallback(async (newPackId) => {
        try {
            const res = await authFetch(`${API_BASE}/api/icons/${newPackId || 'default'}/activate`, {
                method: 'POST'
            });
            if (res.ok) {
                setActivePackId(newPackId);
            }
        } catch (err) {
            console.error('[IconPack] Could not activate pack', err);
        }
    }, []);

    /**
     * getCustomIcon(key)
     * Returns either null (use default), { type: 'emoji', value: '😀' }, or { type: 'image', value: 'url...' }
     */
    const getCustomIcon = useCallback((key) => {
        const item = icons[key];
        if (!item) return null;
        return item; // Ex: { type: 'image', value: '/api/icons/data/...' } or { type: 'emoji', value: '🌟' }
    }, [icons]);

    const value = { getCustomIcon, activePackId, setIconPack, isLoading, reload: () => loadIconPack(activePackId) };

    return (
        <IconPackContext.Provider value={value}>
            {children}
        </IconPackContext.Provider>
    );
}

export function useIconPack() {
    const ctx = useContext(IconPackContext);
    if (!ctx) {
        return {
            getCustomIcon: () => null,
            activePackId: null,
            setIconPack: async () => {},
            isLoading: false,
            reload: () => {}
        };
    }
    return ctx;
}

export default useIconPack;
