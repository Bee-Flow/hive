// Shared state/API engine for the Google Workspace attachment pickers.
// Replaces the ~150-line block that was copy-pasted between GmailPicker
// and GoogleDrivePicker:
//
//   - connection status check against /api/integrations/<service>/status
//   - debounced search + pageToken pagination of a remote item list
//   - multi-select via a Set of item ids
//   - "attach": export each selected item and hand the results to chat
//   - OAuth connect popup that re-checks status once it closes
//
// Endpoints, the response array key, and the per-item export logic are
// passed via options so each picker stays a thin config wrapper (see
// GoogleWorkspacePickerModal.jsx for the matching UI shell).
//
// Usage:
//   const picker = useGoogleWorkspacePicker({
//       isOpen, onClose, onFilesSelected, apiBase,
//       statusPath: '/api/integrations/gmail/status',
//       listPath: '/api/integrations/gmail/messages',
//       listKey: 'messages',
//       loadErrorMessage: 'Failed to load messages',
//       authWindowName: 'gmail-auth',
//       exportItem: async (id, item) => ({ name, type, size, content, source }),
//   });

import { useCallback, useEffect, useState } from 'react';
import useDebouncedValue from './useDebouncedValue';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = '20';

export default function useGoogleWorkspacePicker({
    isOpen,
    onClose,
    onFilesSelected,
    apiBase = '',
    statusPath,
    listPath,
    listKey,
    loadErrorMessage,
    authWindowName,
    exportItem,
}) {
    const [status, setStatus] = useState({ connected: false, configured: false, user: null });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState(null);
    const [nextPageToken, setNextPageToken] = useState(null);

    const checkStatus = useCallback(async () => {
        try {
            const res = await fetch(`${apiBase}${statusPath}`, { credentials: 'include' });
            const data = await res.json();
            setStatus(data);
            return data;
        } catch (err) {
            console.error('Google Workspace status check failed:', err);
            return { connected: false, configured: false };
        }
    }, [apiBase, statusPath]);

    const loadItems = useCallback(async (query = '', append = false) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query) params.set('query', query);
            if (append && nextPageToken) params.set('pageToken', nextPageToken);
            params.set('pageSize', PAGE_SIZE);

            const res = await fetch(`${apiBase}${listPath}?${params}`, { credentials: 'include' });
            if (!res.ok) {
                const err = await res.json();
                if (err.code === 'NOT_CONNECTED') {
                    setStatus(prev => ({ ...prev, connected: false }));
                    return;
                }
                throw new Error(err.error || loadErrorMessage);
            }
            const data = await res.json();
            setItems(prev => append ? [...prev, ...data[listKey]] : data[listKey]);
            setNextPageToken(data.nextPageToken);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [apiBase, listPath, listKey, loadErrorMessage, nextPageToken]);

    // On open: refresh connection status, load the first page, reset selection.
    useEffect(() => {
        if (isOpen) {
            checkStatus().then(s => {
                if (s.connected) loadItems();
            });
            setSelectedIds(new Set());
            setSearchQuery('');
        }
        // checkStatus/loadItems intentionally omitted: this must only fire on
        // open/close, not when nextPageToken recreates loadItems.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Debounced remote search.
    const debouncedQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);
    useEffect(() => {
        if (!status.connected || !isOpen) return;
        loadItems(debouncedQuery);
        // loadItems/isOpen intentionally omitted (same reason as above).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQuery, status.connected]);

    const toggleItem = useCallback((itemId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    }, []);

    const loadMore = useCallback(() => loadItems(searchQuery, true), [loadItems, searchQuery]);

    const handleAttach = useCallback(async () => {
        if (selectedIds.size === 0) return;
        setExporting(true);
        setError(null);

        try {
            const results = [];
            for (const itemId of selectedIds) {
                const item = items.find(i => i.id === itemId);
                results.push(await exportItem(itemId, item));
            }
            onFilesSelected(results);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setExporting(false);
        }
    }, [selectedIds, items, exportItem, onFilesSelected, onClose]);

    const handleConnect = useCallback(async () => {
        // BFSF-255: use the Google Workspace CONNECT flow, not the SSO LOGIN
        // flow. /auth/login/google replaces the whole session and — for a
        // password account whose email is not a Google account — silently
        // creates a NEW user. The connector flow authorises Google for the
        // CURRENT account and stores tokens in the encrypted vault.
        const width = 500, height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        let popup = null;
        try {
            const res = await fetch(`${apiBase}/api/integrations/google/auth-url`, { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.url) throw new Error(data.error || 'google_not_configured');
            popup = window.open(
                data.url,
                authWindowName,
                `width=${width},height=${height},left=${left},top=${top}`
            );
        } catch (err) {
            console.error('[GoogleWorkspacePicker] connect failed:', err.message);
            return;
        }

        const interval = setInterval(() => {
            if (popup?.closed) {
                clearInterval(interval);
                checkStatus().then(s => {
                    if (s.connected) loadItems();
                });
            }
        }, 500);
    }, [apiBase, authWindowName, checkStatus, loadItems]);

    return {
        status,
        items,
        loading,
        searchQuery,
        setSearchQuery,
        selectedIds,
        toggleItem,
        exporting,
        error,
        nextPageToken,
        loadMore,
        handleAttach,
        handleConnect,
    };
}
